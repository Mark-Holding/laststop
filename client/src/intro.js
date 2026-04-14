// Opening sequence — cinematic intro inside the dark 3D scene
// The car is already rendering but with all lights off.
// The announcement plays in darkness, then lights stutter on at the corruption moment.
import { playAnnouncementTone, playOminousTone, playStaticBurst } from './audio/soundManager.js';

export function playIntroSequence(triggerLights, onComplete) {
  // Transparent text overlay (scene renders dark underneath)
  const overlay = document.createElement('div');
  overlay.id = 'intro-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:1000;' +
    'display:flex;align-items:center;justify-content:center;' +
    'flex-direction:column;pointer-events:none;';

  // Subtitle text
  const subtitle = document.createElement('div');
  subtitle.style.cssText =
    'font-family:"Courier New",monospace;color:#888;font-size:16px;' +
    'text-align:center;opacity:0;transition:opacity 0.5s;max-width:500px;' +
    'line-height:1.6;letter-spacing:1px;' +
    'text-shadow:0 0 12px rgba(200,180,140,0.3);';
  overlay.appendChild(subtitle);

  document.body.appendChild(overlay);

  const timeline = [
    // t=0: Silence in darkness — player can vaguely see the car interior
    {
      time: 0,
      action: () => {},
    },
    // t=1: Announcement chime (familiar subway sound)
    {
      time: 1000,
      action: () => {
        playAnnouncementTone();
      },
    },
    // t=1.9: Calm announcement text
    {
      time: 1900,
      action: () => {
        subtitle.style.opacity = '1';
        typeText(subtitle, 'This is a Manhattan-bound express train.', 60);
      },
    },
    // t=4.5: Next stop
    {
      time: 4500,
      action: () => {
        subtitle.textContent = '';
        typeText(subtitle, 'Next stop\u2014', 80);
      },
    },
    // t=5.5: Distortion — voice cuts, static, corruption
    {
      time: 5500,
      action: () => {
        playStaticBurst(1.5);
        subtitle.style.color = '#ff3333';
        subtitle.textContent = 'N\u0336e\u0336x\u0336t\u0336 s\u0336t\u0336o\u0336\u2014';
        setTimeout(() => {
          subtitle.textContent = '\u2588\u2588\u2588\u2588 \u2588\u2588\u2588\u2588\u2014';
        }, 300);
        setTimeout(() => {
          subtitle.style.opacity = '0';
        }, 800);
      },
    },
    // t=6: Lights stutter on — the reveal
    {
      time: 6000,
      action: () => {
        if (triggerLights) triggerLights();
      },
    },
    // t=6.5: Ominous low tone
    {
      time: 6500,
      action: () => {
        playOminousTone(4);
      },
    },
    // t=10: Remove overlay, release controls
    {
      time: 10000,
      action: () => {
        overlay.remove();
        if (onComplete) onComplete();
      },
    },
  ];

  const timers = [];
  for (const event of timeline) {
    timers.push(setTimeout(event.action, event.time));
  }

  return {
    skip() {
      for (const t of timers) clearTimeout(t);
      overlay.remove();
      if (triggerLights) triggerLights();
      if (onComplete) onComplete();
    },
  };
}

function typeText(element, text, charDelay = 50) {
  element.textContent = '';
  let i = 0;
  const interval = setInterval(() => {
    if (i < text.length) {
      element.textContent += text[i];
      i++;
    } else {
      clearInterval(interval);
    }
  }, charDelay);
  return interval;
}
