// Menu background: flickering fluorescent revealing a dark subway car + tension drone

let canvas = null;
let ctx = null;
let animId = null;
let audioCtx = null;
let audioNodes = null;
let lastTime = 0;
let flickerBrightness = 0;
let totalTime = 0;

// Flicker state machine
let flickerPhase = 'dark';
let phaseTimer = 0;
let stutterIndex = 0;
let stutterPattern = [];

// Pre-baked static noise texture (generated once)
let grainCanvas = null;

function generateStutterPattern() {
  const count = 3 + Math.floor(Math.random() * 4);
  const pattern = [];
  for (let i = 0; i < count; i++) {
    const progress = i / count;
    pattern.push([true, 0.03 + progress * 0.06 + Math.random() * 0.03]);
    pattern.push([false, 0.06 * (1 - progress * 0.7) + Math.random() * 0.03]);
  }
  pattern.push([true, 0.05 + Math.random() * 0.04]);
  pattern.push([false, 0.02]);
  return pattern;
}

function nextPhase() {
  phaseTimer = 0;
  if (flickerPhase === 'dark') {
    flickerPhase = 'stutter';
    stutterPattern = generateStutterPattern();
    stutterIndex = 0;
  } else if (flickerPhase === 'stutter') {
    flickerPhase = 'on';
  } else if (flickerPhase === 'on') {
    flickerPhase = 'dying';
  } else {
    flickerPhase = 'dark';
  }
}

function getTargetBrightness(dt) {
  phaseTimer += dt;
  if (flickerPhase === 'dark') {
    if (phaseTimer > 2.0 + Math.random() * 3.0) nextPhase();
    return 0;
  }
  if (flickerPhase === 'stutter') {
    if (stutterIndex >= stutterPattern.length) { nextPhase(); return 0.85; }
    const [isOn, dur] = stutterPattern[stutterIndex];
    if (phaseTimer > dur) { phaseTimer = 0; stutterIndex++; }
    return isOn ? (0.3 + Math.random() * 0.5) : 0;
  }
  if (flickerPhase === 'on') {
    const hum = Math.sin(totalTime * 120 * Math.PI) * 0.03;
    if (phaseTimer > 0.8 + Math.random() * 2.5) nextPhase();
    return 0.85 + hum + Math.random() * 0.02;
  }
  if (flickerPhase === 'dying') {
    const dieDur = 0.15 + Math.random() * 0.1;
    if (phaseTimer > dieDur) {
      if (Math.random() < 0.3 && phaseTimer < dieDur + 0.2) return Math.random() * 0.3;
      nextPhase();
      return 0;
    }
    return 0.85 * (1 - phaseTimer / dieDur);
  }
  return 0;
}

// --- Perspective projection ---
// x,y in [-1,1], z in [0,1] (0=near, 1=far)
function proj(x, y, z) {
  const w = canvas.width;
  const h = canvas.height;
  const vx = w * 0.5;
  const vy = h * 0.44;
  const s = 1 - z * 0.78;
  return [vx + x * w * 0.52 * s, vy + y * h * 0.52 * s];
}

function quad(pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

function line(p1, p2, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.stroke();
}

function rgba(r, g, b, a) {
  return `rgba(${r|0},${g|0},${b|0},${Math.min(1, Math.max(0, a))})`;
}

// Depth fog: things further away are dimmer/hazier
function fogMul(z, brightness) {
  return brightness * (1 - z * 0.55);
}

function initGrain(w, h) {
  grainCanvas = document.createElement('canvas');
  grainCanvas.width = w;
  grainCanvas.height = h;
  const gc = grainCanvas.getContext('2d');
  const img = gc.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() - 0.5) * 25;
    d[i] = 128 + v;
    d[i + 1] = 128 + v;
    d[i + 2] = 128 + v;
    d[i + 3] = 255;
  }
  gc.putImageData(img, 0, 0);
}

// --- Main draw ---
function drawCarriage(brightness) {
  const w = canvas.width;
  const h = canvas.height;

  // Black base
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  // Even in darkness, faint ambient from emergency/tunnel light
  const ambientBase = 0.015;
  const lit = Math.max(brightness, ambientBase);

  if (lit < 0.005) return;

  // Fluorescent color temperature
  const warm = Math.min(1, brightness / 0.7);
  const lr = 50 + 155 * warm;
  const lg = 60 + 130 * warm;
  const lb = 35 + 105 * warm;

  const ZSTEP = 0.04;
  const ZCOUNT = Math.ceil(1 / ZSTEP);

  // === SURFACES (back to front for proper overlap) ===

  for (let zi = ZCOUNT - 1; zi >= 0; zi--) {
    const z = zi * ZSTEP;
    const z2 = z + ZSTEP;
    const f = fogMul(z + ZSTEP * 0.5, lit);
    const f2 = f * 0.85; // walls slightly darker than floor/ceiling

    // --- Ceiling ---
    const ceilBright = f * 0.42;
    // Alternate slightly for panel strips
    const panelShade = (zi % 3 === 0) ? 0.95 : 1.0;
    quad([proj(-1, -1, z), proj(1, -1, z), proj(1, -1, z2), proj(-1, -1, z2)],
      rgba(38 * ceilBright * panelShade, 36 * ceilBright * panelShade, 33 * ceilBright * panelShade, 1));

    // Ceiling panel seam lines
    if (zi % 3 === 0) {
      line(proj(-1, -1, z), proj(1, -1, z), rgba(20 * f, 18 * f, 16 * f, 0.3), 0.5);
    }

    // --- Floor ---
    const floorBright = f * 0.38;
    // Speckled linoleum: slight per-strip color variation
    const floorTint = ((zi * 7) % 3) * 0.02;
    quad([proj(-1, 1, z), proj(1, 1, z), proj(1, 1, z2), proj(-1, 1, z2)],
      rgba((28 + floorTint * 60) * floorBright, (26 + floorTint * 30) * floorBright, 22 * floorBright, 1));

    // --- Left wall ---
    quad([proj(-1, -1, z), proj(-1, 1, z), proj(-1, 1, z2), proj(-1, -1, z2)],
      rgba(32 * f2, 30 * f2, 28 * f2, 1));

    // --- Right wall ---
    quad([proj(1, -1, z), proj(1, 1, z), proj(1, 1, z2), proj(1, -1, z2)],
      rgba(32 * f2, 30 * f2, 28 * f2, 1));
  }

  // === WALL TRIM STRIPS (horizontal lines along walls) ===
  for (const yy of [-0.7, 0.1]) {
    line(proj(-0.99, yy, 0.02), proj(-0.99, yy, 0.98), rgba(55 * lit, 50 * lit, 45 * lit, 0.3), 1);
    line(proj(0.99, yy, 0.02), proj(0.99, yy, 0.98), rgba(55 * lit, 50 * lit, 45 * lit, 0.3), 1);
  }

  // === FAR WALL ===
  const ff = fogMul(0.98, lit) * 0.35;
  quad([proj(-1, -1, 1), proj(1, -1, 1), proj(1, 1, 1), proj(-1, 1, 1)],
    rgba(25 * ff, 23 * ff, 20 * ff, 1));

  // Far door
  quad([proj(-0.22, -0.55, 0.99), proj(0.22, -0.55, 0.99),
        proj(0.22, 0.95, 0.99), proj(-0.22, 0.95, 0.99)],
    rgba(20 * ff, 18 * ff, 16 * ff, 1));
  // Door frame
  for (const dx of [-0.22, 0.22]) {
    line(proj(dx, -0.55, 0.985), proj(dx, 0.95, 0.985), rgba(50 * ff, 45 * ff, 40 * ff, 0.5), 1.5);
  }
  line(proj(-0.22, -0.55, 0.985), proj(0.22, -0.55, 0.985), rgba(50 * ff, 45 * ff, 40 * ff, 0.5), 1.5);
  // Door window
  quad([proj(-0.13, -0.45, 0.98), proj(0.13, -0.45, 0.98),
        proj(0.13, -0.1, 0.98), proj(-0.13, -0.1, 0.98)],
    rgba(3 * ff, 5 * ff, 12 * ff, 1));
  // Door handle
  line(proj(0.15, -0.1, 0.98), proj(0.15, 0.15, 0.98), rgba(80 * ff, 75 * ff, 65 * ff, 0.6), 2);

  // === WINDOWS with tunnel lights ===
  const windowDefs = [
    { z: 0.12, w: 0.14 },
    { z: 0.32, w: 0.14 },
    { z: 0.52, w: 0.14 },
    { z: 0.72, w: 0.14 },
  ];

  for (const wd of windowDefs) {
    const wz = wd.z;
    const ww = wd.w;
    const wf = fogMul(wz + ww * 0.5, lit);

    for (const side of [-1, 1]) {
      const sx = side * 0.99;

      // Window recess (slightly darker than wall)
      quad([proj(sx, -0.6, wz), proj(sx, 0.05, wz),
            proj(sx, 0.05, wz + ww), proj(sx, -0.6, wz + ww)],
        rgba(8 * wf, 10 * wf, 18 * wf, 1));

      // Tunnel rushing past — scrolling amber lights
      const lightPhase = (totalTime * 2.5 + wz * 3) % 3.0;
      if (lightPhase < 0.4) {
        const tunnelGlow = (0.4 - lightPhase) / 0.4 * wf * 0.5;
        const cx = proj(sx, -0.28, wz + ww * 0.5);
        const grd = ctx.createRadialGradient(cx[0], cx[1], 0, cx[0], cx[1], 30);
        grd.addColorStop(0, rgba(200, 150, 50, tunnelGlow));
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(cx[0] - 30, cx[1] - 30, 60, 60);
      }

      // Window frame
      const frameColor = rgba(50 * wf, 45 * wf, 40 * wf, 0.6);
      line(proj(sx, -0.6, wz), proj(sx, -0.6, wz + ww), frameColor, 1.5);
      line(proj(sx, 0.05, wz), proj(sx, 0.05, wz + ww), frameColor, 1.5);
      line(proj(sx, -0.6, wz), proj(sx, 0.05, wz), frameColor, 1);
      line(proj(sx, -0.6, wz + ww), proj(sx, 0.05, wz + ww), frameColor, 1);
    }
  }

  // === CONTINUOUS BENCH SEATS (NYC style — long benches along walls) ===
  const seatZStart = 0.06;
  const seatZEnd = 0.92;

  for (const side of [-1, 1]) {
    const wallX = side * 0.95;
    const innerX = side * 0.48;
    const seatTop = 0.3;
    const seatBot = 0.5;
    const backTop = -0.02;

    // Seat bench (continuous)
    const sf1 = fogMul(seatZStart, lit);
    const sf2 = fogMul(seatZEnd, lit);
    const avgF = (sf1 + sf2) * 0.5;

    // Seat cushion — top face
    quad([proj(wallX, seatTop, seatZStart), proj(innerX, seatTop, seatZStart),
          proj(innerX, seatTop, seatZEnd), proj(wallX, seatTop, seatZEnd)],
      rgba(58 * avgF, 42 * avgF, 28 * avgF, 1));

    // Seat front face
    quad([proj(innerX, seatTop, seatZStart), proj(innerX, seatBot, seatZStart),
          proj(innerX, seatBot, seatZEnd), proj(innerX, seatTop, seatZEnd)],
      rgba(42 * avgF, 30 * avgF, 20 * avgF, 1));

    // Seat back (against wall)
    quad([proj(wallX, backTop, seatZStart), proj(wallX, seatTop, seatZStart),
          proj(wallX, seatTop, seatZEnd), proj(wallX, backTop, seatZEnd)],
      rgba(48 * avgF, 34 * avgF, 22 * avgF, 1));

    // Individual seat dividers (metal armrests)
    for (let sz = 0.12; sz < 0.9; sz += 0.16) {
      const df = fogMul(sz, lit);
      line(proj(innerX, seatTop - 0.05, sz), proj(wallX, seatTop - 0.05, sz),
        rgba(85 * df, 80 * df, 70 * df, 0.5), 1.5);
    }

    // Wear marks on seat edges
    for (let sz = 0.1; sz < 0.9; sz += 0.08) {
      const df = fogMul(sz, lit);
      if (((sz * 100) | 0) % 3 === 0) {
        line(proj(innerX + side * 0.01, seatTop, sz), proj(innerX + side * 0.01, seatTop, sz + 0.04),
          rgba(35 * df, 25 * df, 18 * df, 0.4), 2);
      }
    }
  }

  // === AD PANELS above windows ===
  const adPositions = [0.15, 0.38, 0.58, 0.78];
  for (const az of adPositions) {
    for (const side of [-1, 1]) {
      const sx = side * 0.98;
      const af = fogMul(az, lit);
      // Panel background
      quad([proj(sx, -0.78, az), proj(sx, -0.63, az),
            proj(sx, -0.63, az + 0.12), proj(sx, -0.78, az + 0.12)],
        rgba(70 * af, 62 * af, 52 * af, 1));
      // Panel border
      const borderColor = rgba(45 * af, 40 * af, 35 * af, 0.4);
      line(proj(sx, -0.78, az), proj(sx, -0.78, az + 0.12), borderColor, 0.5);
      line(proj(sx, -0.63, az), proj(sx, -0.63, az + 0.12), borderColor, 0.5);
    }
  }

  // === GRAB POLES (floor to ceiling) ===
  const polePosZ = [0.22, 0.46, 0.7];
  for (const pz of polePosZ) {
    const pf = fogMul(pz, lit);
    for (const px of [-0.44, 0.44]) {
      // Main pole
      line(proj(px, -0.98, pz), proj(px, 0.95, pz),
        rgba(130 * pf, 125 * pf, 110 * pf, 0.9), 2.5);
      // Pole highlight (metallic sheen)
      line(proj(px - 0.005, -0.98, pz), proj(px - 0.005, 0.95, pz),
        rgba(170 * pf, 165 * pf, 150 * pf, 0.2), 1);
    }
  }

  // === CEILING HANDRAIL BARS ===
  for (const side of [-0.58, 0.58]) {
    line(proj(side, -0.85, 0.04), proj(side, -0.85, 0.96),
      rgba(110 * lit, 105 * lit, 95 * lit, 0.7), 1.5);
  }

  // === HANGING STRAP HANDLES ===
  for (let sz = 0.1; sz < 0.95; sz += 0.09) {
    const sf = fogMul(sz, lit);
    for (const side of [-0.58, 0.58]) {
      const top = proj(side, -0.85, sz);
      const mid = proj(side, -0.7, sz);
      // Strap
      line(top, mid, rgba(60 * sf, 55 * sf, 45 * sf, 0.6), 1);
      // Loop handle (rounded rect approximation)
      const bx = mid[0], by = mid[1];
      const loopW = 4 * (1 - sz * 0.5);
      const loopH = 5 * (1 - sz * 0.5);
      ctx.strokeStyle = rgba(90 * sf, 85 * sf, 70 * sf, 0.7);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(bx - loopW, by, loopW * 2, loopH, 2);
      ctx.stroke();
    }
  }

  // === FLUORESCENT LIGHT TUBES ===
  const tubePosZ = [0.15, 0.45, 0.75];
  for (const tz of tubePosZ) {
    const tf = fogMul(tz, brightness);
    if (tf < 0.01) continue;

    const tubeA = Math.min(1, tf * 1.3);

    // Tube housing (dark metal fixture)
    quad([proj(-0.25, -0.98, tz - 0.01), proj(0.25, -0.98, tz - 0.01),
          proj(0.25, -0.98, tz + 0.01), proj(-0.25, -0.98, tz + 0.01)],
      rgba(40 * lit, 38 * lit, 35 * lit, 1));

    // Glowing tube
    line(proj(-0.22, -0.96, tz), proj(0.22, -0.96, tz),
      rgba(lr * tubeA, lg * tubeA, lb * tubeA, tubeA), 3.5);

    // Hot center glow
    const center = proj(0, -0.96, tz);
    const hotGrd = ctx.createRadialGradient(center[0], center[1], 0, center[0], center[1], 15);
    hotGrd.addColorStop(0, rgba(255, 250, 230, tubeA * 0.4));
    hotGrd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hotGrd;
    ctx.fillRect(center[0] - 15, center[1] - 15, 30, 30);

    // Downward light cone
    const coneCenter = proj(0, -0.5, tz);
    const coneR = h * 0.55 * (1 - tz * 0.4);
    const cone = ctx.createRadialGradient(center[0], center[1], 0, coneCenter[0], coneCenter[1], coneR);
    cone.addColorStop(0, rgba(lr, lg, lb, tubeA * 0.1));
    cone.addColorStop(0.4, rgba(lr, lg, lb, tubeA * 0.03));
    cone.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cone;
    ctx.fillRect(0, 0, w, h);
  }

  // === FLOOR REFLECTIONS ===
  if (brightness > 0.2) {
    for (const tz of tubePosZ) {
      const rf = fogMul(tz, brightness - 0.2) * 0.12;
      if (rf < 0.005) continue;
      const refPt = proj(0, 0.9, tz);
      const refGrd = ctx.createRadialGradient(refPt[0], refPt[1], 0, refPt[0], refPt[1], h * 0.12);
      refGrd.addColorStop(0, rgba(lr, lg, lb, rf));
      refGrd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = refGrd;
      ctx.fillRect(refPt[0] - h * 0.12, refPt[1] - h * 0.12, h * 0.24, h * 0.24);
    }

    // Wet-look highlight streak down center of floor
    const streakA = (brightness - 0.2) * 0.04;
    const streakGrd = ctx.createLinearGradient(w * 0.4, 0, w * 0.6, 0);
    streakGrd.addColorStop(0, 'rgba(0,0,0,0)');
    streakGrd.addColorStop(0.5, rgba(lr, lg, lb, streakA));
    streakGrd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = streakGrd;
    const floorTop = proj(0, 0.6, 0)[1];
    const floorBot = proj(0, 1, 0)[1];
    ctx.fillRect(0, floorTop, w, floorBot - floorTop);
  }

  // === ATMOSPHERIC HAZE (dust in the light) ===
  if (brightness > 0.3) {
    const hazeA = (brightness - 0.3) * 0.06;
    const vp = proj(0, -0.5, 0.5);
    const hazeGrd = ctx.createRadialGradient(vp[0], vp[1], 0, vp[0], vp[1], h * 0.6);
    hazeGrd.addColorStop(0, rgba(lr * 0.7, lg * 0.7, lb * 0.5, hazeA));
    hazeGrd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hazeGrd;
    ctx.fillRect(0, 0, w, h);
  }

  // === DEPTH FOG (far end of car fades to black) ===
  const vp = proj(0, 0, 1);
  const fogGrd = ctx.createRadialGradient(vp[0], vp[1], 0, vp[0], vp[1], w * 0.65);
  fogGrd.addColorStop(0, `rgba(0,0,0,${0.5 * lit})`);
  fogGrd.addColorStop(0.5, 'rgba(0,0,0,0)');
  fogGrd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fogGrd;
  ctx.fillRect(0, 0, w, h);

  // === VIGNETTE (darkened edges) ===
  const vigGrd = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.25, w * 0.5, h * 0.5, w * 0.7);
  vigGrd.addColorStop(0, 'rgba(0,0,0,0)');
  vigGrd.addColorStop(1, `rgba(0,0,0,${0.3 + (1 - brightness) * 0.5})`);
  ctx.fillStyle = vigGrd;
  ctx.fillRect(0, 0, w, h);

  // === FILM GRAIN (composited from pre-baked texture) ===
  if (brightness > 0.04 && grainCanvas) {
    ctx.globalAlpha = brightness * 0.07;
    ctx.globalCompositeOperation = 'overlay';
    // Offset randomly each frame for crawling grain
    const ox = (Math.random() * 60) | 0;
    const oy = (Math.random() * 60) | 0;
    ctx.drawImage(grainCanvas, ox, oy, w, h, 0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

}

function frame(timestamp) {
  animId = requestAnimationFrame(frame);
  const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.1) : 0.016;
  lastTime = timestamp;
  totalTime += dt;

  const target = getTargetBrightness(dt);
  if (target > flickerBrightness) {
    flickerBrightness = target;
  } else {
    flickerBrightness += (target - flickerBrightness) * Math.min(1, dt * 12);
  }

  // Drive fluorescent buzz volume to match light brightness
  if (audioNodes && audioNodes.buzzGain && audioCtx) {
    const buzzTarget = flickerBrightness * 0.12;
    audioNodes.buzzGain.gain.setTargetAtTime(buzzTarget, audioCtx.currentTime, 0.01);
  }

  drawCarriage(flickerBrightness);
}

// --- Audio: tension drone + train rumble + fluorescent buzz ---
function startDrone() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Resume immediately — must happen inside a user gesture handler
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const master = audioCtx.createGain();
    master.gain.value = 0.35;
    master.connect(audioCtx.destination);

    // --- Tension drone ---
    const bass = audioCtx.createOscillator();
    bass.type = 'sine';
    bass.frequency.value = 38;
    const bassGain = audioCtx.createGain();
    bassGain.gain.value = 0.3;
    bass.connect(bassGain);
    bassGain.connect(master);
    bass.start();

    const mid = audioCtx.createOscillator();
    mid.type = 'sine';
    mid.frequency.value = 58;
    const midLfo = audioCtx.createOscillator();
    midLfo.type = 'sine';
    midLfo.frequency.value = 0.15;
    const midLfoGain = audioCtx.createGain();
    midLfoGain.gain.value = 3;
    midLfo.connect(midLfoGain);
    midLfoGain.connect(mid.frequency);
    const midGain = audioCtx.createGain();
    midGain.gain.value = 0.15;
    mid.connect(midGain);
    midGain.connect(master);
    mid.start();
    midLfo.start();

    const high = audioCtx.createOscillator();
    high.type = 'sine';
    high.frequency.value = 277;
    const highLfo = audioCtx.createOscillator();
    highLfo.type = 'sine';
    highLfo.frequency.value = 0.08;
    const highLfoGain = audioCtx.createGain();
    highLfoGain.gain.value = 5;
    highLfo.connect(highLfoGain);
    highLfoGain.connect(high.frequency);
    const highGain = audioCtx.createGain();
    highGain.gain.value = 0.05;
    high.connect(highGain);
    highGain.connect(master);
    high.start();
    highLfo.start();

    // --- Train rumble (constant background) ---
    // Brown noise through a low-pass for deep rumble
    const rumbleLen = audioCtx.sampleRate * 4;
    const rumbleBuf = audioCtx.createBuffer(1, rumbleLen, audioCtx.sampleRate);
    const rumbleData = rumbleBuf.getChannelData(0);
    let rv = 0;
    for (let i = 0; i < rumbleLen; i++) {
      rv = (rv + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      rumbleData[i] = rv * 3.5;
    }
    const rumble = audioCtx.createBufferSource();
    rumble.buffer = rumbleBuf;
    rumble.loop = true;
    const rumbleLp = audioCtx.createBiquadFilter();
    rumbleLp.type = 'lowpass';
    rumbleLp.frequency.value = 80;
    rumbleLp.Q.value = 0.5;
    const rumbleGain = audioCtx.createGain();
    rumbleGain.gain.value = 0.4;
    rumble.connect(rumbleLp);
    rumbleLp.connect(rumbleGain);
    rumbleGain.connect(master);
    rumble.start();

    // Subtle wheel-on-rail sine undertone
    const wheelOsc = audioCtx.createOscillator();
    wheelOsc.type = 'sine';
    wheelOsc.frequency.value = 28;
    const wheelGain = audioCtx.createGain();
    wheelGain.gain.value = 0.12;
    wheelOsc.connect(wheelGain);
    wheelGain.connect(master);
    wheelOsc.start();

    // Higher rattle layer — filtered white noise for metallic clatter
    const rattleLen = audioCtx.sampleRate * 2;
    const rattleBuf = audioCtx.createBuffer(1, rattleLen, audioCtx.sampleRate);
    const rattleData = rattleBuf.getChannelData(0);
    for (let i = 0; i < rattleLen; i++) {
      rattleData[i] = Math.random() * 2 - 1;
    }
    const rattle = audioCtx.createBufferSource();
    rattle.buffer = rattleBuf;
    rattle.loop = true;
    const rattleBp = audioCtx.createBiquadFilter();
    rattleBp.type = 'bandpass';
    rattleBp.frequency.value = 300;
    rattleBp.Q.value = 2;
    const rattleGain = audioCtx.createGain();
    rattleGain.gain.value = 0.04;
    rattle.connect(rattleBp);
    rattleBp.connect(rattleGain);
    rattleGain.connect(master);
    rattle.start();

    // --- Fluorescent buzz (driven by flickerBrightness each frame) ---
    // 120Hz hum (doubled mains) + 240Hz harmonic
    const buzz120 = audioCtx.createOscillator();
    buzz120.type = 'sine';
    buzz120.frequency.value = 120;
    const buzz240 = audioCtx.createOscillator();
    buzz240.type = 'sine';
    buzz240.frequency.value = 240;
    const buzz240vol = audioCtx.createGain();
    buzz240vol.gain.value = 0.3; // harmonic is quieter
    buzz240.connect(buzz240vol);

    // Buzz output gain — controlled per-frame to match light
    const buzzGain = audioCtx.createGain();
    buzzGain.gain.value = 0;
    buzz120.connect(buzzGain);
    buzz240vol.connect(buzzGain);
    buzzGain.connect(master);
    buzz120.start();
    buzz240.start();

    audioNodes = {
      master, bass, mid, midLfo, high, highLfo,
      rumble, wheelOsc, rattle,
      buzz120, buzz240, buzzGain,
    };
  } catch (e) { console.warn('Menu audio failed:', e); }
}

function stopDrone() {
  if (!audioNodes || !audioCtx) return;
  const now = audioCtx.currentTime;
  audioNodes.master.gain.setValueAtTime(audioNodes.master.gain.value, now);
  audioNodes.master.gain.linearRampToValueAtTime(0, now + 0.8);
  setTimeout(() => {
    try {
      audioNodes.bass.stop();
      audioNodes.mid.stop();
      audioNodes.midLfo.stop();
      audioNodes.high.stop();
      audioNodes.highLfo.stop();
      audioNodes.rumble.stop();
      audioNodes.wheelOsc.stop();
      audioNodes.rattle.stop();
      audioNodes.buzz120.stop();
      audioNodes.buzz240.stop();
      audioCtx.close();
    } catch (e) { /* ok */ }
    audioNodes = null;
    audioCtx = null;
  }, 900);
}

// --- Public API ---

export function startMenuBackground() {
  if (canvas) return;

  canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  canvas.id = 'menu-bg-canvas';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:999;pointer-events:none;';
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');

  if (!grainCanvas) initGrain(canvas.width + 60, canvas.height + 60);

  flickerPhase = 'dark';
  phaseTimer = 0;
  flickerBrightness = 0;
  totalTime = 0;
  lastTime = 0;
  animId = requestAnimationFrame(frame);

  const startAudioOnce = () => {
    if (!audioNodes) startDrone();
    document.removeEventListener('click', startAudioOnce, true);
    document.removeEventListener('keydown', startAudioOnce, true);
    document.removeEventListener('pointerdown', startAudioOnce, true);
  };
  document.addEventListener('click', startAudioOnce, true);
  document.addEventListener('keydown', startAudioOnce, true);
  document.addEventListener('pointerdown', startAudioOnce, true);
}

export function stopMenuBackground() {
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  if (canvas) { canvas.remove(); canvas = null; ctx = null; }
  stopDrone();
}
