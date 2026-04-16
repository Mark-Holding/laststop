import * as THREE from 'three';
import { PuzzleBase } from './PuzzleBase.js';
import { Interactable } from '../interactable.js';

// Train geometry constants (match client/src/train.js)
const HALF_WIDTH = 1.3;
const HALF_LENGTH = 9;
const SEAT_DEPTH = 0.44;
const SEAT_HEIGHT = 0.42;
const SECTION_START_Z = -7.0;
const SECTION_LENGTH = 2.8;
const SECTION_STRIDE = SECTION_LENGTH + 0.4;
const WINDOW_BOTTOM = 0.95;
const WINDOW_HEIGHT = 0.75;
const WINDOW_ZONE_START = -7.2;
const WINDOW_WIDTH = 1.1;
const WINDOW_DIVIDER = 0.35;
const AD_SPACING = WINDOW_WIDTH + WINDOW_DIVIDER;

function sectionCenterZ(section) {
  return SECTION_START_Z + section * SECTION_STRIDE + SECTION_LENGTH / 2;
}

function seatWorldPos(seatIndex) {
  const side = seatIndex < 5 ? -1 : 1;
  const section = seatIndex % 5;
  return {
    x: side * (HALF_WIDTH - SEAT_DEPTH / 2),
    y: SEAT_HEIGHT,
    z: sectionCenterZ(section),
    side,
    section,
  };
}

// --- Canvas helpers ---

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.anisotropy = 4;
  return tex;
}

// --- Subway map texture (3D wall plane + overlay) ---

function drawSubwayMap(ctx, w, h, layout, opts = {}) {
  const { mapStations, mapStationPositions, mapLineNumbers } = layout;
  const { largeLabels = false } = opts;

  // Cream paper background
  ctx.fillStyle = '#e8e2cc';
  ctx.fillRect(0, 0, w, h);

  // Weathered edges
  ctx.fillStyle = 'rgba(80, 60, 40, 0.08)';
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillRect(x, y, Math.random() * 12, Math.random() * 12);
  }

  // Header
  ctx.fillStyle = '#22313e';
  ctx.fillRect(0, 0, w, h * 0.08);
  ctx.fillStyle = '#e8d49a';
  ctx.font = `bold ${largeLabels ? 28 : 18}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MTA SUBWAY — DOWNTOWN LINES', w / 2, h * 0.04);

  // Fake line routes (colored curves connecting random station points)
  const lineColors = ['#e4002b', '#0039a6', '#00933c', '#ff6319', '#a7a9ac', '#6e3f00'];
  const stationList = Object.keys(mapStationPositions);
  for (let li = 0; li < 4; li++) {
    ctx.strokeStyle = lineColors[li];
    ctx.lineWidth = largeLabels ? 6 : 3;
    ctx.beginPath();
    const path = [];
    const seed = (li * 7 + 3) % stationList.length;
    for (let i = 0; i < 3; i++) {
      const s = stationList[(seed + i * 2) % stationList.length];
      const p = mapStationPositions[s];
      path.push({ x: p.x * w, y: 0.08 * h + p.y * h * 0.9 });
    }
    if (path.length) {
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
    }
  }

  // Stations
  const dotR = largeLabels ? 10 : 5;
  const fontSize = largeLabels ? 18 : 11;
  for (const s of mapStations) {
    const p = mapStationPositions[s];
    const px = p.x * w;
    const py = 0.08 * h + p.y * h * 0.9;
    const line = mapLineNumbers[s];

    // Red ring marking this station as circled
    ctx.strokeStyle = '#c1272d';
    ctx.lineWidth = largeLabels ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(px, py, dotR * 2.6, 0, Math.PI * 2);
    ctx.stroke();

    // Station dot
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(px, py, dotR, 0, Math.PI * 2);
    ctx.fill();

    // Station label with line number
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const label = `${s} · ${line}`;
    // White halo for readability
    ctx.strokeStyle = 'rgba(255,255,245,0.9)';
    ctx.lineWidth = largeLabels ? 4 : 2.5;
    ctx.strokeText(label, px + dotR * 3.2, py);
    ctx.fillText(label, px + dotR * 3.2, py);
  }

  // Compass rose (bottom-right)
  ctx.fillStyle = '#333';
  ctx.font = `${largeLabels ? 14 : 9}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('N↑', w - 14, h - 12);
}

// --- Newspaper / crossword texture ---

function drawNewspaperThumbnail(ctx, w, h) {
  // Newsprint background
  ctx.fillStyle = '#d8d0b8';
  ctx.fillRect(0, 0, w, h);
  // Folded shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(w * 0.48, 0, 2, h);

  // Masthead
  ctx.fillStyle = '#1a1a1a';
  ctx.font = `bold ${h * 0.13}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('THE DAILY', w / 2, 6);

  // Tiny "text" lines
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(10, h * 0.28 + i * (h * 0.04), w * 0.38, 1.5);
  }

  // Crossword grid on right half
  const gx = w * 0.54, gy = h * 0.28;
  const cellSize = Math.min(w, h) * 0.06;
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      const x = gx + c * cellSize;
      const y = gy + r * cellSize;
      const blocked = (r + c * 3) % 5 === 0;
      ctx.fillStyle = blocked ? '#222' : '#f4ecd0';
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.strokeRect(x, y, cellSize, cellSize);
    }
  }
  // A few partial letters for flavor
  ctx.fillStyle = '#222';
  ctx.font = `bold ${cellSize * 0.6}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const samples = ['C', 'A', 'N', 'A', 'L'];
  for (let i = 0; i < samples.length; i++) {
    ctx.fillText(samples[i], gx + (i + 0.5) * cellSize, gy + 1.5 * cellSize);
  }

  // Pen marks + title
  ctx.fillStyle = '#22313e';
  ctx.font = `${h * 0.07}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('CROSSWORD', gx, gy - h * 0.02);
}

// --- Ticket stub texture ---

function drawTicketThumbnail(ctx, w, h) {
  ctx.fillStyle = '#f4e3c1';
  ctx.fillRect(0, 0, w, h);
  // Torn left edge
  ctx.fillStyle = '#d8cbaa';
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, 3 + Math.random() * 3, 4);
  }

  // "METROCARD" header
  ctx.fillStyle = '#c1272d';
  ctx.fillRect(8, 4, w - 16, h * 0.22);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${h * 0.17}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TRANSFER', w / 2, 4 + h * 0.11);

  // Body with dashed route indicator
  ctx.strokeStyle = '#555';
  ctx.setLineDash([3, 2]);
  ctx.beginPath();
  ctx.moveTo(10, h * 0.5);
  ctx.lineTo(w - 10, h * 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#222';
  ctx.font = `${h * 0.11}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('ROUTE GUIDE — READ →', w / 2, h * 0.7);
  ctx.font = `${h * 0.09}px sans-serif`;
  ctx.fillStyle = '#777';
  ctx.fillText('(PICK UP TO READ)', w / 2, h * 0.88);
}

// --- Hidden number scratch texture ---

function createHiddenNumberTexture(digit) {
  const canvas = makeCanvas(64, 64);
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 36px monospace';
  ctx.fillStyle = 'rgba(180, 170, 150, 0.4)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(digit), 32, 34);
  return canvasTexture(canvas);
}

// --- Overlay helpers ---

function createModalOverlay(titleText, bodyWidth = 560) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;display:none;z-index:300;' +
    'background:rgba(0,0,0,0.75);align-items:center;justify-content:center;' +
    'font-family:monospace;';

  const panel = document.createElement('div');
  panel.style.cssText =
    `width:${bodyWidth}px;max-width:92vw;max-height:88vh;overflow:auto;` +
    'background:#1a1814;border:2px solid #443;' +
    'border-radius:8px;padding:18px;color:#d8d0b8;';

  const title = document.createElement('div');
  title.style.cssText =
    'font-size:13px;color:#8a7a55;letter-spacing:2px;text-align:center;' +
    'margin-bottom:10px;text-transform:uppercase;';
  title.textContent = titleText;

  const body = document.createElement('div');

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'CLOSE (ESC)';
  closeBtn.style.cssText =
    'margin-top:12px;width:100%;padding:8px;background:#2a2620;' +
    'border:1px solid #554;color:#aaa;border-radius:4px;' +
    'font-family:monospace;font-size:12px;cursor:pointer;';

  panel.append(title, body, closeBtn);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  let onClose = null;

  function close() {
    overlay.style.display = 'none';
    if (onClose) onClose();
  }

  closeBtn.addEventListener('click', close);

  function onKeyDown(e) {
    if (e.key === 'Escape' && overlay.style.display === 'flex') close();
  }
  document.addEventListener('keydown', onKeyDown);

  return {
    body,
    el: overlay,
    show() { overlay.style.display = 'flex'; },
    hide() { overlay.style.display = 'none'; },
    setOnClose(cb) { onClose = cb; },
    get isOpen() { return overlay.style.display === 'flex'; },
    destroy() {
      document.removeEventListener('keydown', onKeyDown);
      overlay.remove();
    },
  };
}

// --- Map zoom overlay ---

function createMapOverlay(layout, onClose) {
  const modal = createModalOverlay('SUBWAY MAP', 720);
  modal.setOnClose(onClose);

  const canvas = makeCanvas(960, 720);
  canvas.style.cssText = 'width:100%;height:auto;display:block;border-radius:4px;';
  drawSubwayMap(canvas.getContext('2d'), canvas.width, canvas.height, layout, { largeLabels: true });
  modal.body.appendChild(canvas);

  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:11px;color:#665;text-align:center;margin-top:8px;';
  hint.textContent = 'Station labels: NAME · LINE NUMBER';
  modal.body.appendChild(hint);

  return modal;
}

// --- Crossword overlay ---

function createCrosswordOverlay(layout, onClose) {
  const modal = createModalOverlay('CROSSWORD — HALF COMPLETED', 520);
  modal.setOnClose(onClose);

  const intro = document.createElement('div');
  intro.style.cssText = 'font-size:12px;color:#8a7a55;margin-bottom:10px;line-height:1.5;';
  intro.textContent =
    'Someone abandoned this puzzle mid-solve. Station names have been filled in.';
  modal.body.appendChild(intro);

  const list = document.createElement('div');
  list.style.cssText =
    'font-family:"Courier New",monospace;background:#272420;padding:14px;' +
    'border-radius:4px;border:1px solid #333;line-height:1.9;font-size:13px;';

  for (const clue of layout.crosswordClues) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;align-items:baseline;';

    const num = document.createElement('span');
    num.style.cssText = 'color:#7a6a45;min-width:56px;text-align:right;';
    num.textContent = `${clue.num} ${clue.dir}`;

    const answer = document.createElement('span');
    answer.style.cssText = 'flex:1;';
    if (clue.answer) {
      answer.innerHTML = `<span style="color:#e8d49a;font-weight:bold;letter-spacing:2px;">${clue.answer}</span>` +
        ` <span style="color:#665;font-size:11px;">— ${clue.hint}</span>`;
    } else {
      const blanks = '_ '.repeat(7).trim();
      answer.innerHTML = `<span style="color:#554;letter-spacing:2px;">${blanks}</span>` +
        ` <span style="color:#665;font-size:11px;">— ${clue.hint}</span>`;
    }

    row.append(num, answer);
    list.appendChild(row);
  }
  modal.body.appendChild(list);

  return modal;
}

// --- Ticket overlay ---

function createTicketOverlay(layout, onClose) {
  const modal = createModalOverlay('TORN TICKET STUB', 420);
  modal.setOnClose(onClose);

  const card = document.createElement('div');
  card.style.cssText =
    'background:#f4e3c1;color:#1a1814;border-radius:3px;padding:14px 16px;' +
    'font-family:"Courier New",monospace;position:relative;' +
    'box-shadow:inset 0 0 18px rgba(120,80,40,0.18);';

  const header = document.createElement('div');
  header.style.cssText =
    'background:#c1272d;color:#fff;padding:6px;text-align:center;' +
    'font-weight:bold;letter-spacing:3px;margin:-14px -16px 12px;';
  header.textContent = 'METRO TRANSFER';

  const body = document.createElement('div');
  body.style.cssText = 'font-size:13px;line-height:1.7;';
  body.innerHTML =
    '<div style="color:#554;font-size:11px;margin-bottom:8px;">' +
    'Scrawled in pen on the back:</div>';

  const sequence = document.createElement('div');
  sequence.style.cssText = 'font-size:15px;color:#1a1814;font-weight:bold;' +
    'text-align:center;letter-spacing:1px;word-spacing:6px;line-height:2;';
  sequence.textContent = layout.routeOrder.join('  →  ');

  const note = document.createElement('div');
  note.style.cssText = 'color:#665;font-size:11px;margin-top:10px;text-align:center;';
  note.textContent = '"take the lines in this order"';

  body.append(sequence, note);
  card.append(header, body);
  modal.body.appendChild(card);

  return modal;
}

// --- Keypad overlay ---

function createKeypadOverlay(codeLength, onSubmit, onClose) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;display:none;z-index:300;' +
    'background:rgba(0,0,0,0.7);align-items:center;justify-content:center;' +
    'font-family:monospace;';

  const panel = document.createElement('div');
  panel.style.cssText =
    'width:300px;background:#1a1a1a;border:2px solid #444;border-radius:10px;' +
    'padding:20px;color:#ccc;text-align:center;';

  const label = document.createElement('div');
  label.style.cssText = 'font-size:13px;color:#888;margin-bottom:4px;letter-spacing:2px;';
  label.textContent = 'DOOR KEYPAD';

  const sub = document.createElement('div');
  sub.style.cssText = 'font-size:11px;color:#555;margin-bottom:12px;';
  sub.textContent = `Enter ${codeLength}-digit line sequence`;

  const display = document.createElement('div');
  display.style.cssText =
    `background:#0a0a0a;border:1px solid #555;color:#44aaff;` +
    `font-size:28px;letter-spacing:12px;padding:10px;border-radius:4px;` +
    `min-height:44px;font-family:monospace;`;
  display.textContent = '_ '.repeat(codeLength).trim();

  const grid = document.createElement('div');
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;margin-top:12px;';

  let currentInput = '';

  function render() {
    if (currentInput.length === 0) {
      display.textContent = '_ '.repeat(codeLength).trim();
    } else {
      const filled = currentInput.split('').join(' ');
      const blanks = '_ '.repeat(codeLength - currentInput.length).trim();
      display.textContent = blanks ? `${filled} ${blanks}` : filled;
    }
  }

  const keyLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'ENT'];
  const keyButtons = [];
  for (const k of keyLabels) {
    const btn = document.createElement('button');
    btn.textContent = k;
    btn.style.cssText =
      'padding:12px;background:#2a2a2a;border:1px solid #444;color:#ccc;' +
      'font-family:monospace;font-size:18px;cursor:pointer;border-radius:4px;';
    btn.addEventListener('click', () => {
      if (k === 'CLR') {
        currentInput = '';
        render();
      } else if (k === 'ENT') {
        if (currentInput.length === codeLength) {
          onSubmit(currentInput);
        } else {
          feedback.textContent = `Need ${codeLength} digits`;
        }
      } else if (/\d/.test(k)) {
        if (currentInput.length < codeLength) {
          currentInput += k;
          render();
          feedback.textContent = '';
        }
      }
    });
    keyButtons.push(btn);
    grid.appendChild(btn);
  }

  const feedback = document.createElement('div');
  feedback.style.cssText =
    'margin-top:10px;font-size:12px;color:#ff4444;min-height:16px;';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'CLOSE (ESC)';
  closeBtn.style.cssText =
    'margin-top:6px;width:100%;padding:6px;background:#333;border:none;' +
    'color:#aaa;border-radius:4px;font-family:monospace;font-size:12px;cursor:pointer;';

  panel.append(label, sub, display, grid, feedback, closeBtn);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function close() {
    overlay.style.display = 'none';
    if (onClose) onClose();
  }

  closeBtn.addEventListener('click', close);

  function onKeyDown(e) {
    if (overlay.style.display !== 'flex') return;
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Enter') {
      if (currentInput.length === codeLength) onSubmit(currentInput);
    } else if (e.key === 'Backspace') {
      currentInput = currentInput.slice(0, -1);
      render();
    } else if (/^\d$/.test(e.key) && currentInput.length < codeLength) {
      currentInput += e.key;
      render();
      feedback.textContent = '';
    }
  }
  document.addEventListener('keydown', onKeyDown);

  let lockoutTimer = null;

  return {
    show() {
      currentInput = '';
      feedback.textContent = '';
      render();
      overlay.style.display = 'flex';
    },
    hide() { overlay.style.display = 'none'; },
    showError(msg) {
      feedback.textContent = msg;
      currentInput = '';
      render();
      panel.style.animation = 'none';
      panel.offsetHeight;
      panel.style.animation = 'shake 0.3s ease';
    },
    lockout(seconds) {
      for (const btn of keyButtons) btn.disabled = true;
      let remaining = seconds;
      feedback.textContent = `LOCKED — ${remaining}s`;
      feedback.style.color = '#ff4444';
      if (lockoutTimer) clearInterval(lockoutTimer);
      lockoutTimer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(lockoutTimer);
          lockoutTimer = null;
          for (const btn of keyButtons) btn.disabled = false;
          feedback.textContent = '';
          feedback.style.color = '#ff4444';
        } else {
          feedback.textContent = `LOCKED — ${remaining}s`;
        }
      }, 1000);
    },
    success() {
      feedback.textContent = 'ACCESS GRANTED';
      feedback.style.color = '#44cc44';
      for (const btn of keyButtons) btn.disabled = true;
      display.style.color = '#44cc44';
    },
    el: overlay,
    get isOpen() { return overlay.style.display === 'flex'; },
    destroy() {
      document.removeEventListener('keydown', onKeyDown);
      if (lockoutTimer) clearInterval(lockoutTimer);
      overlay.remove();
    },
  };
}

// =========================================================
// CAR 2 PUZZLE — "The Route"
// =========================================================

export class Car2Puzzle extends PuzzleBase {
  constructor(scene, camera, socket, layout, playerController, doors, soloMode = false) {
    super(scene, camera, socket, layout, playerController, doors, soloMode);

    this.interactables = [];
    this.state = {
      completed: false,
      lockoutUntil: 0,
    };

    this.mapUI = null;
    this.newspaperUI = null;
    this.ticketUI = null;
    this.keypadUI = null;

    this.init();
  }

  init() {
    this.createMap();
    this.createNewspaper();
    this.createTicket();
    this.createKeypad();
    this.createHiddenNumber();
    this.setupUI();
    this.setupSocketListeners();
  }

  // --- Subway map on a side wall (above windows) ---
  createMap() {
    const { mapSide, mapPanelIdx } = this.layout;
    const xSign = mapSide === 0 ? -1 : 1;
    const mapZ = WINDOW_ZONE_START + (mapPanelIdx * 2 + 0.5) * AD_SPACING;
    const mapY = WINDOW_BOTTOM + WINDOW_HEIGHT + 0.22;

    const canvas = makeCanvas(768, 384);
    drawSubwayMap(canvas.getContext('2d'), canvas.width, canvas.height, this.layout);

    const tex = canvasTexture(canvas);
    const mapW = AD_SPACING * 1.8;
    const mapH = 0.3;
    const geo = new THREE.PlaneGeometry(mapW, mapH);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(xSign * (HALF_WIDTH - 0.015), mapY, mapZ);
    mesh.rotation.y = xSign === -1 ? Math.PI / 2 : -Math.PI / 2;
    this.scene.add(mesh);
    this.objects.push(mesh);

    // Larger invisible interaction zone — map panel is thin, hard to aim at
    const zoneGeo = new THREE.BoxGeometry(0.12, mapH * 1.3, mapW * 1.1);
    const zoneMat = new THREE.MeshBasicMaterial({ visible: false });
    const zone = new THREE.Mesh(zoneGeo, zoneMat);
    zone.position.copy(mesh.position);
    this.scene.add(zone);
    this.objects.push(zone);

    const inter = new Interactable(zone, {
      onInteract: () => this.openMap(),
      label: 'Press E to read map',
    });
    this.interactables.push(inter);
  }

  // --- Newspaper lying on a seat ---
  createNewspaper() {
    const seatPos = seatWorldPos(this.layout.newspaperSeat);

    const canvas = makeCanvas(512, 320);
    drawNewspaperThumbnail(canvas.getContext('2d'), canvas.width, canvas.height);
    const tex = canvasTexture(canvas);

    const geo = new THREE.PlaneGeometry(0.34, 0.22);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    // Lay flat on top of the seat cushion
    mesh.position.set(seatPos.x, SEAT_HEIGHT + 0.05, seatPos.z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = (seatPos.side === -1 ? 1 : -1) * 0.1;
    this.scene.add(mesh);
    this.objects.push(mesh);

    const inter = new Interactable(mesh, {
      onInteract: () => this.openNewspaper(),
      label: 'Press E to read newspaper',
    });
    this.interactables.push(inter);
  }

  // --- Torn ticket stub on the floor ---
  createTicket() {
    const canvas = makeCanvas(256, 160);
    drawTicketThumbnail(canvas.getContext('2d'), canvas.width, canvas.height);
    const tex = canvasTexture(canvas);

    const geo = new THREE.PlaneGeometry(0.14, 0.09);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.8,
      side: THREE.DoubleSide,
      emissive: 0x332211,
      emissiveIntensity: 0.15,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(this.layout.ticketX, 0.015, this.layout.ticketZ);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = 0.25;
    this.scene.add(mesh);
    this.objects.push(mesh);

    // Larger invisible zone for easier pickup
    const zoneGeo = new THREE.BoxGeometry(0.26, 0.12, 0.22);
    const zoneMat = new THREE.MeshBasicMaterial({ visible: false });
    const zone = new THREE.Mesh(zoneGeo, zoneMat);
    zone.position.set(this.layout.ticketX, 0.08, this.layout.ticketZ);
    this.scene.add(zone);
    this.objects.push(zone);

    const inter = new Interactable(zone, {
      onInteract: () => this.openTicket(),
      label: 'Press E to pick up ticket',
    });
    this.interactables.push(inter);
  }

  // --- Keypad next to the front door ---
  createKeypad() {
    const keypadGroup = new THREE.Group();
    keypadGroup.position.set(-0.55, 1.2, -HALF_LENGTH + 0.08);

    // Housing
    const housingGeo = new THREE.BoxGeometry(0.18, 0.24, 0.04);
    const housingMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a30,
      roughness: 0.5,
      metalness: 0.6,
    });
    const housing = new THREE.Mesh(housingGeo, housingMat);
    keypadGroup.add(housing);

    // Screen
    this.keypadScreenMat = new THREE.MeshStandardMaterial({
      color: 0x111520,
      emissive: 0x44aaff,
      emissiveIntensity: 0.4,
    });
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.13, 0.06),
      this.keypadScreenMat
    );
    screen.position.set(0, 0.06, 0.021);
    keypadGroup.add(screen);

    // Button grid (decorative)
    const btnMat = new THREE.MeshStandardMaterial({ color: 0x555560, roughness: 0.6 });
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const btn = new THREE.Mesh(
          new THREE.BoxGeometry(0.025, 0.018, 0.01),
          btnMat
        );
        btn.position.set(-0.04 + c * 0.04, 0.02 - r * 0.028, 0.022);
        keypadGroup.add(btn);
      }
    }

    // Label
    const labelCanvas = makeCanvas(64, 16);
    const lctx = labelCanvas.getContext('2d');
    lctx.font = 'bold 10px monospace';
    lctx.fillStyle = '#aaa';
    lctx.textAlign = 'center';
    lctx.textBaseline = 'middle';
    lctx.fillText('DOOR CODE', 32, 8);
    const labelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.022),
      new THREE.MeshBasicMaterial({ map: canvasTexture(labelCanvas), transparent: true })
    );
    labelMesh.position.set(0, 0.1, 0.021);
    keypadGroup.add(labelMesh);

    this.scene.add(keypadGroup);
    this.objects.push(keypadGroup);

    const inter = new Interactable(housing, {
      onInteract: () => this.openKeypad(),
      label: 'Press E to use keypad',
    });
    this.interactables.push(inter);
  }

  // --- Hidden meta-puzzle number (scratched under a seat) ---
  createHiddenNumber() {
    const pos = seatWorldPos(this.layout.hiddenSeat);
    const tex = createHiddenNumberTexture(this.layout.hiddenNumber);
    const geo = new THREE.PlaneGeometry(0.08, 0.08);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const innerOffset = pos.side * (SEAT_DEPTH / 2 - 0.05);
    mesh.position.set(pos.x - innerOffset, 0.08, pos.z + 0.4);
    mesh.rotation.y = pos.side === -1 ? -Math.PI / 2 : Math.PI / 2;
    this.scene.add(mesh);
    this.objects.push(mesh);
  }

  // --- UI setup ---
  setupUI() {
    const onClose = () => this.player.setUIBlocking(false);
    this.mapUI = createMapOverlay(this.layout, onClose);
    this.newspaperUI = createCrosswordOverlay(this.layout, onClose);
    this.ticketUI = createTicketOverlay(this.layout, onClose);
    this.keypadUI = createKeypadOverlay(
      this.layout.codeLength || 6,
      (code) => {
        this.socket.emit('puzzle-action', {
          car: 2,
          type: 'enter-code',
          code,
        });
      },
      onClose
    );
  }

  openMap() {
    this.player.setUIBlocking(true);
    this.mapUI.show();
  }
  openNewspaper() {
    this.player.setUIBlocking(true);
    this.newspaperUI.show();
  }
  openTicket() {
    this.player.setUIBlocking(true);
    this.ticketUI.show();
  }
  openKeypad() {
    if (this.state.completed) {
      this.showToast('Door already unlocked.', '#44cc44');
      return;
    }
    const now = Date.now();
    if (this.state.lockoutUntil > now) {
      const remaining = Math.ceil((this.state.lockoutUntil - now) / 1000);
      this.showToast(`Keypad locked — ${remaining}s`, '#ff4444');
      return;
    }
    this.player.setUIBlocking(true);
    this.keypadUI.show();
  }

  // --- Socket listeners ---
  setupSocketListeners() {
    this._onPuzzleUpdate = (data) => {
      if (data.car !== 2) return;
      this.onEvent(data);
    };
    this._onPuzzleError = (data) => {
      this.showToast(data.message, '#ff4444');
    };
    this.socket.on('puzzle-update', this._onPuzzleUpdate);
    this.socket.on('puzzle-error', this._onPuzzleError);
  }

  onEvent(data) {
    switch (data.event) {
      case 'code-wrong': {
        this.state.lockoutUntil = Date.now() + (data.lockoutSeconds || 30) * 1000;
        this.keypadUI.showError(
          `WRONG CODE — attempt ${data.attempts}. Locked for ${data.lockoutSeconds}s.`
        );
        this.keypadUI.lockout(data.lockoutSeconds || 30);
        this.keypadScreenMat.emissive.set(0xff3322);
        setTimeout(() => {
          if (!this.disposed) this.keypadScreenMat.emissive.set(0x44aaff);
        }, 2000);
        this.showToast('Wrong code — alarm buzzer!', '#ff4444');
        break;
      }
      case 'code-correct':
        this.state.completed = true;
        this.keypadUI.success();
        this.keypadScreenMat.emissive.set(0x44cc44);
        setTimeout(() => {
          if (!this.disposed) {
            this.keypadUI.hide();
            this.player.setUIBlocking(false);
          }
        }, 1200);
        break;

      case 'door-unlocked':
        this.doors.unlock('front');
        this.showToast('DOOR UNLOCKED! Move to the next car.', '#44cc44');
        break;

      case 'car-completed':
        // main.js handles the transition
        break;
    }
  }

  // --- Toast (same style as Car 1) ---
  showToast(text, color = '#ccc') {
    const el = document.createElement('div');
    el.style.cssText =
      `position:fixed;top:80px;left:50%;transform:translateX(-50%);` +
      `padding:8px 16px;background:rgba(0,0,0,0.8);border:1px solid ${color};` +
      `color:${color};font-family:monospace;font-size:13px;border-radius:6px;` +
      `z-index:400;pointer-events:none;transition:opacity 0.5s;`;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 2500);
    setTimeout(() => el.remove(), 3000);
  }

  update(_dt) {
    // Nothing animated yet — ticket wiggle could be added later
  }

  dispose() {
    if (this._onPuzzleUpdate) this.socket.off('puzzle-update', this._onPuzzleUpdate);
    if (this._onPuzzleError) this.socket.off('puzzle-error', this._onPuzzleError);

    for (const inter of this.interactables) inter.dispose();
    this.interactables = [];

    super.dispose();

    for (const ui of [this.mapUI, this.newspaperUI, this.ticketUI, this.keypadUI]) {
      if (ui && ui.destroy) ui.destroy();
    }
  }
}
