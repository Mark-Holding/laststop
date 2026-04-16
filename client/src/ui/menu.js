import { startMenuBackground, stopMenuBackground } from './menuBackground.js';

export function createMenu({ onCreateRoom, onJoinRoom, onStartGame }) {
  let currentPlayers = [];
  let currentHostId = null;
  let mySocketId = null;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes menuPulse{0%,100%{opacity:1}50%{opacity:0.4}}
    #menu-overlay{
      position:fixed;inset:0;z-index:1000;
      display:flex;align-items:center;justify-content:center;
      background:transparent;
      font-family:'Courier New',Courier,monospace;
    }
    .menu-box{
      width:100%;max-width:420px;padding:40px 32px;text-align:center;
      background:rgba(5,5,5,0.85);border-radius:4px;
      border:1px solid rgba(255,255,255,0.04)
    }
    .menu-title{
      font-size:2.5rem;color:#e8dcc8;letter-spacing:0.3em;
      text-transform:uppercase;margin-bottom:4px;font-weight:normal
    }
    .menu-subtitle{font-size:0.85rem;color:#555;margin-bottom:20px}
    .menu-premise{
      font-size:0.8rem;color:#666;line-height:1.7;
      margin-bottom:32px;padding:0 8px;text-align:center
    }
    .menu-premise strong{color:#cc8833}
    .menu-input{
      width:100%;padding:12px 16px;margin-bottom:16px;
      background:#141414;border:1px solid #333;border-radius:3px;
      color:#ccc;font-family:inherit;font-size:1rem;
      outline:none;transition:border-color 0.2s
    }
    .menu-input:focus{border-color:#666}
    .menu-input::placeholder{color:#444}
    .menu-input.code-input{
      text-align:center;letter-spacing:0.5em;text-transform:uppercase;
      font-size:1.3rem;max-width:200px;margin:0 auto 16px;display:block
    }
    .menu-btn-row{display:flex;gap:12px;margin-bottom:20px}
    .menu-btn{
      flex:1;padding:12px 16px;
      background:transparent;border:1px solid #444;border-radius:3px;
      color:#aaa;font-family:inherit;font-size:0.85rem;
      letter-spacing:0.15em;text-transform:uppercase;cursor:pointer;
      transition:all 0.2s
    }
    .menu-btn:hover{border-color:#888;color:#ddd;background:rgba(255,255,255,0.03)}
    .menu-btn:disabled{opacity:0.3;cursor:default}
    .menu-btn.primary{border-color:#ffaa22;color:#ffaa22}
    .menu-btn.primary:hover{background:rgba(255,170,34,0.08)}
    .menu-btn.primary:disabled{opacity:0.3;background:transparent}
    .menu-error{color:#ff4444;font-size:0.8rem;margin-top:12px;min-height:1.2em}
    .menu-screen{display:none}
    .menu-screen.active{display:block}
    .lobby-code{
      font-size:2.8rem;color:#ffaa22;letter-spacing:0.6em;
      margin:16px 0 4px;font-weight:bold
    }
    .lobby-hint{font-size:0.75rem;color:#444;margin-bottom:32px}
    .player-list{text-align:left;margin:0 auto 24px;max-width:280px}
    .player-slot{
      display:flex;align-items:center;gap:10px;
      padding:8px 12px;margin-bottom:6px;
      background:rgba(255,255,255,0.02);border-radius:3px;
      border:1px solid rgba(255,255,255,0.05)
    }
    .player-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .player-name{color:#ccc;font-size:0.9rem}
    .player-host-badge{font-size:0.7rem;color:#ffaa22;margin-left:auto}
    .player-slot.empty{border-style:dashed;border-color:rgba(255,255,255,0.08)}
    .player-slot.empty .player-dot{background:#222}
    .player-slot.empty .player-name{color:#333}
    .lobby-status{font-size:0.8rem;color:#444;margin-top:12px}
    .controls-hint{margin-top:32px;font-size:0.7rem;color:#333;line-height:1.8}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'menu-overlay';
  overlay.innerHTML = `
    <div class="menu-box">
      <div id="screen-menu" class="menu-screen active">
        <h1 class="menu-title">Last Stop</h1>
        <p class="menu-subtitle">A multiplayer co-op escape room</p>
        <p class="menu-premise">
          A bomber has hijacked a subway train headed for a rigged station.<br>
          Work together to solve puzzles car by car and <strong>reach the driver's cabin before time runs out</strong>.
        </p>
        <input class="menu-input" id="username-input" type="text"
               placeholder="Enter your name" maxlength="16"
               autocomplete="off" spellcheck="false">
        <div class="menu-btn-row">
          <button class="menu-btn" id="create-btn">Create Room</button>
          <button class="menu-btn" id="join-toggle-btn">Join Room</button>
        </div>
        <div id="join-panel" style="display:none">
          <input class="menu-input code-input" id="code-input" type="text"
                 placeholder="CODE" maxlength="4"
                 autocomplete="off" spellcheck="false">
          <button class="menu-btn primary" id="join-btn"
                  style="max-width:200px;margin:0 auto;display:block">Join</button>
        </div>
        <div class="menu-error" id="menu-error"></div>
        <div class="controls-hint">
          WASD — Move &nbsp;&nbsp; Mouse — Look &nbsp;&nbsp; E — Interact
        </div>
      </div>
      <div id="screen-lobby" class="menu-screen">
        <h1 class="menu-title" style="font-size:1.5rem;margin-bottom:16px">Lobby</h1>
        <div class="lobby-code" id="lobby-code">----</div>
        <p class="lobby-hint">Share this code with your team</p>
        <div class="player-list" id="player-list"></div>
        <button class="menu-btn primary" id="start-btn"
                style="display:none;max-width:280px;margin:0 auto">Start Game</button>
        <div class="lobby-status" id="lobby-status">Waiting for players...</div>
        <div class="menu-error" id="lobby-error"></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  startMenuBackground();

  const screenMenu = overlay.querySelector('#screen-menu');
  const screenLobby = overlay.querySelector('#screen-lobby');
  const usernameInput = overlay.querySelector('#username-input');
  const createBtn = overlay.querySelector('#create-btn');
  const joinToggleBtn = overlay.querySelector('#join-toggle-btn');
  const joinPanel = overlay.querySelector('#join-panel');
  const codeInput = overlay.querySelector('#code-input');
  const joinBtn = overlay.querySelector('#join-btn');
  const menuError = overlay.querySelector('#menu-error');
  const lobbyCode = overlay.querySelector('#lobby-code');
  const playerListEl = overlay.querySelector('#player-list');
  const startBtn = overlay.querySelector('#start-btn');
  const lobbyStatus = overlay.querySelector('#lobby-status');
  const lobbyError = overlay.querySelector('#lobby-error');

  let joinPanelOpen = false;

  joinToggleBtn.addEventListener('click', () => {
    joinPanelOpen = !joinPanelOpen;
    joinPanel.style.display = joinPanelOpen ? 'block' : 'none';
    if (joinPanelOpen) codeInput.focus();
  });

  createBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (!username) { menuError.textContent = 'Enter your name first'; return; }
    menuError.textContent = '';
    onCreateRoom(username);
  });

  joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const code = codeInput.value.trim().toUpperCase();
    if (!username) { menuError.textContent = 'Enter your name first'; return; }
    if (code.length !== 4) { menuError.textContent = 'Enter a 4-character room code'; return; }
    menuError.textContent = '';
    onJoinRoom(username, code);
  });

  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinBtn.click();
  });

  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (joinPanelOpen) joinBtn.click();
      else createBtn.click();
    }
  });

  startBtn.addEventListener('click', () => {
    onStartGame();
  });

  function showScreen(which) {
    screenMenu.classList.toggle('active', which === 'menu');
    screenLobby.classList.toggle('active', which === 'lobby');
  }

  function renderPlayerList() {
    playerListEl.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const p = currentPlayers[i];
      const slot = document.createElement('div');
      slot.className = 'player-slot' + (p ? '' : ' empty');

      const dot = document.createElement('div');
      dot.className = 'player-dot';
      dot.style.background = p ? p.color : '#222';
      slot.appendChild(dot);

      const name = document.createElement('span');
      name.className = 'player-name';
      name.textContent = p ? p.username : 'Waiting...';
      slot.appendChild(name);

      if (p && p.socketId === currentHostId) {
        const badge = document.createElement('span');
        badge.className = 'player-host-badge';
        badge.textContent = 'HOST';
        slot.appendChild(badge);
      }

      playerListEl.appendChild(slot);
    }

    const isHost = mySocketId === currentHostId;
    startBtn.style.display = isHost ? 'block' : 'none';

    const count = currentPlayers.length;
    if (isHost) {
      startBtn.disabled = count < 1;
      startBtn.textContent = count === 1 ? 'Start Solo' : 'Start Game';
      lobbyStatus.textContent = count === 1
        ? 'Solo run — co-op puzzles will adapt'
        : '';
    } else {
      startBtn.textContent = 'Start Game';
      lobbyStatus.textContent = 'Waiting for host to start...';
    }
  }

  return {
    setSocketId(id) { mySocketId = id; },

    showLobby(code, players, hostId) {
      currentPlayers = [...players];
      currentHostId = hostId;
      lobbyCode.textContent = code;
      lobbyError.textContent = '';
      showScreen('lobby');
      renderPlayerList();
    },

    addPlayer(player) {
      if (!currentPlayers.some(p => p.socketId === player.socketId)) {
        currentPlayers.push(player);
      }
      renderPlayerList();
    },

    removePlayer(socketId) {
      currentPlayers = currentPlayers.filter(p => p.socketId !== socketId);
      renderPlayerList();
    },

    updateHost(hostId) {
      currentHostId = hostId;
      renderPlayerList();
    },

    showError(msg) {
      if (screenLobby.classList.contains('active')) {
        lobbyError.textContent = msg;
      } else {
        menuError.textContent = msg;
      }
    },

    hideAll() {
      overlay.style.display = 'none';
      stopMenuBackground();
    },

    showMain() {
      overlay.style.display = 'flex';
      showScreen('menu');
      menuError.textContent = '';
      usernameInput.value = '';
      joinPanelOpen = false;
      joinPanel.style.display = 'none';
      startMenuBackground();
    },
  };
}
