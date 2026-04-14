import * as THREE from 'three';
import { HALF_LENGTH, CAR_HEIGHT } from './train.js';
import { playDoorUnlock, playDoorSlide } from './audio/soundManager.js';

const DOOR_WIDTH = 0.85;
const DOOR_HEIGHT = 1.9;
const DOOR_THICKNESS = 0.05;

const doorMat = new THREE.MeshStandardMaterial({ color: 0x555560, metalness: 0.5, roughness: 0.5 });
const lockedLightMat = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 0.8 });
const unlockedLightMat = new THREE.MeshStandardMaterial({ color: 0x00ff44, emissive: 0x00ff44, emissiveIntensity: 0.8 });

function createDoor(zPos) {
  const group = new THREE.Group();
  const sign = Math.sign(zPos);

  // Door panel (slides left to open)
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, DOOR_THICKNESS),
    doorMat
  );
  panel.position.set(0, DOOR_HEIGHT / 2, zPos - sign * 0.06);
  group.add(panel);

  // Door handle
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.04, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 })
  );
  handle.position.set(sign * -0.25, DOOR_HEIGHT * 0.55, zPos + sign * (DOOR_THICKNESS / 2 + 0.03));
  group.add(handle);

  // Status light
  const lightGeo = new THREE.SphereGeometry(0.03, 8, 8);
  const statusLight = new THREE.Mesh(lightGeo, lockedLightMat.clone());
  statusLight.position.set(0.3, DOOR_HEIGHT + 0.15, zPos);
  group.add(statusLight);

  // Small point light for status glow
  const glow = new THREE.PointLight(0xff2200, 0.3, 1.5);
  glow.position.copy(statusLight.position);
  group.add(glow);

  // Lock plate
  const lockPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.08, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.4 })
  );
  lockPlate.position.set(sign * -0.25, DOOR_HEIGHT * 0.48, zPos + sign * (DOOR_THICKNESS / 2 + 0.02));
  group.add(lockPlate);

  return {
    group,
    panel,
    statusLight,
    glow,
    locked: true,
    open: false,
    openAmount: 0,
    zPos,
    sign,
  };
}

export function createDoors(scene) {
  const backDoor = createDoor(HALF_LENGTH);
  const frontDoor = createDoor(-HALF_LENGTH);

  scene.add(backDoor.group);
  scene.add(frontDoor.group);

  function unlock(which) {
    const door = which === 'front' ? frontDoor : backDoor;
    if (!door.locked) return;
    door.locked = false;
    door.statusLight.material = unlockedLightMat.clone();
    door.glow.color.set(0x00ff44);

    // Heavy mechanical CLUNK
    playDoorUnlock();
  }

  function openDoor(which) {
    const door = which === 'front' ? frontDoor : backDoor;
    if (door.locked || door.open) return;
    door.open = true;

    // Hydraulic slide sound
    playDoorSlide();
  }

  function update(dt) {
    for (const door of [frontDoor, backDoor]) {
      if (door.open && door.openAmount < 1) {
        door.openAmount = Math.min(1, door.openAmount + dt * 1.5);
        door.panel.position.x = door.openAmount * (DOOR_WIDTH + 0.05);
      }
    }
  }

  return {
    frontDoor,
    backDoor,
    unlock,
    openDoor,
    update,
  };
}
