import * as THREE from 'three';
import socket from './network/socket.js';
import { createCar, HALF_LENGTH } from './train.js';
import { createCarLighting } from './lighting.js';
import { createPlayer } from './player.js';
import { createDoors } from './doors.js';
import { createTunnelView } from './windows.js';
import { updateInteractables, Interactable, clearInteractables } from './interactable.js';
import { createMenu } from './ui/menu.js';
import { createHUD } from './ui/hud.js';
import { Car1Puzzle } from './puzzles/car1.js';
import { resumeAudio, initAudio, startAmbientSound, updateAmbientSound, stopAmbientSound } from './audio/soundManager.js';
import {
  addRemotePlayer,
  removeRemotePlayer,
  updateRemotePlayerPosition,
  updateRemotePlayers,
} from './remotePlayers.js';

// New immersion systems
import { updateTension, setCurrentCar, getTensionLevel, getIntensityMultiplier } from './tension.js';
import { playIntroSequence } from './intro.js';
import { createIntercom } from './ui/intercom.js';
import { createCarEnvironment } from './environment.js';
import { createCarTransition } from './carTransition.js';
import { wrongAnswerEffect } from './ui/screenEffects.js';
import { disposeScreenEffects } from './ui/screenEffects.js';
import { playWinEnding, playLoseEnding, buildScoreContent } from './ui/endings.js';

// Visual polish systems
import { createPostProcessing } from './postprocessing.js';
import { createDustParticles } from './particles.js';
import { createAdPanels } from './adPanels.js';

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
let resizeHandler = null;

// New system instances
let intercom = null;
let carEnvironment = null;
let carTransition = null;
let introSequence = null;

// Visual polish instances
let postProcessing = null;
let dustParticles = null;
let adPanels = null;

// Position sync throttle
let syncTimer = 0;
const SYNC_INTERVAL = 1 / 15;
const _syncEuler = new THREE.Euler(0, 0, 0, 'YXZ');

// Station LED display (overhead in-car display)
let stationLED = null;
let lastStationIndex = 0;

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
  // Update tension system
  updateTension(data.elapsed, null);

  if (hud) {
    hud.update(data.elapsed, null, data.stationIndex, null);
  }

  // Station LED flash on station change
  if (data.stationIndex > lastStationIndex) {
    lastStationIndex = data.stationIndex;
    flashStationLED(data.stationIndex);
  }
});

socket.on('game-over', (data) => {
  gameActive = false;
  showGameOverScreen(data && data.won);
});

// --- Hint responses ---
socket.on('hint-response', (data) => {
  if (hud && data.text) {
    hud.showHint(data.tier, data.text, data.penalty);
  }
});

// --- Wrong answer effect (listen for puzzle validation failures) ---
socket.on('puzzle-invalid', () => {
  wrongAnswerEffect();
});

// --- Station LED flash ---
function flashStationLED(stationIndex) {
  if (!stationLED) return;
  // Show station name briefly on the LED mesh
  stationLED.visible = true;
  setTimeout(() => {
    if (stationLED) stationLED.visible = false;
  }, 3000);
}

// --- Game init ---
function startGame({ players, timerState, puzzleLayout }) {
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
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
    hud.setTimerConfig(timerState.totalTime, timerState.stations);
    updateTension(timerState.elapsed, timerState.totalTime);
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

  // --- Visual polish systems ---

  // Post-processing (bloom, vignette, film grain)
  postProcessing = createPostProcessing(renderer, scene, camera);

  // Atmospheric dust particles
  dustParticles = createDustParticles(scene);

  // Procedural subway ad textures
  adPanels = createAdPanels(scene);

  // Kill one fluorescent tube in Car 1 for atmosphere (creates a dark zone)
  lighting.killTube(2);

  // --- Initialize new immersion systems ---

  // Bomber intercom taunts
  intercom = createIntercom();
  setCurrentCar(1);

  // Environmental storytelling (Car 1 — litter, stains, scuff marks)
  carEnvironment = createCarEnvironment(scene, 1);

  // Between-car transition corridor (at front door of Car 1)
  carTransition = createCarTransition(scene, 'front');

  // Station LED display (overhead in-car)
  createStationLED(scene);

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

  // Resize (remove previous if re-entering startGame)
  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
  resizeHandler = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (postProcessing) postProcessing.resize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', resizeHandler);

  // Start clock
  clock = new THREE.Clock();
  gameActive = true;

  // --- Click-to-start (required for browser audio policy) → intro sequence → gameplay ---
  player.setUIBlocking(true);

  const clickPrompt = document.createElement('div');
  clickPrompt.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,0.85);z-index:1100;cursor:pointer;' +
    'font-family:monospace;color:#aaa;font-size:1.1rem;';
  clickPrompt.textContent = 'Click to start';
  document.body.appendChild(clickPrompt);

  // Start with all lights off (intro reveals them)
  lighting.setAllOff();

  clickPrompt.addEventListener('click', () => {
    clickPrompt.remove();

    // Initialize audio context (needs user gesture)
    resumeAudio();
    initAudio(camera);

    // Play intro cinematic inside the dark 3D scene
    introSequence = playIntroSequence(
      // triggerLights — called when the corruption moment hits
      () => lighting.triggerPowerOn(),
      // onComplete — release controls, start gameplay
      () => {
        player.setUIBlocking(false);
        introSequence = null;
        startAmbientSound(camera);
        renderer.domElement.requestPointerLock();
      },
    );
  }, { once: true });

  // Start animation loop immediately (renders behind overlays)
  animate();
}

// --- Station LED display (overhead scrolling display inside car) ---
function createStationLED(scene) {
  // Simple text plane that shows station name when passing
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = '#ff8800';
  ctx.font = 'bold 28px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('NEXT STATION', 256, 40);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    emissive: 0xff6600,
    emissiveIntensity: 0.3,
    emissiveMap: texture,
  });
  const geo = new THREE.PlaneGeometry(1.2, 0.15);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 2.1, 0);
  mesh.visible = false;
  scene.add(mesh);

  stationLED = mesh;
  stationLED.userData.canvas = canvas;
  stationLED.userData.ctx = ctx;
  stationLED.userData.texture = texture;
}

function cleanupGame() {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
  if (gameKeyHandler) {
    document.removeEventListener('keydown', gameKeyHandler);
    gameKeyHandler = null;
  }
  if (player && player.dispose) player.dispose();
  if (currentPuzzle && currentPuzzle.dispose) currentPuzzle.dispose();
  if (hud) hud.hide();
  clearInteractables();

  // Cleanup new systems
  if (intercom) { intercom.dispose(); intercom = null; }
  if (carEnvironment) { carEnvironment.dispose(); carEnvironment = null; }
  if (carTransition) { carTransition.dispose(); carTransition = null; }
  if (introSequence) { introSequence.skip(); introSequence = null; }
  if (dustParticles) { dustParticles.dispose(); dustParticles = null; }
  if (adPanels) { adPanels.dispose(); adPanels = null; }
  if (postProcessing) {
    postProcessing.composer.renderTarget1.dispose();
    postProcessing.composer.renderTarget2.dispose();
    postProcessing = null;
  }
  disposeScreenEffects();

  lastStationIndex = 0;
  if (stationLED) {
    if (stationLED.parent) stationLED.parent.remove(stationLED);
    stationLED.geometry.dispose();
    stationLED.material.dispose();
    stationLED.userData.texture.dispose();
    stationLED = null;
  }
}

function showGameOverScreen(won) {
  cleanupGame();
  if (document.pointerLockElement) document.exitPointerLock();

  const onReturn = () => {
    stopAmbientSound();
    if (renderer && renderer.domElement.parentElement) {
      renderer.domElement.remove();
    }
    renderer = null;
    scene = null;
    camera = null;
    player = null;
    currentPuzzle = null;
    hud = null;
    menu.showMain();
  };

  if (won) {
    playWinEnding((scoreContainer, overlay) => {
      buildScoreContent(scoreContainer, overlay, true, onReturn);
    });
  } else {
    playLoseEnding((scoreContainer, overlay) => {
      buildScoreContent(scoreContainer, overlay, false, onReturn);
    });
  }
}

function animate() {
  if (!gameActive) return;
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  player.update(dt);

  // Update lighting with tension-based flicker intensity
  updateLightingWithTension(dt);

  // Update tunnel with tension-based speed
  updateTunnelWithTension(dt);

  doors.update(dt);
  if (currentPuzzle) currentPuzzle.update(dt);
  updateInteractables(camera, scene);
  updateRemotePlayers(dt, camera.position);

  // New system updates
  updateAmbientSound(dt);
  if (intercom) intercom.update(dt);
  if (carEnvironment) carEnvironment.update(dt);
  if (carTransition) {
    carTransition.update(dt, camera.position.z);
    carTransition.checkPlayerPosition(camera.position.z, -HALF_LENGTH, -HALF_LENGTH - 2.5);
  }

  // Dust particles (opacity tracks lit tubes)
  if (dustParticles) dustParticles.update(dt, lighting ? lighting.tubes : null);

  // Post-processing tension modulation
  if (postProcessing) {
    postProcessing.update(dt);
    postProcessing.setTension(getTensionLevel());
  }

  // Sync position to server at 15 fps
  syncTimer += dt;
  if (syncTimer >= SYNC_INTERVAL) {
    syncTimer = 0;
    _syncEuler.setFromQuaternion(camera.quaternion, 'YXZ');
    socket.emit('player-move', {
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      rotation: { y: _syncEuler.y, x: _syncEuler.x },
    });
  }

  // Render through post-processing pipeline
  if (postProcessing) {
    postProcessing.render();
  } else {
    renderer.render(scene, camera);
  }
}

// --- Tension-reactive lighting ---
// Pre-allocated color objects to avoid per-frame GC pressure
const _ambientColorA = new THREE.Color(0x403828);
const _ambientColorB = new THREE.Color(0x4a1515);
const _fogColorA = new THREE.Color(0x0a0a08);
const _fogColorB = new THREE.Color(0x150505);
const _lerpColor = new THREE.Color();

function updateLightingWithTension(dt) {
  if (!lighting) return;

  const intensity = getIntensityMultiplier();
  const tension = getTensionLevel();

  // Update flicker behavior based on tension
  for (const tube of lighting.tubes) {
    if (tube.dead) continue;

    // Let lighting.js handle powering-on phase (intro stutter)
    if (tube.flickerPhase === 'powering-on' || tube.flickerPhase === 'off') {
      // Only increment timer for these phases — lighting.update handles the logic
      continue;
    }

    tube.flickerTimer += dt;

    switch (tube.flickerPhase) {
      case 'steady':
        // Flicker more frequently at higher tension
        if (tube.flickerTimer >= tube.nextFlicker / intensity) {
          tube.flickerPhase = 'flickering';
          tube.flickerTimer = 0;
          tube.flickerDuration = (Math.random() * 0.6 + 0.1) * intensity;
        }
        break;

      case 'flickering': {
        const flickRate = Math.sin(tube.flickerTimer * 40) > 0;
        tube.on = flickRate;
        tube.light.intensity = flickRate ? tube.baseIntensity : 0.05;
        tube.material.emissiveIntensity = flickRate ? 1.5 : 0.05;

        if (tube.flickerTimer >= tube.flickerDuration) {
          tube.flickerPhase = 'steady';
          tube.flickerTimer = 0;
          tube.nextFlicker = Math.random() * 5 + 2;
          tube.on = true;
          tube.light.intensity = tube.baseIntensity;
          tube.material.emissiveIntensity = 1.5;
        }
        break;
      }
    }
  }

  // Also run lighting.update for powering-on/off phases (intro sequence)
  lighting.update(dt);

  // Red emergency lighting blend at high tension
  if (tension > 0.5) {
    const redBlend = (tension - 0.5) * 2; // 0 to 1 over the second half
    _lerpColor.copy(_ambientColorA).lerp(_ambientColorB, redBlend);
    lighting.ambientLight.color.copy(_lerpColor);
    lighting.ambientLight.intensity = 0.6 - redBlend * 0.2;

    // Fog gets denser and redder
    if (scene.fog) {
      _lerpColor.copy(_fogColorA).lerp(_fogColorB, redBlend);
      scene.fog.color.copy(_lerpColor);
      scene.fog.density = 0.025 + redBlend * 0.015;
    }
  }

  // Tone mapping exposure drops as tension rises (darker feel)
  if (renderer) {
    renderer.toneMappingExposure = 1.0 - tension * 0.2;
  }
}

// --- Tension-reactive tunnel ---
function updateTunnelWithTension(dt) {
  if (!tunnel) return;

  // Base update at tension-adjusted speed
  const speedMultiplier = 1 + getTensionLevel() * 0.8;
  // Override the tunnel's internal scroll speed by calling update with adjusted dt
  tunnel.update(dt * speedMultiplier);
}
