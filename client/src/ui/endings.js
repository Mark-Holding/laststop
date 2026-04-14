// Cinematic ending sequences
// Win: brake screech, camera lurch, silence, calm announcement, score fade
// Lose: white flash, silence, news broadcast, fade to black
import {
  playBrakeScreech,
  playCalmAnnouncement,
  playExplosion,
  fadeAmbientSound,
  stopAmbientSound,
} from '../audio/soundManager.js';
import { explosionFlashEffect } from './screenEffects.js';

// Win ending — cinematic brake sequence
export function playWinEnding(onShowScore) {
  // 1. Brake screech
  playBrakeScreech();
  fadeAmbientSound(2.5);

  // 2. After 2 seconds of screeching — sudden silence
  setTimeout(() => {
    stopAmbientSound();
  }, 2500);

  // 3. 2 seconds of pure silence — tension release
  setTimeout(() => {
    // 4. Calm subway announcement chime returns
    playCalmAnnouncement();
  }, 4500);

  // 5. Build the score overlay with announcement text
  setTimeout(() => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0);z-index:600;font-family:"Courier New",monospace;color:#ccc;' +
      'transition:background 2s;';
    document.body.appendChild(overlay);

    // Announcement text at the top
    const announcement = document.createElement('div');
    announcement.style.cssText =
      'font-size:14px;color:#888;margin-bottom:40px;opacity:0;transition:opacity 1.5s;letter-spacing:1px;';
    announcement.textContent = 'This is... an express train. Please stand clear of the closing doors.';
    overlay.appendChild(announcement);

    // Fade in background
    requestAnimationFrame(() => {
      overlay.style.background = 'rgba(0,0,0,0.85)';
      announcement.style.opacity = '1';
    });

    // Score content container (filled by main.js callback)
    const scoreContainer = document.createElement('div');
    scoreContainer.style.cssText = 'opacity:0;transition:opacity 1.5s;text-align:center;';
    overlay.appendChild(scoreContainer);

    setTimeout(() => {
      scoreContainer.style.opacity = '1';
      if (onShowScore) onShowScore(scoreContainer, overlay);
    }, 2000);
  }, 5000);
}

// Lose ending — explosion flash + news broadcast
export function playLoseEnding(onShowScore) {
  // 1. Instant white flash + explosion sound
  fadeAmbientSound(0.1);
  playExplosion();

  explosionFlashEffect().then(() => {
    stopAmbientSound();

    // 2. One full second of silence after flash
    setTimeout(() => {
      // 3. News broadcast overlay
      const overlay = document.createElement('div');
      overlay.style.cssText =
        'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'background:rgba(0,0,0,0.95);z-index:600;font-family:"Courier New",monospace;color:#ccc;' +
        'opacity:0;transition:opacity 1s;';
      document.body.appendChild(overlay);

      // News broadcast text — typewriter style
      const newsText = document.createElement('div');
      newsText.style.cssText =
        'font-size:13px;color:#ff4444;margin-bottom:40px;letter-spacing:1px;' +
        'max-width:500px;text-align:center;line-height:1.6;';
      overlay.appendChild(newsText);

      const scoreContainer = document.createElement('div');
      scoreContainer.style.cssText = 'opacity:0;transition:opacity 1.5s;text-align:center;';
      overlay.appendChild(scoreContainer);

      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
      });

      // Typewriter the news broadcast
      const newsMessage = 'Breaking news \u2014 an explosion on the downtown line. Emergency services responding to Chambers Street station...';
      let charIndex = 0;
      const typeInterval = setInterval(() => {
        if (charIndex < newsMessage.length) {
          newsText.textContent += newsMessage[charIndex];
          charIndex++;
        } else {
          clearInterval(typeInterval);
          // Show score after news finishes
          setTimeout(() => {
            newsText.style.transition = 'opacity 1s';
            newsText.style.opacity = '0.4';
            scoreContainer.style.opacity = '1';
            if (onShowScore) onShowScore(scoreContainer, overlay);
          }, 1500);
        }
      }, 40);
    }, 1000);
  });
}

// Helper: create the score content inside the container
export function buildScoreContent(container, overlay, won, onReturn) {
  const title = document.createElement('div');
  title.style.cssText = `font-size:32px;font-weight:bold;margin-bottom:12px;color:${won ? '#44cc44' : '#ff3333'};`;
  title.textContent = won ? 'TRAIN STOPPED' : 'MISSION FAILED';
  container.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.style.cssText = 'font-size:14px;color:#888;margin-bottom:28px;';
  subtitle.textContent = won
    ? 'You stopped the train in time.'
    : 'The train reached its destination.';
  container.appendChild(subtitle);

  const returnBtn = document.createElement('button');
  returnBtn.textContent = 'RETURN TO MENU';
  returnBtn.style.cssText =
    'padding:12px 24px;background:#2a4a6a;border:none;color:white;' +
    'border-radius:6px;font-family:monospace;cursor:pointer;font-size:14px;' +
    'margin-top:20px;transition:background 0.2s;';
  returnBtn.addEventListener('mouseenter', () => { returnBtn.style.background = '#3a6a9a'; });
  returnBtn.addEventListener('mouseleave', () => { returnBtn.style.background = '#2a4a6a'; });
  returnBtn.addEventListener('click', () => {
    overlay.remove();
    if (onReturn) onReturn();
  });
  container.appendChild(returnBtn);
}
