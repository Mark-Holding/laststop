// Atmospheric dust motes floating in fluorescent light
import * as THREE from 'three';
import { CAR_HEIGHT, HALF_WIDTH, HALF_LENGTH } from './train.js';

const PARTICLE_COUNT = 88;

export function createDustParticles(scene) {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const velocities = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * (HALF_WIDTH * 2 - 0.4);
    positions[i3 + 1] = Math.random() * CAR_HEIGHT;
    positions[i3 + 2] = (Math.random() - 0.5) * (HALF_LENGTH * 2 - 1);

    velocities[i3] = (Math.random() - 0.5) * 0.005;
    velocities[i3 + 1] = Math.random() * 0.00375 + 0.00125;
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.0025;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xfff8e0,
    size: 0.012,
    transparent: true,
    opacity: 0.3,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  return {
    points,

    update(dt, lightingTubes) {
      const pos = geometry.attributes.position.array;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        pos[i3] += velocities[i3] * dt * 60;
        pos[i3 + 1] += velocities[i3 + 1] * dt * 60;
        pos[i3 + 2] += velocities[i3 + 2] * dt * 60;

        // Slight wandering drift
        velocities[i3] += (Math.random() - 0.5) * 0.001;
        velocities[i3 + 2] += (Math.random() - 0.5) * 0.001;
        velocities[i3] = Math.max(-0.03, Math.min(0.03, velocities[i3]));
        velocities[i3 + 2] = Math.max(-0.02, Math.min(0.02, velocities[i3 + 2]));

        // Wrap when out of bounds
        if (pos[i3 + 1] > CAR_HEIGHT) {
          pos[i3 + 1] = 0.1;
          pos[i3] = (Math.random() - 0.5) * (HALF_WIDTH * 2 - 0.4);
          pos[i3 + 2] = (Math.random() - 0.5) * (HALF_LENGTH * 2 - 1);
        }
        if (Math.abs(pos[i3]) > HALF_WIDTH - 0.2) {
          pos[i3] *= -0.8;
        }
        if (Math.abs(pos[i3 + 2]) > HALF_LENGTH - 0.5) {
          pos[i3 + 2] *= -0.8;
        }
      }

      geometry.attributes.position.needsUpdate = true;

      // Overall opacity tracks how many lights are on
      if (lightingTubes) {
        let litCount = 0;
        for (const tube of lightingTubes) {
          if (tube.on) litCount++;
        }
        material.opacity = 0.12 + (litCount / Math.max(1, lightingTubes.length)) * 0.25;
      }
    },

    dispose() {
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    },
  };
}
