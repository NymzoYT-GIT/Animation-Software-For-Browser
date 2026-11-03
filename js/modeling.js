
import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";

export function createModelingSystem({
  scene,
  camera,
  renderer,
  orbitControls,
  onSelectionChange = () => {}
}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let selectedObject = null;

  const transformControls = new TransformControls(
    camera,
    renderer.domElement
  );

  scene.add(transformControls.getHelper());

  transformControls.addEventListener("dragging-changed", (event) => {
    orbitControls.enabled = !event.value;
  });

  transformControls.addEventListener("objectChange", () => {
    if (selectedObject) {
      onSelectionChange(selectedObject);
    }
  });

  let objectCounter = 1;

  function createMaterial(color = "#8b5cf6") {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.65,
      metalness: 0.05
    });
  }

  function registerObject(object, name) {
    object.name = name || `Object_${objectCounter}`;
    object.userData.editorObject = true;
    object.userData.objectId = crypto.randomUUID();

    object.castShadow = true;
    object.receiveShadow = true;

    scene.add(object);

    objectCounter++;

    selectObject(object);

    return object;
  }

  function addCube() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const object = new THREE.Mesh(
      geometry,
      createMaterial("#8b5cf6")
    );

    return registerObject(object, "Cube");
  }

  function addSphere() {
    const geometry = new THREE.SphereGeometry(0.5, 32, 24);
    const object = new THREE.Mesh(
      geometry,
      createMaterial("#06b6d4")
    );

    return registerObject(object, "Sphere");
  }

  function addCylinder() {
    const geometry = new THREE.CylinderGeometry(
      0.5, 0.5, 1, 32
    );

    const object = new THREE.Mesh(
      geometry,
      createMaterial("#f59e0b")
    );

    return registerObject(object, "Cylinder");
  }

  function addPlane() {
    const geometry = new THREE.PlaneGeometry(2, 2);

    const object = new THREE.Mesh(
      geometry,
      createMaterial("#22c55e")
    );

    object.rotation.x = -Math.PI / 2;

    return registerObject(object, "Plane");
  }

  function selectObject(object) {
    if (!object || !object.userData.editorObject) {
      return;
    }

    selectedObject = object;
    transformControls.attach(object);

    onSelectionChange(object);
  }

  function deselectObject() {
    selectedObject = null;
    transformControls.detach();

    onSelectionChange(null);
  }

  function deleteSelected() {
    if (!selectedObject) return;

    const object = selectedObject;

    deselectObject();
    scene.remove(object);

    object.geometry?.dispose();

    if (Array.isArray(object.material)) {
      object.material.forEach(material => material.dispose());
    } else {
      object.material?.dispose();
    }
  }

  function setMode(mode) {
    const modes = {
      move: "translate",
      rotate: "rotate",
      scale: "scale"
    };

    if (modes[mode]) {
      transformControls.setMode(modes[mode]);
    }
  }

  function selectAtPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();

    pointer.x =
      ((event.clientX - rect.left) / rect.width) * 2 - 1;

    pointer.y =
      -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const objects = [];

    scene.traverse((child) => {
      if (child.isMesh && child.userData.editorObject) {
        objects.push(child);
      }
    });

    const hits = raycaster.intersectObjects(objects, false);

    if (hits.length > 0) {
      selectObject(hits[0].object);
    } else {
      deselectObject();
    }
  }

  renderer.domElement.addEventListener(
    "dblclick",
    selectAtPointer
  );

  return {
    addCube,
    addSphere,
    addCylinder,
    addPlane,
    selectObject,
    deselectObject,
    deleteSelected,
    setMode,

    getSelected() {
      return selectedObject;
    },

    getObjects() {
      return scene.children.filter(
        object => object.userData.editorObject
      );
    },

    dispose() {
      renderer.domElement.removeEventListener(
        "dblclick",
        selectAtPointer
      );

      transformControls.dispose();
      scene.remove(transformControls.getHelper());
    }
  };
}
