// Environmental storytelling — per-car bomber evidence and silhouette
import * as THREE from 'three';
import { HALF_WIDTH, HALF_LENGTH, CAR_HEIGHT } from './train.js';

// Per-car environmental details
const CAR_DETAILS = {
  // Car 1: Lived-in tutorial car — subtle signs of a normal commute interrupted
  1: [
    {
      type: 'newspaper',
      create(scene) {
        const group = new THREE.Group();
        // Crumpled newspaper on the floor (flat quad, slightly angled)
        const geo = new THREE.PlaneGeometry(0.35, 0.25);
        const mat = new THREE.MeshStandardMaterial({
          color: 0xd8d0b8,
          roughness: 1,
          side: THREE.DoubleSide,
        });
        const paper = new THREE.Mesh(geo, mat);
        paper.rotation.x = -Math.PI / 2 + 0.05;
        paper.rotation.z = 0.3;
        paper.position.set(0.3, 0.01, 3.5);
        group.add(paper);

        // Headline text (tiny canvas texture)
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#d8d0b8';
        ctx.fillRect(0, 0, 256, 180);
        ctx.fillStyle = '#222222';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('DAILY NEWS', 20, 35);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#555555';
        ctx.fillText('MTA Budget Woes Continue', 20, 60);
        ctx.fillText('as Ridership Hits Record', 20, 78);
        // Column lines
        for (let y = 95; y < 170; y += 8) {
          ctx.fillStyle = `rgba(100,100,100,${0.15 + Math.random() * 0.15})`;
          ctx.fillRect(20, y, 100, 4);
          ctx.fillRect(135, y, 100, 4);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        paper.material = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 1,
          side: THREE.DoubleSide,
        });

        scene.add(group);
        return { group };
      },
    },
    {
      type: 'coffee-cup-floor',
      create(scene) {
        const group = new THREE.Group();
        // Tipped-over paper coffee cup
        const cupGeo = new THREE.CylinderGeometry(0.032, 0.027, 0.12, 8);
        const cupMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.8 });
        const cup = new THREE.Mesh(cupGeo, cupMat);
        cup.position.set(-0.4, 0.032, -2.0);
        cup.rotation.z = Math.PI / 2 + 0.15;
        cup.rotation.y = 0.8;
        group.add(cup);

        // Brown band on cup
        const bandGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.035, 8);
        const bandMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.position.copy(cup.position);
        band.rotation.copy(cup.rotation);
        group.add(band);

        // Lid nearby
        const lidGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.008, 8);
        const lidMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const lid = new THREE.Mesh(lidGeo, lidMat);
        lid.position.set(-0.25, 0.005, -1.9);
        lid.rotation.x = -Math.PI / 2;
        group.add(lid);

        // Small coffee spill stain
        const spillGeo = new THREE.CircleGeometry(0.08, 8);
        const spillMat = new THREE.MeshStandardMaterial({
          color: 0x1a0e05,
          transparent: true,
          opacity: 0.25,
          roughness: 1,
          side: THREE.DoubleSide,
        });
        const spill = new THREE.Mesh(spillGeo, spillMat);
        spill.rotation.x = -Math.PI / 2;
        spill.position.set(-0.35, 0.003, -2.05);
        group.add(spill);

        scene.add(group);
        return { group };
      },
    },
    {
      type: 'candy-wrapper',
      create(scene) {
        const group = new THREE.Group();
        // Small shiny candy wrapper on the floor
        const geo = new THREE.PlaneGeometry(0.06, 0.04);
        const mat = new THREE.MeshStandardMaterial({
          color: 0xcc2222,
          metalness: 0.5,
          roughness: 0.3,
          side: THREE.DoubleSide,
        });
        const wrapper = new THREE.Mesh(geo, mat);
        wrapper.rotation.x = -Math.PI / 2 + 0.1;
        wrapper.rotation.z = 1.2;
        wrapper.position.set(0.6, 0.005, 0.5);
        group.add(wrapper);

        // Second wrapper (different color, different spot)
        const wrapper2 = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
          color: 0x2255cc,
          metalness: 0.5,
          roughness: 0.3,
          side: THREE.DoubleSide,
        }));
        wrapper2.rotation.x = -Math.PI / 2;
        wrapper2.rotation.z = 2.5;
        wrapper2.position.set(-0.15, 0.005, 5.0);
        group.add(wrapper2);

        scene.add(group);
        return { group };
      },
    },
    {
      type: 'scuff-marks',
      create(scene) {
        const group = new THREE.Group();
        // Dark scuff marks near the front door
        const scuffMat = new THREE.MeshStandardMaterial({
          color: 0x080808,
          transparent: true,
          opacity: 0.2,
          roughness: 1,
          side: THREE.DoubleSide,
        });
        const scuffPositions = [
          { x: 0.1, z: -HALF_LENGTH + 0.5, w: 0.15, h: 0.06, rot: 0.2 },
          { x: -0.2, z: -HALF_LENGTH + 0.8, w: 0.12, h: 0.05, rot: -0.1 },
          { x: 0.0, z: -HALF_LENGTH + 0.3, w: 0.18, h: 0.04, rot: 0.4 },
          // Near back door too
          { x: 0.15, z: HALF_LENGTH - 0.4, w: 0.14, h: 0.05, rot: -0.3 },
          { x: -0.1, z: HALF_LENGTH - 0.7, w: 0.1, h: 0.04, rot: 0.15 },
        ];
        for (const s of scuffPositions) {
          const geo = new THREE.PlaneGeometry(s.w, s.h);
          const scuff = new THREE.Mesh(geo, scuffMat);
          scuff.rotation.x = -Math.PI / 2;
          scuff.rotation.z = s.rot;
          scuff.position.set(s.x, 0.003, s.z);
          group.add(scuff);
        }
        scene.add(group);
        return { group };
      },
    },
    {
      type: 'ceiling-stain',
      create(scene) {
        const group = new THREE.Group();
        // Yellowish water stain on ceiling
        const stainGeo = new THREE.CircleGeometry(0.25, 12);
        const stainMat = new THREE.MeshStandardMaterial({
          color: 0x8a7a50,
          transparent: true,
          opacity: 0.12,
          roughness: 1,
          side: THREE.DoubleSide,
        });
        const stain = new THREE.Mesh(stainGeo, stainMat);
        stain.rotation.x = Math.PI / 2;
        stain.position.set(0.5, CAR_HEIGHT - 0.01, 1.5);
        group.add(stain);

        // Smaller ring around it
        const ringGeo = new THREE.RingGeometry(0.22, 0.28, 12);
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
          color: 0x6a5a30,
          transparent: true,
          opacity: 0.08,
          roughness: 1,
          side: THREE.DoubleSide,
        }));
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0.5, CAR_HEIGHT - 0.01, 1.5);
        group.add(ring);

        scene.add(group);
        return { group };
      },
    },
  ],
  // Car 2: Coffee cup left on a seat, still warm (steam particles)
  2: [
    {
      type: 'coffee-cup',
      create(scene) {
        const group = new THREE.Group();

        // Cup body
        const cupGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.1, 8);
        const cupMat = new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.4 });
        const cup = new THREE.Mesh(cupGeo, cupMat);
        cup.position.set(-0.6, 0.48, 2.5);
        group.add(cup);

        // Lid
        const lidGeo = new THREE.CylinderGeometry(0.037, 0.037, 0.01, 8);
        const lidMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const lid = new THREE.Mesh(lidGeo, lidMat);
        lid.position.set(-0.6, 0.535, 2.5);
        group.add(lid);

        // Steam particles (simple rising sprites)
        const steamGroup = new THREE.Group();
        steamGroup.position.set(-0.6, 0.55, 2.5);
        const steamParticles = [];
        for (let i = 0; i < 6; i++) {
          const spriteMat = new THREE.SpriteMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.15,
          });
          const sprite = new THREE.Sprite(spriteMat);
          sprite.scale.set(0.03, 0.03, 1);
          sprite.position.y = Math.random() * 0.15;
          sprite.userData.speed = 0.02 + Math.random() * 0.02;
          sprite.userData.baseX = (Math.random() - 0.5) * 0.03;
          steamGroup.add(sprite);
          steamParticles.push(sprite);
        }
        group.add(steamGroup);

        scene.add(group);

        return {
          group,
          update(dt) {
            for (const p of steamParticles) {
              p.position.y += p.userData.speed * dt;
              p.position.x = p.userData.baseX + Math.sin(p.position.y * 10) * 0.01;
              p.material.opacity = 0.15 * (1 - p.position.y / 0.2);
              if (p.position.y > 0.2) {
                p.position.y = 0;
                p.material.opacity = 0.15;
              }
            }
          },
        };
      },
    },
  ],
  // Car 3: Emergency panel tampered with — hanging open with cut wires
  3: [
    {
      type: 'tampered-panel',
      create(scene) {
        const group = new THREE.Group();
        const panelX = HALF_WIDTH - 0.05;

        // Panel door (hanging open)
        const panelGeo = new THREE.BoxGeometry(0.01, 0.25, 0.2);
        const panelMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6 });
        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.position.set(panelX - 0.1, 1.2, -3);
        panel.rotation.y = 0.6;
        group.add(panel);

        // Interior of panel (dark)
        const interiorGeo = new THREE.BoxGeometry(0.08, 0.22, 0.18);
        const interiorMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const interior = new THREE.Mesh(interiorGeo, interiorMat);
        interior.position.set(panelX, 1.2, -3);
        group.add(interior);

        // Cut wires dangling
        const wireColors = [0xff0000, 0x0000ff, 0x00ff00, 0xffff00];
        for (let i = 0; i < 4; i++) {
          const wireGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.12, 4);
          const wireMat = new THREE.MeshStandardMaterial({ color: wireColors[i] });
          const wire = new THREE.Mesh(wireGeo, wireMat);
          wire.position.set(panelX - 0.02, 1.12, -3 + (i - 1.5) * 0.04);
          wire.rotation.x = 0.3 + Math.random() * 0.4;
          wire.rotation.z = (Math.random() - 0.5) * 0.3;
          group.add(wire);
        }

        scene.add(group);
        return { group };
      },
    },
  ],
  // Car 4: Smashed security camera
  4: [
    {
      type: 'smashed-camera',
      create(scene) {
        const group = new THREE.Group();

        // Camera body (dented)
        const bodyGeo = new THREE.BoxGeometry(0.08, 0.06, 0.1);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(HALF_WIDTH - 0.1, CAR_HEIGHT - 0.08, -HALF_LENGTH + 1);
        body.rotation.z = 0.3; // Hanging crooked
        group.add(body);

        // Smashed lens
        const lensGeo = new THREE.SphereGeometry(0.02, 6, 6);
        const lensMat = new THREE.MeshStandardMaterial({
          color: 0x111111,
          roughness: 0.2,
          metalness: 0.8,
        });
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.set(HALF_WIDTH - 0.08, CAR_HEIGHT - 0.08, -HALF_LENGTH + 0.95);
        lens.scale.set(1, 0.5, 1); // Crushed
        group.add(lens);

        // Broken bracket
        const bracketGeo = new THREE.BoxGeometry(0.04, 0.1, 0.04);
        const bracketMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
        const bracket = new THREE.Mesh(bracketGeo, bracketMat);
        bracket.position.set(HALF_WIDTH - 0.1, CAR_HEIGHT - 0.03, -HALF_LENGTH + 1);
        group.add(bracket);

        // Dangling wire from camera
        const wireGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.15, 4);
        const wireMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const wire = new THREE.Mesh(wireGeo, wireMat);
        wire.position.set(HALF_WIDTH - 0.12, CAR_HEIGHT - 0.15, -HALF_LENGTH + 1);
        wire.rotation.z = 0.2;
        group.add(wire);

        scene.add(group);
        return { group };
      },
    },
  ],
  // Car 5: Boot prints on the floor
  5: [
    {
      type: 'boot-prints',
      create(scene) {
        const group = new THREE.Group();

        // Create boot print decals on the floor
        const printGeo = new THREE.PlaneGeometry(0.12, 0.25);
        const printMat = new THREE.MeshStandardMaterial({
          color: 0x0d0d0d,
          transparent: true,
          opacity: 0.3,
          roughness: 1,
        });

        // Trail of prints leading forward (toward front of train)
        const positions = [
          { x: 0.1, z: 4, rot: 0.05 },
          { x: -0.05, z: 3, rot: -0.08 },
          { x: 0.15, z: 1.8, rot: 0.03 },
          { x: 0, z: 0.5, rot: -0.05 },
          { x: 0.1, z: -0.8, rot: 0.06 },
          { x: -0.1, z: -2.2, rot: -0.04 },
          { x: 0.05, z: -3.8, rot: 0.02 },
        ];

        for (const pos of positions) {
          const print = new THREE.Mesh(printGeo, printMat);
          print.rotation.x = -Math.PI / 2;
          print.position.set(pos.x, 0.005, pos.z);
          print.rotation.z = pos.rot;
          group.add(print);
        }

        scene.add(group);
        return { group };
      },
    },
  ],
  // Car 6: Scratches on wall — blade test marks
  6: [
    {
      type: 'blade-scratches',
      create(scene) {
        const group = new THREE.Group();

        // Scratch marks on the wall
        const scratchMat = new THREE.MeshStandardMaterial({
          color: 0xaaaaaa,
          metalness: 0.8,
          roughness: 0.2,
        });

        const wallX = -(HALF_WIDTH - 0.01);

        // Several diagonal scratch lines
        for (let i = 0; i < 5; i++) {
          const scratchGeo = new THREE.BoxGeometry(0.003, 0.15 + Math.random() * 0.1, 0.005);
          const scratch = new THREE.Mesh(scratchGeo, scratchMat);
          scratch.position.set(wallX, 1.0 + i * 0.05, 1.5 + i * 0.08);
          scratch.rotation.z = -0.3 + Math.random() * 0.2;
          group.add(scratch);
        }

        scene.add(group);
        return { group };
      },
    },
  ],
  // Car 7: Bomber's jacket left on a seat
  7: [
    {
      type: 'bomber-jacket',
      create(scene) {
        const group = new THREE.Group();

        // Dark jacket draped over a seat
        const jacketGeo = new THREE.BoxGeometry(0.4, 0.08, 0.5);
        const jacketMat = new THREE.MeshStandardMaterial({
          color: 0x1a1a1a,
          roughness: 0.9,
        });
        const jacket = new THREE.Mesh(jacketGeo, jacketMat);
        jacket.position.set(HALF_WIDTH - 0.3, 0.5, -2);
        jacket.rotation.y = 0.15;
        jacket.rotation.z = -0.05;
        group.add(jacket);

        // Sleeve hanging down
        const sleeveGeo = new THREE.BoxGeometry(0.1, 0.2, 0.12);
        const sleeve = new THREE.Mesh(sleeveGeo, jacketMat);
        sleeve.position.set(HALF_WIDTH - 0.1, 0.38, -1.85);
        sleeve.rotation.z = 0.3;
        group.add(sleeve);

        scene.add(group);
        return { group };
      },
    },
  ],
  // Car 8: Handled by the main puzzle (mannequin with bomb)
  8: [],
};

// Bomber silhouette visible from Car 5+ through front windows
let silhouette = null;

export function createSilhouette(scene, carNumber) {
  if (carNumber < 5 || silhouette) return null;

  // Dark figure standing motionless far ahead
  const group = new THREE.Group();

  // Body
  const bodyGeo = new THREE.CylinderGeometry(0.15, 0.18, 1.2, 6);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x050505,
    roughness: 1,
    emissive: 0x000000,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6;
  group.add(body);

  // Head
  const headGeo = new THREE.SphereGeometry(0.12, 6, 6);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.y = 1.3;
  group.add(head);

  // Position far ahead, barely visible through the front door/windows
  // Gets closer with each car
  const distance = (8 - carNumber) * 3 + 5;
  group.position.set(0, 0, -(HALF_LENGTH + distance));

  scene.add(group);
  silhouette = group;

  return group;
}

// Create environmental details for a specific car
export function createCarEnvironment(scene, carNumber) {
  const details = CAR_DETAILS[carNumber] || [];
  const instances = [];

  for (const detail of details) {
    const instance = detail.create(scene);
    instances.push(instance);
  }

  // Add silhouette for cars 5+
  createSilhouette(scene, carNumber);

  return {
    update(dt) {
      for (const instance of instances) {
        if (instance.update) instance.update(dt);
      }
    },
    dispose() {
      for (const instance of instances) {
        if (instance.group) {
          instance.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
          });
          if (instance.group.parent) instance.group.parent.remove(instance.group);
        }
      }
      if (silhouette) {
        silhouette.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        if (silhouette.parent) silhouette.parent.remove(silhouette);
        silhouette = null;
      }
    },
  };
}
