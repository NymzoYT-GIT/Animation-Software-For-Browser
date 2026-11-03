
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createModelingSystem } from "./modeling.js";

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color("#202127");

// Camera
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(5, 5, 7);

// Renderer
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);

renderer.domElement.style.position = "fixed";
renderer.domElement.style.inset = "0";
renderer.domElement.style.width = "100%";
renderer.domElement.style.height = "100%";
renderer.domElement.style.zIndex = "0";

// Camera controls
const orbitControls = new OrbitControls(
  camera,
  renderer.domElement
);

orbitControls.enableDamping = true;

// Lighting
const ambient = new THREE.AmbientLight("#ffffff", 1.5);
scene.add(ambient);

const sunlight = new THREE.DirectionalLight("#ffffff", 3);
sunlight.position.set(5, 10, 5);
sunlight.castShadow = true;
scene.add(sunlight);

// Grid
const grid = new THREE.GridHelper(20, 20, "#777777", "#444444");
scene.add(grid);

// Modeling system
const modeling = createModelingSystem({
  scene,
  camera,
  renderer,
  orbitControls,
  onSelectionChange(object) {
    const label = document.getElementById("selected-object");

    if (label) {
      label.textContent = object ? object.name : "Nothing selected";
    }
  }
});

// Create starting cube
modeling.addCube();

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  orbitControls.update();
  renderer.render(scene, camera);
}

animate();

// Window resizing
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Keyboard shortcuts
window.addEventListener("keydown", (event) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  ) return;

  if (event.key.toLowerCase() === "g") modeling.setMode("move");
  if (event.key.toLowerCase() === "r") modeling.setMode("rotate");
  if (event.key.toLowerCase() === "s") modeling.setMode("scale");

  if (event.key === "Delete" || event.key === "Backspace") {
    modeling.deleteSelected();
  }
});

// Make available to editor interface
window.modeling = modeling;

console.log("3D Animation Studio modeling engine loaded!");
