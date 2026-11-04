
import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";

export function createModelingSystem({
  scene,
  camera,
  renderer,
  orbitControls,
  onSelectionChange = () => {},
  onTransformStart = () => {},
  onTransformEnd = () => {}
}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let selectedObject = null;
  let objectCounter = 1;

  const transformControls = new TransformControls(
    camera,
    renderer.domElement
  );

  scene.add(transformControls.getHelper());

  transformControls.addEventListener("dragging-changed", (event) => {
    if (orbitControls) orbitControls.enabled = !event.value;

    if (event.value) {
      onTransformStart(selectedObject);
    } else {
      onTransformEnd(selectedObject);
    }
  });

  transformControls.addEventListener("objectChange", () => {
    if (selectedObject) onSelectionChange(selectedObject);
  });

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
    object.userData.objectId =
      crypto.randomUUID?.() ||
      `object-${Date.now()}-${objectCounter}`;

    object.castShadow = true;
    object.receiveShadow = true;

    scene.add(object);
    objectCounter++;

    selectObject(object);

    return object;
  }

  function addCube() {
    return registerObject(
      new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        createMaterial("#8b5cf6")
      ),
      "Cube"
    );
  }

  function addSphere() {
    return registerObject(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 32, 24),
        createMaterial("#06b6d4")
      ),
      "Sphere"
    );
  }

  function addCylinder() {
    return registerObject(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
        createMaterial("#f59e0b")
      ),
      "Cylinder"
    );
  }

  function addPlane() {
    const object = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      createMaterial("#22c55e")
    );

    object.rotation.x = -Math.PI / 2;

    return registerObject(object, "Plane");
  }

  function selectObject(object) {
    if (!object || !object.userData.editorObject) return;

    selectedObject = object;
    transformControls.attach(object);

    onSelectionChange(object);
  }

  function deselectObject() {
    selectedObject = null;

    transformControls.detach();

    onSelectionChange(null);
  }

  // Do not dispose geometry or materials here.
  // History needs them to remain available for Undo.
  function deleteSelected() {
    if (!selectedObject) return null;

    const object = selectedObject;

    deselectObject();
    scene.remove(object);

    return object;
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
      if (
        child.isMesh &&
        child.userData.editorObject
      ) {
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
