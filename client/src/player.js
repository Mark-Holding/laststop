import * as THREE from 'three';
import { HALF_WIDTH, HALF_LENGTH } from './train.js';

const MOVE_SPEED = 3.5;
const MOUSE_SENSITIVITY = 0.002;
const PLAYER_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.25;

export function createPlayer(camera, domElement) {
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const velocity = new THREE.Vector3();
  const moveDir = new THREE.Vector3();
  let isLocked = false;

  let uiBlocking = false;
  const keys = {};

  const bounds = {
    minX: -(HALF_WIDTH - PLAYER_RADIUS - 0.44),
    maxX: HALF_WIDTH - PLAYER_RADIUS - 0.44,
    minZ: -(HALF_LENGTH - PLAYER_RADIUS),
    maxZ: HALF_LENGTH - PLAYER_RADIUS,
  };

  camera.position.set(0, PLAYER_HEIGHT, 6);

  // Pointer lock
  domElement.addEventListener('click', () => {
    if (!isLocked && !uiBlocking) {
      domElement.requestPointerLock();
    }
  });

  document.addEventListener('pointerlockchange', () => {
    isLocked = document.pointerLockElement === domElement;
  });

  // Mouse look
  const onMouseMove = (event) => {
    if (!isLocked) return;
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= event.movementX * MOUSE_SENSITIVITY;
    euler.x -= event.movementY * MOUSE_SENSITIVITY;
    euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.x));
    camera.quaternion.setFromEuler(euler);
  };
  document.addEventListener('mousemove', onMouseMove);

  // Keyboard
  const onKeyDown = (event) => { keys[event.code] = true; };
  const onKeyUp = (event) => { keys[event.code] = false; };
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  // Crosshair
  const crosshair = document.createElement('div');
  crosshair.style.cssText = 'position:fixed;top:50%;left:50%;width:4px;height:4px;background:rgba(255,255,255,0.5);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:100;display:none;';
  document.body.appendChild(crosshair);

  function update(dt) {
    crosshair.style.display = isLocked ? 'block' : 'none';

    if (!isLocked) return;

    // Build movement direction relative to camera facing
    moveDir.set(0, 0, 0);

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    if (keys['KeyW']) moveDir.add(forward);
    if (keys['KeyS']) moveDir.sub(forward);
    if (keys['KeyD']) moveDir.add(right);
    if (keys['KeyA']) moveDir.sub(right);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
    }

    // Apply movement with simple damping
    const speed = MOVE_SPEED * dt;
    velocity.x = moveDir.x * speed;
    velocity.z = moveDir.z * speed;

    camera.position.x += velocity.x;
    camera.position.z += velocity.z;

    // Clamp to car bounds
    camera.position.x = Math.max(bounds.minX, Math.min(bounds.maxX, camera.position.x));
    camera.position.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, camera.position.z));
    camera.position.y = PLAYER_HEIGHT;
  }

  function getPosition() {
    return camera.position;
  }

  function setUIBlocking(blocking) {
    uiBlocking = blocking;
    if (blocking && isLocked) {
      document.exitPointerLock();
    }
  }

  function dispose() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    if (crosshair.parentElement) crosshair.remove();
  }

  return { update, getPosition, get isLocked() { return isLocked; }, setUIBlocking, dispose };
}
