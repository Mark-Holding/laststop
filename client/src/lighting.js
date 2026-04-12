import * as THREE from 'three';
import { CAR_LENGTH, CAR_HEIGHT } from './train.js';

const TUBE_COUNT = 6;
const TUBE_SPACING = (CAR_LENGTH - 2) / (TUBE_COUNT - 1);
const TUBE_START_Z = -(CAR_LENGTH - 2) / 2;

export function createCarLighting(scene) {
  const tubes = [];
  const ambientLight = new THREE.AmbientLight(0x403828, 0.6);
  scene.add(ambientLight);

  // Fluorescent tube lights along the ceiling
  for (let i = 0; i < TUBE_COUNT; i++) {
    const z = TUBE_START_Z + i * TUBE_SPACING;

    // Emissive tube mesh (visible light fixture)
    const tubeGeo = new THREE.BoxGeometry(0.6, 0.04, 0.12);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0xfff8e0,
      emissive: 0xfff8e0,
      emissiveIntensity: 1.5,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    tubeMesh.position.set(0, CAR_HEIGHT - 0.04, z);
    scene.add(tubeMesh);

    // Housing/fixture
    const housingGeo = new THREE.BoxGeometry(0.7, 0.06, 0.18);
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });
    const housing = new THREE.Mesh(housingGeo, housingMat);
    housing.position.set(0, CAR_HEIGHT - 0.01, z);
    scene.add(housing);

    // Point light for actual illumination
    const light = new THREE.PointLight(0xffe8c0, 2.0, 10, 1.2);
    light.position.set(0, CAR_HEIGHT - 0.1, z);
    scene.add(light);

    tubes.push({
      mesh: tubeMesh,
      light,
      material: tubeMat,
      baseIntensity: 2.0,
      // Flicker state
      on: true,
      nextFlicker: Math.random() * 3 + 1,
      flickerTimer: 0,
      flickerDuration: 0,
      flickerPhase: 'steady',
    });
  }

  // Fog for atmosphere
  scene.fog = new THREE.FogExp2(0x0a0a08, 0.025);

  function update(dt) {
    for (const tube of tubes) {
      tube.flickerTimer += dt;

      switch (tube.flickerPhase) {
        case 'steady':
          if (tube.flickerTimer >= tube.nextFlicker) {
            tube.flickerPhase = 'flickering';
            tube.flickerTimer = 0;
            tube.flickerDuration = Math.random() * 0.6 + 0.1;
          }
          break;

        case 'flickering': {
          // Rapid on/off during flicker
          const flickRate = Math.sin(tube.flickerTimer * 40) > 0;
          setTubeState(tube, flickRate);

          if (tube.flickerTimer >= tube.flickerDuration) {
            tube.flickerPhase = 'steady';
            tube.flickerTimer = 0;
            tube.nextFlicker = Math.random() * 5 + 2;
            setTubeState(tube, true);
          }
          break;
        }
      }
    }
  }

  function setTubeState(tube, on) {
    tube.on = on;
    tube.light.intensity = on ? tube.baseIntensity : 0.05;
    tube.material.emissiveIntensity = on ? 1.5 : 0.05;
  }

  return { tubes, ambientLight, update };
}
