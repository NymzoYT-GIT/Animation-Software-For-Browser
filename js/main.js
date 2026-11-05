
import * as THREE from "three";
import { createModelingSystem } from "./modeling.js";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { ColladaLoader } from "three/addons/loaders/ColladaLoader.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { ThreeMFLoader } from "three/addons/loaders/3MFLoader.js";
import { USDZLoader } from "three/addons/loaders/USDZLoader.js";

// ==========================================
// SCENE
// ==========================================

const scene = new THREE.Scene();
scene.background = new THREE.Color("#202127");

// CAMERA
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const cameraTarget = new THREE.Vector3(0, 0, 0);
camera.position.set(5, 5, 7);
camera.lookAt(cameraTarget);

// RENDERER
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.domElement.style.position = "fixed";
renderer.domElement.style.inset = "0";
renderer.domElement.style.width = "100%";
renderer.domElement.style.height = "100%";
renderer.domElement.style.zIndex = "0";

document.body.appendChild(renderer.domElement);

// ==========================================
// CAMERA CONTROLS
// ==========================================

const orbitControls = { enabled: false };

let cameraTheta = Math.atan2(5, 7);
let cameraPhi = Math.acos(5 / Math.sqrt(99));
let cameraDistance = Math.sqrt(99);

function updateCamera() {
  cameraPhi = THREE.MathUtils.clamp(
    cameraPhi,
    0.05,
    Math.PI - 0.05
  );

  cameraDistance = THREE.MathUtils.clamp(
    cameraDistance,
    1,
    100
  );

  camera.position.set(
    cameraTarget.x +
      cameraDistance * Math.sin(cameraPhi) * Math.sin(cameraTheta),
    cameraTarget.y +
      cameraDistance * Math.cos(cameraPhi),
    cameraTarget.z +
      cameraDistance * Math.sin(cameraPhi) * Math.cos(cameraTheta)
  );

  camera.lookAt(cameraTarget);
}

let previousPointer = null;

renderer.domElement.addEventListener("pointermove", event => {
  if (!event.altKey) {
    previousPointer = null;
    return;
  }

  if (!previousPointer) {
    previousPointer = {
      x: event.clientX,
      y: event.clientY
    };
    return;
  }

  const dx = event.clientX - previousPointer.x;
  const dy = event.clientY - previousPointer.y;

  previousPointer = {
    x: event.clientX,
    y: event.clientY
  };

  if (event.ctrlKey) {
    cameraTheta -= dx * 0.006;
    cameraPhi -= dy * 0.006;
    updateCamera();
  } else {
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();

    camera.updateMatrixWorld();

    right.setFromMatrixColumn(camera.matrix, 0);
    up.setFromMatrixColumn(camera.matrix, 1);

    const speed = cameraDistance * 0.0015;

    cameraTarget.addScaledVector(right, -dx * speed);
    cameraTarget.addScaledVector(up, dy * speed);

    updateCamera();
  }
});

renderer.domElement.addEventListener("pointerleave", () => {
  previousPointer = null;
});

renderer.domElement.addEventListener("contextmenu", event => {
  event.preventDefault();
});

// ==========================================
// LIGHTING
// ==========================================

scene.add(new THREE.AmbientLight("#ffffff", 1.5));

const sunlight = new THREE.DirectionalLight("#ffffff", 3);
sunlight.position.set(5, 10, 5);
sunlight.castShadow = true;
scene.add(sunlight);

// GRID
const grid = new THREE.GridHelper(
  20,
  20,
  "#777777",
  "#444444"
);

scene.add(grid);

// ==========================================
// HIERARCHY
// ==========================================

const objectList = document.getElementById("object-list");
const selectedLabel = document.getElementById("selected-object");
const nameInput = document.getElementById("object-name");
const renameButton = document.getElementById("rename-object");

let modeling = null;

function updateHierarchy() {
  if (!modeling || !objectList) return;

  const objects = modeling.getObjects();
  const selected = modeling.getSelected();

  objectList.replaceChildren();

  if (objects.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = "No objects";
    objectList.appendChild(empty);
  }

  objects.forEach(object => {
    const row = document.createElement("button");

    row.type = "button";
    row.className = "object-row";
    row.textContent = "◇  " + object.name;

    row.classList.toggle("selected", object === selected);

    row.addEventListener("click", () => {
      modeling.selectObject(object);
    });

    objectList.appendChild(row);
  });

  if (selectedLabel) {
    selectedLabel.textContent = selected
      ? selected.name
      : "Nothing selected";
  }

  if (nameInput) {
    nameInput.value = selected ? selected.name : "";
    nameInput.disabled = !selected;
  }

  if (renameButton) {
    renameButton.disabled = !selected;
  }
}

// RENAME OBJECT
if (renameButton) {
  renameButton.addEventListener("click", () => {
    const selected = modeling?.getSelected();
    const name = nameInput.value.trim();

    if (!selected || !name) return;

    selected.name = name;
    updateHierarchy();
  });
}

if (nameInput) {
  nameInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      renameButton.click();
      nameInput.blur();
    }
  });
}

// ==========================================
// HISTORY / UNDO / REDO
// ==========================================

let history = [];
let historyIndex = -1;
let transformDragBefore = null;

function captureState() {
  return modeling.getObjects().map(object => ({
    object,
    position: object.position.clone(),
    rotation: object.rotation.clone(),
    scale: object.scale.clone()
  }));
}

function commitHistory() {
  const state = captureState();

  history = history.slice(0, historyIndex + 1);
  history.push(state);

  if (history.length > 50) history.shift();

  historyIndex = history.length - 1;
}

function restoreHistory(index) {
  if (index < 0 || index >= history.length) return;

  modeling.deselectObject();

  modeling.getObjects().forEach(object => {
    scene.remove(object);
  });

  history[index].forEach(item => {
    scene.add(item.object);
    item.object.position.copy(item.position);
    item.object.rotation.copy(item.rotation);
    item.object.scale.copy(item.scale);
  });

  historyIndex = index;
  updateHierarchy();
}

function undo() {
  if (historyIndex > 0) {
    restoreHistory(historyIndex - 1);
  }
}

function redo() {
  if (historyIndex < history.length - 1) {
    restoreHistory(historyIndex + 1);
  }
}

// ==========================================
// MODELING SYSTEM
// ==========================================

modeling = createModelingSystem({
  scene,
  camera,
  renderer,
  orbitControls,

  onSelectionChange() {
    updateHierarchy();
  },

  onTransformStart() {
    transformDragBefore = captureState();
  },

  onTransformEnd() {
    if (transformDragBefore) {
      commitHistory();
      transformDragBefore = null;
    }
  }
});

// CONNECT MODEL CREATION TO HISTORY
["addCube", "addSphere", "addCylinder", "addPlane"].forEach(method => {
  const original = modeling[method];

  modeling[method] = function(...args) {
    const result = original.apply(modeling, args);
    commitHistory();
    updateHierarchy();
    return result;
  };
});

// DELETE HISTORY
const originalDelete = modeling.deleteSelected;

modeling.deleteSelected = function() {
  if (!modeling.getSelected()) return;

  originalDelete.call(modeling);
  commitHistory();
  updateHierarchy();
};

// STARTER OBJECT
modeling.addCube();

// ==========================================
// MODEL IMPORTER
// ==========================================

const importButton = document.getElementById("import-model-button");
const fileInput = document.getElementById("model-file-input");

function createLoadingManager(files) {
  const manager = new THREE.LoadingManager();
  const fileURLs = new Map();

  files.forEach(file => {
    fileURLs.set(
      file.name.toLowerCase(),
      URL.createObjectURL(file)
    );
  });

  manager.setURLModifier(url => {
    const cleanURL = decodeURIComponent(
      url.split("?")[0].split("#")[0]
    );

    const filename = cleanURL.split("/").pop().toLowerCase();

    return fileURLs.get(filename) || url;
  });

  return {
    manager,

    cleanup() {
      fileURLs.forEach(url => URL.revokeObjectURL(url));
    }
  };
}

// ADD IMPORTED MODEL
function addImportedModel(object, filename) {
  const name = filename.replace(/\.[^/.]+$/, "");

  const wrapper = new THREE.Group();

  wrapper.name = name;
  wrapper.add(object);

  wrapper.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(wrapper);

  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3());

    wrapper.position.sub(center);

    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);

    if (maxDimension > 0) {
      const factor = 3 / maxDimension;
      wrapper.scale.setScalar(factor);
    }
  }

  modeling.addImportedObject(wrapper, name);

  commitHistory();
  updateHierarchy();

  console.log("Imported model:", filename);
}

// LOAD MODEL
async function loadModel(file, files) {
  const extension = file.name.split(".").pop().toLowerCase();

  const managerData = createLoadingManager(files);
  const manager = managerData.manager;

  try {
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder().decode(buffer);

    let object;

    switch (extension) {
      case "glb":
      case "gltf": {
        const loader = new GLTFLoader(manager);

        const gltf = await new Promise((resolve, reject) => {
          loader.parse(
            buffer,
            "",
            resolve,
            reject
          );
        });

        object = gltf.scene;
        break;
      }

      case "obj": {
        const loader = new OBJLoader(manager);
        object = loader.parse(text);
        break;
      }

      case "fbx": {
        const loader = new FBXLoader(manager);
        object = loader.parse(buffer, "");
        break;
      }

      case "stl": {
        const loader = new STLLoader(manager);
        const geometry = loader.parse(buffer);

        object = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: "#b5b5c5",
            roughness: 0.6
          })
        );

        break;
      }

      case "dae": {
        const loader = new ColladaLoader(manager);
        const result = loader.parse(text, "");

        object = result.scene;
        break;
      }

      case "ply": {
        const loader = new PLYLoader(manager);
        const geometry = loader.parse(buffer);

        geometry.computeVertexNormals();

        object = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: geometry.hasAttribute("color")
              ? "#ffffff"
              : "#b5b5c5",
            vertexColors: geometry.hasAttribute("color"),
            roughness: 0.7
          })
        );

        break;
      }

      case "3mf": {
        const loader = new ThreeMFLoader(manager);
        object = loader.parse(buffer);
        break;
      }

      case "usdz": {
        const loader = new USDZLoader(manager);
        object = loader.parse(buffer);
        break;
      }

      default:
        throw new Error("Unsupported model format: " + extension);
    }

    if (!object) {
      throw new Error("The model did not contain a usable scene.");
    }

    addImportedModel(object, file.name);

  } catch (error) {
    console.error("Model import failed:", error);

    alert(
      "Could not import " + file.name +
      ". Check the file format and any required companion files."
    );

  } finally {
    managerData.cleanup();
  }
}

// IMPORT BUTTON
if (importButton && fileInput) {
  importButton.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", async () => {
    const files = Array.from(fileInput.files || []);

    if (!files.length) return;

    for (const file of files) {
      await loadModel(file, files);
    }

    fileInput.value = "";
  });
}

// ==========================================
// ANIMATION ENGINE
// ==========================================

// Each object gets its own collection of keyframes.
const animationData = new Map();
let selectedKeyframe = null;

let currentFrame = 1;
let isPlaying = false;
let lastPlaybackTime = 0;
let playbackAccumulator = 0;

const currentFrameDisplay = document.getElementById("current-frame");
const previousFrameButton = document.getElementById("previous-frame");
const nextFrameButton = document.getElementById("next-frame");
const addKeyframeButton = document.getElementById("add-keyframe");
const playButton = document.getElementById("play-animation");
const startFrameInput = document.getElementById("start-frame");
const endFrameInput = document.getElementById("end-frame");
const fpsInput = document.getElementById("animation-fps");
const timelineTrack = document.getElementById("timeline-track");

function getStartFrame() {
  return Math.max(1, Number(startFrameInput?.value) || 1);
}

function getEndFrame() {
  return Math.max(
    getStartFrame(),
    Number(endFrameInput?.value) || 120
  );
}

function getFPS() {
  return THREE.MathUtils.clamp(
    Number(fpsInput?.value) || 24,
    1,
    120
  );
}

// Save an object's transform at the current frame.
function addKeyframe() {
  const object = modeling.getSelected();

  if (!object) {
    console.log("Select an object before adding a keyframe.");
    return;
  }

  if (!animationData.has(object)) {
    animationData.set(object, new Map());
  }

  const objectFrames = animationData.get(object);

  objectFrames.set(currentFrame, {
    position: object.position.clone(),
    rotation: object.rotation.clone(),
    scale: object.scale.clone()
  });

  updateKeyframeDisplay();

  console.log(
    "Keyframe added:",
    object.name,
    "Frame:",
    currentFrame
  );
}

// Interpolate between two values.
function interpolateVector(a, b, amount) {
  return a.clone().lerp(b, amount);
}

function interpolateRotation(a, b, amount) {
  return new THREE.Euler(
    THREE.MathUtils.lerp(a.x, b.x, amount),
    THREE.MathUtils.lerp(a.y, b.y, amount),
    THREE.MathUtils.lerp(a.z, b.z, amount),
    a.order
  );
}

// Apply the animation at a particular frame.
function applyAnimationFrame(frame) {
  animationData.forEach((frames, object) => {
    if (!object.parent) return;

    const sortedFrames = Array.from(frames.keys()).sort(
      (a, b) => a - b
    );

    if (sortedFrames.length === 0) return;

    let before = sortedFrames[0];
    let after = sortedFrames[sortedFrames.length - 1];

    for (const key of sortedFrames) {
      if (key <= frame) before = key;
      if (key >= frame) {
        after = key;
        break;
      }
    }

    const first = frames.get(before);
    const second = frames.get(after);

    let amount = 0;

    if (before !== after) {
      amount = (frame - before) / (after - before);
    }

    object.position.copy(
      interpolateVector(first.position, second.position, amount)
    );

    object.rotation.copy(
      interpolateRotation(first.rotation, second.rotation, amount)
    );

    object.scale.copy(
      interpolateVector(first.scale, second.scale, amount)
    );
  });
}

// Update the frame display.
function updateFrameDisplay() {
  if (currentFrameDisplay) {
    currentFrameDisplay.textContent = "Frame " + currentFrame;
  }

  if (timelineTrack) {
    timelineTrack.dataset.currentFrame = currentFrame;
  }

  updatePlayhead();
}

// Change the current frame.
function setCurrentFrame(frame) {
  currentFrame = THREE.MathUtils.clamp(
    Math.round(frame),
    getStartFrame(),
    getEndFrame()
  );

  applyAnimationFrame(currentFrame);
  updateFrameDisplay();
}

function previousFrame() {
  stopPlayback();
  setCurrentFrame(currentFrame - 1);
}

function nextFrame() {
  stopPlayback();
  setCurrentFrame(currentFrame + 1);
}

// ==========================================
// TIMELINE VISUALS
// ==========================================

function updatePlayhead() {
  if (!timelineTrack) return;

  const oldPlayhead = timelineTrack.querySelector(".timeline-playhead");

  if (oldPlayhead) oldPlayhead.remove();

  const playhead = document.createElement("div");

  playhead.className = "timeline-playhead";

  const start = getStartFrame();
  const end = getEndFrame();
  const percentage = end === start
    ? 0
    : ((currentFrame - start) / (end - start)) * 100;

  playhead.style.position = "absolute";
  playhead.style.left = percentage + "%";
  playhead.style.top = "-2px";
  playhead.style.bottom = "0";
  playhead.style.width = "2px";
  playhead.style.background = "#ffb347";
  playhead.style.pointerEvents = "none";
  playhead.style.zIndex = "3";

  timelineTrack.appendChild(playhead);
}


function renderFrameMarkers() {
  if (!timelineTrack) return;

  timelineTrack.querySelectorAll(".frame-marker").forEach(marker => {
    marker.remove();
  });

  const start = getStartFrame();
  const end = getEndFrame();
  const range = end - start;

  // Choose a readable marker interval.
  const step = range <= 20 ? 1 :
    range <= 60 ? 5 :
    range <= 120 ? 10 :
    range <= 300 ? 20 : 50;

  const frames = [start];

  for (let frame = Math.ceil(start / step) * step;
       frame < end;
       frame += step) {
    if (frame > start) frames.push(frame);
  }

  if (end !== start) frames.push(end);

  frames.forEach(frame => {
    const marker = document.createElement("div");

    marker.className = "frame-marker";
    marker.textContent = frame;
    marker.style.position = "absolute";
    marker.style.left =
      ((frame - start) / (end - start || 1) * 100) + "%";
    marker.style.top = "10px";
    marker.style.transform = "translateX(-50%)";
    marker.style.pointerEvents = "none";

    timelineTrack.appendChild(marker);
  });
}


function updateKeyframeDisplay() {
  if (!timelineTrack) return;

  timelineTrack.querySelectorAll(".keyframe-dot").forEach(dot => {
    dot.remove();
  });

  const start = getStartFrame();
  const end = getEndFrame();

  animationData.forEach((frames, object) => {
    if (!object.parent) return;

    frames.forEach((data, frame) => {
      if (frame < start || frame > end) return;

      const dot = document.createElement("div");

      const isSelected =
        selectedKeyframe &&
        selectedKeyframe.object === object &&
        selectedKeyframe.frame === frame;

      dot.className = "keyframe-dot";
      dot.title = object.name + " — Frame " + frame;

      const percentage = end === start
        ? 0
        : ((frame - start) / (end - start)) * 100;

      dot.style.position = "absolute";
      dot.style.left = percentage + "%";
      dot.style.top = "0";
      dot.style.width = isSelected ? "13px" : "9px";
      dot.style.height = isSelected ? "13px" : "9px";
      dot.style.background = isSelected ? "#ffb347" : "#9b7bff";
      dot.style.border = isSelected ? "2px solid white" : "none";
      dot.style.boxSizing = "border-box";
      dot.style.transform = "translateX(-50%) rotate(45deg)";
      dot.style.zIndex = "4";
      dot.style.cursor = "pointer";

      dot.addEventListener("click", event => {
        event.stopPropagation();

        stopPlayback();

        selectedKeyframe = {
          object,
          frame
        };

        modeling.selectObject(object);
        setCurrentFrame(frame);

        updateKeyframeDisplay();
      });

      timelineTrack.appendChild(dot);
    });
  });

  updatePlayhead();
}

// Click the timeline to scrub between frames.
if (timelineTrack) {
  timelineTrack.addEventListener("click", event => {
    if (event.target.classList.contains("keyframe-dot")) return;

    const rect = timelineTrack.getBoundingClientRect();

    const percentage = THREE.MathUtils.clamp(
      (event.clientX - rect.left) / rect.width,
      0,
      1
    );

    const frame =
      getStartFrame() +
      percentage * (getEndFrame() - getStartFrame());

    stopPlayback();
    setCurrentFrame(frame);
  });
}

// ==========================================
// PLAYBACK
// ==========================================

function startPlayback() {
  if (isPlaying) return;

  if (currentFrame >= getEndFrame()) {
    setCurrentFrame(getStartFrame());
  }

  isPlaying = true;
  lastPlaybackTime = 0;
  playbackAccumulator = 0;

  if (playButton) {
    playButton.textContent = "Ⅱ Pause";
  }

  window.dispatchEvent(
    new CustomEvent("editor-playback-change", {
      detail: { isPlaying }
    })
  );
}

function stopPlayback() {
  if (!isPlaying) return;

  isPlaying = false;

  if (playButton) {
    playButton.textContent = "▶ Play";
  }

  window.dispatchEvent(
    new CustomEvent("editor-playback-change", {
      detail: { isPlaying }
    })
  );
}

function togglePlayback() {
  if (isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

// Advance the animation using elapsed time.
function updatePlayback(timestamp) {
  if (!isPlaying) return;

  if (!lastPlaybackTime) {
    lastPlaybackTime = timestamp;
    return;
  }

  const delta = Math.min(
    (timestamp - lastPlaybackTime) / 1000,
    0.1
  );

  lastPlaybackTime = timestamp;
  playbackAccumulator += delta;

  const frameDuration = 1 / getFPS();

  while (playbackAccumulator >= frameDuration) {
    playbackAccumulator -= frameDuration;

    if (currentFrame >= getEndFrame()) {
      stopPlayback();
      return;
    }

    currentFrame++;
    applyAnimationFrame(currentFrame);
    updateFrameDisplay();
  }
}

// ==========================================
// TIMELINE BUTTONS
// ==========================================

if (previousFrameButton) {
  previousFrameButton.addEventListener("click", previousFrame);
}

if (nextFrameButton) {
  nextFrameButton.addEventListener("click", nextFrame);
}

if (addKeyframeButton) {
  addKeyframeButton.addEventListener("click", addKeyframe);
}

if (playButton) {
  playButton.addEventListener("click", togglePlayback);
}

if (startFrameInput) {
  startFrameInput.addEventListener("change", () => {
    stopPlayback();

    if (Number(startFrameInput.value) < 1) {
      startFrameInput.value = 1;
    }

    if (getEndFrame() < getStartFrame()) {
      endFrameInput.value = getStartFrame();
    }

    setCurrentFrame(currentFrame);
    renderFrameMarkers();
    updateKeyframeDisplay();
  });
}

if (endFrameInput) {
  endFrameInput.addEventListener("change", () => {
    stopPlayback();

    if (Number(endFrameInput.value) < getStartFrame()) {
      endFrameInput.value = getStartFrame();
    }

  setCurrentFrame(currentFrame);
  renderFrameMarkers();
  updateKeyframeDisplay();
  });
}

// ==========================================
// KEYBOARD CONTROLS
// ==========================================

window.addEventListener("keydown", event => {
  const target = event.target;

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) return;

  if (event.ctrlKey && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (!event.repeat) undo();
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "y") {
    event.preventDefault();
    if (!event.repeat) redo();
    return;
  }

  if (event.ctrlKey && event.key === "ArrowUp") {
    event.preventDefault();
    cameraDistance *= 0.9;
    updateCamera();
    return;
  }

  if (event.ctrlKey && event.key === "ArrowDown") {
    event.preventDefault();
    cameraDistance *= 1.1;
    updateCamera();
    return;
  }

  if (event.ctrlKey && event.key === "Backspace") {
    event.preventDefault();
    if (!event.repeat) modeling.deleteSelected();
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (!event.repeat) togglePlayback();
    return;
  }

  if (event.ctrlKey || event.altKey || event.repeat) return;

  const key = event.key.toLowerCase();

  if (key === "g") modeling.setMode("move");
  if (key === "r") modeling.setMode("rotate");
  if (key === "s") modeling.setMode("scale");
});

// ==========================================
// RESIZE
// ==========================================

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
});

// ==========================================
// RENDER LOOP
// ==========================================

function animate(timestamp) {
  requestAnimationFrame(animate);

  updatePlayback(timestamp);

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// ==========================================
// INITIALIZATION
// ==========================================

updateFrameDisplay();
updateKeyframeDisplay();

window.modeling = modeling;
window.scene = scene;
window.camera = camera;
window.renderer = renderer;
window.editorUndo = undo;
window.editorRedo = redo;
window.editorIsPlaying = () => isPlaying;
window.editorCurrentFrame = () => currentFrame;
window.editorAddKeyframe = addKeyframe;
window.editorSetFrame = setCurrentFrame;

commitHistory();

console.log("3D ANIMATION STUDIO INITIALIZED");
