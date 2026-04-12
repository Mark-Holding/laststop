import * as THREE from 'three';

const capsuleGeo = new THREE.CapsuleGeometry(0.2, 0.6, 4, 8);
const players = new Map();

function createNameSprite(name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.font = 'bold 24px Courier New, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(name.substring(0, 16), 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.2, 0.3, 1);
  return sprite;
}

export function addRemotePlayer(scene, socketId, username, color) {
  if (players.has(socketId)) return;

  const group = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.6,
  });
  const capsule = new THREE.Mesh(capsuleGeo, mat);
  capsule.position.y = -0.85;
  group.add(capsule);

  const label = createNameSprite(username, color);
  label.position.y = 0.25;
  group.add(label);

  group.position.set(0, 1.6, 6);
  scene.add(group);

  players.set(socketId, {
    group,
    targetPosition: new THREE.Vector3(0, 1.6, 6),
    targetRotationY: 0,
  });
}

export function removeRemotePlayer(scene, socketId) {
  const player = players.get(socketId);
  if (!player) return;
  scene.remove(player.group);
  player.group.traverse((child) => {
    // Don't dispose the shared capsule geometry
    if (child.geometry && child.geometry !== capsuleGeo) child.geometry.dispose();
    if (child.material) {
      if (child.material.map) child.material.map.dispose();
      child.material.dispose();
    }
  });
  players.delete(socketId);
}

export function updateRemotePlayerPosition(socketId, position, rotation) {
  const player = players.get(socketId);
  if (!player) return;
  player.targetPosition.set(position.x, position.y, position.z);
  player.targetRotationY = rotation.y;
}

export function updateRemotePlayers(dt) {
  const lerpFactor = Math.min(1, dt * 10);
  for (const player of players.values()) {
    player.group.position.lerp(player.targetPosition, lerpFactor);
    // Smoothly rotate capsule to face direction
    const capsule = player.group.children[0];
    const currentY = capsule.rotation.y;
    const targetY = player.targetRotationY;
    let diff = targetY - currentY;
    // Wrap angle difference to [-PI, PI]
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    capsule.rotation.y = currentY + diff * lerpFactor;
  }
}

export function clearRemotePlayers(scene) {
  for (const socketId of [...players.keys()]) {
    removeRemotePlayer(scene, socketId);
  }
}
