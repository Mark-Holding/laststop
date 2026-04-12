import * as THREE from 'three';

// NYC subway car interior dimensions (meters)
const CAR_LENGTH = 18;
const CAR_WIDTH = 2.6;
const CAR_HEIGHT = 2.2;
const WALL_THICKNESS = 0.08;
const HALF_LENGTH = CAR_LENGTH / 2;
const HALF_WIDTH = CAR_WIDTH / 2;

// Window layout
const WINDOW_WIDTH = 1.1;
const WINDOW_HEIGHT = 0.75;
const WINDOW_BOTTOM = 0.95;
const WINDOW_DIVIDER = 0.35;
const WINDOW_ZONE_START = -7.2;
const WINDOW_COUNT = 10;

// Seat dimensions
const SEAT_HEIGHT = 0.42;
const SEAT_DEPTH = 0.44;
const SEAT_BACK_HEIGHT = 0.5;

// Materials
const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x7a7a70, roughness: 0.7 });
const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a8878, roughness: 0.8 });
const seatMat = new THREE.MeshStandardMaterial({ color: 0x1e3050, roughness: 0.6 });
const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 });
const doorMat = new THREE.MeshStandardMaterial({ color: 0x555560, metalness: 0.5, roughness: 0.5 });
const adPanelMat = new THREE.MeshStandardMaterial({ color: 0xd0c8b0, roughness: 0.5 });
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x112233,
  transparent: true,
  opacity: 0.25,
  roughness: 0.1,
  metalness: 0.2,
  side: THREE.DoubleSide,
});
const trimMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6, roughness: 0.4 });

function createFloor(group) {
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(CAR_WIDTH, WALL_THICKNESS, CAR_LENGTH),
    floorMat
  );
  floor.position.y = -WALL_THICKNESS / 2;
  floor.receiveShadow = true;
  group.add(floor);
}

function createCeiling(group) {
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(CAR_WIDTH + WALL_THICKNESS * 2, WALL_THICKNESS, CAR_LENGTH),
    ceilingMat
  );
  ceiling.position.y = CAR_HEIGHT;
  group.add(ceiling);
}

function createWallSide(group, side) {
  const xSign = side === 'left' ? -1 : 1;
  const wallX = xSign * (HALF_WIDTH + WALL_THICKNESS / 2);

  // Lower wall panel (below windows)
  const lowerWall = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_THICKNESS, WINDOW_BOTTOM, CAR_LENGTH),
    wallMat
  );
  lowerWall.position.set(wallX, WINDOW_BOTTOM / 2, 0);
  group.add(lowerWall);

  // Upper wall panel (above windows — ad panel zone)
  const upperHeight = CAR_HEIGHT - (WINDOW_BOTTOM + WINDOW_HEIGHT);
  const upperWall = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_THICKNESS, upperHeight, CAR_LENGTH),
    wallMat
  );
  upperWall.position.set(wallX, WINDOW_BOTTOM + WINDOW_HEIGHT + upperHeight / 2, 0);
  group.add(upperWall);

  // End sections (solid wall near doors)
  const endLength = HALF_LENGTH + WINDOW_ZONE_START;
  for (const zSign of [-1, 1]) {
    const endWall = new THREE.Mesh(
      new THREE.BoxGeometry(WALL_THICKNESS, WINDOW_HEIGHT, endLength),
      wallMat
    );
    endWall.position.set(wallX, WINDOW_BOTTOM + WINDOW_HEIGHT / 2, zSign * (HALF_LENGTH - endLength / 2));
    group.add(endWall);
  }

  // Window dividers and glass panes
  const spacing = WINDOW_WIDTH + WINDOW_DIVIDER;
  for (let i = 0; i < WINDOW_COUNT; i++) {
    const windowZ = WINDOW_ZONE_START + i * spacing + WINDOW_WIDTH / 2;

    // Glass pane
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(WINDOW_WIDTH, WINDOW_HEIGHT),
      glassMat
    );
    glass.position.set(wallX, WINDOW_BOTTOM + WINDOW_HEIGHT / 2, windowZ);
    glass.rotation.y = xSign * Math.PI / 2;
    group.add(glass);

    // Divider between windows (skip after last window)
    if (i < WINDOW_COUNT - 1) {
      const divider = new THREE.Mesh(
        new THREE.BoxGeometry(WALL_THICKNESS, WINDOW_HEIGHT, WINDOW_DIVIDER),
        wallMat
      );
      divider.position.set(wallX, WINDOW_BOTTOM + WINDOW_HEIGHT / 2, windowZ + WINDOW_WIDTH / 2 + WINDOW_DIVIDER / 2);
      group.add(divider);
    }
  }

  // Ad panels above windows
  const adHeight = 0.3;
  const adY = WINDOW_BOTTOM + WINDOW_HEIGHT + 0.05;
  for (let i = 0; i < 5; i++) {
    const adZ = WINDOW_ZONE_START + (i * 2 + 0.5) * spacing;
    const ad = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, adHeight, spacing * 1.8),
      adPanelMat
    );
    ad.position.set(xSign * (HALF_WIDTH - 0.01), adY + adHeight / 2, adZ);
    group.add(ad);
  }
}

function createEndWall(group, zPos) {
  const sign = Math.sign(zPos);

  // Wall with door frame cutout — build as 3 pieces around the door opening
  const doorWidth = 0.9;
  const doorHeight = 1.95;

  // Left section
  const sideWidth = (CAR_WIDTH - doorWidth) / 2;
  const leftSection = new THREE.Mesh(
    new THREE.BoxGeometry(sideWidth, CAR_HEIGHT, WALL_THICKNESS),
    wallMat
  );
  leftSection.position.set(-(doorWidth / 2 + sideWidth / 2), CAR_HEIGHT / 2, zPos);
  group.add(leftSection);

  // Right section
  const rightSection = new THREE.Mesh(
    new THREE.BoxGeometry(sideWidth, CAR_HEIGHT, WALL_THICKNESS),
    wallMat
  );
  rightSection.position.set(doorWidth / 2 + sideWidth / 2, CAR_HEIGHT / 2, zPos);
  group.add(rightSection);

  // Above door
  const aboveDoorHeight = CAR_HEIGHT - doorHeight;
  const aboveDoor = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth, aboveDoorHeight, WALL_THICKNESS),
    wallMat
  );
  aboveDoor.position.set(0, doorHeight + aboveDoorHeight / 2, zPos);
  group.add(aboveDoor);

  // Door frame trim
  const frameParts = [
    { w: 0.04, h: doorHeight, x: -doorWidth / 2 - 0.02, y: doorHeight / 2 },
    { w: 0.04, h: doorHeight, x: doorWidth / 2 + 0.02, y: doorHeight / 2 },
    { w: doorWidth + 0.08, h: 0.04, x: 0, y: doorHeight + 0.02 },
  ];
  for (const part of frameParts) {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(part.w, part.h, WALL_THICKNESS + 0.02),
      trimMat
    );
    frame.position.set(part.x, part.y, zPos);
    group.add(frame);
  }
}

function createSeats(group) {
  for (const xSign of [-1, 1]) {
    const seatX = xSign * (HALF_WIDTH - SEAT_DEPTH / 2);
    const backX = xSign * (HALF_WIDTH - 0.02);

    // Continuous bench seat — split into sections between poles
    const sectionLength = 2.8;
    const sectionGap = 0.4;
    const startZ = -7.0;

    for (let i = 0; i < 5; i++) {
      const sectionZ = startZ + i * (sectionLength + sectionGap);

      // Seat cushion
      const seatIndex = (xSign === -1 ? 0 : 5) + i;
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(SEAT_DEPTH, 0.06, sectionLength),
        seatMat.clone()
      );
      seat.position.set(seatX, SEAT_HEIGHT, sectionZ + sectionLength / 2);
      seat.userData.type = 'seat-cushion';
      seat.userData.seatIndex = seatIndex;
      seat.userData.side = xSign === -1 ? 'left' : 'right';
      seat.userData.section = i;
      group.add(seat);

      // Seat base (support)
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(SEAT_DEPTH - 0.1, SEAT_HEIGHT - 0.06, sectionLength - 0.1),
        trimMat
      );
      base.position.set(seatX, (SEAT_HEIGHT - 0.06) / 2, sectionZ + sectionLength / 2);
      group.add(base);

      // Seat back
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, SEAT_BACK_HEIGHT, sectionLength),
        seatMat
      );
      back.position.set(backX, SEAT_HEIGHT + SEAT_BACK_HEIGHT / 2, sectionZ + sectionLength / 2);
      group.add(back);
    }
  }
}

function createPoles(group) {
  const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, CAR_HEIGHT, 8);
  const positions = [];

  // Center poles
  for (let z = -6; z <= 6; z += 3) {
    positions.push({ x: -0.4, z });
    positions.push({ x: 0.4, z });
  }

  // Near-door poles
  for (const z of [-HALF_LENGTH + 0.5, HALF_LENGTH - 0.5]) {
    positions.push({ x: -0.5, z });
    positions.push({ x: 0.5, z });
  }

  for (const pos of positions) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(pos.x, CAR_HEIGHT / 2, pos.z);
    group.add(pole);
  }

  // Overhead grab bars (horizontal, along ceiling)
  const barGeo = new THREE.CylinderGeometry(0.018, 0.018, CAR_LENGTH - 2, 8);
  for (const xOffset of [-0.4, 0.4]) {
    const bar = new THREE.Mesh(barGeo, poleMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(xOffset, CAR_HEIGHT - 0.15, 0);
    group.add(bar);
  }
}

export function createCar(carIndex = 0) {
  const group = new THREE.Group();
  group.name = `car-${carIndex}`;

  createFloor(group);
  createCeiling(group);
  createWallSide(group, 'left');
  createWallSide(group, 'right');
  createEndWall(group, -HALF_LENGTH);
  createEndWall(group, HALF_LENGTH);
  createSeats(group);
  createPoles(group);

  return group;
}

export { CAR_LENGTH, CAR_WIDTH, CAR_HEIGHT, HALF_LENGTH, HALF_WIDTH };
