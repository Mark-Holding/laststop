import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
raycaster.far = 3;
const center = new THREE.Vector2(0, 0);

const interactables = [];

export class Interactable {
  constructor(mesh, { onInteract = null, hoverColor = 0xffffcc } = {}) {
    this.mesh = mesh;
    this.onInteract = onInteract;
    this.hoverColor = hoverColor;
    this.originalEmissive = mesh.material.emissive ? mesh.material.emissive.getHex() : 0x000000;
    this.hovered = false;
    this.mesh.userData.interactable = this;
    interactables.push(this);
  }

  setHover(hovered) {
    if (this.hovered === hovered) return;
    this.hovered = hovered;
    const mat = this.mesh.material;
    if (mat && mat.emissive && typeof mat.emissive.setHex === 'function') {
      mat.emissive.setHex(hovered ? this.hoverColor : this.originalEmissive);
      mat.emissiveIntensity = hovered ? 0.3 : 0;
    }
  }

  interact(player) {
    if (this.onInteract) this.onInteract(player);
  }

  dispose() {
    const idx = interactables.indexOf(this);
    if (idx !== -1) interactables.splice(idx, 1);
  }
}

let promptEl = null;

function getPromptElement() {
  if (!promptEl) {
    promptEl = document.createElement('div');
    promptEl.style.cssText = 'position:fixed;bottom:40%;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.7);font-family:monospace;font-size:14px;pointer-events:none;z-index:100;display:none;';
    promptEl.textContent = 'Press E to interact';
    document.body.appendChild(promptEl);
  }
  return promptEl;
}

export function updateInteractables(camera, scene) {
  raycaster.setFromCamera(center, camera);
  const meshes = interactables.map((item) => item.mesh);
  const intersects = raycaster.intersectObjects(meshes, false);

  let hoveredItem = null;
  if (intersects.length > 0) {
    hoveredItem = intersects[0].object.userData.interactable;
  }

  for (const item of interactables) {
    item.setHover(item === hoveredItem);
  }

  const prompt = getPromptElement();
  prompt.style.display = hoveredItem ? 'block' : 'none';

  return hoveredItem;
}

export function getInteractables() {
  return interactables;
}
