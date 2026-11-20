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
  const REPO_URL = 'https://github.com/Foxcrack/twfoxtetrio';

  function buildPixelBadgeSvg(rows, palette) {
    const height = rows.length;
    const width = rows[0] ? rows[0].length : 1;
    const rects = [];
    for (let y = 0; y < height; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        const fill = palette[Number(ch) - 1] || palette[1];
        rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`);
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" aria-hidden="true">${rects.join('')}</svg>`;
  }

  const ICONS = {
    fox: buildPixelBadgeSvg(
      [
        '......1...1......',
        '1111..11111..1.1.',
        '2222..2...2..2.2.',
        '211...2...2...2..',
        '222...2...2..2.2.',
        '3.....2...2..3.3.',
        '3.....33333..3.3.'
      ],
      ['#ffca96', '#ff8234', '#c24812']
    ),
    practice: buildPixelBadgeSvg(
      [
        '1111..1111...1111',
        '2...2.2...2.2....',
        '2222..2222..2....',
        '2.....2..2..2....',
        '3.....3...3..3333',
        '.................'
      ],
      ['#ffe580', '#f5a623', '#b36b0c']
    ),
    fourWide: buildPixelBadgeSvg(
      [
        '1...1..1...1.....',
        '1...1..1...1.....',
        '22222..2.2.2.....',
        '....2..22.22.....',
        '....3..3...3.....',
        '.................'
      ],
      ['#ffe580', '#f5a623', '#b36b0c']
    ),
    pentomino: buildPixelBadgeSvg(
      [
        '..1111...11111...',
        '..2...2..2.......',
        '..2...2..2222....',
        '..2222.......2...',
        '..2..........2...',
        '..3......3333....'
      ],
      ['#ff99aa', '#e84863', '#a32238']
    ),
    marathon: buildPixelBadgeSvg(
      [
        '1...1..1111..1111',
        '11.11..2...2..2..',
        '2.2.2..2222...2..',
        '2...2..2..2...2..',
        '3...3..3...3..3..',
        '.................'
      ],
      ['#99ccff', '#4b8aff', '#2351b8']
    ),
    multi: buildPixelBadgeSvg(
      [
        '1111...1111..1111',
        '2...2.....2..2..2',
        '2222...111...2222',
        '2......2.....2...',
        '3......3333..3...',
        '.................'
      ],
      ['#ff99aa', '#e84863', '#a32238']
    ),
    config: buildPixelBadgeSvg(
      [
        '.1111..11111..1111',
        '2......2.....2....',
        '2......2222..2..11',
        '2......2.....2...2',
        '3......3.....3...3',
        '.3333..3......333.'
      ],
      ['#99ccff', '#4b8aff', '#2351b8']
    ),
    credits: buildPixelBadgeSvg(
      [
        '.1111..1111..1111.',
        '2......2...2.2...2',
        '2......2222..2...2',
        '2......2..2..2...2',
        '3......3...3.3...3',
        '.3333..3...3.3333.'
      ],
      ['#eab0ff', '#a855ff', '#6a23bd']
    )
  };

  const HUB_CARDS = [
    {
      view: 'foxmod_practice',
      cardId: 'twfoxtetrio-card-practice',
      icon: ICONS.practice,
      title: 'PRACTICA',
      subtitle: '4-wide, pentominoes, marathon & custom solo modes',
      bg: '#382a18',
      top: '#705226',
      left: '#4f3a1d',
      bottom: '#1a120a',
      titleColor: '#ffd28c',
      descColor: '#c9954c'
    },
    {
      view: 'foxmod_multi',
      cardId: 'twfoxtetrio-card-multi',
      icon: ICONS.multi,
      title: 'MULTIJUGADOR',
      subtitle: 'create P2P custom rooms (you are the server) or join friends',
      bg: '#3b1c23',
      top: '#752d3c',
      left: '#52212c',
      bottom: '#1c0c10',
      titleColor: '#ffb5c2',
      descColor: '#c96b7c'
    },
    {
      view: 'foxmod_config',
      cardId: 'twfoxtetrio-card-config',
      icon: ICONS.config,
      title: 'CONFIG',
      subtitle: 'tweak Blitz, 40 Lines & Multiplayer VS HUD settings',
      bg: '#1c263e',
      top: '#1d3164',
      left: '#1e2a48',
      bottom: '#0e0f13',
      titleColor: '#88afff',
      descColor: '#5169c0'
    },
    {
      view: 'foxmod_credits',
      cardId: 'twfoxtetrio-card-credits',
      icon: ICONS.credits,
      title: 'CREDITS',
      subtitle: 'modded by TWFoxcrack & twfoxtetrio repository',
      bg: '#2c1c3e',
      top: '#52267a',
      left: '#3b1e54',
      bottom: '#120b1a',
      titleColor: '#dfadff',
      descColor: '#9f66c9'
    }
  ];

  const CUSTOM_SOLO_PRESETS = {
    fourWide: {
      bagtype: '7-bag',
      spinbonuses: 'all-mini+',
      combotable: 'multiplier',
      allclears: true,
      seed_random: true,
      can_retry: true,
      stock: 0,
      clutch: true,
      nolockout: true,
      boardwidth: 4,
      boardheight: 20,
      survivalmode: 'none',
      allow180: true,
      kickset: 'SRS+',
      allow_harddrop: true,
      display_next: true,
      display_hold: true,
      nextcount: 5,
      infinite_movement: false,
      infinite_hold: false,
      display_shadow: true,
      are: 0,
      lineclear_are: 0,
      g: 0.02,
      levels: false,
      objective_type: 'none',
      topoutisclear: false,
      mission: '4-WIDE PRACTICE',
      slot_counter1: 'stopwatch',
      slot_counter2: 'lines',
      slot_counter3: 'pieces',
      slot_counter4: 'attack',
      slot_counter5: 'score'
    },
    marathon: {
      bagtype: '7-bag',
      spinbonuses: 'all-mini+',
      combotable: 'multiplier',
      allclears: true,
      seed_random: true,
      can_retry: true,
      stock: 0,
      clutch: true,
      nolockout: false,
      boardwidth: 10,
      boardheight: 20,
      survivalmode: 'none',
      allow180: true,
      kickset: 'SRS+',
      allow_harddrop: true,
      display_next: true,
      display_hold: true,
      nextcount: 5,
      infinite_movement: false,
      infinite_hold: false,
      display_shadow: true,
      are: 0,
      lineclear_are: 0,
      levels: true,
      masterlevels: false,
      startinglevel: 1,
      levelstatic: true,
      levelstaticspeed: 10,
      levelgbase: 0.8,
      levelgspeed: 0.007,
      locktime: 30,
      objective_type: 'lines',
      objective_count: 150,
      objective_result: 'score',
      topoutisclear: true,
      mission: 'MARATHON 150 LINES',
      slot_counter1: 'stopwatch',
      slot_counter2: 'lines',
      slot_counter3: 'level',
      slot_counter4: '---empty---',
      slot_counter5: 'score'
    }
  };

  const VIEW_META = {
    home: { header: 'HOME', footer: 'WELCOME TO TETR.IO!', back: null },
    foxmod: { header: 'FOXMOD', footer: 'pick a foxmod section', back: 'home' },
    foxmod_practice: { header: 'PRACTICA', footer: 'pick a practice mode', back: 'foxmod' },
    foxmod_pentomino: {
      header: 'PENTOMINOS',
      footer: '12 pentominoes · real TETR.IO controls & skin',
      back: 'foxmod_practice'
    },
    foxmod_multi: {
      header: 'MULTIJUGADOR',
      footer: 'custom P2P rooms — host acts as server',
      back: 'foxmod'
    },
    foxmod_config: {
      header: 'FOXMOD CONFIG',
      footer: 'tweak your twfoxtetrio HUD settings',
      back: 'foxmod'
    },
    foxmod_credits: {
      header: 'FOXMOD CREDITS',
      footer: 'modded by twfoxcrack',
      back: 'foxmod'
    }
  };

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
      name: 'Practice Modes (4Wide, Pentominoes & Marathon)',
      detail: 'Launches 4Wide & Marathon on TETR.IO engine + TETR.IO-skinned 12-Pentominoes.'
    },
    {
      name: 'Host-Server P2P Custom Rooms',
      detail: 'Creator acts as room server over WebRTC with Pentominoes / Tetrominoes / Chaos.'
    },
    {
      name: 'Blitz PB Delta & 40 Lines PB Pace HUDs',
      detail: 'Real-time top HUD trackers dynamically adapting to PB and quick retry.'
    },
    {
      name: 'Multiplayer Live VS Leaderboard',
      detail: 'Sorted real-time VS standings with [KO] tracking and automatic #killfeed shift.'
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
.scroller_item.scroller_item_giant .twfox-menu-svg {
  position: absolute;
  left: 1em;
  top: 0.65em;
  height: 5.7em;
  width: 10.5em;
  display: flex;
  align-items: center;
  pointer-events: none;
}
.scroller_item.scroller_item_giant .twfox-menu-svg > svg {
  height: 100%;
  width: auto;
  display: block;
}
.twfox-stage-scroller {
  padding-left: 0 !important;
  background: transparent !important;
  text-align: center;
}
.twfox-stage-inner {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.twfox-stage-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 6px;
}
.twfox-game-canvas {
  background: transparent;
  display: block;
  max-width: 96vw;
  max-height: 76vh;
}
.twfox-native-scroller > .scroller_block {
  box-sizing: border-box;
}
.twfox-scroller-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top-color: #cf6427 !important;
}
.twfox-scroller-header h1 {
  margin: 0;
  font-size: 2.1em;
  color: #ffbe8e !important;
}
.twfox-scroller-header p { margin: 0; color: #9bb0e6; font-size: 1.1em; }
.twfox-native-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0.7em 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.twfox-native-row:first-of-type { border-top: 0; }
.twfox-native-label { display: block; font-size: 1.25em; font-weight: 700; color: #edf1ff; }
.twfox-native-desc { display: block; margin-top: 2px; font-size: 0.95em; color: #8f9fc9; }
.twfox-btn {
  font-family: HUN, sans-serif;
  font-size: 1.05em;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.45em 1em;
  border-radius: 3px;
  cursor: pointer;
  color: #dbe3ff;
  background-color: #20273b;
  border-top: 3px solid #39466b;
  border-left: 3px solid #2b3552;
  border-right: 3px solid #141926;
  border-bottom: 3px solid #0d1018;
  transition: filter 120ms ease, transform 80ms ease;
  text-decoration: none;
  display: inline-block;
}
.twfox-btn:hover { filter: brightness(1.2); }
.twfox-btn:active { transform: translateY(1px); }
.twfox-btn.is-pri {
  background-color: #3d2215;
  border-top-color: #d46927;
  border-left-color: #914318;
  border-right-color: #54250c;
  border-bottom-color: #160c07;
  color: #ffbe8e;
}
.twfox-select, .twfox-input {
  font-family: HUN, sans-serif;
  font-size: 1.05em;
  font-weight: 700;
  padding: 0.4em 0.7em;
  border-radius: 3px;
  color: #fff;
  background: rgba(10, 13, 20, 0.92);
  border: 2px solid #2e3854;
}
.twfox-textarea {
  width: 100%;
  min-height: 62px;
  box-sizing: border-box;
  font-family: monospace;
  font-size: 0.95em;
  padding: 8px;
  border-radius: 3px;
  color: #dbe3ff;
  background: #080b12;
  border: 2px solid #2e3854;
  resize: vertical;
}
.twfox-toggle { position: relative; display: inline-flex; align-items: center; cursor: pointer; flex: 0 0 auto; }
.twfox-toggle-input { position: absolute; opacity: 0; width: 0; height: 0; }
.twfox-toggle-track {
  width: 48px; height: 26px; border-radius: 3px; background: #0a0d14;
  border: 2px solid #2c3550; position: relative; transition: background 140ms ease, border-color 140ms ease;
}
.twfox-toggle-track::after {
  content: ""; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px;
  border-radius: 2px; background: #6a7aa3; transition: transform 140ms ease, background 140ms ease;
}
.twfox-toggle-input:checked + .twfox-toggle-track { background: #3d2215; border-color: #cf6427; }
.twfox-toggle-input:checked + .twfox-toggle-track::after { transform: translateX(22px); background: #ff9c54; }
.twfox-range-wrap { display: flex; align-items: center; gap: 8px; }
.twfox-step-btn { padding: 0.3em 0.7em; font-size: 1.1em; }
.twfox-range-input { width: 120px; accent-color: #ff8c42; cursor: pointer; }
.twfox-range-val { min-width: 28px; text-align: right; font-size: 1.2em; font-weight: 800; color: #ffbe8e; }
.twfox-multi-cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}
.twfox-multi-card {
  background: #121622;
  border: 2px solid #273049;
  border-radius: 4px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.twfox-multi-card h2 { margin: 0; font-size: 1.4em; color: #ffbe8e; }
.twfox-multi-card p { margin: 0; font-size: 1em; color: #93a2cc; }
.twfox-player-list, .twfox-chat-log {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 150px;
  overflow-y: auto;
  font-size: 1em;
}
.twfox-player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: #1a2030;
  border-radius: 3px;
}
.twfox-multi-arena {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 18px;
}
.twfox-opponents-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.twfox-opp-card {
  background: rgba(0, 0, 0, 0.75);
  border: 2px solid #ffffff;
  padding: 6px;
  text-align: center;
}
.twfox-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 0.9em;
  font-weight: 800;
  background: rgba(255, 140, 66, 0.16);
  border: 1px solid rgba(255, 140, 66, 0.42);
  color: #ffbe8e;
}
#menus[data-menu-type^='foxmod'] #header_text {
  color: #ffbe8e;
  transition: .5s color;
}
#menus[data-menu-type^='foxmod'] #footer {
  background: linear-gradient(to bottom, #1e1510 0, #362218 100%);
  border-top: 2px solid #4d2c1b;
}
#menus[data-menu-type^='foxmod'] #footer_text {
  color: #ffbe8e;
}
.twfox-native-scroller .hidden,
.twfox-stage-scroller .hidden {
  display: none;
}
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

  function collectMenuViews(menusEl) {
    const result = [];
    if (!menusEl || !menusEl.children) return result;
    for (const child of menusEl.children) {
      if (typeof child.getAttribute === 'function' && child.getAttribute('data-menuview')) {
        result.push(child);
      }
    }
    return result;
  }

  function collectIndexedItems(rootEl) {
    const result = [];
    if (!rootEl) return result;
    if (typeof rootEl.querySelectorAll === 'function') {
      try {
        const found = rootEl.querySelectorAll('.room_config_item');
        if (Array.isArray(found) || (found && found.length)) {
          for (const item of found) {
            if (item.getAttribute && item.getAttribute('data-index')) {
              result.push(item);
            }
          }
          if (result.length > 0) return result;
        }
      } catch (_) {}
    }
    const stack = Array.from(rootEl.children || []);
    while (stack.length > 0) {
      const node = stack.shift();
      if (node.getAttribute && node.getAttribute('data-index')) {
        result.push(node);
      }
      if (node.children) stack.push(...node.children);
    }
    return result;
  }

  function applyCustomSoloPreset(presetMap) {
    const container = document.getElementById('custom_content_container');
    const startBtn = document.getElementById('start_custom');
    if (!container || !startBtn) return false;

    for (const item of collectIndexedItems(container)) {
      const key = item.getAttribute('data-index');
      if (!Object.prototype.hasOwnProperty.call(presetMap, key)) continue;
      const val = presetMap[key];
      const inputType = item.getAttribute('type');
      if (inputType === 'checkbox') {
        item.checked = Boolean(val);
      } else if (item.classList && item.classList.contains('room_config_spinner')) {
        item.textContent = String(val);
      } else {
        item.value = String(val);
      }
    }

    startBtn.click();
    return true;
  }

  function initFoxmodMenu(runtimeApi) {
    ensureStyle();

    let activeFoxView = null;
    let isNavigatingInternal = false;
    let scrollersInjected = false;
    let backHooked = false;
    let statusEl = null;
    const scrollerMap = new Map();
    const toggleControls = [];
    const rangeControls = [];

    // Practice Pentominoes stage
    let practiceGame = null;
    let practiceController = null;
    let practiceCanvas = null;

    // Multiplayer P2P
    let peerSession = null;
    let peerUnsub = null;
    let multiGame = null;
    let multiController = null;
    let multiCanvas = null;
    let multiSubMode = 'entry';
    let multiDom = null;

    function stopPlayControllers() {
      if (practiceController) practiceController.stop();
      if (multiController) multiController.stop();
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

    function hideFoxmodScrollersImmediately() {
      activeFoxView = null;
      stopPlayControllers();
      for (const scroller of scrollerMap.values()) {
        scroller.classList.add('hidden');
        scroller.classList.add('thidden');
      }
    }

    function navigateMenu(targetView) {
      ensureNativeScrollers();
      const menusEl = document.getElementById('menus');
      if (!menusEl) return;

      const meta = VIEW_META[targetView] || VIEW_META.home;
      const isFoxTarget = targetView !== 'home';
      activeFoxView = isFoxTarget ? targetView : null;

      stopPlayControllers();

      isNavigatingInternal = true;
      try {
        for (const el of collectMenuViews(menusEl)) {
          const viewName = el.getAttribute('data-menuview');
          if (viewName === targetView) {
            el.classList.remove('thidden');
            if (typeof root.getComputedStyle === 'function') {
              void root.getComputedStyle(el).transform;
              void root.getComputedStyle(el).opacity;
            }
            if (typeof el.getBoundingClientRect === 'function') {
              el.getBoundingClientRect();
            }
            el.classList.remove('hidden');
          } else if (!el.classList.contains('hidden')) {
            el.classList.add('hidden');
            if (typeof root.setTimeout === 'function') {
              root.setTimeout(() => {
                if (el.classList.contains('hidden')) {
                  el.classList.add('thidden');
                }
              }, 666);
            } else {
              el.classList.add('thidden');
            }
          }
        }

        menusEl.setAttribute('data-menu-type', targetView);

        const backBtn = document.getElementById('back');
        if (backBtn) setClass(backBtn, 'hidden', !meta.back);

        const exitBtn = document.getElementById('exit_electron');
        if (exitBtn) setClass(exitBtn, 'hidden', targetView !== 'home');

        const headerText = document.getElementById('header_text');
        if (headerText) headerText.textContent = meta.header;

        const footerText = document.getElementById('footer_text');
        if (footerText) footerText.textContent = meta.footer;
      } finally {
        isNavigatingInternal = false;
      }

      if (targetView === 'foxmod_config') {
        syncConfigControls(runtimeApi.getConfig());
      } else if (targetView === 'foxmod_pentomino' && practiceController) {
        practiceController.reloadUserSettings();
        practiceController.start();
      } else if (targetView === 'foxmod_multi' && multiSubMode === 'playing' && multiController) {
        multiController.reloadUserSettings();
        multiController.start();
      }
    }

    function goBack() {
      if (!activeFoxView) return;
      const meta = VIEW_META[activeFoxView];
      navigateMenu(meta && meta.back ? meta.back : 'home');
    }

    function makeGiantBanner(spec, onClick) {
      const item = createEl(
        'div',
        {
          id: spec.cardId,
          className: 'scroller_item scroller_item_giant has_image has_description ns',
          style: `background-color:${spec.bg};border-top:3px solid ${spec.top};border-left:3px solid ${spec.left};border-bottom:3px solid ${spec.bottom};`,
          attrs: { 'data-hover': 'hover', 'data-hit': spec.hit || 'hit2' }
        },
        [
          createEl('div', { className: 'twfox-menu-svg', html: spec.icon }),
          createEl('h1', { style: `color:${spec.titleColor}`, text: spec.title }),
          createEl('p', { style: `color:${spec.descColor}`, text: spec.subtitle })
        ]
      );
      item.addEventListener('click', onClick);
      return item;
    }

    function buildHubScroller() {
      const items = HUB_CARDS.map((cardSpec) =>
        makeGiantBanner(cardSpec, function () {
          navigateMenu(cardSpec.view);
        })
      );

      return createEl(
        'div',
        {
          id: 'twfoxtetrio-view-foxmod',
          className: 'right_scroller hidden thidden',
          attrs: { 'data-menuview': 'foxmod' }
        },
        items
      );
    }

    function buildPracticeMenuScroller() {
      const items = [
        makeGiantBanner(
          {
            cardId: 'twfoxtetrio-prac-4wide',
            icon: ICONS.fourWide,
            title: '4WIDE',
            subtitle: 'practice stacking combos on a 4-wide well (real TETR.IO engine)',
            bg: '#382a18',
            top: '#705226',
            left: '#4f3a1d',
            bottom: '#1a120a',
            titleColor: '#ffd28c',
            descColor: '#c9954c',
            hit: 'confirm'
          },
          function () {
            hideFoxmodScrollersImmediately();
            applyCustomSoloPreset(CUSTOM_SOLO_PRESETS.fourWide);
          }
        ),
        makeGiantBanner(
          {
            cardId: 'twfoxtetrio-prac-pentomino',
            icon: ICONS.pentomino,
            title: 'PENTOMINOS',
            subtitle: '12-piece pentominoes with your TETR.IO skin & real controls',
            bg: '#3b1c23',
            top: '#752d3c',
            left: '#52212c',
            bottom: '#1c0c10',
            titleColor: '#ffb5c2',
            descColor: '#c96b7c',
            hit: 'hit2'
          },
          function () {
            if (practiceGame) practiceGame.reset();
            navigateMenu('foxmod_pentomino');
          }
        ),
        makeGiantBanner(
          {
            cardId: 'twfoxtetrio-prac-marathon',
            icon: ICONS.marathon,
            title: 'MARATHON',
            subtitle: 'classic 150-line speed progression marathon (real TETR.IO engine)',
            bg: '#1c263e',
            top: '#1d3164',
            left: '#1e2a48',
            bottom: '#0e0f13',
            titleColor: '#88afff',
            descColor: '#5169c0',
            hit: 'confirm'
          },
          function () {
            hideFoxmodScrollersImmediately();
            applyCustomSoloPreset(CUSTOM_SOLO_PRESETS.marathon);
          }
        )
      ];

      return createEl(
        'div',
        {
          id: 'twfoxtetrio-pane-practice',
          className: 'right_scroller hidden thidden',
          attrs: { 'data-menuview': 'foxmod_practice' }
        },
        items
      );
    }

    function buildPentominoStageScroller() {
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
        className: 'twfox-btn is-pri',
        text: 'RETRY',
        type: 'button',
        attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
      });

      practiceCanvas = createEl('canvas', {
        id: 'twfoxtetrio-practice-canvas',
        className: 'twfox-game-canvas',
        attrs: { width: '620', height: '560' }
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

      return createEl(
        'div',
        {
          id: 'twfoxtetrio-pane-pentomino',
          className: 'right_scroller hidden thidden twfox-stage-scroller',
          attrs: { 'data-menuview': 'foxmod_pentomino' }
        },
        [
          createEl('div', { className: 'twfox-stage-inner' }, [
            createEl('div', { className: 'twfox-stage-bar' }, [pieceSelect, modeSelect, restartBtn]),
            practiceCanvas
          ])
        ]
      );
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
        if (nextSub === 'playing' && activeFoxView === 'foxmod_multi') {
          multiController.reloadUserSettings();
          multiController.start();
        } else {
          multiController.stop();
        }
      }
    }

    function renderMultiSnapshot(snap, evType, detail) {
      if (!multiDom || !snap) return;

      if (evType === 'match_start' && detail && pentominoEngine && foxmodCanvas) {
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

      multiDom.playersList.innerHTML = '';
      for (const p of snap.players || []) {
        const badge = p.isHost ? 'HOST SERVER' : p.ready ? 'READY' : 'WAIT';
        multiDom.playersList.appendChild(
          createEl('div', { className: 'twfox-player-row' }, [
            createEl('span', { text: `${p.name} (${badge})` }),
            createEl('span', { className: 'twfox-badge', text: `${p.wins || 0}W` })
          ])
        );
      }

      multiDom.chatLog.innerHTML = '';
      for (const entry of snap.chat || []) {
        multiDom.chatLog.appendChild(
          createEl('div', {
            style: entry.system ? 'color:#ffbe8e' : 'color:#dce4ff',
            text: entry.system ? `* ${entry.text}` : `${entry.author}: ${entry.text}`
          })
        );
      }

      if (multiSubMode === 'playing' && foxmodCanvas) {
        const selfId = isHost ? 'host' : snap.selfId;
        const opponents = (snap.players || []).filter((p) => p.id !== selfId);
        multiDom.opponentsGrid.innerHTML = '';
        for (const opp of opponents) {
          const miniCanvas = createEl('canvas', {
            attrs: { width: '100', height: '200' },
            style: 'background:#000;display:block;'
          });
          foxmodCanvas.renderMiniBoard(miniCanvas, opp.board, opp.alive);
          multiDom.opponentsGrid.appendChild(
            createEl('div', { className: 'twfox-opp-card' }, [
              createEl('div', { style: 'font-weight:800;margin-bottom:4px;color:#fff', text: opp.name }),
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

    function buildMultiScroller() {
      const createBtn = createEl('button', {
        id: 'twfoxtetrio-create-room-btn',
        className: 'twfox-btn is-pri',
        text: 'CREAR SALA (HOST / SERVIDOR)',
        type: 'button',
        attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
      });
      const joinBtn = createEl('button', {
        id: 'twfoxtetrio-join-room-btn',
        className: 'twfox-btn',
        text: 'UNIRSE A SALA (CLIENTE)',
        type: 'button',
        attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
      });

      const entryView = createEl('div', { id: 'twfoxtetrio-multi-entry', className: 'scroller_block twfox-multi-cols' }, [
        createEl('div', { className: 'twfox-multi-card' }, [
          createEl('h2', { text: 'HOSTEAR SALA (TU PC = SERVIDOR)' }),
          createEl('p', {
            text: 'Crea una sala personalizada P2P sin servidores externos. Elige Pentominós, Tetrominós o Caos e invita amigos por WebRTC.'
          }),
          createBtn
        ]),
        createEl('div', { className: 'twfox-multi-card' }, [
          createEl('h2', { text: 'UNIRSE A SALA DE UN AMIGO' }),
          createEl('p', {
            text: 'Pega el código FOX1:... de tu amigo Host, copia tu respuesta y conéctate directo PC a PC.'
          }),
          joinBtn
        ])
      ]);

      const joinOfferInput = createEl('textarea', {
        id: 'twfoxtetrio-join-offer-input',
        className: 'twfox-textarea',
        attrs: { placeholder: 'Pega aqui el codigo FOX1:... de tu amigo Host' }
      });
      const joinGenerateBtn = createEl('button', {
        id: 'twfoxtetrio-join-generate-btn',
        className: 'twfox-btn is-pri',
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
        className: 'twfox-btn',
        text: 'COPIAR RESPUESTA',
        type: 'button'
      });
      const joinStatus = createEl('p', { id: 'twfoxtetrio-join-status', text: '' });
      const joinBackBtn = createEl('button', {
        id: 'twfoxtetrio-join-back-btn',
        className: 'twfox-btn',
        text: 'CANCELAR',
        type: 'button'
      });

      const joinView = createEl('div', { id: 'twfoxtetrio-multi-join', className: 'scroller_block twfox-multi-card hidden' }, [
        createEl('h2', { text: 'UNIRSE A SALA P2P' }),
        joinOfferInput,
        createEl('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;' }, [joinGenerateBtn, joinCopyBtn, joinBackBtn]),
        joinAnswerOutput,
        joinStatus
      ]);

      const lobbyRoleTitle = createEl('span', { className: 'twfox-badge', text: 'SALA P2P' });
      const leaveRoomBtn = createEl('button', {
        id: 'twfoxtetrio-leave-room-btn',
        className: 'twfox-btn',
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
        className: 'twfox-btn is-pri',
        text: '+ GENERAR INVITACION',
        type: 'button'
      });
      const hostCopyInviteBtn = createEl('button', {
        id: 'twfoxtetrio-host-copy-invite',
        className: 'twfox-btn',
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
        className: 'twfox-btn is-pri',
        text: 'CONECTAR JUGADOR',
        type: 'button'
      });
      const hostInviteStatus = createEl('p', { text: '' });
      const hostInviteBox = createEl('div', { id: 'twfoxtetrio-host-invite-box', className: 'twfox-multi-card' }, [
        createEl('h2', { text: 'INVITAR AMIGOS (P2P)' }),
        createEl('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;' }, [hostGenInviteBtn, hostCopyInviteBtn]),
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
        className: 'twfox-btn',
        text: 'ENVIAR',
        type: 'button'
      });
      const winnerBanner = createEl('span', {
        id: 'twfoxtetrio-multi-winner',
        className: 'twfox-badge hidden',
        text: ''
      });
      const hostStartBtn = createEl('button', {
        id: 'twfoxtetrio-host-start-btn',
        className: 'twfox-btn is-pri',
        text: 'START MATCH',
        type: 'button'
      });
      const clientReadyBtn = createEl('button', {
        id: 'twfoxtetrio-client-ready-btn',
        className: 'twfox-btn is-pri hidden',
        text: 'READY / NOT READY',
        type: 'button'
      });

      const lobbyView = createEl('div', { id: 'twfoxtetrio-multi-lobby', className: 'hidden' }, [
        createEl('div', { className: 'scroller_block twfox-scroller-header' }, [
          createEl('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;' }, [lobbyRoleTitle, winnerBanner]),
          leaveRoomBtn
        ]),
        createEl('div', { className: 'scroller_block twfox-scroller-header' }, [
          createEl('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;' }, [pieceSelect, garbageSelect, gravitySelect]),
          createEl('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;' }, [hostStartBtn, clientReadyBtn])
        ]),
        createEl('div', { className: 'scroller_block twfox-multi-cols' }, [
          hostInviteBox,
          createEl('div', { className: 'twfox-multi-card' }, [
            createEl('h2', { text: 'JUGADORES & CHAT' }),
            playersList,
            chatLog,
            createEl('div', { style: 'display:flex;gap:8px;align-items:center;' }, [chatInput, chatSendBtn])
          ])
        ])
      ]);

      multiCanvas = createEl('canvas', {
        id: 'twfoxtetrio-multi-canvas',
        className: 'twfox-game-canvas',
        attrs: { width: '580', height: '540' }
      });
      const opponentsGrid = createEl('div', { id: 'twfoxtetrio-multi-opponents', className: 'twfox-opponents-grid' });
      const backLobbyBtn = createEl('button', {
        id: 'twfoxtetrio-back-lobby-btn',
        className: 'twfox-btn',
        text: 'VOLVER AL LOBBY',
        type: 'button'
      });
      const gameView = createEl('div', { id: 'twfoxtetrio-multi-game', className: 'hidden' }, [
        createEl('div', { className: 'twfox-stage-bar' }, [
          createEl('span', { className: 'twfox-badge', text: 'VS LIVE P2P' }),
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
            if (peerSession && snap) peerSession.updateSelfBoard(snap);
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
        bindPeerSession(p2pRoom.createHostServer({ hostName }));
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
          hostInviteStatus.textContent = 'Codigo copiado! Envialo por Discord y pega abajo la respuesta.';
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
          hostInviteStatus.textContent = 'Jugador conectado al servidor!';
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
          joinStatus.textContent = 'Respuesta copiada! Enviasela al Host para entrar al lobby.';
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
        if (peerSession && peerSession.getSnapshot().role === 'host') peerSession.startMatch();
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
        if (ev && (ev.key === 'Enter' || ev.code === 'Enter')) sendChatMsg();
      });

      return createEl(
        'div',
        {
          id: 'twfoxtetrio-pane-multi',
          className: 'right_scroller hidden thidden twfox-native-scroller',
          attrs: { 'data-menuview': 'foxmod_multi' }
        },
        [entryView, joinView, lobbyView, gameView]
      );
    }

    function buildConfigSection(sectionSpec) {
      const children = [createEl('h1', { style: `color:${sectionSpec.accent}`, text: sectionSpec.title })];

      for (const toggleSpec of sectionSpec.toggles) {
        const input = createEl('input', {
          className: 'twfox-toggle-input',
          type: 'checkbox',
          attrs: { type: 'checkbox' }
        });
        input.addEventListener('change', function () {
          runtimeApi.updateConfig({ [sectionSpec.key]: { [toggleSpec.field]: Boolean(input.checked) } });
          if (statusEl) statusEl.textContent = 'SETTINGS SAVED';
        });

        toggleControls.push({ section: sectionSpec.key, field: toggleSpec.field, input });

        children.push(
          createEl('div', { className: 'twfox-native-row' }, [
            createEl('div', {}, [
              createEl('span', { className: 'twfox-native-label', text: toggleSpec.label }),
              createEl('span', { className: 'twfox-native-desc', text: toggleSpec.description })
            ]),
            createEl('label', { className: 'twfox-toggle', attrs: { 'data-hover': 'tap', 'data-hit': 'click' } }, [
              input,
              createEl('span', { className: 'twfox-toggle-track' })
            ])
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
          if (statusEl) statusEl.textContent = 'SETTINGS SAVED';
        }

        rangeInput.addEventListener('input', function () { commitRangeValue(rangeInput.value); });
        rangeInput.addEventListener('change', function () { commitRangeValue(rangeInput.value); });

        const minusBtn = createEl('button', {
          className: 'twfox-btn twfox-step-btn',
          text: '-',
          type: 'button',
          attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
        });
        minusBtn.addEventListener('click', function () { commitRangeValue(Number(rangeInput.value) - r.step); });

        const plusBtn = createEl('button', {
          className: 'twfox-btn twfox-step-btn',
          text: '+',
          type: 'button',
          attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
        });
        plusBtn.addEventListener('click', function () { commitRangeValue(Number(rangeInput.value) + r.step); });

        rangeControls.push({
          section: sectionSpec.key,
          field: r.field,
          min: r.min,
          max: r.max,
          input: rangeInput,
          valueEl
        });

        children.push(
          createEl('div', { className: 'twfox-native-row' }, [
            createEl('div', {}, [
              createEl('span', { className: 'twfox-native-label', text: r.label }),
              createEl('span', { className: 'twfox-native-desc', text: r.description })
            ]),
            createEl('div', { className: 'twfox-range-wrap' }, [minusBtn, rangeInput, plusBtn, valueEl])
          ])
        );
      }

      return createEl('div', { className: 'scroller_block' }, children);
    }

    function buildConfigScroller() {
      statusEl = createEl('span', {
        id: 'twfoxtetrio-config-status',
        className: 'twfox-badge',
        text: 'CHANGES SAVED AUTOMATICALLY'
      });

      const resetBtn = createEl('button', {
        id: 'twfoxtetrio-reset-defaults',
        className: 'twfox-btn is-pri',
        text: 'RESET DEFAULTS',
        type: 'button',
        attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
      });
      resetBtn.addEventListener('click', function () {
        const nextCfg = typeof runtimeApi.resetConfig === 'function'
          ? runtimeApi.resetConfig()
          : runtimeApi.getConfig();
        syncConfigControls(nextCfg);
        if (statusEl) statusEl.textContent = 'RESET TO DEFAULTS';
      });

      const blocks = CONFIG_SECTIONS.map(buildConfigSection);
      blocks.push(
        createEl('div', { className: 'scroller_block twfox-scroller-header' }, [statusEl, resetBtn])
      );

      return createEl(
        'div',
        {
          id: 'twfoxtetrio-pane-config',
          className: 'right_scroller hidden thidden twfox-native-scroller',
          attrs: { 'data-menuview': 'foxmod_config' }
        },
        blocks
      );
    }

    function buildCreditsScroller() {
      const githubLink = createEl('a', {
        id: 'twfoxtetrio-github-link',
        className: 'twfox-btn is-pri',
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

      const rows = CREDIT_ITEMS.map((item) =>
        createEl('div', { className: 'twfox-native-row' }, [
          createEl('div', {}, [
            createEl('span', { className: 'twfox-native-label', text: item.name }),
            createEl('span', { className: 'twfox-native-desc', text: item.detail })
          ])
        ])
      );

      return createEl(
        'div',
        {
          id: 'twfoxtetrio-pane-credits',
          className: 'right_scroller hidden thidden twfox-native-scroller',
          attrs: { 'data-menuview': 'foxmod_credits' }
        },
        [
          createEl('div', { className: 'scroller_block twfox-scroller-header' }, [
            createEl('div', {}, [
              createEl('h1', { text: 'FOXMOD // TWFOXTETRIO' }),
              createEl('p', {
                className: 'twfox-credits-author',
                text: `Modded By: TWFoxcrack · v${runtimeApi.version}`
              })
            ]),
            githubLink
          ]),
          createEl('div', { className: 'scroller_block' }, rows),
          createEl('div', { className: 'scroller_block' }, [
            createEl('p', {
              text:
                'Visual HUD trackers & standalone offline/P2P FOXMOD modes. Never modifies official TETR.IO server physics or network packets.'
            })
          ])
        ]
      );
    }

    function ensureNativeScrollers() {
      if (scrollersInjected) return;
      const menusEl = document.getElementById('menus');
      if (!menusEl) return;
      scrollersInjected = true;

      const built = [
        ['foxmod', buildHubScroller()],
        ['foxmod_practice', buildPracticeMenuScroller()],
        ['foxmod_pentomino', buildPentominoStageScroller()],
        ['foxmod_multi', buildMultiScroller()],
        ['foxmod_config', buildConfigScroller()],
        ['foxmod_credits', buildCreditsScroller()]
      ];
      for (const [viewKey, scroller] of built) {
        scrollerMap.set(viewKey, scroller);
        menusEl.appendChild(scroller);
      }

      const backBtn = document.getElementById('back');
      if (backBtn && !backHooked) {
        backHooked = true;
        backBtn.addEventListener(
          'click',
          function (ev) {
            if (!activeFoxView) return;
            if (typeof ev.preventDefault === 'function') ev.preventDefault();
            if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
            if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
            goBack();
          },
          true
        );
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
          createEl('div', { className: 'twfox-menu-svg', html: ICONS.fox }),
          createEl('h1', { text: 'FOXMOD' }),
          createEl('p', { text: 'practica, salas P2P, config & credits' })
        ]
      );
      btn.addEventListener('click', function () {
        navigateMenu('foxmod');
      });

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
        if (!activeFoxView || !ev) return;
        if (ev.key === 'Escape' || ev.code === 'Escape') {
          if (typeof ev.preventDefault === 'function') ev.preventDefault();
          if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
          if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
          goBack();
          return;
        }
        if (isTextInputTarget(ev.target)) return;
        const activeCtrl =
          activeFoxView === 'foxmod_pentomino'
            ? practiceController
            : activeFoxView === 'foxmod_multi' && multiSubMode === 'playing'
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
        if (!activeFoxView || !ev) return;
        if (practiceController) practiceController.handleKeyUp(ev);
        if (multiController) multiController.handleKeyUp(ev);
      },
      true
    );

    ensureHomeButton();
    ensureNativeScrollers();

    const menusEl = document.getElementById('menus');
    if (menusEl && typeof root.MutationObserver === 'function') {
      const menuObserver = new root.MutationObserver(function () {
        if (isNavigatingInternal || !activeFoxView) return;
        const menuType = menusEl.getAttribute('data-menu-type');
        if (menusEl.classList.contains('hidden') || (menuType && !menuType.startsWith('foxmod'))) {
          hideFoxmodScrollersImmediately();
        }
      });
      menuObserver.observe(menusEl, {
        attributes: true,
        attributeFilter: ['class', 'data-menu-type']
      });
    }

    runtimeApi.subscribe(function (state, cfg) {
      ensureHomeButton();
      ensureNativeScrollers();
      if (state && (state.inGame || state.inMultiplayer) && activeFoxView) {
        hideFoxmodScrollersImmediately();
        return;
      }
      if (activeFoxView === 'foxmod_config') {
        syncConfigControls(cfg);
      }
    });
  }

  api.registerFeature('foxmod-menu', initFoxmodMenu);
}(typeof globalThis !== 'undefined' ? globalThis : window));
