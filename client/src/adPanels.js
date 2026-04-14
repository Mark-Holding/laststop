// Procedural subway ad panel textures — NYC-style diegetic ads
import * as THREE from 'three';
import { HALF_WIDTH } from './train.js';

const WINDOW_ZONE_START = -7.2;
const WINDOW_WIDTH = 1.1;
const WINDOW_DIVIDER = 0.35;
const SPACING = WINDOW_WIDTH + WINDOW_DIVIDER;
const AD_HEIGHT = 0.3;
const AD_Y = 0.95 + 0.75 + 0.05; // WINDOW_BOTTOM + WINDOW_HEIGHT + gap

const AD_TEMPLATES = [
  // Injury lawyer
  (ctx, w, h) => {
    ctx.fillStyle = '#cc2200';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${h * 0.35}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('HURT?', w * 0.5, h * 0.42);
    ctx.font = `bold ${h * 0.16}px sans-serif`;
    ctx.fillText('CALL 1-800-555-' + (1000 + Math.floor(Math.random() * 9000)), w * 0.5, h * 0.68);
    ctx.font = `${h * 0.1}px sans-serif`;
    ctx.fillText('Goldberg & Associates', w * 0.5, h * 0.9);
  },
  // Learn English
  (ctx, w, h) => {
    ctx.fillStyle = '#1a4a8a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffdd00';
    ctx.font = `bold ${h * 0.28}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('LEARN ENGLISH', w * 0.5, h * 0.35);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${h * 0.14}px sans-serif`;
    ctx.fillText('FREE CLASSES \u2022 CALL 311', w * 0.5, h * 0.6);
    ctx.font = `${h * 0.1}px sans-serif`;
    ctx.fillText('NYC Adult Education Program', w * 0.5, h * 0.82);
  },
  // Dermatologist (Dr. Zizmor homage)
  (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    const rainbow = ['#ff0000', '#ff8800', '#ffff00', '#00cc00', '#0066ff', '#8800cc'];
    const stripeH = h * 0.08;
    for (let i = 0; i < rainbow.length; i++) {
      ctx.fillStyle = rainbow[i];
      ctx.fillRect(i * w / rainbow.length, 0, w / rainbow.length + 1, stripeH);
    }
    ctx.fillStyle = '#333333';
    ctx.font = `bold ${h * 0.22}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('DR. ZELENKO', w * 0.5, h * 0.4);
    ctx.font = `${h * 0.12}px sans-serif`;
    ctx.fillText('Beautiful Clear Skin', w * 0.5, h * 0.58);
    ctx.fillStyle = '#cc0000';
    ctx.font = `bold ${h * 0.13}px sans-serif`;
    ctx.fillText('\u260e 718-555-SKIN', w * 0.5, h * 0.78);
  },
  // MTA service change
  (ctx, w, h) => {
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${h * 0.2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SERVICE CHANGES', w * 0.5, h * 0.3);
    ctx.font = `${h * 0.11}px sans-serif`;
    ctx.fillText('Planned work this weekend', w * 0.5, h * 0.5);
    const lines = ['A', 'C', 'E'];
    for (let i = 0; i < 3; i++) {
      const cx = w * 0.32 + i * h * 0.28;
      ctx.fillStyle = '#0039a6';
      ctx.beginPath();
      ctx.arc(cx, h * 0.74, h * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${h * 0.11}px sans-serif`;
      ctx.fillText(lines[i], cx, h * 0.77);
    }
  },
  // See Something Say Something
  (ctx, w, h) => {
    ctx.fillStyle = '#003322';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${h * 0.2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('IF YOU SEE', w * 0.5, h * 0.25);
    ctx.fillText('SOMETHING', w * 0.5, h * 0.48);
    ctx.fillStyle = '#ffcc00';
    ctx.font = `bold ${h * 0.22}px sans-serif`;
    ctx.fillText('SAY SOMETHING', w * 0.5, h * 0.76);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${h * 0.08}px sans-serif`;
    ctx.fillText('1-888-NYC-SAFE', w * 0.5, h * 0.93);
  },
  // College
  (ctx, w, h) => {
    ctx.fillStyle = '#2c1654';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${h * 0.18}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('YOUR FUTURE', w * 0.5, h * 0.28);
    ctx.fillText('STARTS HERE', w * 0.5, h * 0.48);
    ctx.fillStyle = '#ffaa00';
    ctx.font = `${h * 0.12}px sans-serif`;
    ctx.fillText('Monroe College', w * 0.5, h * 0.7);
    ctx.fillStyle = '#999999';
    ctx.font = `${h * 0.08}px sans-serif`;
    ctx.fillText('Apply Today \u2022 monroecollege.edu', w * 0.5, h * 0.88);
  },
  // Grocery delivery
  (ctx, w, h) => {
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${h * 0.32}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('FRESH DIRECT', w * 0.5, h * 0.38);
    ctx.font = `${h * 0.13}px sans-serif`;
    ctx.fillText('Groceries in 30 minutes', w * 0.5, h * 0.62);
    ctx.font = `${h * 0.1}px sans-serif`;
    ctx.fillText('Use code: SUBWAY', w * 0.5, h * 0.85);
  },
  // Missing person (fits the game's dark tone)
  (ctx, w, h) => {
    ctx.fillStyle = '#f0f0e8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#cc0000';
    ctx.font = `bold ${h * 0.18}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('MISSING', w * 0.5, h * 0.18);
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(w * 0.38, h * 0.24, w * 0.24, h * 0.38);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `${h * 0.08}px sans-serif`;
    ctx.fillText('[PHOTO]', w * 0.5, h * 0.45);
    ctx.fillStyle = '#333333';
    ctx.font = `${h * 0.1}px sans-serif`;
    ctx.fillText('Last seen: Chambers St Station', w * 0.5, h * 0.76);
    ctx.font = `${h * 0.08}px sans-serif`;
    ctx.fillText('If found, call NYPD Tips: 800-577-TIPS', w * 0.5, h * 0.92);
  },
  // Luxury real estate
  (ctx, w, h) => {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d4af37';
    ctx.font = `bold ${h * 0.24}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('LUXURY LIVING', w * 0.5, h * 0.38);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${h * 0.11}px sans-serif`;
    ctx.fillText('Studios from $2,850/mo', w * 0.5, h * 0.6);
    ctx.fillStyle = '#888888';
    ctx.font = `${h * 0.08}px sans-serif`;
    ctx.fillText('The Greenwich \u2022 Now Leasing', w * 0.5, h * 0.82);
  },
  // Pest control
  (ctx, w, h) => {
    ctx.fillStyle = '#222222';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff4444';
    ctx.font = `bold ${h * 0.28}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('RATS?', w * 0.5, h * 0.32);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${h * 0.18}px sans-serif`;
    ctx.fillText('BED BUGS?', w * 0.5, h * 0.56);
    ctx.fillStyle = '#00cc44';
    ctx.font = `bold ${h * 0.13}px sans-serif`;
    ctx.fillText('\u260e 212-555-PEST', w * 0.5, h * 0.78);
    ctx.fillStyle = '#777777';
    ctx.font = `${h * 0.08}px sans-serif`;
    ctx.fillText('24/7 Emergency Service', w * 0.5, h * 0.93);
  },
];

function applyAging(ctx, w, h) {
  const roll = Math.random();

  if (roll < 0.25) {
    // Marker scribble
    ctx.strokeStyle = `rgba(${Math.random() > 0.5 ? '0,0,0' : '50,50,180'},0.6)`;
    ctx.lineWidth = 2 + Math.random() * 2;
    ctx.beginPath();
    const sx = w * 0.15 + Math.random() * w * 0.3;
    const sy = h * 0.4 + Math.random() * h * 0.3;
    ctx.moveTo(sx, sy);
    for (let j = 0; j < 4 + Math.floor(Math.random() * 4); j++) {
      ctx.lineTo(sx + (Math.random() - 0.3) * 100, sy + (Math.random() - 0.5) * 50);
    }
    ctx.stroke();
  } else if (roll < 0.45) {
    // Water stain (bottom edge)
    ctx.fillStyle = 'rgba(70,60,40,0.12)';
    ctx.beginPath();
    ctx.ellipse(Math.random() * w, h * 0.88, w * 0.25, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (roll < 0.6) {
    // Peeling corner
    ctx.fillStyle = '#8a8878';
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w - w * 0.12, 0);
    ctx.lineTo(w, h * 0.18);
    ctx.closePath();
    ctx.fill();
  }

  // Universal slight yellowing
  ctx.fillStyle = 'rgba(50,45,25,0.06)';
  ctx.fillRect(0, 0, w, h);
}

export function createAdPanels(scene) {
  const panels = [];
  const textures = [];

  const shuffled = [...AD_TEMPLATES].sort(() => Math.random() - 0.5);
  let templateIdx = 0;

  for (const xSign of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const adZ = WINDOW_ZONE_START + (i * 2 + 0.5) * SPACING;
      const adWidth = SPACING * 1.8;

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      shuffled[templateIdx % shuffled.length](ctx, canvas.width, canvas.height);
      if (Math.random() < 0.55) applyAging(ctx, canvas.width, canvas.height);
      templateIdx++;

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      textures.push(texture);

      const geo = new THREE.PlaneGeometry(adWidth - 0.06, AD_HEIGHT - 0.03);
      const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 });
      const plane = new THREE.Mesh(geo, mat);

      plane.position.set(
        xSign * (HALF_WIDTH - 0.025),
        AD_Y + AD_HEIGHT / 2,
        adZ,
      );
      plane.rotation.y = xSign === -1 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(plane);
      panels.push(plane);
    }
  }

  return {
    panels,
    dispose() {
      for (const p of panels) {
        if (p.parent) p.parent.remove(p);
        p.geometry.dispose();
        p.material.dispose();
      }
      for (const t of textures) t.dispose();
    },
  };
}
