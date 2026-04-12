import * as THREE from 'three';
import { CAR_LENGTH, CAR_HEIGHT, HALF_WIDTH } from './train.js';

const TUNNEL_RADIUS = 3.0;
const LIGHT_COUNT = 20;
const LIGHT_SPACING = 4;
const SCROLL_SPEED = 12;

const tunnelWallMat = new THREE.MeshStandardMaterial({ color: 0x1a1510, roughness: 1.0 });
const tunnelLightMat = new THREE.MeshStandardMaterial({
  color: 0xffcc66,
  emissive: 0xffaa33,
  emissiveIntensity: 0.6,
});
const cableMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

export function createTunnelView(scene) {
  const tunnelGroup = new THREE.Group();

  // Tunnel walls — long boxes on each side of the car
  for (const xSign of [-1, 1]) {
    const wallX = xSign * (HALF_WIDTH + 0.6);

    // Main tunnel wall
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, CAR_HEIGHT + 1, CAR_LENGTH * 3),
      tunnelWallMat
    );
    wall.position.set(wallX, CAR_HEIGHT / 2 - 0.3, 0);
    tunnelGroup.add(wall);

    // Grimy tunnel ceiling outside car
    const tunnelCeiling = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.2, CAR_LENGTH * 3),
      tunnelWallMat
    );
    tunnelCeiling.position.set(wallX * 0.8, CAR_HEIGHT + 0.8, 0);
    tunnelGroup.add(tunnelCeiling);

    // Cable conduits running along the tunnel
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, CAR_LENGTH * 3, 6),
      cableMat
    );
    cable.rotation.x = Math.PI / 2;
    cable.position.set(wallX - xSign * 0.05, CAR_HEIGHT * 0.7, 0);
    tunnelGroup.add(cable);
  }

  // Tunnel floor (below car)
  const tunnelFloor = new THREE.Mesh(
    new THREE.BoxGeometry(TUNNEL_RADIUS * 2, 0.1, CAR_LENGTH * 3),
    tunnelWallMat
  );
  tunnelFloor.position.y = -0.15;
  tunnelGroup.add(tunnelFloor);

  // Scrolling tunnel lights
  const lights = [];
  for (let i = 0; i < LIGHT_COUNT; i++) {
    const z = (i - LIGHT_COUNT / 2) * LIGHT_SPACING;

    for (const xSign of [-1, 1]) {
      const wallX = xSign * (HALF_WIDTH + 0.45);

      // Light fixture
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.06, 0.3),
        tunnelLightMat
      );
      fixture.position.set(wallX, CAR_HEIGHT * 0.65, z);
      tunnelGroup.add(fixture);
      lights.push(fixture);
    }
  }

  // Occasional support pillars
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x2a2520, roughness: 0.9 });
  const pillars = [];
  for (let i = 0; i < 8; i++) {
    const z = (i - 4) * 8;
    for (const xSign of [-1, 1]) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, CAR_HEIGHT + 0.5, 0.15),
        pillarMat
      );
      pillar.position.set(xSign * (HALF_WIDTH + 0.55), CAR_HEIGHT / 2, z);
      tunnelGroup.add(pillar);
      pillars.push(pillar);
    }
  }

  scene.add(tunnelGroup);

  // Scroll offset tracker
  let scrollOffset = 0;
  const totalLightSpan = LIGHT_COUNT * LIGHT_SPACING;
  const totalPillarSpan = 8 * 8;

  function update(dt) {
    scrollOffset += SCROLL_SPEED * dt;

    // Move tunnel lights
    for (let i = 0; i < lights.length; i++) {
      const baseI = Math.floor(i / 2);
      const baseZ = (baseI - LIGHT_COUNT / 2) * LIGHT_SPACING;
      let z = baseZ - (scrollOffset % totalLightSpan);
      // Wrap around both directions
      if (z < -totalLightSpan / 2) z += totalLightSpan;
      if (z > totalLightSpan / 2) z -= totalLightSpan;
      lights[i].position.z = z;
    }

    // Move pillars
    for (let i = 0; i < pillars.length; i++) {
      const baseI = Math.floor(i / 2);
      const baseZ = (baseI - 4) * 8;
      let z = baseZ - (scrollOffset % totalPillarSpan);
      if (z < -totalPillarSpan / 2) z += totalPillarSpan;
      if (z > totalPillarSpan / 2) z -= totalPillarSpan;
      pillars[i].position.z = z;
    }
  }

  return { update, tunnelGroup };
}
