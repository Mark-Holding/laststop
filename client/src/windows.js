import * as THREE from 'three';
import { CAR_LENGTH, CAR_HEIGHT, HALF_WIDTH } from './train.js';

const TUNNEL_RADIUS = 3.0;
const LIGHT_COUNT = 20;
const LIGHT_SPACING = 4;
const SCROLL_SPEED = 12;

const tunnelWallMat = new THREE.MeshStandardMaterial({ color: 0x1a1510, roughness: 1.0 });
const tunnelWallLightMat = new THREE.MeshStandardMaterial({ color: 0x221d15, roughness: 1.0 });
const tunnelLightMat = new THREE.MeshStandardMaterial({
  color: 0xffcc66,
  emissive: 0xffaa33,
  emissiveIntensity: 0.6,
});
const cableMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
const graffitiColors = [0xcc3333, 0x3366cc, 0x33aa33, 0xcccc33, 0xcc66cc, 0xff6633];
const crossPassageMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1.0 });

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

  // Graffiti tags on tunnel walls (small colored patches that scroll past)
  const graffitiTags = [];
  const GRAFFITI_COUNT = 12;
  const GRAFFITI_SPAN = GRAFFITI_COUNT * 6;
  for (let i = 0; i < GRAFFITI_COUNT; i++) {
    const z = (i - GRAFFITI_COUNT / 2) * 6 + Math.random() * 2;
    const xSign = Math.random() > 0.5 ? -1 : 1;
    const wallX = xSign * (HALF_WIDTH + 0.44);
    const tagW = 0.3 + Math.random() * 0.5;
    const tagH = 0.1 + Math.random() * 0.2;
    const tagColor = graffitiColors[Math.floor(Math.random() * graffitiColors.length)];

    const tagMat = new THREE.MeshStandardMaterial({
      color: tagColor,
      roughness: 0.9,
      transparent: true,
      opacity: 0.3 + Math.random() * 0.3,
    });
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(tagW, tagH), tagMat);
    tag.position.set(wallX, 0.6 + Math.random() * 1.0, z);
    tag.rotation.y = xSign === -1 ? Math.PI / 2 : -Math.PI / 2;
    tunnelGroup.add(tag);
    graffitiTags.push(tag);
  }

  // Cross-passage openings (dark rectangular gaps in tunnel wall)
  const crossPassages = [];
  const PASSAGE_COUNT = 4;
  const PASSAGE_SPAN = PASSAGE_COUNT * 16;
  for (let i = 0; i < PASSAGE_COUNT; i++) {
    const z = (i - PASSAGE_COUNT / 2) * 16;
    const xSign = i % 2 === 0 ? -1 : 1;
    const wallX = xSign * (HALF_WIDTH + 0.44);

    const passage = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 1.8),
      crossPassageMat,
    );
    passage.position.set(wallX, 0.9, z);
    passage.rotation.y = xSign === -1 ? Math.PI / 2 : -Math.PI / 2;
    tunnelGroup.add(passage);
    crossPassages.push(passage);
  }

  // Wall section color variation (alternate lighter/darker patches)
  const wallPatches = [];
  const PATCH_COUNT = 10;
  const PATCH_SPAN = PATCH_COUNT * 5;
  for (let i = 0; i < PATCH_COUNT; i++) {
    const z = (i - PATCH_COUNT / 2) * 5;
    for (const xSign of [-1, 1]) {
      const wallX = xSign * (HALF_WIDTH + 0.44);
      const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(0.01, CAR_HEIGHT * 0.7, 2.5),
        tunnelWallLightMat,
      );
      patch.position.set(wallX, CAR_HEIGHT * 0.35, z);
      patch.rotation.y = xSign === -1 ? Math.PI / 2 : -Math.PI / 2;
      tunnelGroup.add(patch);
      wallPatches.push(patch);
    }
  }

  // Window reflection overlays (faint warm tint on the inside of each window)
  const reflectionMat = new THREE.MeshStandardMaterial({
    color: 0xffe8c0,
    transparent: true,
    opacity: 0.04,
    roughness: 0.1,
    metalness: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

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

    // Move graffiti tags
    for (let i = 0; i < graffitiTags.length; i++) {
      const baseZ = (i - GRAFFITI_COUNT / 2) * 6;
      let z = baseZ - (scrollOffset % GRAFFITI_SPAN);
      if (z < -GRAFFITI_SPAN / 2) z += GRAFFITI_SPAN;
      if (z > GRAFFITI_SPAN / 2) z -= GRAFFITI_SPAN;
      graffitiTags[i].position.z = z;
    }

    // Move cross-passages
    for (let i = 0; i < crossPassages.length; i++) {
      const baseZ = (i - PASSAGE_COUNT / 2) * 16;
      let z = baseZ - (scrollOffset % PASSAGE_SPAN);
      if (z < -PASSAGE_SPAN / 2) z += PASSAGE_SPAN;
      if (z > PASSAGE_SPAN / 2) z -= PASSAGE_SPAN;
      crossPassages[i].position.z = z;
    }

    // Move wall patches
    for (let i = 0; i < wallPatches.length; i++) {
      const baseI = Math.floor(i / 2);
      const baseZ = (baseI - PATCH_COUNT / 2) * 5;
      let z = baseZ - (scrollOffset % PATCH_SPAN);
      if (z < -PATCH_SPAN / 2) z += PATCH_SPAN;
      if (z > PATCH_SPAN / 2) z -= PATCH_SPAN;
      wallPatches[i].position.z = z;
    }
  }

  return { update, tunnelGroup, reflectionMat };
}
