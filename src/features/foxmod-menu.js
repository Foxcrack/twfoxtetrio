(function (root) {
  'use strict';

  const api = root.__TWFOX_TETRIO__;
  if (!api) {
    return;
  }

  const internals = root.__TWFOX_INTERNAL__ || {};
  const pentominoEngine = internals.pentominoEngine || null;
  const p2pRoom = internals.p2pRoom || null;
  const foxmodCanvas = internals.foxmodCanvas || null;

  const STYLE_ID = 'twfoxtetrio-foxmod-style';
  const MENU_BTN_ID = 'twfoxtetrio-home-foxmod';
  const OVERLAY_ID = 'twfoxtetrio-foxmod-overlay';
  const PANEL_ID = 'twfoxtetrio-foxmod-panel';
  const REPO_URL = 'https://github.com/Foxcrack/twfoxtetrio';

  const FOX_ICON_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19 12" shape-rendering="crispEdges" aria-hidden="true">',
    '<rect x="1" y="2" width="4" height="2" fill="#ffb87a"/>',
    '<rect x="1" y="4" width="2" height="7" fill="#ff7d2e"/>',
    '<rect x="3" y="6" width="2" height="2" fill="#ff7d2e"/>',
    '<rect x="2" y="7" width="1" height="4" fill="#bd4711"/>',
    '<rect x="4" y="3" width="1" height="1" fill="#bd4711"/>',
    '<rect x="4" y="7" width="1" height="1" fill="#bd4711"/>',
    '<rect x="7" y="1" width="1" height="1" fill="#ffd4a8"/>',
    '<rect x="11" y="1" width="1" height="1" fill="#ffd4a8"/>',
    '<rect x="7" y="2" width="5" height="2" fill="#ffb87a"/>',
    '<rect x="7" y="4" width="2" height="5" fill="#ff7d2e"/>',
    '<rect x="10" y="4" width="2" height="5" fill="#ff7d2e"/>',
    '<rect x="7" y="9" width="5" height="2" fill="#d95618"/>',
    '<rect x="8" y="4" width="1" height="5" fill="#bd4711"/>',
    '<rect x="11" y="4" width="1" height="7" fill="#bd4711"/>',
    '<rect x="13" y="2" width="2" height="3" fill="#ffb87a"/>',
    '<rect x="16" y="2" width="2" height="3" fill="#ffb87a"/>',
    '<rect x="14" y="5" width="3" height="3" fill="#ff7d2e"/>',
    '<rect x="13" y="8" width="2" height="3" fill="#d95618"/>',
    '<rect x="16" y="8" width="2" height="3" fill="#d95618"/>',
    '<rect x="14" y="7" width="3" height="1" fill="#bd4711"/>',
    '<rect x="17" y="8" width="1" height="3" fill="#bd4711"/>',
    '</svg>'
  ].join('');

  const HUB_SECTIONS = [
    {
      view: 'practice',
      cardId: 'twfoxtetrio-card-practice',
      tag: 'P5',
      title: 'PRACTICA',
      subtitle: 'solo pentominoes (12 pieces), 40 lines, blitz & chaos mix',
      bg: '#1c3a29',
      top: '#2d7a4f',
      left: '#215437',
      bottom: '#0b1710',
      titleColor: '#98ffbf',
      descColor: '#61c889'
    },
    {
      view: 'multi',
      cardId: 'twfoxtetrio-card-multi',
      tag: 'P2P',
      title: 'MULTIJUGADOR',
      subtitle: 'host custom rooms (your PC is the server) or join a friend',
      bg: '#34222d',
      top: '#7a355d',
      left: '#532741',
      bottom: '#1c1218',
      titleColor: '#f5bce0',
      descColor: '#cf8fb6'
    },
    {
      view: 'config',
      cardId: 'twfoxtetrio-card-config',
      tag: 'CFG',
      title: 'CONFIG',
      subtitle: 'configure Blitz, 40 Lines & Multiplayer VS HUD trackers',
      bg: '#1c263e',
      top: '#2b4a91',
      left: '#223561',
      bottom: '#0c101a',
      titleColor: '#8cb3ff',
      descColor: '#6283cc'
    },
    {
      view: 'credits',
      cardId: 'twfoxtetrio-card-credits',
      tag: 'CRD',
      title: 'CREDITS',
      subtitle: 'Modded By TWFoxcrack, features & GitHub repository',
      bg: '#2a211b',
      top: '#8c4b22',
      left: '#5e351c',
      bottom: '#120d0a',
      titleColor: '#ffbe8e',
      descColor: '#d98c5b'
    }
  ];

  const CONFIG_SECTIONS = [
    {
      key: 'blitzTracker',
      title: 'BLITZ PB TRACKER',
      accent: '#ff7b4a',
      toggles: [
        {
          field: 'enabled',
          label: 'Enable Blitz PB HUD',
          description: 'Show points remaining to surpass your personal best (and surplus in green).'
        },
        {
          field: 'showSubtitle',
          label: 'Show Best Score Subtitle',
          description: 'Display your current Blitz personal best beneath the counter.'
        },
        {
          field: 'signedBehind',
          label: 'Show Minus Sign While Behind PB',
          description: 'Prefix a "-" sign before the deficit while below your best score.'
        }
      ]
    },
    {
      key: 'fortyLinesTracker',
      title: '40 LINES PB PACE TRACKER',
      accent: '#42e88a',
      toggles: [
        {
          field: 'enabled',
          label: 'Enable 40 Lines PB Pace HUD',
          description: 'Start at your PB in green counting down to 0:00, then overtime in red.'
        },
        {
          field: 'showSubtitle',
          label: 'Show Best Time Subtitle',
          description: 'Display your current 40 Lines personal best beneath the pace timer.'
        }
      ]
    },
    {
      key: 'multiplayerLeaderboard',
      title: 'MULTIPLAYER LIVE VS LEADERBOARD',
      accent: '#8daeff',
      toggles: [
        {
          field: 'enabled',
          label: 'Enable Live VS Leaderboard',
          description: 'Show the real-time VS ranking panel on the right in multiplayer matches.'
        },
        {
          field: 'includeQuickPlay',
          label: 'Show in Quick Play (Zenith Tower)',
          description: 'Also display the live VS leaderboard while climbing in Quick Play.'
        }
      ],
      range: {
        field: 'maxRows',
        label: 'Max Players Displayed',
        description: 'Limit how many player rows appear at once in the VS leaderboard.',
        min: 2,
        max: 30,
        step: 1
      }
    }
  ];

  const CREDIT_ITEMS = [
    {
      name: 'Pentominoes Solo Practice & Custom Rooms (P2P Host)',
      detail: '12-pentomino stacker engine + WebRTC host-as-server custom multiplayer rooms.'
    },
    {
      name: 'Blitz PB Delta HUD',
      detail: 'Real-time points needed to beat your Blitz PB, switching green at overtake.'
    },
    {
      name: '40 Lines PB Pace Timer',
      detail: 'Green countdown from your 40L PB time to zero, switching red into overtime.'
    },
    {
      name: 'Multiplayer Live VS Leaderboard',
      detail: 'Sorted real-time VS ranking with [KO] badges and automatic #killfeed offset.'
    },
    {
      name: 'Loading Screen Attribution',
      detail: 'Displays "Modded By: TWFoxcrack" beneath the desktop loader.'
    }
  ];

  const FOXMOD_CSS = `
#${MENU_BTN_ID} {
  background-color: #382015;
  border-top: 3px solid #cf6427;
  border-left: 3px solid #914318;
  border-bottom: 3px solid #160c07;
}
#${MENU_BTN_ID} > h1 { color: #ffbe8e; }
#${MENU_BTN_ID} > p { color: #e08d58; }
#home_menu.play-entry-anim #${MENU_BTN_ID} {
  animation: .5s .75s HomeMenuEntryAnimSlider backwards cubic-bezier(.17,.38,.3,1);
}
#${MENU_BTN_ID} .twfox-home-icon {
  position: absolute;
  left: 1em;
  top: 0.5em;
  height: 6em;
  width: 10.5em;
  display: flex;
  align-items: center;
  pointer-events: none;
}
#${MENU_BTN_ID} .twfox-home-icon > svg { height: 100%; width: auto; display: block; }
#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  z-index: 9999998;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  background: rgba(8, 10, 16, 0.88);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  font-family: 'HUN', 'C', 'Segoe UI', sans-serif;
  color: #eef2ff;
}
#${OVERLAY_ID}.is-open { display: flex; }
#${PANEL_ID} {
  width: min(920px, 95vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: #141824;
  border-top: 3px solid #cf6427;
  border-left: 3px solid #2b344d;
  border-right: 3px solid #20273b;
  border-bottom: 3px solid #090b10;
  border-radius: 4px;
  box-shadow: 0 22px 64px rgba(0, 0, 0, 0.82);
  overflow: hidden;
  user-select: none;
}
.twfox-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(90deg, #2d1b13 0%, #1b2030 65%);
  border-bottom: 2px solid #273047;
}
.twfox-modal-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.twfox-modal-logo { width: 42px; height: 26px; display: flex; align-items: center; flex: 0 0 auto; }
.twfox-modal-logo > svg { width: 100%; height: 100%; display: block; }
.twfox-modal-title-wrap { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.twfox-modal-title { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.08em; color: #ffbe8e; }
.twfox-modal-badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 2px 7px;
  border-radius: 3px;
  background: rgba(255, 140, 66, 0.16);
  border: 1px solid rgba(255, 140, 66, 0.36);
  color: #ffb87a;
}
.twfox-header-actions { display: flex; align-items: center; gap: 8px; }
.twfox-modal-btn {
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 7px 12px;
  border-radius: 3px;
  cursor: pointer;
  color: #dbe3ff;
  background: #20273b;
  border-top: 2px solid #35405f;
  border-left: 2px solid #2b3550;
  border-right: 2px solid #161b29;
  border-bottom: 2px solid #0e111b;
  transition: filter 120ms ease, transform 80ms ease;
}
.twfox-modal-btn:hover { filter: brightness(1.18); }
.twfox-modal-btn:active { transform: translateY(1px); }
.twfox-modal-btn.is-primary {
  background: #3a2115;
  border-top-color: #cf6427;
  border-left-color: #914318;
  border-right-color: #59290d;
  border-bottom-color: #160c07;
  color: #ffbe8e;
}
.twfox-modal-btn.hidden { display: none; }
.twfox-modal-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 16px 0;
  background: #111520;
  border-bottom: 2px solid #242b40;
}
.twfox-tab-btn {
  font-family: inherit;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.09em;
  padding: 8px 14px;
  border: 0;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: #8290b8;
  cursor: pointer;
  transition: color 140ms ease, background 140ms ease, border-color 140ms ease;
}
.twfox-tab-btn:hover { color: #e4ebff; background: rgba(255, 255, 255, 0.04); }
.twfox-tab-btn.is-active {
  color: #ffbe8e;
  background: rgba(255, 138, 66, 0.1);
  border-bottom-color: #ff8c42;
}
.twfox-modal-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.twfox-pane.hidden { display: none; }
.twfox-hub-list { display: flex; flex-direction: column; gap: 10px; }
.twfox-hub-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,0.45);
  transition: transform 160ms ease, filter 160ms ease;
}
.twfox-hub-card:hover { transform: translateX(-6px); filter: brightness(1.18); }
.twfox-hub-tag {
  width: 68px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 0.06em;
  background: rgba(0, 0, 0, 0.28);
  border-radius: 3px;
  flex: 0 0 auto;
}
.twfox-hub-text h2 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.06em; }
.twfox-hub-text p { margin: 3px 0 0; font-size: 13px; }
.twfox-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  background: #181d2b;
  border: 1px solid rgba(130, 155, 225, 0.22);
  border-radius: 4px;
}
.twfox-toolbar-group { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.twfox-select, .twfox-input {
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 9px;
  border-radius: 3px;
  color: #eef2ff;
  background: #0d1018;
  border: 1px solid #35405f;
  user-select: text;
}
.twfox-canvas-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.twfox-game-canvas {
  background: #0a0d14;
  border: 1px solid rgba(130, 155, 225, 0.25);
  border-radius: 4px;
  max-width: 100%;
}
.twfox-key-hint { font-size: 11px; color: #8c9bc4; text-align: center; }
.twfox-multi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}
.twfox-card-box {
  background: #181d2b;
  border: 1px solid rgba(130, 155, 225, 0.22);
  border-radius: 4px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.twfox-card-box h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #ffbe8e;
}
.twfox-card-box p { margin: 0; font-size: 12px; color: #9aa8cf; line-height: 1.4; }
.twfox-textarea {
  width: 100%;
  min-height: 58px;
  box-sizing: border-box;
  font-family: monospace;
  font-size: 11px;
  padding: 7px;
  border-radius: 3px;
  color: #dbe3ff;
  background: #0b0e15;
  border: 1px solid #35405f;
  resize: vertical;
  user-select: text;
}
.twfox-player-list, .twfox-chat-log {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 140px;
  overflow-y: auto;
  font-size: 12px;
}
.twfox-player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 8px;
  background: #111520;
  border-radius: 3px;
}
.twfox-multi-arena {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: center;
  gap: 14px;
}
.twfox-opponents-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  flex: 1 1 260px;
}
.twfox-opp-card {
  background: #181d2b;
  border: 1px solid rgba(130, 155, 225, 0.25);
  border-radius: 4px;
  padding: 7px;
  text-align: center;
  font-size: 11px;
}
.twfox-section {
  background: #181d2b;
  border: 1px solid rgba(130, 155, 225, 0.2);
  border-left: 4px solid var(--twfox-accent, #ff8c42);
  border-radius: 4px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.twfox-section:last-child { margin-bottom: 0; }
.twfox-section-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--twfox-accent, #ffbe8e);
}
.twfox-control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.twfox-control-row:first-of-type { border-top: 0; padding-top: 2px; }
.twfox-control-row:last-of-type { padding-bottom: 2px; }
.twfox-control-text { min-width: 0; flex: 1 1 auto; }
.twfox-control-label { display: block; font-size: 13px; font-weight: 700; color: #edf1ff; }
.twfox-control-desc { display: block; margin-top: 2px; font-size: 11px; color: #93a1c8; line-height: 1.35; }
.twfox-toggle { position: relative; display: inline-flex; align-items: center; cursor: pointer; flex: 0 0 auto; }
.twfox-toggle-input { position: absolute; opacity: 0; width: 0; height: 0; }
.twfox-toggle-track {
  width: 44px; height: 24px; border-radius: 3px;
  background: #0d1018; border: 2px solid #2b334b; position: relative;
  transition: background 140ms ease, border-color 140ms ease;
}
.twfox-toggle-track::after {
  content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
  border-radius: 2px; background: #67769e; transition: transform 140ms ease, background 140ms ease;
}
.twfox-toggle-input:checked + .twfox-toggle-track { background: #3a2115; border-color: #cf6427; }
.twfox-toggle-input:checked + .twfox-toggle-track::after { transform: translateX(20px); background: #ff9c54; }
.twfox-range-wrap { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.twfox-step-btn { width: 26px; height: 26px; padding: 0; font-size: 14px; line-height: 1; }
.twfox-range-input { width: 112px; accent-color: #ff8c42; cursor: pointer; }
.twfox-range-val {
  min-width: 26px; text-align: right; font-size: 13px; font-weight: 800;
  color: #ffbe8e; font-variant-numeric: tabular-nums;
}
.twfox-credits-hero {
  background: linear-gradient(135deg, #2d1b13 0%, #1a2133 100%);
  border: 1px solid rgba(255, 140, 66, 0.35);
  border-radius: 4px; padding: 14px; margin-bottom: 10px;
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;
}
.twfox-credits-author { margin: 4px 0 0; font-size: 15px; font-weight: 700; color: #ffb87a; }
.twfox-credits-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.twfox-credits-item {
  background: #181d2b; border: 1px solid rgba(130, 155, 225, 0.16);
  border-radius: 4px; padding: 9px 12px;
}
.twfox-credits-item strong { display: block; font-size: 13px; color: #eef2ff; }
.twfox-credits-item span { display: block; margin-top: 2px; font-size: 11px; color: #93a1c8; }
.twfox-credits-note { margin: 10px 0 0; font-size: 11px; color: #8290b8; line-height: 1.45; }
.twfox-github-btn { display: inline-block; text-decoration: none; }
.twfox-modal-footer {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 16px; background: #10131e; border-top: 2px solid #242b40;
}
.twfox-modal-footer.hidden { display: none; }
.twfox-modal-status { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #8496c4; }
.hidden { display: none; }
`;

  function setClass(el, className, active) {
    if (!el || !el.classList) return;
    if (active) el.classList.add(className);
    else el.classList.remove(className);
  }

  function createEl(tag, options, children) {
    const node = document.createElement(tag);
    if (options) {
      if (options.id) node.id = options.id;
      if (options.className) node.className = options.className;
      if (options.text !== undefined) node.textContent = options.text;
      if (options.html !== undefined) node.innerHTML = options.html;
      if (options.style) node.setAttribute('style', options.style);
      if (options.type && (tag === 'input' || tag === 'button')) node.type = options.type;
      if (options.attrs) {
        for (const [k, v] of Object.entries(options.attrs)) {
          node.setAttribute(k, v);
        }
      }
    }
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child) node.appendChild(child);
      }
    }
    return node;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const head = document.head || document.documentElement;
    if (!head) return;
    head.appendChild(createEl('style', { id: STYLE_ID, text: FOXMOD_CSS }));
  }

  function clampNumber(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.min(max, Math.max(min, Math.round(parsed)));
  }

  function openExternalUrl(url) {
    if (typeof root.OPEN_EXTERNAL === 'function') {
      root.OPEN_EXTERNAL(url);
      return true;
    }
    return false;
  }

  function copyToClipboard(text) {
    try {
      if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === 'function') {
        root.navigator.clipboard.writeText(String(text || ''));
        return true;
      }
    } catch (_) {}
    return false;
  }

  function isTextInputTarget(target) {
    if (!target || !target.tagName) return false;
    const tag = target.tagName.toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function initFoxmodMenu(runtimeApi) {
    ensureStyle();

    let isOpen = false;
    let activeView = 'hub';
    let overlayEl = null;
    let footerEl = null;
    let backHubBtn = null;
    let statusEl = null;
    const viewPanes = new Map();
    const tabButtons = new Map();
    const toggleControls = [];
    const rangeControls = [];

    // Practice state
    let practiceGame = null;
    let practiceController = null;
    let practiceCanvas = null;

    // Multiplayer P2P state
    let peerSession = null;
    let peerUnsub = null;
    let multiGame = null;
    let multiController = null;
    let multiCanvas = null;
    let multiSubMode = 'entry'; // entry | join | lobby | playing
    let multiDom = null;
    let lastSelfAttackCount = 0;

    function setStatus(message) {
      if (statusEl) statusEl.textContent = message;
    }

    function syncConfigControls(cfg) {
      if (!cfg) return;
      for (const item of toggleControls) {
        const sectionCfg = cfg[item.section];
        item.input.checked = Boolean(sectionCfg && sectionCfg[item.field]);
      }
      for (const item of rangeControls) {
        const sectionCfg = cfg[item.section];
        const raw = sectionCfg ? sectionCfg[item.field] : item.min;
        const clamped = clampNumber(raw, item.min, item.max);
        item.input.value = String(clamped);
        item.valueEl.textContent = String(clamped);
      }
    }

    function stopPlayControllers() {
      if (practiceController) practiceController.stop();
      if (multiController) multiController.stop();
    }

    function setActiveView(view) {
      const validViews = ['hub', 'practice', 'multi', 'config', 'credits'];
      activeView = validViews.includes(view) ? view : 'hub';

      for (const [k, pane] of viewPanes.entries()) {
        setClass(pane, 'hidden', k !== activeView);
      }
      for (const [k, btn] of tabButtons.entries()) {
        setClass(btn, 'is-active', k === activeView);
      }

      setClass(backHubBtn, 'hidden', activeView === 'hub');
      setClass(footerEl, 'hidden', activeView !== 'config');

      stopPlayControllers();
      if (isOpen && activeView === 'practice' && practiceController) {
        practiceController.start();
      } else if (isOpen && activeView === 'multi' && multiSubMode === 'playing' && multiController) {
        multiController.start();
      }
    }

    function openPanel() {
      ensureOverlay();
      if (!overlayEl) return;
      syncConfigControls(runtimeApi.getConfig());
      setActiveView('hub');
      setStatus('CHANGES SAVED AUTOMATICALLY');
      isOpen = true;
      overlayEl.classList.add('is-open');
    }

    function closePanel() {
      if (!overlayEl || !isOpen) return;
      isOpen = false;
      stopPlayControllers();
      overlayEl.classList.remove('is-open');
    }

    function buildHubPane() {
      const cards = HUB_SECTIONS.map((sec) => {
        const card = createEl(
          'div',
          {
            id: sec.cardId,
            className: 'twfox-hub-card',
            style: `background-color:${sec.bg};border-top:3px solid ${sec.top};border-left:3px solid ${sec.left};border-bottom:3px solid ${sec.bottom};`,
            attrs: { 'data-hover': 'hover', 'data-hit': 'hit1' }
          },
          [
            createEl('div', {
              className: 'twfox-hub-tag',
              style: `color:${sec.titleColor}`,
              text: sec.tag
            }),
            createEl('div', { className: 'twfox-hub-text' }, [
              createEl('h2', { style: `color:${sec.titleColor}`, text: sec.title }),
              createEl('p', { style: `color:${sec.descColor}`, text: sec.subtitle })
            ])
          ]
        );
        card.addEventListener('click', function () {
          setActiveView(sec.view);
        });
        return card;
      });

      return createEl('div', { id: 'twfoxtetrio-pane-hub', className: 'twfox-pane' }, [
        createEl('div', { className: 'twfox-hub-list' }, cards)
      ]);
    }

    function buildPracticePane() {
      const pieceSelect = createEl('select', { id: 'twfoxtetrio-practice-pieces', className: 'twfox-select' }, [
        createEl('option', { text: 'PENTOMINOS (12)', attrs: { value: 'pentomino' } }),
        createEl('option', { text: 'TETROMINOS (7)', attrs: { value: 'tetromino' } }),
        createEl('option', { text: 'CAOS MIX (19)', attrs: { value: 'chaos' } })
      ]);
      pieceSelect.value = 'pentomino';

      const modeSelect = createEl('select', { id: 'twfoxtetrio-practice-mode', className: 'twfox-select' }, [
        createEl('option', { text: 'ZEN / PRACTICA', attrs: { value: 'zen' } }),
        createEl('option', { text: '40 LINES', attrs: { value: '40l' } }),
        createEl('option', { text: 'BLITZ 2:00', attrs: { value: 'blitz' } })
      ]);
      modeSelect.value = 'zen';

      const restartBtn = createEl('button', {
        id: 'twfoxtetrio-practice-restart',
        className: 'twfox-modal-btn is-primary',
        text: 'REINICIAR [R]',
        type: 'button',
        attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
      });

      practiceCanvas = createEl('canvas', {
        id: 'twfoxtetrio-practice-canvas',
        className: 'twfox-game-canvas',
        attrs: { width: '430', height: '420' }
      });

      if (pentominoEngine && foxmodCanvas) {
        practiceGame = pentominoEngine.createGame({
          pieceSet: 'pentomino',
          mode: 'zen'
        });
        practiceController = foxmodCanvas.createPlayfieldController({
          canvas: practiceCanvas,
          game: practiceGame,
          allowRestart: true
        });
      }

      function applyPracticeSettings() {
        if (!practiceGame) return;
        practiceGame.reset({
          pieceSet: pieceSelect.value || 'pentomino',
          mode: modeSelect.value || 'zen',
          seed: Date.now() >>> 0
        });
        if (foxmodCanvas) {
          foxmodCanvas.renderPlayfield(practiceCanvas, practiceGame.getSnapshot());
        }
      }

      pieceSelect.addEventListener('change', applyPracticeSettings);
      modeSelect.addEventListener('change', applyPracticeSettings);
      restartBtn.addEventListener('click', applyPracticeSettings);

      return createEl('div', { id: 'twfoxtetrio-pane-practice', className: 'twfox-pane hidden' }, [
        createEl('div', { className: 'twfox-toolbar' }, [
          createEl('div', { className: 'twfox-toolbar-group' }, [
            createEl('span', { className: 'twfox-modal-badge', text: 'PIEZAS' }),
            pieceSelect,
            createEl('span', { className: 'twfox-modal-badge', text: 'MODO' }),
            modeSelect
          ]),
          restartBtn
        ]),
        createEl('div', { className: 'twfox-canvas-wrap' }, [
          practiceCanvas,
          createEl('div', {
            className: 'twfox-key-hint',
            text: 'ARROWS: Mover · UP/X: Rotar · Z: Anti · A: 180° · SPACE: Drop · C/SHIFT: Hold · R: Reiniciar'
          })
        ])
      ]);
    }

    function teardownPeerSession() {
      if (multiController) multiController.stop();
      if (peerUnsub) {
        peerUnsub();
        peerUnsub = null;
      }
      if (peerSession) {
        peerSession.close();
        peerSession = null;
      }
      multiGame = null;
      multiSubMode = 'entry';
    }

    function showMultiSubMode(nextSub) {
      multiSubMode = nextSub;
      if (!multiDom) return;
      setClass(multiDom.entryView, 'hidden', nextSub !== 'entry');
      setClass(multiDom.joinView, 'hidden', nextSub !== 'join');
      setClass(multiDom.lobbyView, 'hidden', nextSub !== 'lobby');
      setClass(multiDom.gameView, 'hidden', nextSub !== 'playing');
      if (multiController) {
        if (nextSub === 'playing' && isOpen && activeView === 'multi') {
          multiController.start();
        } else {
          multiController.stop();
        }
      }
    }

    function renderMultiSnapshot(snap, evType, detail) {
      if (!multiDom || !snap) return;

      if (evType === 'match_start' && detail && pentominoEngine && foxmodCanvas) {
        lastSelfAttackCount = 0;
        multiGame = pentominoEngine.createGame({
          pieceSet: (detail.config && detail.config.pieceSet) || 'pentomino',
          mode: 'vs',
          seed: detail.seed,
          gravityLevel: (detail.config && detail.config.gravityLevel) || 1,
          garbageMultiplier: (detail.config && detail.config.garbageMultiplier) || 1,
          onAttack(amount, callout) {
            if (peerSession) peerSession.sendSelfAttack(amount, callout);
          },
          onTopOut() {
            if (peerSession) peerSession.reportSelfKo();
          }
        });
        multiController.setGame(multiGame);
        showMultiSubMode('playing');
      }

      if (evType === 'garbage' && detail && multiGame) {
        multiGame.receiveGarbage(detail.amount || 0);
      }

      if (evType === 'round_end' && detail) {
        showMultiSubMode('lobby');
      }

      if (evType === 'connected' && multiSubMode === 'join') {
        showMultiSubMode('lobby');
      }

      const isHost = snap.role === 'host';
      multiDom.lobbyRoleTitle.textContent = isHost
        ? `HOST SERVER // ${snap.room.roomName}`
        : `CLIENT // ${snap.room.roomName}`;
      setClass(multiDom.hostInviteBox, 'hidden', !isHost);
      setClass(multiDom.hostStartBtn, 'hidden', !isHost);
      setClass(multiDom.clientReadyBtn, 'hidden', isHost);

      if (multiDom.pieceSelect) {
        multiDom.pieceSelect.value = snap.room.pieceSet || 'pentomino';
        multiDom.pieceSelect.disabled = !isHost;
      }
      if (multiDom.garbageSelect) {
        multiDom.garbageSelect.value = String(snap.room.garbageMultiplier ?? 1);
        multiDom.garbageSelect.disabled = !isHost;
      }
      if (multiDom.gravitySelect) {
        multiDom.gravitySelect.value = String(snap.room.gravityLevel || 1);
        multiDom.gravitySelect.disabled = !isHost;
      }

      multiDom.winnerBanner.textContent =
        snap.room.status === 'results' && snap.room.winner
          ? `GANADOR RONDA #${snap.room.round}: ${snap.room.winner}`
          : '';
      setClass(multiDom.winnerBanner, 'hidden', !(snap.room.status === 'results' && snap.room.winner));

      // Lobby player list
      multiDom.playersList.innerHTML = '';
      for (const p of snap.players || []) {
        const badge = p.isHost ? 'HOST SERVER' : p.ready ? 'READY' : 'WAIT';
        multiDom.playersList.appendChild(
          createEl('div', { className: 'twfox-player-row' }, [
            createEl('span', { text: `${p.name} (${badge})` }),
            createEl('span', { className: 'twfox-modal-badge', text: `${p.wins || 0}W` })
          ])
        );
      }

      // Chat log
      multiDom.chatLog.innerHTML = '';
      for (const entry of snap.chat || []) {
        multiDom.chatLog.appendChild(
          createEl('div', {
            style: entry.system ? 'color:#ffbe8e' : 'color:#dce4ff',
            text: entry.system ? `* ${entry.text}` : `${entry.author}: ${entry.text}`
          })
        );
      }

      // Live opponent boards when playing
      if (multiSubMode === 'playing' && foxmodCanvas) {
        const selfId = isHost ? 'host' : snap.selfId;
        const opponents = (snap.players || []).filter((p) => p.id !== selfId);
        multiDom.opponentsGrid.innerHTML = '';
        for (const opp of opponents) {
          const miniCanvas = createEl('canvas', {
            attrs: { width: '100', height: '200' },
            style: 'background:#090c14;border:1px solid #2b344d;border-radius:3px;'
          });
          foxmodCanvas.renderMiniBoard(miniCanvas, opp.board, opp.alive);
          multiDom.opponentsGrid.appendChild(
            createEl('div', { className: 'twfox-opp-card' }, [
              createEl('div', { style: 'font-weight:800;margin-bottom:4px;color:#ffbe8e', text: opp.name }),
              miniCanvas,
              createEl('div', { style: 'margin-top:4px;color:#9aa8cf', text: `L:${opp.lines || 0} · ATK:${opp.attack || 0}` })
            ])
          );
        }
      }
    }

    function bindPeerSession(session) {
      teardownPeerSession();
      peerSession = session;
      peerUnsub = session.subscribe(renderMultiSnapshot);
    }

    function buildMultiPane() {
      const createBtn = createEl('button', {
        id: 'twfoxtetrio-create-room-btn',
        className: 'twfox-modal-btn is-primary',
        text: 'CREAR SALA (HOST / SERVIDOR)',
        type: 'button',
        attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
      });
      const joinBtn = createEl('button', {
        id: 'twfoxtetrio-join-room-btn',
        className: 'twfox-modal-btn',
        text: 'UNIRSE A SALA (CLIENTE)',
        type: 'button',
        attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
      });

      const entryView = createEl('div', { id: 'twfoxtetrio-multi-entry', className: 'twfox-multi-grid' }, [
        createEl('div', { className: 'twfox-card-box' }, [
          createEl('h3', { text: 'HOSTEAR SALA (TU PC = SERVIDOR)' }),
          createEl('p', {
            text: 'Crea una sala personalizada P2P sin servidores externos. Elige Pentominós, Tetrominós o Caos, invita amigos por código WebRTC y empieza rondas VS.'
          }),
          createBtn
        ]),
        createEl('div', { className: 'twfox-card-box' }, [
          createEl('h3', { text: 'UNIRSE A SALA DE UN AMIGO' }),
          createEl('p', {
            text: 'Pega el código de invitación (FOX1:...) que te envíe el Host por Discord, genera tu código de respuesta y conéctate directo PC a PC.'
          }),
          joinBtn
        ])
      ]);

      // Join view
      const joinOfferInput = createEl('textarea', {
        id: 'twfoxtetrio-join-offer-input',
        className: 'twfox-textarea',
        attrs: { placeholder: 'Pega aqui el codigo FOX1:... de tu amigo Host' }
      });
      const joinGenerateBtn = createEl('button', {
        id: 'twfoxtetrio-join-generate-btn',
        className: 'twfox-modal-btn is-primary',
        text: 'GENERAR RESPUESTA',
        type: 'button'
      });
      const joinAnswerOutput = createEl('textarea', {
        id: 'twfoxtetrio-join-answer-output',
        className: 'twfox-textarea',
        attrs: { readonly: 'true', placeholder: 'Aqui saldra tu codigo FOXR:... para enviarle al Host' }
      });
      const joinCopyBtn = createEl('button', {
        id: 'twfoxtetrio-join-copy-btn',
        className: 'twfox-modal-btn',
        text: 'COPIAR RESPUESTA',
        type: 'button'
      });
      const joinStatus = createEl('p', { id: 'twfoxtetrio-join-status', text: '' });
      const joinBackBtn = createEl('button', {
        id: 'twfoxtetrio-join-back-btn',
        className: 'twfox-modal-btn',
        text: 'VOLVER',
        type: 'button'
      });

      const joinView = createEl('div', { id: 'twfoxtetrio-multi-join', className: 'twfox-card-box hidden' }, [
        createEl('h3', { text: 'UNIRSE A SALA P2P' }),
        joinOfferInput,
        createEl('div', { className: 'twfox-toolbar-group' }, [joinGenerateBtn, joinCopyBtn, joinBackBtn]),
        joinAnswerOutput,
        joinStatus
      ]);

      // Lobby view
      const lobbyRoleTitle = createEl('span', { className: 'twfox-modal-badge', text: 'SALA P2P' });
      const leaveRoomBtn = createEl('button', {
        id: 'twfoxtetrio-leave-room-btn',
        className: 'twfox-modal-btn',
        text: 'SALIR DE SALA',
        type: 'button'
      });

      const pieceSelect = createEl('select', { id: 'twfoxtetrio-room-pieces', className: 'twfox-select' }, [
        createEl('option', { text: 'PENTOMINOS (12)', attrs: { value: 'pentomino' } }),
        createEl('option', { text: 'TETROMINOS (7)', attrs: { value: 'tetromino' } }),
        createEl('option', { text: 'CAOS MIX (19)', attrs: { value: 'chaos' } })
      ]);
      const garbageSelect = createEl('select', { id: 'twfoxtetrio-room-garbage', className: 'twfox-select' }, [
        createEl('option', { text: 'BASURA 0.5x', attrs: { value: '0.5' } }),
        createEl('option', { text: 'BASURA 1x', attrs: { value: '1' } }),
        createEl('option', { text: 'BASURA 1.5x', attrs: { value: '1.5' } }),
        createEl('option', { text: 'BASURA 2x', attrs: { value: '2' } })
      ]);
      const gravitySelect = createEl('select', { id: 'twfoxtetrio-room-gravity', className: 'twfox-select' }, [
        createEl('option', { text: 'GRAV 1', attrs: { value: '1' } }),
        createEl('option', { text: 'GRAV 2', attrs: { value: '2' } }),
        createEl('option', { text: 'GRAV 3', attrs: { value: '3' } }),
        createEl('option', { text: 'GRAV 5', attrs: { value: '5' } })
      ]);

      const hostGenInviteBtn = createEl('button', {
        id: 'twfoxtetrio-host-gen-invite',
        className: 'twfox-modal-btn is-primary',
        text: '+ GENERAR INVITACION',
        type: 'button'
      });
      const hostCopyInviteBtn = createEl('button', {
        id: 'twfoxtetrio-host-copy-invite',
        className: 'twfox-modal-btn',
        text: 'COPIAR INVITE',
        type: 'button'
      });
      const hostOfferOutput = createEl('textarea', {
        id: 'twfoxtetrio-host-offer-output',
        className: 'twfox-textarea',
        attrs: { readonly: 'true', placeholder: 'Genera un codigo para enviarselo a tu amigo por Discord...' }
      });
      const hostAnswerInput = createEl('textarea', {
        id: 'twfoxtetrio-host-answer-input',
        className: 'twfox-textarea',
        attrs: { placeholder: 'Pega aqui el codigo FOXR:... que te devuelva tu amigo' }
      });
      const hostAcceptBtn = createEl('button', {
        id: 'twfoxtetrio-host-accept-btn',
        className: 'twfox-modal-btn is-primary',
        text: 'CONECTAR JUGADOR',
        type: 'button'
      });
      const hostInviteStatus = createEl('p', { text: '' });
      const hostInviteBox = createEl('div', { id: 'twfoxtetrio-host-invite-box', className: 'twfox-card-box' }, [
        createEl('h3', { text: 'INVITAR AMIGOS (P2P DIRECTO)' }),
        createEl('div', { className: 'twfox-toolbar-group' }, [hostGenInviteBtn, hostCopyInviteBtn]),
        hostOfferOutput,
        hostAnswerInput,
        hostAcceptBtn,
        hostInviteStatus
      ]);

      const playersList = createEl('div', { id: 'twfoxtetrio-lobby-players', className: 'twfox-player-list' });
      const chatLog = createEl('div', { id: 'twfoxtetrio-lobby-chat', className: 'twfox-chat-log' });
      const chatInput = createEl('input', {
        id: 'twfoxtetrio-lobby-chat-input',
        className: 'twfox-input',
        attrs: { type: 'text', placeholder: 'Mensaje en el lobby...' }
      });
      const chatSendBtn = createEl('button', {
        id: 'twfoxtetrio-lobby-chat-send',
        className: 'twfox-modal-btn',
        text: 'ENVIAR',
        type: 'button'
      });
      const winnerBanner = createEl('div', {
        id: 'twfoxtetrio-multi-winner',
        className: 'twfox-modal-badge hidden',
        text: ''
      });
      const hostStartBtn = createEl('button', {
        id: 'twfoxtetrio-host-start-btn',
        className: 'twfox-modal-btn is-primary',
        text: 'START MATCH',
        type: 'button'
      });
      const clientReadyBtn = createEl('button', {
        id: 'twfoxtetrio-client-ready-btn',
        className: 'twfox-modal-btn is-primary hidden',
        text: 'READY / NOT READY',
        type: 'button'
      });

      const lobbyView = createEl('div', { id: 'twfoxtetrio-multi-lobby', className: 'hidden' }, [
        createEl('div', { className: 'twfox-toolbar', style: 'margin-bottom:10px' }, [
          createEl('div', { className: 'twfox-toolbar-group' }, [lobbyRoleTitle, winnerBanner]),
          leaveRoomBtn
        ]),
        createEl('div', { className: 'twfox-toolbar', style: 'margin-bottom:10px' }, [
          createEl('div', { className: 'twfox-toolbar-group' }, [pieceSelect, garbageSelect, gravitySelect]),
          createEl('div', { className: 'twfox-toolbar-group' }, [hostStartBtn, clientReadyBtn])
        ]),
        createEl('div', { className: 'twfox-multi-grid' }, [
          hostInviteBox,
          createEl('div', { className: 'twfox-card-box' }, [
            createEl('h3', { text: 'JUGADORES & CHAT' }),
            playersList,
            chatLog,
            createEl('div', { className: 'twfox-toolbar-group' }, [chatInput, chatSendBtn])
          ])
        ])
      ]);

      multiCanvas = createEl('canvas', {
        id: 'twfoxtetrio-multi-canvas',
        className: 'twfox-game-canvas',
        attrs: { width: '400', height: '420' }
      });
      const opponentsGrid = createEl('div', { id: 'twfoxtetrio-multi-opponents', className: 'twfox-opponents-grid' });
      const backLobbyBtn = createEl('button', {
        id: 'twfoxtetrio-back-lobby-btn',
        className: 'twfox-modal-btn',
        text: 'VOLVER AL LOBBY',
        type: 'button'
      });
      const gameView = createEl('div', { id: 'twfoxtetrio-multi-game', className: 'hidden' }, [
        createEl('div', { className: 'twfox-toolbar', style: 'margin-bottom:10px' }, [
          createEl('span', { className: 'twfox-modal-badge', text: 'VS LIVE P2P' }),
          backLobbyBtn
        ]),
        createEl('div', { className: 'twfox-multi-arena' }, [multiCanvas, opponentsGrid])
      ]);

      if (foxmodCanvas) {
        multiController = foxmodCanvas.createPlayfieldController({
          canvas: multiCanvas,
          game: null,
          allowRestart: false,
          onFrame(snap) {
            if (peerSession && snap) {
              peerSession.updateSelfBoard(snap);
            }
          }
        });
      }

      multiDom = {
        entryView,
        joinView,
        lobbyView,
        gameView,
        lobbyRoleTitle,
        hostInviteBox,
        hostStartBtn,
        clientReadyBtn,
        pieceSelect,
        garbageSelect,
        gravitySelect,
        winnerBanner,
        playersList,
        chatLog,
        opponentsGrid
      };

      let pendingInvitePeerId = null;

      createBtn.addEventListener('click', function () {
        if (!p2pRoom) return;
        const hostName = (runtimeApi.getState().selfUsername || 'HOST').toUpperCase();
        const server = p2pRoom.createHostServer({ hostName });
        bindPeerSession(server);
        hostOfferOutput.value = '';
        hostAnswerInput.value = '';
        hostInviteStatus.textContent = '';
        showMultiSubMode('lobby');
      });

      joinBtn.addEventListener('click', function () {
        joinOfferInput.value = '';
        joinAnswerOutput.value = '';
        joinStatus.textContent = '';
        showMultiSubMode('join');
      });

      joinBackBtn.addEventListener('click', function () {
        teardownPeerSession();
        showMultiSubMode('entry');
      });

      leaveRoomBtn.addEventListener('click', function () {
        teardownPeerSession();
        showMultiSubMode('entry');
      });

      backLobbyBtn.addEventListener('click', function () {
        showMultiSubMode('lobby');
      });

      hostGenInviteBtn.addEventListener('click', async function () {
        if (!peerSession || peerSession.getSnapshot().role !== 'host') return;
        hostInviteStatus.textContent = 'Generando codigo WebRTC...';
        try {
          const invite = await peerSession.createInvite();
          pendingInvitePeerId = invite.peerId;
          hostOfferOutput.value = invite.code;
          copyToClipboard(invite.code);
          hostInviteStatus.textContent = 'Codigo listo y copiado. Envialo a tu amigo y pega su respuesta abajo.';
        } catch (err) {
          hostInviteStatus.textContent = 'Error: ' + (err && err.message ? err.message : err);
        }
      });

      hostCopyInviteBtn.addEventListener('click', function () {
        if (hostOfferOutput.value) {
          copyToClipboard(hostOfferOutput.value);
          hostInviteStatus.textContent = 'Codigo copiado al portapapeles.';
        }
      });

      hostAcceptBtn.addEventListener('click', async function () {
        if (!peerSession || peerSession.getSnapshot().role !== 'host') return;
        try {
          await peerSession.acceptAnswer(pendingInvitePeerId, hostAnswerInput.value);
          hostAnswerInput.value = '';
          hostOfferOutput.value = '';
          pendingInvitePeerId = null;
          hostInviteStatus.textContent = 'Jugador conectado al servidor local!';
        } catch (err) {
          hostInviteStatus.textContent = 'Error: ' + (err && err.message ? err.message : err);
        }
      });

      joinGenerateBtn.addEventListener('click', async function () {
        if (!p2pRoom) return;
        joinStatus.textContent = 'Procesando invitacion...';
        try {
          const playerName = (runtimeApi.getState().selfUsername || 'PLAYER').toUpperCase();
          const client = p2pRoom.createClientPeer({ playerName });
          bindPeerSession(client);
          const answerCode = await client.joinFromInvite(joinOfferInput.value);
          joinAnswerOutput.value = answerCode;
          copyToClipboard(answerCode);
          joinStatus.textContent = 'Respuesta lista y copiada! Enviasela al Host para entrar al lobby.';
        } catch (err) {
          joinStatus.textContent = 'Error: ' + (err && err.message ? err.message : err);
        }
      });

      joinCopyBtn.addEventListener('click', function () {
        if (joinAnswerOutput.value) {
          copyToClipboard(joinAnswerOutput.value);
          joinStatus.textContent = 'Respuesta copiada al portapapeles.';
        }
      });

      function pushRoomConfigPatch() {
        if (!peerSession || peerSession.getSnapshot().role !== 'host') return;
        peerSession.updateSettings({
          pieceSet: pieceSelect.value,
          garbageMultiplier: Number(garbageSelect.value),
          gravityLevel: Number(gravitySelect.value)
        });
      }

      pieceSelect.addEventListener('change', pushRoomConfigPatch);
      garbageSelect.addEventListener('change', pushRoomConfigPatch);
      gravitySelect.addEventListener('change', pushRoomConfigPatch);

      hostStartBtn.addEventListener('click', function () {
        if (peerSession && peerSession.getSnapshot().role === 'host') {
          peerSession.startMatch();
        }
      });

      clientReadyBtn.addEventListener('click', function () {
        if (peerSession && peerSession.getSnapshot().role === 'client') {
          peerSession.setReady(!peerSession.getSnapshot().ready);
        }
      });

      function sendChatMsg() {
        if (!peerSession || !chatInput.value.trim()) return;
        peerSession.sendChat(chatInput.value);
        chatInput.value = '';
      }

      chatSendBtn.addEventListener('click', sendChatMsg);
      chatInput.addEventListener('keydown', function (ev) {
        if (ev && (ev.key === 'Enter' || ev.code === 'Enter')) {
          sendChatMsg();
        }
      });

      return createEl('div', { id: 'twfoxtetrio-pane-multi', className: 'twfox-pane hidden' }, [
        entryView,
        joinView,
        lobbyView,
        gameView
      ]);
    }

    function buildConfigSection(sectionSpec) {
      const children = [
        createEl('h2', { className: 'twfox-section-title', text: sectionSpec.title })
      ];

      for (const toggleSpec of sectionSpec.toggles) {
        const input = createEl('input', {
          className: 'twfox-toggle-input',
          type: 'checkbox',
          attrs: { type: 'checkbox' }
        });
        input.addEventListener('change', function () {
          runtimeApi.updateConfig({
            [sectionSpec.key]: { [toggleSpec.field]: Boolean(input.checked) }
          });
          setStatus('SETTINGS SAVED');
        });

        toggleControls.push({
          section: sectionSpec.key,
          field: toggleSpec.field,
          input
        });

        children.push(
          createEl('div', { className: 'twfox-control-row' }, [
            createEl('div', { className: 'twfox-control-text' }, [
              createEl('span', { className: 'twfox-control-label', text: toggleSpec.label }),
              createEl('span', { className: 'twfox-control-desc', text: toggleSpec.description })
            ]),
            createEl(
              'label',
              { className: 'twfox-toggle', attrs: { 'data-hover': 'tap', 'data-hit': 'click' } },
              [input, createEl('span', { className: 'twfox-toggle-track' })]
            )
          ])
        );
      }

      if (sectionSpec.range) {
        const r = sectionSpec.range;
        const rangeInput = createEl('input', {
          className: 'twfox-range-input',
          type: 'range',
          attrs: { type: 'range', min: String(r.min), max: String(r.max), step: String(r.step) }
        });
        const valueEl = createEl('span', {
          id: 'twfoxtetrio-maxrows-value',
          className: 'twfox-range-val',
          text: String(r.min)
        });

        function commitRangeValue(nextRaw) {
          const next = clampNumber(nextRaw, r.min, r.max);
          rangeInput.value = String(next);
          valueEl.textContent = String(next);
          runtimeApi.updateConfig({ [sectionSpec.key]: { [r.field]: next } });
          setStatus('SETTINGS SAVED');
        }

        rangeInput.addEventListener('input', function () {
          commitRangeValue(rangeInput.value);
        });
        rangeInput.addEventListener('change', function () {
          commitRangeValue(rangeInput.value);
        });

        const minusBtn = createEl('button', {
          className: 'twfox-modal-btn twfox-step-btn',
          text: '-',
          type: 'button',
          attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
        });
        minusBtn.addEventListener('click', function () {
          commitRangeValue(Number(rangeInput.value) - r.step);
        });

        const plusBtn = createEl('button', {
          className: 'twfox-modal-btn twfox-step-btn',
          text: '+',
          type: 'button',
          attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
        });
        plusBtn.addEventListener('click', function () {
          commitRangeValue(Number(rangeInput.value) + r.step);
        });

        rangeControls.push({
          section: sectionSpec.key,
          field: r.field,
          min: r.min,
          max: r.max,
          input: rangeInput,
          valueEl
        });

        children.push(
          createEl('div', { className: 'twfox-control-row' }, [
            createEl('div', { className: 'twfox-control-text' }, [
              createEl('span', { className: 'twfox-control-label', text: r.label }),
              createEl('span', { className: 'twfox-control-desc', text: r.description })
            ]),
            createEl('div', { className: 'twfox-range-wrap' }, [minusBtn, rangeInput, plusBtn, valueEl])
          ])
        );
      }

      return createEl(
        'div',
        { className: 'twfox-section', style: `--twfox-accent: ${sectionSpec.accent}` },
        children
      );
    }

    function buildCreditsPane() {
      const githubLink = createEl('a', {
        id: 'twfoxtetrio-github-link',
        className: 'twfox-modal-btn is-primary twfox-github-btn',
        text: 'GITHUB REPO',
        attrs: {
          href: REPO_URL,
          target: '_blank',
          rel: 'noopener',
          'data-hover': 'tap',
          'data-hit': 'click'
        }
      });
      githubLink.addEventListener('click', function (ev) {
        if (openExternalUrl(REPO_URL) && ev && typeof ev.preventDefault === 'function') {
          ev.preventDefault();
        }
      });

      const listItems = CREDIT_ITEMS.map((item) =>
        createEl('li', { className: 'twfox-credits-item' }, [
          createEl('strong', { text: item.name }),
          createEl('span', { text: item.detail })
        ])
      );

      return createEl('div', { id: 'twfoxtetrio-pane-credits', className: 'twfox-pane hidden' }, [
        createEl('div', { className: 'twfox-credits-hero' }, [
          createEl('div', {}, [
            createEl('div', { className: 'twfox-modal-title-wrap' }, [
              createEl('h2', { className: 'twfox-modal-title', text: 'FOXMOD // TWFOXTETRIO' }),
              createEl('span', { className: 'twfox-modal-badge', text: 'v' + runtimeApi.version })
            ]),
            createEl('p', { className: 'twfox-credits-author', text: 'Modded By: TWFoxcrack' })
          ]),
          githubLink
        ]),
        createEl('ul', { className: 'twfox-credits-list' }, listItems),
        createEl('p', {
          className: 'twfox-credits-note',
          text:
            'Visual HUD trackers & standalone offline/P2P custom FOXMOD modes. Does not alter official TETR.IO server physics or network packets.'
        })
      ]);
    }

    function ensureOverlay() {
      if (overlayEl || document.getElementById(OVERLAY_ID)) {
        overlayEl = overlayEl || document.getElementById(OVERLAY_ID);
        return;
      }

      backHubBtn = createEl('button', {
        id: 'twfoxtetrio-back-hub',
        className: 'twfox-modal-btn hidden',
        text: '< HUB',
        type: 'button',
        attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
      });
      backHubBtn.addEventListener('click', function () {
        setActiveView('hub');
      });

      const closeBtn = createEl('button', {
        id: 'twfoxtetrio-foxmod-close',
        className: 'twfox-modal-btn',
        text: 'CLOSE [ESC]',
        type: 'button',
        attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
      });
      closeBtn.addEventListener('click', closePanel);

      const navSpecs = [
        { view: 'hub', id: 'twfoxtetrio-tab-hub', label: 'FOXMOD HUB' },
        { view: 'practice', id: 'twfoxtetrio-tab-practice', label: 'PRACTICA' },
        { view: 'multi', id: 'twfoxtetrio-tab-multi', label: 'MULTIJUGADOR' },
        { view: 'config', id: 'twfoxtetrio-tab-config', label: 'CONFIG' },
        { view: 'credits', id: 'twfoxtetrio-tab-credits', label: 'CREDITS' }
      ];

      const tabsRow = navSpecs.map((spec) => {
        const btn = createEl('button', {
          id: spec.id,
          className: 'twfox-tab-btn' + (spec.view === 'hub' ? ' is-active' : ''),
          text: spec.label,
          type: 'button',
          attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
        });
        btn.addEventListener('click', function () {
          setActiveView(spec.view);
        });
        tabButtons.set(spec.view, btn);
        return btn;
      });

      const hubPane = buildHubPane();
      const practicePane = buildPracticePane();
      const multiPane = buildMultiPane();
      const configPane = createEl(
        'div',
        { id: 'twfoxtetrio-pane-config', className: 'twfox-pane hidden' },
        CONFIG_SECTIONS.map(buildConfigSection)
      );
      const creditsPane = buildCreditsPane();

      viewPanes.set('hub', hubPane);
      viewPanes.set('practice', practicePane);
      viewPanes.set('multi', multiPane);
      viewPanes.set('config', configPane);
      viewPanes.set('credits', creditsPane);

      statusEl = createEl('span', {
        id: 'twfoxtetrio-config-status',
        className: 'twfox-modal-status',
        text: 'CHANGES SAVED AUTOMATICALLY'
      });

      const resetBtn = createEl('button', {
        id: 'twfoxtetrio-reset-defaults',
        className: 'twfox-modal-btn',
        text: 'RESET DEFAULTS',
        type: 'button',
        attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
      });
      resetBtn.addEventListener('click', function () {
        const nextCfg = typeof runtimeApi.resetConfig === 'function'
          ? runtimeApi.resetConfig()
          : runtimeApi.getConfig();
        syncConfigControls(nextCfg);
        setStatus('RESET TO DEFAULTS');
      });

      footerEl = createEl('div', { className: 'twfox-modal-footer hidden' }, [statusEl, resetBtn]);

      const panel = createEl('div', { id: PANEL_ID }, [
        createEl('div', { className: 'twfox-modal-header' }, [
          createEl('div', { className: 'twfox-modal-brand' }, [
            createEl('div', { className: 'twfox-modal-logo', html: FOX_ICON_SVG }),
            createEl('div', { className: 'twfox-modal-title-wrap' }, [
              createEl('h1', { className: 'twfox-modal-title', text: 'FOXMOD' }),
              createEl('span', { className: 'twfox-modal-badge', text: 'v' + runtimeApi.version }),
              createEl('span', { className: 'twfox-modal-badge', text: 'BY TWFOXCRACK' })
            ])
          ]),
          createEl('div', { className: 'twfox-header-actions' }, [backHubBtn, closeBtn])
        ]),
        createEl('div', { className: 'twfox-modal-tabs' }, tabsRow),
        createEl('div', { className: 'twfox-modal-body' }, [
          hubPane,
          practicePane,
          multiPane,
          configPane,
          creditsPane
        ]),
        footerEl
      ]);

      overlayEl = createEl('div', { id: OVERLAY_ID }, [panel]);
      overlayEl.addEventListener('click', function (ev) {
        if (ev && ev.target === overlayEl) {
          closePanel();
        }
      });

      const mountTarget = document.body || document.documentElement;
      if (mountTarget) {
        mountTarget.appendChild(overlayEl);
      }
    }

    function ensureHomeButton() {
      if (document.getElementById(MENU_BTN_ID)) return;
      const homeMenu = document.getElementById('home_menu');
      if (!homeMenu) return;

      const btn = createEl(
        'div',
        {
          id: MENU_BTN_ID,
          className: 'scroller_item scroller_item_giant has_image has_description ns',
          attrs: { 'data-hover': 'hover', 'data-hit': 'hit1' }
        },
        [
          createEl('div', { className: 'twfox-home-icon', html: FOX_ICON_SVG }),
          createEl('h1', { text: 'FOXMOD' }),
          createEl('p', { text: 'practica pentominos, salas P2P, config & credits' })
        ]
      );
      btn.addEventListener('click', openPanel);

      const sigAbout = document.getElementById('sig_about');
      if (sigAbout && typeof homeMenu.insertBefore === 'function' && sigAbout.parentNode === homeMenu) {
        homeMenu.insertBefore(btn, sigAbout.nextSibling || null);
      } else {
        homeMenu.appendChild(btn);
      }
    }

    document.addEventListener(
      'keydown',
      function (ev) {
        if (!isOpen || !ev) return;
        if (ev.key === 'Escape' || ev.code === 'Escape') {
          if (typeof ev.preventDefault === 'function') ev.preventDefault();
          if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
          if (activeView !== 'hub') {
            setActiveView('hub');
          } else {
            closePanel();
          }
          return;
        }
        if (isTextInputTarget(ev.target)) return;
        const activeCtrl =
          activeView === 'practice'
            ? practiceController
            : activeView === 'multi' && multiSubMode === 'playing'
              ? multiController
              : null;
        if (activeCtrl && activeCtrl.handleKeyDown(ev)) {
          if (typeof ev.preventDefault === 'function') ev.preventDefault();
          if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
        }
      },
      true
    );

    document.addEventListener(
      'keyup',
      function (ev) {
        if (!isOpen || !ev) return;
        if (practiceController) practiceController.handleKeyUp(ev);
        if (multiController) multiController.handleKeyUp(ev);
      },
      true
    );

    ensureHomeButton();

    const menusEl = document.getElementById('menus');
    if (menusEl && typeof root.MutationObserver === 'function') {
      const menuObserver = new root.MutationObserver(function () {
        if (!isOpen) return;
        const menuType = menusEl.getAttribute('data-menu-type');
        if (menusEl.classList.contains('hidden') || (menuType && menuType !== 'home')) {
          closePanel();
        }
      });
      menuObserver.observe(menusEl, {
        attributes: true,
        attributeFilter: ['class', 'data-menu-type']
      });
    }

    runtimeApi.subscribe(function (state, cfg) {
      ensureHomeButton();
      if (state && (state.inGame || state.inMultiplayer) && isOpen) {
        closePanel();
        return;
      }
      if (isOpen) {
        syncConfigControls(cfg);
      }
    });
  }

  api.registerFeature('foxmod-menu', initFoxmodMenu);
}(typeof globalThis !== 'undefined' ? globalThis : window));
