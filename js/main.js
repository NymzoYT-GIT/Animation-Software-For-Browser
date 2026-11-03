
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
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

camera.position.set(5, 5, 7);

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
// CAMERA CONTROLS
// =====================================

const orbitControls = new OrbitControls(
  camera,
  renderer.domElement
);

orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;

orbitControls.enableRotate = true;
orbitControls.enablePan = true;
orbitControls.enableZoom = false;

orbitControls.rotateSpeed = 0.7;
orbitControls.panSpeed = 0.7;

orbitControls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.PAN,
  RIGHT: THREE.MOUSE.PAN
};

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
    const label = document.getElementById(
      "selected-object"
    );

    if (label) {
      label.textContent = object
        ? object.name
        : "Nothing selected";
    }
  }
});

// STARTING OBJECT
modeling.addCube();

// =====================================
// KEYBOARD CONTROLS
// =====================================

window.addEventListener("keydown", (event) => {

  const target = event.target;

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) return;

  // ZOOM IN
  if (event.ctrlKey && event.key === "ArrowUp") {
    event.preventDefault();

    camera.position.multiplyScalar(0.9);
    orbitControls.update();
    return;
  }

  // ZOOM OUT
  if (event.ctrlKey && event.key === "ArrowDown") {
    event.preventDefault();

    camera.position.multiplyScalar(1.1);
    orbitControls.update();
    return;
  }

  // TRANSFORM CONTROLS
  if (event.key.toLowerCase() === "g") {
    modeling.setMode("move");
  }

  if (event.key.toLowerCase() === "r") {
    modeling.setMode("rotate");
  }

  if (event.key.toLowerCase() === "s") {
    modeling.setMode("scale");
  }

  // DELETE OBJECT
  if (
    event.key === "Delete" ||
    event.key === "Backspace"
  ) {
    modeling.deleteSelected();
  }

});

// =====================================
// WINDOW RESIZING
// =====================================

window.addEventListener("resize", () => {

  camera.aspect =
    window.innerWidth / window.innerHeight;

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

  orbitControls.update();

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

console.log(
  "3D ANIMATION STUDIO INITIALIZED"
);
