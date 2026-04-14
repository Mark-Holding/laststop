import * as THREE from 'three';
import { PuzzleBase } from './PuzzleBase.js';
import { Interactable } from '../interactable.js';
import { getAudioListener, resumeAudio } from '../audio/soundManager.js';

// Train geometry constants (match server/puzzleGenerator.js and train.js)
const HALF_WIDTH = 1.3;
const HALF_LENGTH = 9;
const SEAT_DEPTH = 0.44;
const SEAT_HEIGHT = 0.42;
const SECTION_START_Z = -7.0;
const SECTION_LENGTH = 2.8;
const SECTION_STRIDE = SECTION_LENGTH + 0.4;
const WINDOW_ZONE_START = -7.2;
const WINDOW_WIDTH = 1.1;
const WINDOW_HEIGHT = 0.75;
const WINDOW_BOTTOM = 0.95;
const WINDOW_SPACING = WINDOW_WIDTH + 0.35;

// Tag colors map
const TAG_COLORS = {
  red: 0xff3333,
  blue: 0x3388ff,
  green: 0x33cc55,
  yellow: 0xffcc00,
  white: 0xeeeeee,
};

// --- Position Helpers ---

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

function compartmentWorldPos(index) {
  const side = index < 5 ? -1 : 1;
  const section = index % 5;
  return {
    x: side * (HALF_WIDTH - 0.13),
    y: 2.0,
    z: sectionCenterZ(section),
    side,
    section,
  };
}

function windowWorldPos(side, windowIdx) {
  const xSign = side === 0 ? -1 : 1;
  return {
    x: xSign * (HALF_WIDTH + 0.01),
    y: WINDOW_BOTTOM + WINDOW_HEIGHT / 2,
    z: WINDOW_ZONE_START + windowIdx * WINDOW_SPACING + WINDOW_WIDTH / 2,
  };
}

// --- Textures ---

function createScratchTexture(scratchVisual) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const { segments, highlightedDots } = scratchVisual;

  // Scratch lines from pre-computed segments (no answer order exposed)
  ctx.strokeStyle = 'rgba(220, 220, 200, 0.55)';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const x1 = seg.x1 * 256, y1 = seg.y1 * 256;
    const x2 = seg.x2 * 256, y2 = seg.y2 * 256;
    const jx1 = Math.sin(i * 7.3) * 2, jy1 = Math.cos(i * 5.1) * 2;
    const jx2 = Math.sin((i + 1) * 7.3) * 2, jy2 = Math.cos((i + 1) * 5.1) * 2;
    if (i === 0) ctx.moveTo(x1 + jx1, y1 + jy1);
    ctx.lineTo(x2 + jx2, y2 + jy2);
  }
  ctx.stroke();

  // Re-stroke thinner for a double-scratch effect
  ctx.strokeStyle = 'rgba(255, 255, 240, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const x1 = seg.x1 * 256, y1 = seg.y1 * 256;
    const x2 = seg.x2 * 256, y2 = seg.y2 * 256;
    const jx1 = Math.sin(i * 7.3 + 1) * 3, jy1 = Math.cos(i * 5.1 + 1) * 3;
    const jx2 = Math.sin((i + 1) * 7.3 + 1) * 3, jy2 = Math.cos((i + 1) * 5.1 + 1) * 3;
    if (i === 0) ctx.moveTo(x1 + jx1, y1 + jy1);
    ctx.lineTo(x2 + jx2, y2 + jy2);
  }
  ctx.stroke();

  // Dots at grid positions
  const cols = [64, 128, 192];
  const rows = [64, 128, 192];
  for (let i = 0; i < 9; i++) {
    const px = cols[i % 3], py = rows[Math.floor(i / 3)];
    const isHighlighted = highlightedDots.includes(i);
    ctx.beginPath();
    ctx.arc(px, py, isHighlighted ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = isHighlighted
      ? 'rgba(255, 255, 240, 0.5)'
      : 'rgba(200, 200, 190, 0.15)';
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createNumberTexture(digit) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 36px monospace';
  ctx.fillStyle = 'rgba(180, 170, 150, 0.4)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(digit), 32, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createStickerTexture(code) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  // White sticker background
  ctx.fillStyle = '#e8e4d8';
  ctx.fillRect(4, 4, 120, 56);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, 120, 56);
  // Code text
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = '#222';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`_ _ ${code}`, 64, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// --- Lock Pattern UI ---

function createLockPatternUI(onSubmit) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;display:none;z-index:300;' +
    'background:rgba(0,0,0,0.7);align-items:center;justify-content:center;';

  const phone = document.createElement('div');
  phone.style.cssText =
    'width:260px;height:420px;background:#111;border-radius:20px;' +
    'border:2px solid #333;padding:16px;display:flex;flex-direction:column;' +
    'font-family:monospace;color:#ccc;';

  const title = document.createElement('div');
  title.style.cssText = 'text-align:center;margin-bottom:8px;font-size:13px;color:#888;';
  title.textContent = 'DRAW UNLOCK PATTERN';

  const canvas = document.createElement('canvas');
  canvas.width = 228;
  canvas.height = 228;
  canvas.style.cssText = 'background:#1a1a2e;border-radius:8px;cursor:pointer;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:10px;';

  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'SUBMIT';
  submitBtn.style.cssText =
    'flex:1;padding:8px;background:#2a4a6a;border:none;color:white;' +
    'border-radius:5px;font-family:monospace;cursor:pointer;font-size:13px;';

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'CLEAR';
  clearBtn.style.cssText =
    'flex:1;padding:8px;background:#333;border:none;color:#aaa;' +
    'border-radius:5px;font-family:monospace;cursor:pointer;font-size:13px;';

  const feedback = document.createElement('div');
  feedback.style.cssText =
    'text-align:center;margin-top:8px;font-size:12px;color:#ff4444;min-height:16px;';

  btnRow.append(clearBtn, submitBtn);
  phone.append(title, canvas, btnRow, feedback);
  overlay.appendChild(phone);

  // Pattern state
  const selected = [];
  const cols = [57, 114, 171];
  const rows = [57, 114, 171];
  const dotRadius = 18;

  function dotPos(idx) {
    return { x: cols[idx % 3], y: rows[Math.floor(idx / 3)] };
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 228, 228);

    // Lines
    if (selected.length > 1) {
      ctx.strokeStyle = '#44aaff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < selected.length; i++) {
        const p = dotPos(selected[i]);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // Dots
    for (let i = 0; i < 9; i++) {
      const p = dotPos(i);
      const isSelected = selected.includes(i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, isSelected ? 10 : 7, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#44aaff' : '#555';
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = '#88ccff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (228 / rect.width);
    const my = (e.clientY - rect.top) * (228 / rect.height);

    for (let i = 0; i < 9; i++) {
      const p = dotPos(i);
      const dist = Math.hypot(mx - p.x, my - p.y);
      if (dist < dotRadius && !selected.includes(i)) {
        selected.push(i);
        feedback.textContent = '';
        draw();
        break;
      }
    }
  });

  clearBtn.addEventListener('click', () => {
    selected.length = 0;
    feedback.textContent = '';
    draw();
  });

  submitBtn.addEventListener('click', () => {
    if (selected.length < 3) {
      feedback.textContent = 'Pattern too short';
      return;
    }
    onSubmit([...selected]);
  });

  function show() {
    overlay.style.display = 'flex';
    selected.length = 0;
    feedback.textContent = '';
    draw();
  }

  function hide() {
    overlay.style.display = 'none';
  }

  function showError(msg) {
    feedback.textContent = msg;
    phone.style.animation = 'none';
    phone.offsetHeight; // force reflow
    phone.style.animation = 'shake 0.3s ease';
  }

  // Add shake keyframes
  if (!document.getElementById('puzzle-shake-style')) {
    const style = document.createElement('style');
    style.id = 'puzzle-shake-style';
    style.textContent =
      '@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}';
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);

  return { show, hide, showError, el: overlay, get isOpen() { return overlay.style.display === 'flex'; } };
}

// --- Text Messages UI ---

function createTextsUI(phoneCodePart, targetTag, onClose) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;display:none;z-index:300;' +
    'background:rgba(0,0,0,0.7);align-items:center;justify-content:center;';

  const phone = document.createElement('div');
  phone.style.cssText =
    'width:280px;height:440px;background:#111;border-radius:20px;' +
    'border:2px solid #333;padding:16px;display:flex;flex-direction:column;' +
    'font-family:monospace;color:#ccc;';

  const header = document.createElement('div');
  header.style.cssText = 'text-align:center;font-size:12px;color:#666;margin-bottom:8px;';
  header.textContent = 'MESSAGES — Unknown Number';

  const messages = document.createElement('div');
  messages.style.cssText =
    'flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;' +
    'padding:8px;background:#0a0a1a;border-radius:8px;';

  const texts = [
    { from: 'them', text: 'yo you still at the station?' },
    { from: 'them', text: `grab it from the overhead compartment` },
    { from: 'them', text: `the one with the ${targetTag} tag` },
    { from: 'them', text: `code starts with ${phoneCodePart}` },
    { from: 'you', text: "what's the rest?" },
    { from: 'them', text: 'check the compartment. its on the sticker' },
    { from: 'them', text: 'hurry bro' },
  ];

  for (const msg of texts) {
    const bubble = document.createElement('div');
    const isYou = msg.from === 'you';
    bubble.style.cssText =
      `max-width:85%;padding:6px 10px;border-radius:10px;font-size:13px;line-height:1.4;` +
      `align-self:${isYou ? 'flex-end' : 'flex-start'};` +
      `background:${isYou ? '#1a3a5a' : '#2a2a3a'};` +
      `color:${isYou ? '#88bbff' : '#ccc'};`;
    bubble.textContent = msg.text;
    messages.appendChild(bubble);
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'CLOSE (ESC)';
  closeBtn.style.cssText =
    'margin-top:8px;padding:8px;background:#333;border:none;color:#aaa;' +
    'border-radius:5px;font-family:monospace;cursor:pointer;font-size:12px;';

  const hint = document.createElement('div');
  hint.style.cssText = 'text-align:center;font-size:11px;color:#555;margin-top:4px;';
  hint.textContent = 'Press P to re-open phone';

  phone.append(header, messages, closeBtn, hint);
  overlay.appendChild(phone);

  function close() {
    overlay.style.display = 'none';
    if (onClose) onClose();
  }

  closeBtn.addEventListener('click', close);

  function onKeyDown(e) {
    if (e.key === 'Escape' && overlay.style.display === 'flex') {
      close();
    }
  }
  document.addEventListener('keydown', onKeyDown);

  document.body.appendChild(overlay);

  return {
    show() { overlay.style.display = 'flex'; },
    hide() { overlay.style.display = 'none'; },
    get isOpen() { return overlay.style.display === 'flex'; },
    el: overlay,
    destroy() { document.removeEventListener('keydown', onKeyDown); },
  };
}

// --- Code Entry UI ---

function createCodeEntryUI(stickerCode, onSubmit) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;display:none;z-index:300;' +
    'background:rgba(0,0,0,0.5);align-items:center;justify-content:center;';

  const panel = document.createElement('div');
  panel.style.cssText =
    'width:240px;background:#1a1a1a;border:2px solid #444;border-radius:10px;' +
    'padding:20px;font-family:monospace;color:#ccc;text-align:center;';

  const label = document.createElement('div');
  label.style.cssText = 'font-size:14px;margin-bottom:4px;color:#888;';
  label.textContent = 'COMPARTMENT LOCK';

  const stickerLabel = document.createElement('div');
  stickerLabel.style.cssText = 'font-size:12px;margin-bottom:12px;color:#666;';
  stickerLabel.textContent = `Sticker reads: _ _ ${stickerCode}`;

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 4;
  input.placeholder = '____';
  input.style.cssText =
    'width:100%;padding:10px;font-size:24px;font-family:monospace;' +
    'text-align:center;background:#0a0a0a;border:1px solid #555;' +
    'color:#44aaff;border-radius:5px;letter-spacing:8px;outline:none;';
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^0-9]/g, '');
  });

  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'ENTER';
  submitBtn.style.cssText =
    'width:100%;margin-top:10px;padding:8px;background:#2a4a6a;border:none;' +
    'color:white;border-radius:5px;font-family:monospace;cursor:pointer;font-size:14px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'CANCEL';
  cancelBtn.style.cssText =
    'width:100%;margin-top:6px;padding:6px;background:#333;border:none;' +
    'color:#aaa;border-radius:5px;font-family:monospace;cursor:pointer;font-size:12px;';

  const feedback = document.createElement('div');
  feedback.style.cssText =
    'margin-top:8px;font-size:12px;color:#ff4444;min-height:16px;';

  panel.append(label, stickerLabel, input, submitBtn, cancelBtn, feedback);
  overlay.appendChild(panel);

  let currentCompIdx = -1;

  submitBtn.addEventListener('click', () => {
    if (input.value.length !== 4) {
      feedback.textContent = 'Enter 4 digits';
      return;
    }
    onSubmit(currentCompIdx, input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitBtn.click();
    if (e.key === 'Escape') overlay.style.display = 'none';
  });

  cancelBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
  });

  document.body.appendChild(overlay);

  return {
    show(compartmentIndex, stickerText) {
      currentCompIdx = compartmentIndex;
      stickerLabel.textContent = stickerText
        ? `Sticker reads: _ _ ${stickerText}`
        : 'No sticker visible';
      input.value = '';
      feedback.textContent = '';
      overlay.style.display = 'flex';
      setTimeout(() => input.focus(), 50);
    },
    hide() { overlay.style.display = 'none'; },
    showError(msg) { feedback.textContent = msg; },
    el: overlay,
    get isOpen() { return overlay.style.display === 'flex'; },
  };
}

// =========================================================
// CAR 1 PUZZLE — "The Dead Phone"
// =========================================================

export class Car1Puzzle extends PuzzleBase {
  constructor(scene, camera, socket, layout, playerController, doors) {
    super(scene, camera, socket, layout, playerController, doors);

    this.interactables = [];
    this.seatMeshMap = new Map(); // seatIndex → cushion mesh
    this.seatInteractables = new Map(); // seatIndex → Interactable
    this.seatLiftState = new Map(); // seatIndex → { amount, target, timer }

    // Puzzle progression (mirrors server state via events)
    this.state = {
      seatLiftedBy: null,
      seatLiftedIndex: -1,
      phoneGrabbedBy: null,
      phoneUnlocked: false,
      compartmentOpen: false,
      keycardTaken: false,
      doorSwiped: false,
    };

    // 3D objects refs
    this.phoneMesh = null;
    this.keycardMesh = null;
    this.keycardReaderInteractable = null;
    this.compartmentDoors = new Map(); // index → mesh

    // UI
    this.lockPatternUI = null;
    this.textsUI = null;
    this.codeEntryUI = null;

    this.init();
  }

  init() {
    this.findSeatMeshes();
    this.createSeatInteractionZones();
    this.createPhoneModel();
    this.createCompartments();
    this.createScratchMarks();
    this.createHiddenNumber();
    this.createKeycardReader();
    this.setupUI();
    this.setupSocketListeners();
  }

  // --- Find existing seat cushion meshes by userData ---
  findSeatMeshes() {
    this.scene.traverse((obj) => {
      if (obj.userData && obj.userData.type === 'seat-cushion') {
        this.seatMeshMap.set(obj.userData.seatIndex, obj);
      }
    });
  }

  // --- Seat interaction zones (invisible meshes over each seat) ---
  createSeatInteractionZones() {
    const zoneMat = new THREE.MeshBasicMaterial({ visible: false });

    for (let i = 0; i < 10; i++) {
      const pos = seatWorldPos(i);
      const zone = new THREE.Mesh(
        new THREE.BoxGeometry(SEAT_DEPTH, 0.15, SECTION_LENGTH),
        zoneMat
      );
      zone.position.set(pos.x, pos.y + 0.08, pos.z);
      this.scene.add(zone);
      this.objects.push(zone);

      const seatIdx = i;
      const interactable = new Interactable(zone, {
        onInteract: () => this.handleSeatInteract(seatIdx),
        label: 'Press E to lift seat',
      });
      this.interactables.push(interactable);
      this.seatInteractables.set(seatIdx, interactable);
    }
  }

  // --- Phone model (hidden under seat until lifted) ---
  createPhoneModel() {
    const { phonePos } = this.layout;
    const phoneGeo = new THREE.BoxGeometry(0.07, 0.01, 0.13);
    const phoneMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.3,
      metalness: 0.5,
    });
    this.phoneMesh = new THREE.Mesh(phoneGeo, phoneMat);
    this.phoneMesh.position.set(phonePos.x, phonePos.y, phonePos.z);
    this.phoneMesh.visible = false;
    this.scene.add(this.phoneMesh);
    this.objects.push(this.phoneMesh);

    // Screen face (slightly emissive when visible)
    const screenGeo = new THREE.PlaneGeometry(0.055, 0.1);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a3a,
      emissive: 0x2244aa,
      emissiveIntensity: 0.5,
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.rotation.x = -Math.PI / 2;
    screen.position.y = 0.006;
    this.phoneMesh.add(screen);

    // Phone interactable (only active when visible)
    this.phoneInteractable = new Interactable(this.phoneMesh, {
      onInteract: () => this.handlePhoneInteract(),
      label: 'Press E to grab phone',
    });
    this.interactables.push(this.phoneInteractable);
  }

  // --- Overhead compartments ---
  createCompartments() {
    const { compartmentTags, compartmentIndex, stickerCode } = this.layout;

    for (let i = 0; i < 10; i++) {
      const pos = compartmentWorldPos(i);
      const group = new THREE.Group();
      group.position.set(pos.x, pos.y, pos.z);

      // Compartment box
      const boxGeo = new THREE.BoxGeometry(0.5, 0.18, 0.25);
      const boxMat = new THREE.MeshStandardMaterial({
        color: 0x555560,
        roughness: 0.7,
        metalness: 0.3,
      });
      const box = new THREE.Mesh(boxGeo, boxMat);
      group.add(box);

      // Door (front face)
      const doorGeo = new THREE.BoxGeometry(0.48, 0.16, 0.02);
      const doorMat = new THREE.MeshStandardMaterial({
        color: 0x666670,
        roughness: 0.6,
        metalness: 0.4,
      });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(0, 0, pos.side * -0.12);
      group.add(door);
      this.compartmentDoors.set(i, door);

      // Colored tag
      const tagGeo = new THREE.PlaneGeometry(0.05, 0.05);
      const tagColor = TAG_COLORS[compartmentTags[i]] || 0xcccccc;
      const tagMat = new THREE.MeshStandardMaterial({
        color: tagColor,
        emissive: tagColor,
        emissiveIntensity: 0.3,
        side: THREE.DoubleSide,
      });
      const tag = new THREE.Mesh(tagGeo, tagMat);
      tag.position.set(0.18, 0.04, pos.side * -0.135);
      tag.rotation.y = pos.side === -1 ? Math.PI / 2 : -Math.PI / 2;
      group.add(tag);

      // Sticker (only on target compartment)
      if (i === compartmentIndex) {
        const stickerTex = createStickerTexture(stickerCode);
        const stickerGeo = new THREE.PlaneGeometry(0.16, 0.06);
        const stickerMat = new THREE.MeshStandardMaterial({
          map: stickerTex,
          transparent: true,
          side: THREE.DoubleSide,
        });
        const sticker = new THREE.Mesh(stickerGeo, stickerMat);
        sticker.position.set(-0.05, -0.04, pos.side * -0.135);
        sticker.rotation.y = pos.side === -1 ? Math.PI / 2 : -Math.PI / 2;
        group.add(sticker);
      }

      // Number label
      const numCanvas = document.createElement('canvas');
      numCanvas.width = 32;
      numCanvas.height = 32;
      const numCtx = numCanvas.getContext('2d');
      numCtx.font = 'bold 20px monospace';
      numCtx.fillStyle = '#999';
      numCtx.textAlign = 'center';
      numCtx.textBaseline = 'middle';
      numCtx.fillText(String(i + 1), 16, 17);
      const numTex = new THREE.CanvasTexture(numCanvas);
      const numGeo = new THREE.PlaneGeometry(0.04, 0.04);
      const numMat = new THREE.MeshStandardMaterial({
        map: numTex,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const numMesh = new THREE.Mesh(numGeo, numMat);
      numMesh.position.set(0, 0.04, pos.side * -0.135);
      numMesh.rotation.y = pos.side === -1 ? Math.PI / 2 : -Math.PI / 2;
      group.add(numMesh);

      this.scene.add(group);
      this.objects.push(group);

      // Interactable zone for the compartment
      const compIdx = i;
      const zoneGeo = new THREE.BoxGeometry(0.5, 0.2, 0.3);
      const zoneMat = new THREE.MeshBasicMaterial({ visible: false });
      const zone = new THREE.Mesh(zoneGeo, zoneMat);
      zone.position.set(pos.x, pos.y, pos.z);
      this.scene.add(zone);
      this.objects.push(zone);

      const interactable = new Interactable(zone, {
        onInteract: () => this.handleCompartmentInteract(compIdx),
        label: 'Press E to open compartment',
      });
      this.interactables.push(interactable);
    }
  }

  // --- Window scratch marks ---
  createScratchMarks() {
    const { scratchSide, scratchWindowIdx, scratchVisual } = this.layout;
    const pos = windowWorldPos(scratchSide, scratchWindowIdx);

    const texture = createScratchTexture(scratchVisual);
    const scratchGeo = new THREE.PlaneGeometry(WINDOW_WIDTH * 0.8, WINDOW_HEIGHT * 0.8);
    const scratchMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const scratchPlane = new THREE.Mesh(scratchGeo, scratchMat);
    scratchPlane.position.set(pos.x, pos.y, pos.z);
    // Face inward (normal toward player inside the car)
    const xSign = scratchSide === 0 ? -1 : 1;
    scratchPlane.rotation.y = -xSign * Math.PI / 2;
    // Offset slightly inward from the window glass
    scratchPlane.position.x -= xSign * 0.02;
    this.scene.add(scratchPlane);
    this.objects.push(scratchPlane);
  }

  // --- Hidden meta-puzzle number ---
  createHiddenNumber() {
    const { hiddenSeat, hiddenNumber } = this.layout;
    const pos = seatWorldPos(hiddenSeat);
    const texture = createNumberTexture(hiddenNumber);
    const geo = new THREE.PlaneGeometry(0.08, 0.08);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    // Place on inner face of seat base, near the bottom
    const innerOffset = pos.side * (SEAT_DEPTH / 2 - 0.05);
    mesh.position.set(
      pos.x - innerOffset,
      0.08,
      pos.z + 0.4
    );
    mesh.rotation.y = pos.side === -1 ? -Math.PI / 2 : Math.PI / 2;
    this.scene.add(mesh);
    this.objects.push(mesh);
  }

  // --- Keycard reader (on wall next to front door) ---
  createKeycardReader() {
    const readerGeo = new THREE.BoxGeometry(0.1, 0.15, 0.04);
    const readerMat = new THREE.MeshStandardMaterial({
      color: 0x333340,
      roughness: 0.5,
      metalness: 0.6,
    });
    const reader = new THREE.Mesh(readerGeo, readerMat);
    reader.position.set(0.55, 1.2, -HALF_LENGTH + 0.1);
    this.scene.add(reader);
    this.objects.push(reader);

    // Slot indicator (red → green when swiped)
    const slotGeo = new THREE.BoxGeometry(0.06, 0.01, 0.01);
    this.readerSlotMat = new THREE.MeshStandardMaterial({
      color: 0xff2200,
      emissive: 0xff2200,
      emissiveIntensity: 0.6,
    });
    const slot = new THREE.Mesh(slotGeo, this.readerSlotMat);
    slot.position.set(0, -0.05, 0.025);
    reader.add(slot);

    // Label
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 64;
    labelCanvas.height = 32;
    const lctx = labelCanvas.getContext('2d');
    lctx.font = '10px monospace';
    lctx.fillStyle = '#666';
    lctx.textAlign = 'center';
    lctx.fillText('SWIPE', 32, 14);
    lctx.fillText('CARD', 32, 26);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelGeo = new THREE.PlaneGeometry(0.06, 0.03);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.set(0, 0.04, 0.025);
    reader.add(labelMesh);

    this.keycardReaderInteractable = new Interactable(reader, {
      onInteract: () => this.handleSwipeInteract(),
      label: 'Press E to swipe keycard',
    });
    this.interactables.push(this.keycardReaderInteractable);
  }

  // --- Proximity audio (muffled phone vibration) ---
  setupAudio() {
    try {
      this.audioListener = getAudioListener(this.camera);
      resumeAudio();
      const ctx = this.audioListener.context;

      // Vibration motor: low sine rumble
      this.buzzOsc = ctx.createOscillator();
      this.buzzOsc.type = 'sine';
      this.buzzOsc.frequency.value = 55;

      // Second harmonic for body
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 110;
      const osc2Gain = ctx.createGain();
      osc2Gain.gain.value = 0.3;
      osc2.connect(osc2Gain);

      // Rattle noise: filtered noise for the "phone on hard surface" texture
      const noiseSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, noiseSize, ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseSize; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }
      this.buzzNoise = ctx.createBufferSource();
      this.buzzNoise.buffer = noiseBuffer;
      this.buzzNoise.loop = true;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.08;
      this.buzzNoise.connect(noiseGain);

      // Merge into output gain
      this.buzzGain = ctx.createGain();
      this.buzzGain.gain.value = 0;
      this.buzzOsc.connect(this.buzzGain);
      osc2Gain.connect(this.buzzGain);
      noiseGain.connect(this.buzzGain);

      // Low-pass filter: muffled under a seat
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 280;
      lpf.Q.value = 1.2;
      this.buzzGain.connect(lpf);

      // Create PositionalAudio for spatial effect
      this.buzzSound = new THREE.PositionalAudio(this.audioListener);
      this.buzzSound.setRefDistance(1.5);
      this.buzzSound.setMaxDistance(12);
      this.buzzSound.setRolloffFactor(1.5);
      this.buzzSound.setVolume(0.5);

      // Connect filter → positional audio panner
      lpf.connect(this.buzzSound.panner);

      this.buzzOsc.start();
      osc2.start();
      this.buzzNoise.start();
      this.buzzOsc2 = osc2;
      this.buzzStarted = true;

      // Attach to phone position
      this.phoneMesh.add(this.buzzSound);
    } catch (e) {
      console.warn('Audio setup failed:', e);
    }
  }

  // --- UI Setup ---
  setupUI() {
    this.lockPatternUI = createLockPatternUI((pattern) => {
      this.socket.emit('puzzle-action', {
        car: 1,
        type: 'submit-pattern',
        pattern,
      });
    });

    this.codeEntryUI = createCodeEntryUI(this.layout.stickerCode, (compIdx, code) => {
      this.socket.emit('puzzle-action', {
        car: 1,
        type: 'enter-code',
        compartmentIndex: compIdx,
        code,
      });
    });
  }

  // --- Socket event listeners ---
  setupSocketListeners() {
    this._onPuzzleUpdate = (data) => {
      if (data.car !== 1) return;
      this.onEvent(data);
    };
    this._onPuzzleError = (data) => {
      this.showToast(data.message, '#ff4444');
    };
    this.socket.on('puzzle-update', this._onPuzzleUpdate);
    this.socket.on('puzzle-error', this._onPuzzleError);
  }

  // --- Handle server events ---
  onEvent(data) {
    switch (data.event) {
      case 'seat-checked':
        // Wrong seat — animate briefly
        this.animateSeatPeek(data.seatIndex);
        break;

      case 'seat-lifted':
        this.state.seatLiftedBy = data.by;
        this.state.seatLiftedIndex = data.seatIndex;
        this.animateSeatLift(data.seatIndex, true);
        if (data.hasPhone) {
          this.phoneMesh.visible = true;
          // Disable the seat interaction zone so the phone can be raycasted
          const seatInt = this.seatInteractables.get(data.seatIndex);
          if (seatInt) seatInt.dispose();
        }
        this.showToast('Seat lifted — phone revealed!', '#44cc44');
        break;

      case 'seat-released':
        this.state.seatLiftedBy = null;
        this.animateSeatLift(data.seatIndex, false);
        if (!this.state.phoneGrabbedBy) {
          this.phoneMesh.visible = false;
        }
        break;

      case 'phone-grabbed':
        this.state.phoneGrabbedBy = data.by;
        this.stopBuzz();
        if (data.by === this.socket.id) {
          // I grabbed it — open the lock pattern screen
          this.player.setUIBlocking(true);
          this.lockPatternUI.show();
        } else {
          this.showToast('Another player grabbed the phone', '#ffaa22');
        }
        break;

      case 'phone-dropped':
        this.state.phoneGrabbedBy = null;
        this.showToast('Phone dropped — someone pick it up!', '#ffaa22');
        break;

      case 'pattern-wrong':
        this.lockPatternUI.showError('Wrong pattern — try again');
        break;

      case 'phone-unlocked':
        this.state.phoneUnlocked = true;
        this.lockPatternUI.hide();
        this.textsUI = createTextsUI(data.phoneCodePart, data.targetTag, () => {
          this.player.setUIBlocking(false);
        });
        this.textsUI.show();
        break;

      case 'phone-unlocked-broadcast':
        this.state.phoneUnlocked = true;
        if (this.state.phoneGrabbedBy !== this.socket.id) {
          this.showToast('Phone unlocked! Find the compartment.', '#44cc44');
        }
        break;

      case 'wrong-compartment':
        this.showToast('Wrong compartment — look for the right tag', '#ff4444');
        this.codeEntryUI.hide();
        this.player.setUIBlocking(false);
        break;

      case 'code-wrong':
        this.codeEntryUI.showError('ACCESS DENIED');
        break;

      case 'compartment-opened':
        this.state.compartmentOpen = true;
        this.codeEntryUI.hide();
        this.player.setUIBlocking(false);
        this.animateCompartmentOpen(data.compartmentIndex);
        this.showKeycardInCompartment(data.compartmentIndex);
        this.showToast('Compartment open! Take the keycard.', '#44cc44');
        break;

      case 'keycard-taken':
        this.state.keycardTaken = true;
        if (this.keycardMesh) this.keycardMesh.visible = false;
        if (data.by === this.socket.id) {
          this.showToast('Keycard acquired. Swipe it at the front door.', '#44cc44');
        } else {
          this.showToast('Another player took the keycard.', '#ffaa22');
        }
        break;

      case 'keycard-dropped':
        this.state.keycardTaken = false;
        if (this.keycardMesh) this.keycardMesh.visible = true;
        this.showToast('Keycard dropped — pick it up!', '#ffaa22');
        break;

      case 'door-unlocked':
        this.state.doorSwiped = true;
        this.readerSlotMat.color.set(0x00ff44);
        this.readerSlotMat.emissive.set(0x00ff44);
        this.doors.unlock('front');
        this.showToast('DOOR UNLOCKED! Move to the next car!', '#44cc44');
        break;

      case 'car-completed':
        break;
    }
  }

  // --- Interaction handlers ---

  handleSeatInteract(seatIndex) {
    if (this.state.phoneGrabbedBy) return; // phone already found
    this.socket.emit('puzzle-action', {
      car: 1,
      type: 'lift-seat',
      seatIndex,
    });
  }

  handlePhoneInteract() {
    if (!this.phoneMesh.visible) return;
    if (this.state.phoneGrabbedBy) {
      // Already grabbed — if we own it and it's unlocked, re-open texts
      if (
        this.state.phoneGrabbedBy === this.socket.id &&
        this.state.phoneUnlocked &&
        this.textsUI
      ) {
        this.player.setUIBlocking(true);
        this.textsUI.show();
      }
      return;
    }
    this.socket.emit('puzzle-action', { car: 1, type: 'grab-phone' });
  }

  handleCompartmentInteract(compIdx) {
    if (!this.state.phoneUnlocked) {
      this.showToast('Compartment is locked tight.', '#888');
      return;
    }
    if (this.state.compartmentOpen) {
      // Compartment already open — take keycard
      if (!this.state.keycardTaken) {
        this.socket.emit('puzzle-action', { car: 1, type: 'take-keycard' });
      }
      return;
    }
    // Show code entry UI — let the server determine if it's the right compartment
    this.player.setUIBlocking(true);
    this.codeEntryUI.show(compIdx, this.layout.stickerCode);
  }

  handleSwipeInteract() {
    if (!this.state.keycardTaken) {
      this.showToast('You need a keycard to use this.', '#888');
      return;
    }
    if (this.state.doorSwiped) return;
    this.socket.emit('puzzle-action', { car: 1, type: 'swipe-keycard' });
  }

  // --- Animations ---

  animateSeatLift(seatIndex, up) {
    this.seatLiftState.set(seatIndex, {
      amount: up ? 0 : 1,
      target: up ? 1 : 0,
    });
  }

  animateSeatPeek(seatIndex) {
    // Brief lift then drop
    this.seatLiftState.set(seatIndex, {
      amount: 0,
      target: 1,
      peek: true,
      peekTimer: 0,
    });
  }

  animateCompartmentOpen(compIdx) {
    const door = this.compartmentDoors.get(compIdx);
    if (door) {
      door.visible = false; // simple open: hide the door
    }
  }

  showKeycardInCompartment(compIdx) {
    const pos = compartmentWorldPos(compIdx);
    const cardGeo = new THREE.BoxGeometry(0.06, 0.004, 0.09);
    const cardMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      emissive: 0x44aaff,
      emissiveIntensity: 0.3,
      metalness: 0.5,
      roughness: 0.3,
    });
    this.keycardMesh = new THREE.Mesh(cardGeo, cardMat);
    this.keycardMesh.position.set(pos.x, pos.y, pos.z);
    this.scene.add(this.keycardMesh);
    this.objects.push(this.keycardMesh);

    const interactable = new Interactable(this.keycardMesh, {
      label: 'Press E to take keycard',
      onInteract: () => {
        if (!this.state.keycardTaken) {
          this.socket.emit('puzzle-action', { car: 1, type: 'take-keycard' });
        }
      },
    });
    this.interactables.push(interactable);
  }

  // --- Audio ---

  stopBuzz() {
    if (this.buzzGain) {
      const ctx = this.audioListener.context;
      this.buzzGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    }
    // Stop all sources to free CPU
    if (this.buzzOsc) {
      try { this.buzzOsc.stop(); } catch (e) {}
      this.buzzOsc = null;
    }
    if (this.buzzOsc2) {
      try { this.buzzOsc2.stop(); } catch (e) {}
      this.buzzOsc2 = null;
    }
    if (this.buzzNoise) {
      try { this.buzzNoise.stop(); } catch (e) {}
      this.buzzNoise = null;
    }
    this.buzzStarted = false;
  }

  // --- Toast notifications ---

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

  // --- Update loop ---

  update(dt) {
    // Phone vibration pattern: buzz-buzz ... pause ... (like a real incoming call)
    // Pattern over 3s cycle: on 0-0.4, off 0.4-0.55, on 0.55-0.95, off 0.95-3.0
    if (
      this.buzzStarted &&
      !this.state.phoneGrabbedBy &&
      this.audioListener
    ) {
      const ctx = this.audioListener.context;
      if (ctx.state === 'running') {
        const time = ctx.currentTime;
        const cycle = time % 3.0;
        const vibrating = (cycle < 0.4) || (cycle >= 0.55 && cycle < 0.95);
        this.buzzGain.gain.setTargetAtTime(
          vibrating ? 0.25 : 0.0,
          time,
          vibrating ? 0.01 : 0.03
        );
      }
    }

    // Seat lift/peek animations
    for (const [seatIndex, info] of this.seatLiftState.entries()) {
      const mesh = this.seatMeshMap.get(seatIndex);
      if (!mesh) continue;

      const speed = 4;
      if (info.peek) {
        // Peek: lift briefly then drop
        info.peekTimer = (info.peekTimer || 0) + dt;
        if (info.peekTimer < 0.4) {
          info.amount = Math.min(1, info.amount + dt * speed);
        } else {
          info.amount = Math.max(0, info.amount - dt * speed);
          if (info.amount <= 0) {
            this.seatLiftState.delete(seatIndex);
          }
        }
      } else {
        // Normal lift/drop
        if (info.amount < info.target) {
          info.amount = Math.min(info.target, info.amount + dt * speed);
        } else if (info.amount > info.target) {
          info.amount = Math.max(info.target, info.amount - dt * speed);
        }
      }

      // Apply: move up and tilt
      const baseSeatY = SEAT_HEIGHT;
      mesh.position.y = baseSeatY + info.amount * 0.25;
      mesh.rotation.x = info.amount * -0.4;
    }

    // Handle ESC to close UIs
    // (handled via keydown listener set up once)
  }

  // --- Keyboard handler for ESC and P ---
  // --- Dispose ---

  dispose() {
    // Stop audio
    this.stopBuzz();

    // Remove socket listeners
    if (this._onPuzzleUpdate) {
      this.socket.off('puzzle-update', this._onPuzzleUpdate);
    }
    if (this._onPuzzleError) {
      this.socket.off('puzzle-error', this._onPuzzleError);
    }

    // Remove interactables
    for (const inter of this.interactables) {
      inter.dispose();
    }
    this.interactables = [];

    // Remove 3D objects and dispose geometries/materials (via PuzzleBase)
    super.dispose();

    // Remove UI DOM elements
    if (this.lockPatternUI && this.lockPatternUI.el) {
      this.lockPatternUI.el.remove();
    }
    if (this.textsUI) {
      if (this.textsUI.destroy) this.textsUI.destroy();
      if (this.textsUI.el) this.textsUI.el.remove();
    }
    if (this.codeEntryUI && this.codeEntryUI.el) {
      this.codeEntryUI.el.remove();
    }
    const shakeStyle = document.getElementById('puzzle-shake-style');
    if (shakeStyle) shakeStyle.remove();
  }
}
