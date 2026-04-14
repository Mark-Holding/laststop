import { playStationDing, playStaticBurst } from '../audio/soundManager.js';

export function createHUD() {
  const style = document.createElement('style');
  style.textContent = `
    #hud{
      position:fixed;top:0;left:0;right:0;
      z-index:500;pointer-events:none;display:none;
      font-family:'Courier New',Courier,monospace
    }
    #progress-container{
      margin:12px 24px;padding:10px 20px;
      background:rgba(0,0,0,0.75);
      border-bottom:1px solid rgba(255,255,255,0.08);
      border-radius:0 0 4px 4px;
      display:flex;align-items:center;gap:16px
    }
    #station-track{
      flex:1;position:relative;height:44px
    }
    #station-line{
      position:absolute;top:13px;left:5%;right:5%;
      height:2px;background:rgba(255,255,255,0.15)
    }
    .station-dot{
      position:absolute;top:8px;
      width:10px;height:10px;border-radius:50%;
      border:2px solid rgba(255,255,255,0.3);
      background:transparent;transform:translateX(-50%);
      transition:all 0.5s
    }
    .station-dot.passed{background:#ccc;border-color:#ccc}
    .station-dot.current{background:#fff;border-color:#fff;box-shadow:0 0 6px rgba(255,255,255,0.4)}
    .station-dot.terminal{border-color:#ff3333}
    .station-dot.terminal.passed{background:#ff3333}
    .station-name{
      position:absolute;top:26px;
      font-size:8px;color:rgba(255,255,255,0.3);
      transform:translateX(-50%);white-space:nowrap
    }
    .station-name.active{color:#fff;font-size:9px;font-weight:bold}
    .station-name.terminal-label{color:#ff3333}
    #train-marker{
      position:absolute;top:1px;
      width:0;height:0;
      border-left:5px solid transparent;
      border-right:5px solid transparent;
      border-top:7px solid #ffaa22;
      transform:translateX(-50%);
      transition:left 1s linear;
      filter:drop-shadow(0 0 3px rgba(255,170,34,0.5))
    }
    #timer-display{
      font-size:20px;color:#ffaa22;font-weight:bold;
      min-width:65px;text-align:right;
      transition:color 0.5s
    }
    #hint-btn{
      position:fixed;bottom:24px;right:24px;z-index:500;
      width:48px;height:48px;border-radius:50%;
      background:rgba(40,40,40,0.85);border:2px solid #555;
      color:#aaa;font-family:monospace;font-size:11px;
      cursor:pointer;display:flex;align-items:center;justify-content:center;
      pointer-events:auto;transition:border-color 0.3s,color 0.3s
    }
    #hint-btn:hover{border-color:#ffaa22;color:#ffaa22}
    #hint-panel{
      position:fixed;bottom:80px;right:24px;z-index:500;
      width:260px;background:rgba(15,15,15,0.95);
      border:1px solid #444;border-radius:8px;
      padding:12px;font-family:monospace;
      display:none;pointer-events:auto
    }
    #hint-panel .hint-title{
      font-size:12px;color:#888;margin-bottom:8px;text-align:center
    }
    .hint-tier-btn{
      width:100%;padding:8px;margin-bottom:4px;
      background:#222;border:1px solid #444;border-radius:4px;
      color:#ccc;font-family:monospace;font-size:12px;
      cursor:pointer;text-align:left;transition:background 0.2s
    }
    .hint-tier-btn:hover:not(:disabled){background:#333}
    .hint-tier-btn:disabled{color:#555;cursor:default;border-color:#333}
    #hint-text{
      margin-top:8px;padding:8px;background:#1a1a1a;
      border-radius:4px;font-size:12px;color:#ffcc44;
      line-height:1.4;min-height:20px;display:none
    }
    #hint-penalty{
      text-align:center;font-size:11px;color:#ff4444;margin-top:4px;
      min-height:14px
    }
  `;
  document.head.appendChild(style);

  const hud = document.createElement('div');
  hud.id = 'hud';
  hud.innerHTML = `
    <div id="progress-container">
      <div id="station-track">
        <div id="station-line"></div>
        <div id="train-marker"></div>
      </div>
      <div id="timer-display">30:00</div>
    </div>
  `;
  document.body.appendChild(hud);

  const track = hud.querySelector('#station-track');
  const marker = hud.querySelector('#train-marker');
  const timerEl = hud.querySelector('#timer-display');
  let stationDots = [];
  let stationLabels = [];
  let builtStations = false;
  let storedTotalTime = 1800;
  let storedStations = null;
  let lastStationIndex = 0;

  function buildStations(stations) {
    if (builtStations) return;
    builtStations = true;

    stations.forEach((name, i) => {
      const pct = 5 + (i / (stations.length - 1)) * 90;

      const dot = document.createElement('div');
      dot.className = 'station-dot';
      if (i === stations.length - 1) dot.classList.add('terminal');
      dot.style.left = pct + '%';
      track.appendChild(dot);
      stationDots.push(dot);

      const label = document.createElement('div');
      label.className = 'station-name';
      if (i === stations.length - 1) label.classList.add('terminal-label');
      label.textContent = name;
      label.style.left = pct + '%';
      track.appendChild(label);
      stationLabels.push(label);
    });
  }

  function setTimerConfig(totalTime, stations) {
    storedTotalTime = totalTime;
    storedStations = stations;
    if (stations) buildStations(stations);
  }

  function update(elapsed, totalTime, stationIndex, stations) {
    // Accept totalTime/stations from initial call, fall back to stored values
    const tt = totalTime || storedTotalTime;
    const st = stations || storedStations;
    if (st && !builtStations) {
      buildStations(st);
    }

    // Play station ding when passing a new station
    if (stationIndex > lastStationIndex) {
      const totalStations = stationDots.length;
      const isLate = totalStations > 0 && stationIndex >= totalStations - 3;
      playStationDing(isLate);
      lastStationIndex = stationIndex;
    }

    stationDots.forEach((dot, i) => {
      dot.classList.toggle('passed', i <= stationIndex);
      dot.classList.toggle('current', i === stationIndex);
    });

    stationLabels.forEach((label, i) => {
      label.classList.toggle('active', i === stationIndex);
    });

    const progress = Math.min(elapsed / tt, 1);
    marker.style.left = (5 + progress * 90) + '%';

    const remaining = Math.max(0, tt - elapsed);
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);
    timerEl.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;

    if (remaining < 120) {
      timerEl.style.color = '#ff3333';
    } else if (remaining < 300) {
      timerEl.style.color = '#ff8833';
    } else {
      timerEl.style.color = '#ffaa22';
    }
  }

  // --- Hint System ---
  const hintBtn = document.createElement('div');
  hintBtn.id = 'hint-btn';
  hintBtn.textContent = 'HINT';
  hintBtn.title = 'Press H for hints';
  document.body.appendChild(hintBtn);

  const hintPanel = document.createElement('div');
  hintPanel.id = 'hint-panel';
  hintPanel.innerHTML = `
    <div class="hint-title">EMERGENCY INTERCOM</div>
    <button class="hint-tier-btn" data-tier="1">Tier 1 — Nudge (+30s penalty)</button>
    <button class="hint-tier-btn" data-tier="2">Tier 2 — Clue (+60s penalty)</button>
    <button class="hint-tier-btn" data-tier="3">Tier 3 — Answer (+120s penalty)</button>
    <div id="hint-text"></div>
    <div id="hint-penalty"></div>
  `;
  document.body.appendChild(hintPanel);

  const hintTextEl = hintPanel.querySelector('#hint-text');
  const hintPenaltyEl = hintPanel.querySelector('#hint-penalty');
  const tierBtns = hintPanel.querySelectorAll('.hint-tier-btn');
  let hintPanelOpen = false;
  let hintCallback = null;
  let usedTiers = 0;

  hintBtn.addEventListener('click', () => {
    hintPanelOpen = !hintPanelOpen;
    hintPanel.style.display = hintPanelOpen ? 'block' : 'none';
  });

  tierBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tier = Number(btn.dataset.tier);
      if (tier <= usedTiers) return;
      if (hintCallback) hintCallback(tier);
    });
  });

  function setHintCallback(cb) {
    hintCallback = cb;
  }

  function showHint(tier, text, penalty) {
    usedTiers = Math.max(usedTiers, tier);
    tierBtns.forEach((btn) => {
      if (Number(btn.dataset.tier) <= usedTiers) {
        btn.disabled = true;
      }
    });

    // Intercom crackle before hint text appears
    playStaticBurst(0.8);
    hintTextEl.style.display = 'block';
    hintTextEl.textContent = '...';
    setTimeout(() => {
      hintTextEl.textContent = text;
      hintPenaltyEl.textContent = `+${penalty}s added to score`;
    }, 800);
    setTimeout(() => { hintPenaltyEl.textContent = ''; }, 5000);
  }

  return {
    show() {
      hud.style.display = 'block';
      hintBtn.style.display = 'flex';
    },
    hide() {
      hud.style.display = 'none';
      hintBtn.style.display = 'none';
      hintPanel.style.display = 'none';
    },
    update,
    setTimerConfig,
    setHintCallback,
    showHint,
    toggleHintPanel() {
      hintPanelOpen = !hintPanelOpen;
      hintPanel.style.display = hintPanelOpen ? 'block' : 'none';
    },
  };
}
