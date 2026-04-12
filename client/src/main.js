import * as THREE from 'three';
import socket from './network/socket.js';
import { createCar } from './train.js';
import { createCarLighting } from './lighting.js';
import { createPlayer } from './player.js';
import { createDoors } from './doors.js';
import { createTunnelView } from './windows.js';
import { updateInteractables, Interactable } from './interactable.js';
import { createMenu } from './ui/menu.js';
import { createHUD } from './ui/hud.js';
import { Car1Puzzle } from './puzzles/car1.js';
import { resumeAudio } from './audio/soundManager.js';
import {
  addRemotePlayer,
  removeRemotePlayer,
  updateRemotePlayerPosition,
  updateRemotePlayers,
} from './remotePlayers.js';

// Game state
let mySocketId = null;
let myPlayerIndex = 0;
let gameActive = false;
let scene = null;
let camera = null;
let renderer = null;
let player = null;
let clock = null;
let lighting = null;
let tunnel = null;
let doors = null;
let hud = null;
let currentPuzzle = null;
let gameKeyHandler = null;

// Position sync throttle
let syncTimer = 0;
const SYNC_INTERVAL = 1 / 15;

// Spawn positions per player index (back of Car 1)
const SPAWN_POSITIONS = [
  { x: -0.5, z: 6.0 },
  { x: 0.5, z: 6.0 },
  { x: -0.5, z: 5.0 },
  { x: 0.5, z: 5.0 },
];

// --- Menu ---
const menu = createMenu({
  onCreateRoom(username) {
    if (!socket.connected) socket.connect();
    socket.emit('create-room', { username });
  },
  onJoinRoom(username, code) {
    if (!socket.connected) socket.connect();
    socket.emit('join-room', { code, username });
  },
  onStartGame() {
    socket.emit('start-game');
  },
});

// --- Socket events ---
socket.on('connect', () => {
  mySocketId = socket.id;
  menu.setSocketId(socket.id);
});

socket.on('room-created', (data) => {
  menu.showLobby(data.code, data.players, data.hostId);
});

socket.on('room-joined', (data) => {
  menu.showLobby(data.code, data.players, data.hostId);
});

socket.on('player-joined', ({ player: p }) => {
  menu.addPlayer(p);
});

socket.on('player-left', ({ socketId }) => {
  menu.removePlayer(socketId);
  if (gameActive && scene) {
    removeRemotePlayer(scene, socketId);
  }
});

socket.on('host-changed', ({ hostId }) => {
  menu.updateHost(hostId);
});

socket.on('err', ({ message }) => {
  menu.showError(message);
});

socket.on('game-started', (data) => {
  menu.hideAll();
  startGame(data);
});

socket.on('player-moved', ({ socketId, position, rotation }) => {
  if (gameActive) {
    updateRemotePlayerPosition(socketId, position, rotation);
  }
});

socket.on('timer-update', (data) => {
  if (hud) {
    hud.update(data.elapsed, data.totalTime, data.stationIndex, data.stations);
  }
});

socket.on('game-over', () => {
  gameActive = false;
});

// --- Hint responses ---
socket.on('hint-response', (data) => {
  if (hud && data.text) {
    hud.showHint(data.tier, data.text, data.penalty);
  }
});

// --- Game init ---
function startGame({ seed, players, timerState, puzzleLayout }) {
  gameActive = true;

  const me = players.find((p) => p.socketId === mySocketId);
  myPlayerIndex = me ? me.index : 0;

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  document.body.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);

  // Camera
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );

  // Subway car
  const car = createCar(0);
  scene.add(car);

  // Lighting
  lighting = createCarLighting(scene);

  // Tunnel view
  tunnel = createTunnelView(scene);

  // Doors
  doors = createDoors(scene);

  new Interactable(doors.frontDoor.panel, {
    onInteract: () => {
      if (!doors.frontDoor.locked) doors.openDoor('front');
    },
  });
  new Interactable(doors.backDoor.panel, {
    onInteract: () => {
      if (!doors.backDoor.locked) doors.openDoor('back');
    },
  });

  // First-person controls
  player = createPlayer(camera, renderer.domElement);

  // Set spawn position
  const spawn = SPAWN_POSITIONS[myPlayerIndex] || SPAWN_POSITIONS[0];
  camera.position.set(spawn.x, 1.6, spawn.z);

  // Add remote players
  for (const p of players) {
    if (p.socketId === mySocketId) continue;
    addRemotePlayer(scene, p.socketId, p.username, p.color);
    const remoteSpawn = SPAWN_POSITIONS[p.index] || SPAWN_POSITIONS[0];
    updateRemotePlayerPosition(
      p.socketId,
      { x: remoteSpawn.x, y: 1.6, z: remoteSpawn.z },
      { y: 0, x: 0 }
    );
  }

  // HUD
  hud = createHUD();
  hud.show();
  if (timerState) {
    hud.update(
      timerState.elapsed,
      timerState.totalTime,
      timerState.stationIndex,
      timerState.stations
    );
  }

  // Car 1 puzzle
  if (puzzleLayout && puzzleLayout.car1) {
    currentPuzzle = new Car1Puzzle(scene, camera, socket, puzzleLayout.car1, player, doors);
  }

  // Hint system wiring
  hud.setHintCallback((tier) => {
    socket.emit('hint-request', { car: 1 });
  });

  // Keyboard interaction (remove previous listener if re-entering startGame)
  if (gameKeyHandler) document.removeEventListener('keydown', gameKeyHandler);
  gameKeyHandler = (event) => {
    if (event.code === 'KeyE' && player.isLocked) {
      const hovered = updateInteractables(camera, scene);
      if (hovered) hovered.interact(player);
    }
    if (event.code === 'KeyH') {
      hud.toggleHintPanel();
    }
    if (event.code === 'Escape' && currentPuzzle) {
      let closedSomething = false;
      if (currentPuzzle.lockPatternUI && currentPuzzle.lockPatternUI.isOpen) {
        currentPuzzle.lockPatternUI.hide();
        closedSomething = true;
      }
      if (currentPuzzle.textsUI && currentPuzzle.textsUI.isOpen) {
        currentPuzzle.textsUI.hide();
        closedSomething = true;
      }
      if (currentPuzzle.codeEntryUI && currentPuzzle.codeEntryUI.isOpen) {
        currentPuzzle.codeEntryUI.hide();
        closedSomething = true;
      }
      if (closedSomething) {
        player.setUIBlocking(false);
      }
    }
    if (event.code === 'KeyP' && currentPuzzle && currentPuzzle.textsUI) {
      if (currentPuzzle.state.phoneGrabbedBy === mySocketId && currentPuzzle.state.phoneUnlocked) {
        player.setUIBlocking(true);
        currentPuzzle.textsUI.show();
      }
    }
  };
  document.addEventListener('keydown', gameKeyHandler);

  // Click-to-lock overlay
  const clickPrompt = document.createElement('div');
  clickPrompt.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,0.6);z-index:200;cursor:pointer;' +
    'font-family:monospace;color:#aaa;font-size:1.1rem;';
  clickPrompt.textContent = 'Click to start';
  document.body.appendChild(clickPrompt);
  clickPrompt.addEventListener(
    'click',
    () => {
      clickPrompt.remove();
      renderer.domElement.requestPointerLock();
      resumeAudio();
    },
    { once: true }
  );

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Start loop
  clock = new THREE.Clock();
  animate();
}

function animate() {
  if (!gameActive) return;
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  player.update(dt);
  lighting.update(dt);
  tunnel.update(dt);
  doors.update(dt);
  if (currentPuzzle) currentPuzzle.update(dt);
  updateInteractables(camera, scene);
  updateRemotePlayers(dt);

  // Sync position to server at 15 fps
  syncTimer += dt;
  if (syncTimer >= SYNC_INTERVAL) {
    syncTimer = 0;
    const euler = new THREE.Euler().setFromQuaternion(
      camera.quaternion,
      'YXZ'
    );
    socket.emit('player-move', {
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      rotation: { y: euler.y, x: euler.x },
    });
  }

  renderer.render(scene, camera);
}
