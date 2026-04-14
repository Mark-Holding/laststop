import * as THREE from 'three';
import { playHoverSound, playInteractClick, updateProximityAudio } from './audio/soundManager.js';

const raycaster = new THREE.Raycaster();
raycaster.far = 3;
const center = new THREE.Vector2(0, 0);

const interactables = [];

export class Interactable {
  constructor(mesh, { onInteract = null, hoverColor = 0xffffcc, label = null } = {}) {
    this.mesh = mesh;
    this.onInteract = onInteract;
    this.hoverColor = hoverColor;
    this.label = label || 'Press E to interact';
    this.originalEmissive = mesh.material.emissive ? mesh.material.emissive.getHex() : 0x000000;
    this.hovered = false;
    this.mesh.userData.interactable = this;
    interactables.push(this);
  }

  setHover(hovered) {
    if (this.hovered === hovered && hovered === false) return;
    const wasHovered = this.hovered;
    this.hovered = hovered;
    const mat = this.mesh.material;
    if (mat && mat.emissive && typeof mat.emissive.setHex === 'function') {
      if (hovered) {
        // Pulsing emission when hovered
        const t = performance.now() * 0.001;
        const pulse = 0.2 + Math.sin(t * 4) * 0.1;
        mat.emissive.setHex(this.hoverColor);
        mat.emissiveIntensity = pulse;
      } else {
        mat.emissive.setHex(this.originalEmissive);
        mat.emissiveIntensity = 0;
      }
    }
    if (hovered && !wasHovered) {
      playHoverSound();
    }
  }

  interact(player) {
    playInteractClick();
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
    promptEl.style.cssText =
      'position:fixed;bottom:38%;left:50%;transform:translateX(-50%);' +
      'color:rgba(255,255,255,0.85);font-family:"Courier New",monospace;font-size:13px;' +
      'pointer-events:none;z-index:100;display:none;' +
      'text-shadow:0 0 8px rgba(255,255,255,0.3);letter-spacing:1px;';
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
  if (hoveredItem) {
    prompt.style.display = 'block';
    prompt.textContent = hoveredItem.label;
  } else {
    prompt.style.display = 'none';
  }

  // Proximity audio — subtle hum when looking near an interactable
  if (intersects.length > 0) {
    const dist = intersects[0].distance;
    const proximity = Math.max(0, 1 - dist / raycaster.far);
    updateProximityAudio(proximity);
  } else {
    updateProximityAudio(0);
  }

  return hoveredItem;
}

export function getInteractables() {
  return interactables;
}

export function clearInteractables() {
  interactables.length = 0;
}
