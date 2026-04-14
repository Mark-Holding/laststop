// Bomber intercom taunt system
// Triggered on timer + car entry, displays glitchy text with static audio
import { playStaticBurst } from '../audio/soundManager.js';
import { getCurrentCar, getElapsedTime, getTensionPhase, isFinalMinutes } from '../tension.js';

const TAUNTS = {
  // Generic taunts (use {car} and {time} placeholders)
  generic: [
    'Still in car {car}? I expected more from you.',
    'Three stations left. You\'re running out of track.',
    'I can hear you fumbling around back there.',
    'That last puzzle took you {time} seconds. Pathetic.',
    'Do you even know what\'s waiting at the end of the line?',
    'Tick tock. The clock doesn\'t care about your feelings.',
    'I\'ve been watching. You\'re slower than I thought.',
    'Every second you waste, the station gets closer.',
    'You think this is a game? This is your last stop.',
    'I almost feel sorry for you. Almost.',
  ],
  // Taunts for specific cars (on entry)
  carEntry: {
    2: 'Oh good, you figured out the phone. I\'m impressed. Not really.',
    3: 'Car 3. The passengers are waiting. Try not to bore them.',
    4: 'Scared of the dark? You should be.',
    5: 'Careful with the wires. One wrong cut and... well, you know.',
    6: 'Can you hear me now? Oh wait, you can\'t. Yet.',
    7: 'I split the car for a reason. Let\'s see how well you communicate.',
    8: 'Welcome to the front. You can see the station from here, can\'t you?',
  },
  // Final minutes taunts (more aggressive)
  critical: [
    'You\'re out of time. Can you feel the brakes NOT working?',
    'I can see the platform from here. Can you?',
    'This is it. Your last stop.',
    'Faster! FASTER!',
    'The station is right there. Right. There.',
    'Too late. Too slow. Too bad.',
  ],
};

let container = null;
let textEl = null;
let glitchInterval = null;
let tauntTimer = 0;
let nextTauntTime = 120; // First taunt at 2 minutes
let lastCarTaunted = 0;
let carEnterTime = 0;
let disposed = false;
let tauntQueue = [];
let isShowing = false;
let carEntryTimeout = null;

export function createIntercom() {
  // Inject styles
  const style = document.createElement('style');
  style.id = 'intercom-style';
  style.textContent = `
    #intercom-taunt {
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 550;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s;
    }
    #intercom-text {
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: #ff4444;
      text-align: center;
      padding: 10px 24px;
      background: rgba(0, 0, 0, 0.85);
      border: 1px solid rgba(255, 68, 68, 0.3);
      max-width: 500px;
      line-height: 1.5;
      letter-spacing: 1px;
      text-shadow: 0 0 8px rgba(255, 68, 68, 0.5);
    }
    #intercom-taunt.visible {
      opacity: 1;
    }
    @keyframes intercom-glitch {
      0% { transform: translateX(-50%) skewX(0); }
      10% { transform: translateX(-50%) skewX(-2deg); }
      20% { transform: translateX(-50%) skewX(0); }
      30% { transform: translateX(-50%) skewX(1deg); }
      40% { transform: translateX(-50%) skewX(0); }
      100% { transform: translateX(-50%) skewX(0); }
    }
    #intercom-taunt.glitching {
      animation: intercom-glitch 0.15s ease-in-out;
    }
  `;
  document.head.appendChild(style);

  container = document.createElement('div');
  container.id = 'intercom-taunt';
  textEl = document.createElement('div');
  textEl.id = 'intercom-text';
  container.appendChild(textEl);
  document.body.appendChild(container);

  disposed = false;
  tauntTimer = 0;
  nextTauntTime = 120;
  lastCarTaunted = 0;

  return {
    update: updateIntercom,
    onCarEnter: handleCarEnter,
    dispose: disposeIntercom,
  };
}

function handleCarEnter(carNumber) {
  if (carNumber <= 1 || carNumber === lastCarTaunted) return;
  lastCarTaunted = carNumber;
  carEnterTime = getElapsedTime();

  const carTaunt = TAUNTS.carEntry[carNumber];
  if (carTaunt) {
    // Small delay before car entry taunt
    carEntryTimeout = setTimeout(() => showTaunt(carTaunt), 2000);
  }
}

function updateIntercom(dt) {
  if (disposed) return;

  tauntTimer += dt;

  if (tauntTimer >= nextTauntTime && !isShowing) {
    tauntTimer = 0;

    const phase = getTensionPhase();
    const car = getCurrentCar();
    const elapsed = getElapsedTime();
    const finalMin = isFinalMinutes();

    // Pick taunt pool based on tension
    const pool = finalMin ? TAUNTS.critical : TAUNTS.generic;
    let taunt = pool[Math.floor(Math.random() * pool.length)];

    // Replace placeholders
    taunt = taunt.replace('{car}', car);
    taunt = taunt.replace('{time}', Math.floor(elapsed - carEnterTime));

    showTaunt(taunt);

    // Schedule next taunt — more frequent at higher tension
    if (finalMin) {
      nextTauntTime = 30 + Math.random() * 30; // 30-60s in final minutes
    } else if (phase === 'tense') {
      nextTauntTime = 90 + Math.random() * 60; // 90-150s
    } else {
      nextTauntTime = 120 + Math.random() * 60; // 120-180s
    }
  }
}

function showTaunt(text) {
  if (disposed || isShowing) {
    tauntQueue.push(text);
    return;
  }

  isShowing = true;

  // Static audio burst
  playStaticBurst(0.8);

  // Glitch effect during static
  textEl.textContent = '';
  container.classList.add('visible');

  // Corrupted text phase
  let glitchCount = 0;
  glitchInterval = setInterval(() => {
    glitchCount++;
    textEl.textContent = corruptText(text, Math.max(0, 1 - glitchCount / 8));
    container.classList.add('glitching');
    setTimeout(() => container.classList.remove('glitching'), 100);

    if (glitchCount >= 8) {
      clearInterval(glitchInterval);
      textEl.textContent = text;
    }
  }, 100);

  // Hold the text for a few seconds, then fade
  setTimeout(() => {
    container.classList.remove('visible');
    setTimeout(() => {
      isShowing = false;
      // Process queue
      if (tauntQueue.length > 0) {
        showTaunt(tauntQueue.shift());
      }
    }, 500);
  }, 4000);
}

// Corrupt text with random unicode block characters
function corruptText(text, amount) {
  const glitchChars = '\u2588\u2591\u2592\u2593\u2580\u2584\u258C\u2590';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    if (Math.random() < amount && text[i] !== ' ') {
      result += glitchChars[Math.floor(Math.random() * glitchChars.length)];
    } else {
      result += text[i];
    }
  }
  return result;
}

function disposeIntercom() {
  disposed = true;
  if (glitchInterval) clearInterval(glitchInterval);
  if (carEntryTimeout) clearTimeout(carEntryTimeout);
  if (container && container.parentElement) container.remove();
  const style = document.getElementById('intercom-style');
  if (style) style.remove();
  tauntQueue = [];
  isShowing = false;
  carEntryTimeout = null;
}
