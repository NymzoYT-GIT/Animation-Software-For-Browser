
import * as THREE from "three";
import { createModelingSystem } from "./modeling.js";

// =====================================
// 3D ANIMATION STUDIO
// =====================================

// SCENE
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

// =====================================
// CAMERA SYSTEM
// =====================================

// OrbitControls are replaced with custom
// cursor-based camera controls.

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

renderer.domElement.addEventListener("pointermove", (event) => {
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

  // CTRL + ALT = ROTATE CAMERA
  if (event.ctrlKey) {
    cameraTheta -= dx * 0.006;
    cameraPhi -= dy * 0.006;

    updateCamera();
  }

  // ALT = PAN CAMERA
  else {
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

renderer.domElement.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

// =====================================
// LIGHTING
// =====================================

scene.add(
  new THREE.AmbientLight("#ffffff", 1.5)
);

const sunlight = new THREE.DirectionalLight(
  "#ffffff",
  3
);

sunlight.position.set(5, 10, 5);
sunlight.castShadow = true;

scene.add(sunlight);

// =====================================
// GRID
// =====================================

const grid = new THREE.GridHelper(
  20,
  20,
  "#777777",
  "#444444"
);

scene.add(grid);

// =====================================
// MODELING SYSTEM
// =====================================

const modeling = createModelingSystem({
  scene,
  camera,
  renderer,
  orbitControls,

  onSelectionChange(object) {
    const label = document.getElementById("selected-object");

    if (label) {
      label.textContent = object
        ? object.name
        : "Nothing selected";
    }
  }
});

// =====================================
// UNDO AND REDO SYSTEM
// =====================================

let history = [];
let historyIndex = -1;

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

  if (history.length > 50) {
    history.shift();
  }

  historyIndex = history.length - 1;
}

function restoreHistory(index) {
  if (index < 0 || index >= history.length) return;

  modeling.deselectObject();

  // Remove current editor objects
  modeling.getObjects().forEach(object => {
    scene.remove(object);
  });

  // Restore previous objects
  const state = history[index];

  state.forEach(item => {
    scene.add(item.object);

    item.object.position.copy(item.position);
    item.object.rotation.copy(item.rotation);
    item.object.scale.copy(item.scale);
  });

  historyIndex = index;
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

// Wrap object creation methods for history
["addCube", "addSphere", "addCylinder", "addPlane"].forEach(method => {
  const original = modeling[method];

  modeling[method] = function (...args) {
    const result = original.apply(modeling, args);
    commitHistory();
    return result;
  };
});

const originalDelete = modeling.deleteSelected;

modeling.deleteSelected = function () {
  if (!modeling.getSelected()) return;

  originalDelete.call(modeling);
  commitHistory();
};

// STARTING OBJECT
modeling.addCube();

// =====================================
// ANIMATION PLAYBACK STATE
// =====================================

let isPlaying = false;

function togglePlayback() {
  isPlaying = !isPlaying;

  window.dispatchEvent(
    new CustomEvent("editor-playback-change", {
      detail: { isPlaying }
    })
  );

  console.log(
    isPlaying ? "Playback started" : "Playback stopped"
  );
}

// =====================================
// KEYBOARD CONTROLS
// =====================================

let transformBefore = null;

window.addEventListener("keydown", (event) => {
  const target = event.target;

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) return;

  // UNDO
  if (event.ctrlKey && event.key.toLowerCase() === "z") {
    event.preventDefault();

    if (!event.repeat) undo();
    return;
  }

  // REDO
  if (event.ctrlKey && event.key.toLowerCase() === "y") {
    event.preventDefault();

    if (!event.repeat) redo();
    return;
  }

  // ZOOM IN
  if (event.ctrlKey && event.key === "ArrowUp") {
    event.preventDefault();

    cameraDistance *= 0.9;
    updateCamera();
    return;
  }

  // ZOOM OUT
  if (event.ctrlKey && event.key === "ArrowDown") {
    event.preventDefault();

    cameraDistance *= 1.1;
    updateCamera();
    return;
  }

  // DELETE
  if (event.ctrlKey && event.key === "Backspace") {
    event.preventDefault();

    if (!event.repeat) modeling.deleteSelected();
    return;
  }

  // PLAY / PAUSE
  if (event.code === "Space") {
    event.preventDefault();

    if (!event.repeat) togglePlayback();
    return;
  }

  if (event.ctrlKey || event.altKey || event.repeat) return;

  // TRANSFORM CONTROLS
  if (["g", "r", "s"].includes(event.key.toLowerCase())) {
    transformBefore = captureState();

    if (event.key.toLowerCase() === "g") {
      modeling.setMode("move");
    }

    if (event.key.toLowerCase() === "r") {
      modeling.setMode("rotate");
    }

    if (event.key.toLowerCase() === "s") {
      modeling.setMode("scale");
    }
  }
});

// Save completed transformations to history
window.addEventListener("keyup", (event) => {
  if (
    transformBefore &&
    ["g", "r", "s"].includes(event.key.toLowerCase())
  ) {
    commitHistory();
    transformBefore = null;
  }
});

// =====================================
// WINDOW RESIZING
// =====================================

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 1.5)
  );
});

// =====================================
// ANIMATION LOOP
// =====================================

function animate() {
  requestAnimationFrame(animate);

  renderer.render(scene, camera);
}

animate();

// =====================================
// GLOBAL EDITOR ACCESS
// =====================================

window.modeling = modeling;
window.scene = scene;
window.camera = camera;
window.renderer = renderer;

window.editorUndo = undo;
window.editorRedo = redo;

window.editorIsPlaying = () => isPlaying;

console.log("3D ANIMATION STUDIO INITIALIZED");
