import * as THREE from 'three';
import { playFootstep } from './audio/soundManager.js';

// ── Shared geometries (created once, reused for all players) ─────────────

// Head & face
const headGeo = new THREE.SphereGeometry(0.11, 16, 12);
const earGeo = new THREE.SphereGeometry(0.028, 8, 6);
const noseGeo = new THREE.BoxGeometry(0.025, 0.03, 0.025);

// Neck
const neckGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.07, 10);

// Torso
const chestGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.24, 12);
const abdomenGeo = new THREE.CylinderGeometry(0.15, 0.12, 0.14, 12);
const waistGeo = new THREE.CylinderGeometry(0.12, 0.11, 0.06, 10);
const shoulderCapGeo = new THREE.SphereGeometry(0.05, 10, 8);

// Arms
const upperArmGeo = new THREE.CapsuleGeometry(0.032, 0.18, 4, 10);
const elbowGeo = new THREE.SphereGeometry(0.033, 8, 6);
const lowerArmGeo = new THREE.CapsuleGeometry(0.028, 0.18, 4, 10);
const handGeo = new THREE.BoxGeometry(0.04, 0.06, 0.025);

// Legs
const hipJointGeo = new THREE.SphereGeometry(0.052, 10, 8);
const upperLegGeo = new THREE.CapsuleGeometry(0.048, 0.22, 4, 10);
const kneeGeo = new THREE.SphereGeometry(0.042, 8, 6);
const lowerLegGeo = new THREE.CapsuleGeometry(0.038, 0.24, 4, 10);
const shoeGeo = new THREE.BoxGeometry(0.07, 0.06, 0.16);

const sharedGeos = new Set([
  headGeo, earGeo, noseGeo, neckGeo,
  chestGeo, abdomenGeo, waistGeo, shoulderCapGeo,
  upperArmGeo, elbowGeo, lowerArmGeo, handGeo,
  hipJointGeo, upperLegGeo, kneeGeo, lowerLegGeo, shoeGeo,
]);

const skinMat = new THREE.MeshStandardMaterial({ color: 0xc8a882, roughness: 0.8 });

const players = new Map();

// Pre-allocated for per-frame updates
const _lookDir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _prevPos = new THREE.Vector3();

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

function buildHumanoid(playerColor) {
  const bodyGroup = new THREE.Group();

  const shirtMat = new THREE.MeshStandardMaterial({ color: playerColor, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: playerColor.clone().multiplyScalar(0.35),
    roughness: 0.8,
  });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

  // ── Head ──
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 0.08;
  head.scale.set(1, 1.08, 0.95);
  bodyGroup.add(head);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, skinMat);
    ear.position.set(side * 0.11, 0.06, 0);
    ear.scale.set(0.5, 0.8, 0.45);
    bodyGroup.add(ear);
  }

  const nose = new THREE.Mesh(noseGeo, skinMat);
  nose.position.set(0, 0.04, 0.105);
  bodyGroup.add(nose);

  // ── Neck ──
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.y = -0.04;
  bodyGroup.add(neck);

  // ── Torso ──
  const chest = new THREE.Mesh(chestGeo, shirtMat);
  chest.position.y = -0.22;
  bodyGroup.add(chest);

  const abdomen = new THREE.Mesh(abdomenGeo, shirtMat);
  abdomen.position.y = -0.40;
  bodyGroup.add(abdomen);

  const waist = new THREE.Mesh(waistGeo, pantsMat);
  waist.position.y = -0.50;
  bodyGroup.add(waist);

  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(shoulderCapGeo, shirtMat);
    cap.position.set(side * 0.17, -0.12, 0);
    bodyGroup.add(cap);
  }

  // ── Arms (grouped for walk animation) ──
  const armGroups = [];
  for (const side of [-1, 1]) {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.17, -0.14, 0);

    const upper = new THREE.Mesh(upperArmGeo, shirtMat);
    upper.position.y = -0.13;
    armGroup.add(upper);

    const elbow = new THREE.Mesh(elbowGeo, skinMat);
    elbow.position.y = -0.26;
    armGroup.add(elbow);

    const lower = new THREE.Mesh(lowerArmGeo, skinMat);
    lower.position.y = -0.39;
    armGroup.add(lower);

    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.52;
    hand.rotation.x = -0.15;
    armGroup.add(hand);

    bodyGroup.add(armGroup);
    armGroups.push(armGroup);
  }

  // ── Legs (grouped for walk animation) ──
  const legGroups = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Mesh(hipJointGeo, pantsMat);
    hip.position.set(side * 0.075, -0.54, 0);
    bodyGroup.add(hip);

    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.075, -0.54, 0);

    const upper = new THREE.Mesh(upperLegGeo, pantsMat);
    upper.position.y = -0.18;
    legGroup.add(upper);

    const knee = new THREE.Mesh(kneeGeo, pantsMat);
    knee.position.y = -0.36;
    legGroup.add(knee);

    const lower = new THREE.Mesh(lowerLegGeo, pantsMat);
    lower.position.y = -0.54;
    legGroup.add(lower);

    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.position.set(0, -0.74, 0.02);
    legGroup.add(shoe);

    bodyGroup.add(legGroup);
    legGroups.push(legGroup);
  }

  return {
    bodyGroup, shirtMat, pantsMat, shoeMat,
    leftArm: armGroups[0], rightArm: armGroups[1],
    leftLeg: legGroups[0], rightLeg: legGroups[1],
    chest,
  };
}

export function addRemotePlayer(scene, socketId, username, color) {
  if (players.has(socketId)) return;

  const group = new THREE.Group();
  const playerColor = new THREE.Color(color);

  const { bodyGroup, shirtMat, pantsMat, shoeMat, leftArm, rightArm, leftLeg, rightLeg, chest } =
    buildHumanoid(playerColor);
  group.add(bodyGroup);

  // Name label above head
  const label = createNameSprite(username, color);
  label.position.y = 0.38;
  group.add(label);

  // Flashlight
  const flashlight = new THREE.SpotLight(0xfff0d0, 1.2, 8, 0.4, 0.6);
  flashlight.position.set(0, -0.05, 0);
  group.add(flashlight);

  const flashTarget = new THREE.Object3D();
  flashTarget.position.set(0, -0.3, -3);
  group.add(flashTarget);
  flashlight.target = flashTarget;

  group.position.set(0, 1.6, 6);
  scene.add(group);

  players.set(socketId, {
    group,
    bodyGroup,
    flashlight,
    flashTarget,
    materials: [shirtMat, pantsMat, shoeMat],
    targetPosition: new THREE.Vector3(0, 1.6, 6),
    lastSoundPosition: new THREE.Vector3(0, 1.6, 6),
    targetRotationY: 0,
    footstepTimer: 0,
    // Animation refs
    leftArm, rightArm, leftLeg, rightLeg, chest,
    // Animation state
    walkPhase: 0,
    swingAmp: 0,
    breathPhase: Math.random() * Math.PI * 2,
  });
}

export function removeRemotePlayer(scene, socketId) {
  const player = players.get(socketId);
  if (!player) return;
  scene.remove(player.group);
  player.group.traverse((child) => {
    if (child.geometry && !sharedGeos.has(child.geometry)) {
      child.geometry.dispose();
    }
    if (child.material && child.material !== skinMat) {
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

export function updateRemotePlayers(dt, cameraPosition) {
  const lerpFactor = Math.min(1, dt * 10);

  for (const player of players.values()) {
    _prevPos.copy(player.group.position);

    player.group.position.lerp(player.targetPosition, lerpFactor);

    // Rotate body to face look direction
    const currentY = player.bodyGroup.rotation.y;
    const targetY = player.targetRotationY;
    let diff = targetY - currentY;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.bodyGroup.rotation.y = currentY + diff * lerpFactor;

    // Point flashlight in look direction
    _lookDir.set(0, -0.3, -3);
    _lookDir.applyAxisAngle(_upAxis, player.targetRotationY);
    player.flashTarget.position.copy(_lookDir);

    // ── Animation ──
    const moved = player.group.position.distanceTo(_prevPos);
    const speed = dt > 0 ? Math.min(moved / dt, 6) : 0;

    // Walk cycle
    const targetAmp = Math.min(speed * 0.12, 0.35);
    player.swingAmp += (targetAmp - player.swingAmp) * Math.min(1, dt * 8);

    if (player.swingAmp > 0.01) {
      player.walkPhase += dt * speed * 4.5;
      const swing = Math.sin(player.walkPhase) * player.swingAmp;

      // Arms and legs swing in opposition
      player.leftArm.rotation.x = swing;
      player.rightArm.rotation.x = -swing;
      player.leftLeg.rotation.x = -swing * 0.8;
      player.rightLeg.rotation.x = swing * 0.8;

      // Subtle body bob (two bounces per stride)
      player.bodyGroup.position.y = Math.abs(Math.sin(player.walkPhase * 2)) * 0.012;
    } else {
      // Ease limbs back to rest
      player.leftArm.rotation.x *= 0.85;
      player.rightArm.rotation.x *= 0.85;
      player.leftLeg.rotation.x *= 0.85;
      player.rightLeg.rotation.x *= 0.85;
      player.bodyGroup.position.y *= 0.85;
    }

    // Idle breathing
    player.breathPhase += dt * 1.2;
    const breath = 1 + Math.sin(player.breathPhase) * 0.012;
    player.chest.scale.set(1, breath, 1 + (breath - 1) * 0.6);

    // Footstep sounds
    player.footstepTimer += dt;
    const movedFromSound = player.group.position.distanceTo(player.lastSoundPosition);
    if (movedFromSound > 0.4 && player.footstepTimer > 0.35) {
      player.footstepTimer = 0;
      player.lastSoundPosition.copy(player.group.position);

      if (cameraPosition) {
        const dist = player.group.position.distanceTo(cameraPosition);
        const volume = Math.max(0, 1 - dist / 10) * 0.06;
        if (volume > 0.005) {
          playFootstep(volume);
        }
      }
    }
  }
}

export function clearRemotePlayers(scene) {
  for (const socketId of [...players.keys()]) {
    removeRemotePlayer(scene, socketId);
  }
}
