import * as THREE from 'three';
import { getTensionLevel, isFinalMinutes, getTensionPhase } from '../tension.js';

let audioListener = null;
let audioCtx = null;
let masterGain = null;
let started = false;

// Sound layers
let rumbleNodes = null;
let clickNodes = null;
let ventNodes = null;
let heartbeatNodes = null;

// State
let clickTimer = 0;
let clickInterval = 0.4; // seconds between track clicks
let heartbeatPhase = 0;
let isInTransition = false; // between-car transition state

// Atmospheric events
let atmosphericTimer = 0;
let nextAtmosphericEvent = 8 + Math.random() * 12;

// Proximity audio
let proximityOsc = null;
let proximityGain = null;

export function getAudioListener(camera) {
  if (!audioListener) {
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);
  }
  return audioListener;
}

export function getAudioContext() {
  if (!audioCtx && audioListener) {
    audioCtx = audioListener.context;
  }
  return audioCtx;
}

export function resumeAudio() {
  if (audioListener && audioListener.context.state === 'suspended') {
    audioListener.context.resume();
  }
}

// Create a noise buffer (white/brown noise)
function createNoiseBuffer(ctx, duration, type = 'brown') {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else {
    // Brown noise (random walk, lowpassed)
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  return buffer;
}

// --- Base layer: wheel-on-rail rumble ---
function createRumble(ctx) {
  // Low frequency noise for constant rumble
  const noiseBuffer = createNoiseBuffer(ctx, 4, 'brown');
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;

  // Low-pass filter for deep rumble
  const lpFilter = ctx.createBiquadFilter();
  lpFilter.type = 'lowpass';
  lpFilter.frequency.value = 120;
  lpFilter.Q.value = 0.5;

  // Add a subtle oscillation for wheel rhythm
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 30;

  const oscGain = ctx.createGain();
  oscGain.gain.value = 0.08;

  const gain = ctx.createGain();
  gain.gain.value = 0.25;

  source.connect(lpFilter);
  lpFilter.connect(gain);
  osc.connect(oscGain);
  oscGain.connect(gain);

  source.start();
  osc.start();

  return { source, osc, gain, lpFilter, oscGain };
}

// --- Rhythmic layer: track joint clicks ---
function createClickSystem(ctx) {
  const gain = ctx.createGain();
  gain.gain.value = 0.04;

  return { gain, ctx };
}

function playClick(ctx, output) {
  // Short thud of filtered noise for a subtle track-joint knock
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const env = Math.exp(-i / (ctx.sampleRate * 0.015));
    data[i] = (Math.random() * 2 - 1) * env;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600 + Math.random() * 200;
  lp.Q.value = 1;

  source.connect(lp);
  lp.connect(output);
  source.start();
}

// --- Atmosphere: ventilation hum ---
function createVentilation(ctx) {
  const noiseBuffer = createNoiseBuffer(ctx, 3, 'brown');
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 150;
  lp.Q.value = 0.5;

  const gain = ctx.createGain();
  gain.gain.value = 0.025;

  source.connect(lp);
  lp.connect(gain);
  source.start();

  return { source, gain, lp };
}


// --- Heartbeat bass pulse (final 3 minutes) ---
function createHeartbeat(ctx) {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  return { gain, ctx, phase: 0 };
}

function playHeartbeatPulse(ctx, output, intensity) {
  // Two quick thumps (lub-dub)
  for (const offset of [0, 0.12]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = offset === 0 ? 40 : 35;

    const gain = ctx.createGain();
    const t = ctx.currentTime + offset;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(intensity * 0.4, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(output);
    osc.start(t);
    osc.stop(t + 0.25);
  }
}

// --- Static/crackle effect for intercom ---
export function playStaticBurst(duration = 1.0) {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;

  const buffer = createNoiseBuffer(ctx, duration, 'white');
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3000;
  bp.Q.value = 1;

  const gain = ctx.createGain();
  // Stutter the static
  const now = ctx.currentTime;
  for (let t = 0; t < duration; t += 0.05) {
    const on = Math.random() > 0.3;
    gain.gain.setValueAtTime(on ? 0.12 : 0, now + t);
  }
  gain.gain.setValueAtTime(0, now + duration);

  source.connect(bp);
  bp.connect(gain);
  gain.connect(masterGain);
  source.start();
  source.stop(now + duration + 0.1);
}

// --- Door unlock sound ---
export function playDoorUnlock() {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;

  // Heavy mechanical clunk
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 15);
    data[i] = (Math.random() * 2 - 1) * env * 0.8;
    // Add resonant ping
    data[i] += Math.sin(t * 300) * env * 0.3;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;

  const gain = ctx.createGain();
  gain.gain.value = 0.5;

  source.connect(lp);
  lp.connect(gain);
  gain.connect(masterGain);
  source.start();

  // Hydraulic hiss after clunk
  setTimeout(() => {
    if (!audioCtx) return;
    const hissBuffer = createNoiseBuffer(ctx, 0.8, 'white');
    const hissSource = ctx.createBufferSource();
    hissSource.buffer = hissBuffer;

    const hissBp = ctx.createBiquadFilter();
    hissBp.type = 'highpass';
    hissBp.frequency.value = 4000;

    const hissGain = ctx.createGain();
    const t = ctx.currentTime;
    hissGain.gain.setValueAtTime(0.15, t);
    hissGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

    hissSource.connect(hissBp);
    hissBp.connect(hissGain);
    hissGain.connect(masterGain);
    hissSource.start();
  }, 200);
}

// --- Door slide open sound ---
export function playDoorSlide() {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;

  // Metallic sliding rumble
  const buffer = createNoiseBuffer(ctx, 1.0, 'brown');
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 400;
  bp.Q.value = 2;

  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.2, t + 0.1);
  gain.gain.setValueAtTime(0.2, t + 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);

  source.connect(bp);
  bp.connect(gain);
  gain.connect(masterGain);
  source.start();
}

// --- Wrong answer buzzer ---
export function playBuzzer() {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;

  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 150;

  const osc2 = ctx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.value = 153; // slight detune for grit

  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.25, t);
  gain.gain.setValueAtTime(0.25, t + 0.5);
  gain.gain.linearRampToValueAtTime(0, t + 0.6);

  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc2.start(t);
  osc.stop(t + 0.6);
  osc2.stop(t + 0.6);
}

// --- Electrical crackle ---
export function playCrackle() {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;

  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() > 0.92 ? (Math.random() * 2 - 1) : 0;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.value = 0.2;

  source.connect(gain);
  gain.connect(masterGain);
  source.start();
}

// --- Station ding ---
export function playStationDing(isLateStation = false) {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = isLateStation ? 880 : 1047; // A5 or C6

  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + 1.3);

  if (isLateStation) {
    // Alarm tone follows the ding
    setTimeout(() => {
      if (!audioCtx) return;
      const alarm = ctx.createOscillator();
      alarm.type = 'square';
      alarm.frequency.value = 600;

      const alarmGain = ctx.createGain();
      const t2 = ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        alarmGain.gain.setValueAtTime(0.1, t2 + i * 0.15);
        alarmGain.gain.setValueAtTime(0, t2 + i * 0.15 + 0.08);
      }
      alarmGain.gain.setValueAtTime(0, t2 + 0.9);

      alarm.connect(alarmGain);
      alarmGain.connect(masterGain);
      alarm.start(t2);
      alarm.stop(t2 + 1.0);
    }, 400);
  }
}

// --- Object interact click ---
export function playInteractClick() {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 1200;

  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.1);
}

// --- Object hover sound ---
export function playHoverSound() {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 800;

  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.03, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.08);
}

// --- Brake screech (win ending) ---
export function playBrakeScreech() {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;

  // High-pitched metallic screech
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 3000;

  const osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = 3050;

  const noiseBuffer = createNoiseBuffer(ctx, 3, 'white');
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const noiseBp = ctx.createBiquadFilter();
  noiseBp.type = 'bandpass';
  noiseBp.frequency.value = 4000;
  noiseBp.Q.value = 3;

  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.3, t + 0.2);
  gain.gain.setValueAtTime(0.3, t + 1.5);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 3.0);

  osc.connect(gain);
  osc2.connect(gain);
  noise.connect(noiseBp);
  noiseBp.connect(gain);
  gain.connect(masterGain);

  osc.start(t);
  osc2.start(t);
  noise.start(t);
  osc.stop(t + 3.1);
  osc2.stop(t + 3.1);
  noise.stop(t + 3.1);
}

// --- Subway announcement voice (synthesized) ---
export function playAnnouncementTone(callback) {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;

  // Chime before announcement
  const chime = ctx.createOscillator();
  chime.type = 'sine';
  chime.frequency.value = 880;

  const chimeGain = ctx.createGain();
  const t = ctx.currentTime;
  chimeGain.gain.setValueAtTime(0.15, t);
  chimeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

  chime.connect(chimeGain);
  chimeGain.connect(masterGain);
  chime.start(t);
  chime.stop(t + 0.9);

  if (callback) setTimeout(callback, 900);
}

// --- Distortion/ominous tone for intro ---
export function playOminousTone(duration = 3) {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;
  const t = ctx.currentTime;

  // Low drone
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 55;

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 82.5; // perfect fifth above

  // Static/distortion noise
  const noiseBuffer = createNoiseBuffer(ctx, duration, 'brown');
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const noiseLp = ctx.createBiquadFilter();
  noiseLp.type = 'lowpass';
  noiseLp.frequency.value = 300;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.25, t + 1);
  gain.gain.setValueAtTime(0.25, t + duration - 1);
  gain.gain.linearRampToValueAtTime(0, t + duration);

  osc.connect(gain);
  osc2.connect(gain);
  noise.connect(noiseLp);
  noiseLp.connect(gain);
  gain.connect(masterGain);

  osc.start(t);
  osc2.start(t);
  noise.start(t);
  osc.stop(t + duration + 0.1);
  osc2.stop(t + duration + 0.1);
  noise.stop(t + duration + 0.1);
}

// --- Explosion (lose ending) ---
export function playExplosion() {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;

  const buffer = createNoiseBuffer(ctx, 2, 'brown');
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 200;

  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 2);

  source.connect(lp);
  lp.connect(gain);
  gain.connect(masterGain);
  source.start(t);
}

// --- Calm announcement for win ---
export function playCalmAnnouncement() {
  // Just a pleasant chime — the voice is text overlay
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;
  const t = ctx.currentTime;

  for (const [freq, offset] of [[880, 0], [1047, 0.3], [1319, 0.6]]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t + offset);
    gain.gain.linearRampToValueAtTime(0.1, t + offset + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 1.5);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t + offset);
    osc.stop(t + offset + 1.6);
  }
}

// --- Metallic creak/ping (train expanding, settling) ---
function playMetallicCreak() {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;
  const t = ctx.currentTime;
  const freq = 400 + Math.random() * 600;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.15);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.04 + Math.random() * 0.03, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3 + Math.random() * 0.2);

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 300;

  osc.connect(hp);
  hp.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.6);
}

// --- Distant muffled PA (unintelligible speech-rhythm noise) ---
function playDistantPA() {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;
  const t = ctx.currentTime;
  const duration = 1.5 + Math.random() * 1.5;

  // Chime first
  const chime = ctx.createOscillator();
  chime.type = 'sine';
  chime.frequency.value = 660;
  const chimeGain = ctx.createGain();
  chimeGain.gain.setValueAtTime(0.015, t);
  chimeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  chime.connect(chimeGain);
  chimeGain.connect(masterGain);
  chime.start(t);
  chime.stop(t + 0.5);

  // Muffled speech-like noise bursts
  const buf = createNoiseBuffer(ctx, duration, 'brown');
  const src = ctx.createBufferSource();
  src.buffer = buf;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 400;
  lp.Q.value = 2;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 250;
  bp.Q.value = 3;

  const gain = ctx.createGain();
  // Stutter on/off to simulate speech cadence
  for (let s = 0; s < duration; s += 0.12) {
    const on = Math.random() > 0.35;
    gain.gain.setValueAtTime(on ? 0.02 : 0, t + 0.5 + s);
  }
  gain.gain.setValueAtTime(0, t + 0.5 + duration);

  src.connect(bp);
  bp.connect(lp);
  lp.connect(gain);
  gain.connect(masterGain);
  src.start(t + 0.5);
  src.stop(t + 0.5 + duration + 0.1);
}

// --- Distant brake squeal (another train, far away) ---
function playDistantBrakeSqueal() {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(2800 + Math.random() * 600, t);
  osc.frequency.exponentialRampToValueAtTime(1800, t + 1.2);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1200;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.015, t + 0.2);
  gain.gain.setValueAtTime(0.015, t + 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);

  osc.connect(lp);
  lp.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + 1.5);
}

// --- Proximity audio for interactable objects ---
export function updateProximityAudio(intensity) {
  if (!audioCtx || !masterGain) return;
  if (intensity > 0 && !proximityOsc) {
    proximityOsc = audioCtx.createOscillator();
    proximityOsc.type = 'sine';
    proximityOsc.frequency.value = 200;
    proximityGain = audioCtx.createGain();
    proximityGain.gain.value = 0;
    proximityOsc.connect(proximityGain);
    proximityGain.connect(masterGain);
    proximityOsc.start();
  }
  if (proximityGain) {
    const targetVol = intensity * 0.018;
    proximityGain.gain.setTargetAtTime(targetVol, audioCtx.currentTime, 0.1);
  }
  if (proximityOsc) {
    proximityOsc.frequency.setTargetAtTime(200 + intensity * 350, audioCtx.currentTime, 0.1);
  }
}

// --- Remote player footstep ---
export function playFootstep(volume) {
  if (!audioCtx || !masterGain) return;
  const ctx = audioCtx;
  const t = ctx.currentTime;

  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const env = Math.exp(-i / (ctx.sampleRate * 0.02));
    data[i] = (Math.random() * 2 - 1) * env;
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 400 + Math.random() * 200;

  const gain = ctx.createGain();
  gain.gain.value = Math.min(0.08, volume);

  src.connect(lp);
  lp.connect(gain);
  gain.connect(masterGain);
  src.start(t);
}

// --- Between-car transition: set tunnel roar mode ---
export function setTransitionMode(inTransition) {
  isInTransition = inTransition;
}

// --- Initialize audio context and master gain (call early, before intro) ---
export function initAudio(camera) {
  if (audioCtx && masterGain) return;
  getAudioListener(camera);
  audioCtx = audioListener.context;
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.7;
  masterGain.connect(audioCtx.destination);
}

// --- Start ambient sound layers (call after intro completes) ---
export function startAmbientSound(camera) {
  if (started) return;
  started = true;

  // Ensure audio is initialized
  initAudio(camera);

  // Start ambient layers
  rumbleNodes = createRumble(audioCtx);
  rumbleNodes.gain.connect(masterGain);

  clickNodes = createClickSystem(audioCtx);
  clickNodes.gain.connect(masterGain);

  ventNodes = createVentilation(audioCtx);
  ventNodes.gain.connect(masterGain);

  heartbeatNodes = createHeartbeat(audioCtx);
  heartbeatNodes.gain.connect(masterGain);

  clickTimer = 0;
}

// --- Update ambient sounds each frame ---
export function updateAmbientSound(dt) {
  if (!started || !audioCtx) return;

  const tension = getTensionLevel();
  const finalMinutes = isFinalMinutes();

  // Adjust rumble volume and filter based on tension
  if (rumbleNodes) {
    const rumbleVol = isInTransition ? 0.6 : 0.15 + tension * 0.25;
    rumbleNodes.gain.gain.value += (rumbleVol - rumbleNodes.gain.gain.value) * dt * 2;
    rumbleNodes.lpFilter.frequency.value = isInTransition ? 300 : 100 + tension * 100;
  }

  // Track joint clicks — subtle, irregular rhythm
  clickInterval = isInTransition ? 0.15 : 0.5 - tension * 0.15;
  clickTimer += dt;
  if (clickTimer >= clickInterval && clickNodes) {
    clickTimer = -(Math.random() * 0.1); // slight randomness so it doesn't sound mechanical
    const clickVol = isInTransition ? 0.12 : 0.03 + tension * 0.04;
    clickNodes.gain.gain.value = clickVol;
    playClick(audioCtx, clickNodes.gain);
  }

  // Ventilation — louder in transition, quieter normally
  if (ventNodes) {
    const ventVol = isInTransition ? 0.01 : 0.03 + tension * 0.02;
    ventNodes.gain.gain.value += (ventVol - ventNodes.gain.gain.value) * dt * 2;
  }

  // Heartbeat — only in final 3 minutes
  if (finalMinutes && heartbeatNodes) {
    const remaining = 180 - (1800 * tension - 1620); // approx
    const heartRate = 0.8 + (1 - Math.max(0, remaining) / 180) * 0.6; // 0.8s to 0.5s interval
    heartbeatPhase += dt;
    if (heartbeatPhase >= heartRate) {
      heartbeatPhase = 0;
      const intensity = 0.3 + (1 - Math.max(0, remaining) / 180) * 0.7;
      heartbeatNodes.gain.gain.value = 1;
      playHeartbeatPulse(audioCtx, heartbeatNodes.gain, intensity);
    }
  }

  // Random atmospheric events (creaks, distant PA, distant brake squeal)
  atmosphericTimer += dt;
  if (atmosphericTimer >= nextAtmosphericEvent) {
    atmosphericTimer = 0;
    const roll = Math.random();
    if (roll < 0.45) {
      playMetallicCreak();
    } else if (roll < 0.75) {
      playDistantPA();
    } else {
      playDistantBrakeSqueal();
    }
    // More frequent at higher tension
    nextAtmosphericEvent = (6 + Math.random() * 14) / (1 + tension * 0.5);
  }
}

// --- Stop all ambient sound ---
export function stopAmbientSound() {
  if (!started) return;
  started = false;

  // Stop running source nodes to free resources
  try {
    if (rumbleNodes) { rumbleNodes.source.stop(); rumbleNodes.osc.stop(); }
    if (ventNodes) { ventNodes.source.stop(); }
    if (proximityOsc) { proximityOsc.stop(); proximityOsc = null; proximityGain = null; }
  } catch (e) { /* already stopped */ }

  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    // Disconnect after fade completes
    setTimeout(() => {
      try { masterGain.disconnect(); } catch (e) { /* ok */ }
    }, 600);
  }

  rumbleNodes = null;
  clickNodes = null;
  ventNodes = null;
  heartbeatNodes = null;
}

// --- Fade ambient for endings ---
export function fadeAmbientSound(duration = 2) {
  if (!masterGain || !audioCtx) return;
  masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
}
