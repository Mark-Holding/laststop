// Screen-level visual effects — red flash, white flash, etc.
import { playBuzzer, playCrackle } from '../audio/soundManager.js';

let flashOverlay = null;

function getFlashOverlay() {
  if (!flashOverlay) {
    flashOverlay = document.createElement('div');
    flashOverlay.id = 'screen-flash';
    flashOverlay.style.cssText =
      'position:fixed;inset:0;z-index:550;pointer-events:none;' +
      'opacity:0;transition:opacity 0.1s;';
    document.body.appendChild(flashOverlay);
  }
  return flashOverlay;
}

// Wrong answer: harsh buzzer, red flash, electrical crackle, camera jolt
export function wrongAnswerEffect() {
  const overlay = getFlashOverlay();
  overlay.style.background = 'rgba(255, 0, 0, 0.3)';
  overlay.style.transition = 'opacity 0.05s';
  overlay.style.opacity = '1';

  playBuzzer();
  playCrackle();

  setTimeout(() => {
    overlay.style.transition = 'opacity 0.8s';
    overlay.style.opacity = '0';
  }, 150);
}

// Win: white flash then fade to reveal score
export function whiteFlashEffect(duration = 1000) {
  const overlay = getFlashOverlay();
  overlay.style.background = 'rgba(255, 255, 255, 0.9)';
  overlay.style.transition = 'opacity 0.05s';
  overlay.style.opacity = '1';

  return new Promise((resolve) => {
    setTimeout(() => {
      overlay.style.transition = `opacity ${duration}ms`;
      overlay.style.opacity = '0';
      setTimeout(resolve, duration);
    }, 100);
  });
}

// Lose: bright white flash then silence
export function explosionFlashEffect() {
  const overlay = getFlashOverlay();
  overlay.style.background = '#ffffff';
  overlay.style.transition = 'opacity 0.02s';
  overlay.style.opacity = '1';

  return new Promise((resolve) => {
    setTimeout(() => {
      overlay.style.transition = 'opacity 3s';
      overlay.style.opacity = '0';
      overlay.style.background = '#000000';
      // Second phase — fade to black
      setTimeout(() => {
        overlay.style.opacity = '1';
        overlay.style.transition = 'opacity 2s';
        setTimeout(resolve, 2000);
      }, 500);
    }, 1000);
  });
}

export function disposeScreenEffects() {
  if (flashOverlay && flashOverlay.parentElement) {
    flashOverlay.remove();
    flashOverlay = null;
  }
}
