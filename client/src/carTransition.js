// Between-car transition corridor
// Short connecting passage with raw tunnel sound, visible track, sparks
import * as THREE from 'three';
import { HALF_LENGTH, CAR_HEIGHT, HALF_WIDTH } from './train.js';
import { setTransitionMode } from './audio/soundManager.js';

const CORRIDOR_LENGTH = 2.5;
const CORRIDOR_WIDTH = 1.0;
const CORRIDOR_HEIGHT = 2.0;

let corridorGroup = null;
let sparks = [];
let sparkTimer = 0;
let trackLines = [];
let playerInCorridor = false;

export function createCarTransition(scene, direction = 'front') {
  corridorGroup = new THREE.Group();
  const zSign = direction === 'front' ? -1 : 1;
  const startZ = zSign * HALF_LENGTH;

  // Corridor walls — narrow, metallic, industrial
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x2a2520,
    metalness: 0.7,
    roughness: 0.6,
  });

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1a1510,
    roughness: 1.0,
    metalness: 0.3,
  });

  // Left wall
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, CORRIDOR_HEIGHT, CORRIDOR_LENGTH),
    wallMat
  );
  leftWall.position.set(-CORRIDOR_WIDTH / 2, CORRIDOR_HEIGHT / 2, startZ + zSign * -CORRIDOR_LENGTH / 2);
  corridorGroup.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, CORRIDOR_HEIGHT, CORRIDOR_LENGTH),
    wallMat
  );
  rightWall.position.set(CORRIDOR_WIDTH / 2, CORRIDOR_HEIGHT / 2, startZ + zSign * -CORRIDOR_LENGTH / 2);
  corridorGroup.add(rightWall);

  // Ceiling — ribbed metal
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x333330,
    metalness: 0.6,
    roughness: 0.5,
  });
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(CORRIDOR_WIDTH, 0.04, CORRIDOR_LENGTH),
    ceilingMat
  );
  ceiling.position.set(0, CORRIDOR_HEIGHT, startZ + zSign * -CORRIDOR_LENGTH / 2);
  corridorGroup.add(ceiling);

  // Ceiling ribs
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(CORRIDOR_WIDTH + 0.02, 0.03, 0.04),
      wallMat
    );
    const ribZ = startZ + zSign * -(0.4 + i * 0.55);
    rib.position.set(0, CORRIDOR_HEIGHT - 0.02, ribZ);
    corridorGroup.add(rib);
  }

  // Floor — grated metal with gaps to see track below
  // Main floor panels with gaps between them
  for (let i = 0; i < 3; i++) {
    const panelLength = 0.6;
    const gapLength = 0.15;
    const panelZ = startZ + zSign * -(0.3 + i * (panelLength + gapLength));

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(CORRIDOR_WIDTH - 0.1, 0.02, panelLength),
      floorMat
    );
    panel.position.set(0, 0, panelZ);
    corridorGroup.add(panel);
  }

  // Track rushing below — visible through floor gaps
  // Emissive animated lines to simulate rails
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x666666,
    emissive: 0x333322,
    emissiveIntensity: 0.3,
    metalness: 0.9,
    roughness: 0.3,
  });

  trackLines = [];
  for (let i = 0; i < 8; i++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.005, 0.4),
      railMat.clone()
    );
    const lineZ = startZ + zSign * -(0.2 + i * 0.3);
    line.position.set((Math.random() - 0.5) * 0.6, -0.15, lineZ);
    line.userData.baseZ = lineZ;
    line.userData.speed = 8 + Math.random() * 4;
    corridorGroup.add(line);
    trackLines.push(line);
  }

  // Ground plane below (dark, visible through gaps)
  const groundGeo = new THREE.PlaneGeometry(CORRIDOR_WIDTH + 1, CORRIDOR_LENGTH + 1);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0a08, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.3, startZ + zSign * -CORRIDOR_LENGTH / 2);
  corridorGroup.add(ground);

  // Dim emergency light in corridor
  const light = new THREE.PointLight(0xff6633, 0.5, 4);
  light.position.set(0, CORRIDOR_HEIGHT - 0.15, startZ + zSign * -CORRIDOR_LENGTH / 2);
  corridorGroup.add(light);

  // Small red light fixture
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0xff4422,
    emissive: 0xff3311,
    emissiveIntensity: 0.8,
  });
  const fixture = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.03, 0.06),
    fixtureMat
  );
  fixture.position.copy(light.position);
  fixture.position.y += 0.05;
  corridorGroup.add(fixture);

  // Spark emitter positions (edges where metal meets metal)
  sparks = [];
  sparkTimer = 0;

  scene.add(corridorGroup);

  return {
    group: corridorGroup,
    update: updateTransition,
    checkPlayerPosition,
    dispose: disposeTransition,
  };
}

function updateTransition(dt, cameraZ) {
  if (!corridorGroup) return;

  // Animate track lines scrolling through floor gaps
  for (const line of trackLines) {
    line.position.z -= line.userData.speed * dt;
    // Wrap around
    const extent = 1.5;
    if (Math.abs(line.position.z - line.userData.baseZ) > extent) {
      line.position.z = line.userData.baseZ + extent;
      line.position.x = (Math.random() - 0.5) * 0.6;
    }
  }

  // Occasional sparks
  sparkTimer += dt;
  if (sparkTimer > 0.3 + Math.random() * 0.8) {
    sparkTimer = 0;
    emitSpark();
  }

  // Update existing sparks
  for (let i = sparks.length - 1; i >= 0; i--) {
    const spark = sparks[i];
    spark.life -= dt * 3;
    spark.mesh.position.y -= dt * 2;
    spark.mesh.position.x += spark.vx * dt;
    spark.mesh.position.z += spark.vz * dt;
    spark.mesh.material.opacity = Math.max(0, spark.life);
    if (spark.life <= 0) {
      corridorGroup.remove(spark.mesh);
      spark.mesh.geometry.dispose();
      spark.mesh.material.dispose();
      sparks.splice(i, 1);
    }
  }
}

function emitSpark() {
  if (!corridorGroup || sparks.length > 10) return;

  const sparkGeo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  const sparkMat = new THREE.MeshStandardMaterial({
    color: 0xffaa44,
    emissive: 0xffaa44,
    emissiveIntensity: 2,
    transparent: true,
    opacity: 1,
  });
  const spark = new THREE.Mesh(sparkGeo, sparkMat);

  // Spawn at edge of corridor
  const side = Math.random() > 0.5 ? 1 : -1;
  spark.position.set(
    side * (CORRIDOR_WIDTH / 2 - 0.05),
    0.1 + Math.random() * 0.5,
    corridorGroup.position.z || 0
  );
  // Offset to corridor area — sparks spawn near the bottom edges
  spark.position.z = -HALF_LENGTH - CORRIDOR_LENGTH * 0.3 + Math.random() * CORRIDOR_LENGTH * 0.6;

  corridorGroup.add(spark);
  sparks.push({
    mesh: spark,
    life: 1,
    vx: -side * (0.5 + Math.random()),
    vz: (Math.random() - 0.5) * 2,
  });
}

// Check if player camera is within the corridor zone
function checkPlayerPosition(cameraZ, corridorStartZ, corridorEndZ) {
  const inCorridor = cameraZ < corridorStartZ && cameraZ > corridorEndZ;
  if (inCorridor !== playerInCorridor) {
    playerInCorridor = inCorridor;
    setTransitionMode(inCorridor);
  }
  return playerInCorridor;
}

function disposeTransition() {
  if (corridorGroup && corridorGroup.parent) {
    corridorGroup.parent.remove(corridorGroup);
  }
  for (const spark of sparks) {
    spark.mesh.geometry.dispose();
    spark.mesh.material.dispose();
  }
  sparks = [];
  trackLines = [];
  corridorGroup = null;
  playerInCorridor = false;
  setTransitionMode(false);
}
