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
  position: fixed !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  width: auto !important;
  height: auto !important;
  max-width: 100vw !important;
  max-height: 100vh !important;
  padding: 0 !important;
  margin: 0 !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  background: transparent !important;
  text-align: center;
}
.twfox-stage-inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
}
.twfox-stage-corner-controls {
  position: fixed;
  left: 14px;
  bottom: 14px;
  z-index: 6;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.twfox-corner-back-btn {
  position: fixed;
  left: 0;
  top: 0.35em;
  z-index: 8;
  transform: translateX(-1.2em);
  background-color: #120e18;
  border: 0;
  border-top: 3px solid #2b2238;
  border-right: 3px solid #211a2c;
  border-bottom: 3px solid #09070d;
  color: #fffb;
  font-family: HUN, sans-serif;
  font-size: 1.5em;
  padding: .3em .85em .28em 2em;
  border-radius: 3px;
  cursor: pointer;
  transition: .25s transform, .25s filter;
}
.twfox-corner-back-btn:hover {
  transform: translateX(-.4em);
  filter: brightness(1.25);
}
body.twfox-ingame #header,
body.twfox-ingame #footer,
body.twfox-ingame #menus > #header_text,
body.twfox-ingame #menus > #footer {
  opacity: 0 !important;
  pointer-events: none !important;
}
.twfox-game-canvas {
  background: transparent;
  display: block;
  width: auto;
  height: auto;
  max-width: 96%;
  max-height: 92%;
}
#twfoxtetrio-multi-canvas {
  max-width: calc(100% - 280px);
  max-height: 92%;
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
#twfoxtetrio-multi-request {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.84);
  z-index: 9999999;
  opacity: 0;
  pointer-events: none;
  transition: .3s opacity;
}
#twfoxtetrio-multi-request.is-open {
  opacity: 1;
  pointer-events: all;
}
#twfoxtetrio-multi-request .right_scroller {
  transform: translateX(30vw);
  transition: .45s transform, .45s opacity;
}
#twfoxtetrio-multi-request.is-open .right_scroller {
  transform: translateX(0);
  opacity: 1;
  pointer-events: all;
}
#twfoxtetrio-req-back {
  position: fixed;
  left: 0;
  top: 4em;
  width: fit-content;
  transform: translateX(-2em);
  background-color: #242424;
  border-top: 3px solid #3d3d3d;
  border-right: 3px solid #181818;
  border-bottom: 3px solid #0e0e0e;
  box-shadow: 0 0 8px #000;
  color: #c9c9c9;
  font-family: HUN, sans-serif;
  font-size: 1.8em;
  border-radius: 3px;
  padding: .45em .7em .35em 3.2em;
  cursor: pointer;
  z-index: 2;
  transition: .3s transform, .3s filter;
}
#twfoxtetrio-req-back:hover {
  transform: translateX(-1em);
  filter: brightness(1.25);
}
#twfoxtetrio-multi-request .scroller_item {
  background-color: #1a161d;
  border-top: 3px solid #453351;
  border-left: 3px solid #392e40;
  border-bottom: 3px solid #0a080b;
}
#twfoxtetrio-multi-request .scroller_item > h1 { color: #dac8e7; }
#twfoxtetrio-multi-request .scroller_item > p { color: #7c6b88; }
#menus[data-menu-type='foxmod_multi'] #header_text,
#menus[data-menu-type='foxmod_multi'] #back,
#menus[data-menu-type='foxmod_multi'] #footer {
  opacity: 0;
  pointer-events: none;
  transition: .3s opacity;
}
#twfoxtetrio-pane-multi {
  position: fixed !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  width: auto !important;
  height: auto !important;
  max-width: 100vw !important;
  max-height: 100vh !important;
  padding: 0 !important;
  margin: 0 !important;
  background: transparent !important;
  text-align: left;
  overflow: hidden !important;
  box-sizing: border-box !important;
}
#twfoxtetrio-multi-lobby {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}
#twfoxtetrio-lobby-top {
  position: relative;
  flex: 0 0 auto;
  width: 100%;
  height: 3.9em;
  pointer-events: none;
  z-index: 4;
}
#twfoxtetrio-leave-room-btn {
  pointer-events: all;
  position: absolute;
  left: 0;
  top: .2em;
  transform: translateX(-1.2em);
  background-color: #120e18;
  border-top: 3px solid #2b2238;
  border-right: 3px solid #211a2c;
  border-bottom: 3px solid #09070d;
  color: #fffb;
  font-family: HUN, sans-serif;
  font-size: 1.75em;
  padding: .32em .8em .28em 2.2em;
  border-radius: 3px;
  cursor: pointer;
  transition: .25s transform, .25s filter;
}
#twfoxtetrio-leave-room-btn:hover {
  transform: translateX(-.4em);
  filter: brightness(1.25);
}
#twfoxtetrio-lobby-invite-banner {
  pointer-events: all;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: min(22em, calc(100vw - 14em));
  top: 0.25em;
  height: 3.35em;
  background-color: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 4px 8px rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  text-align: center;
  cursor: pointer;
  transition: .2s filter;
}
#twfoxtetrio-lobby-invite-banner:hover { filter: brightness(1.25); }
.twfox-invite-sub { color: rgba(255, 255, 255, 0.45); font-size: 0.8em; letter-spacing: 0.08em; margin-top: 3px; }
.twfox-invite-id { color: #ffffff; font-size: 1.55em; font-weight: 900; letter-spacing: 0.08em; }
.twfox-lobby-grid {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(14em, 24%) minmax(0, 1fr) minmax(14em, 24%);
  gap: 0.75em;
  padding: 0.2em 0.5em 0.5em;
  box-sizing: border-box;
}
.twfox-lobby-col {
  background-color: rgba(0, 0, 0, 0.45);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.twfox-col-heading {
  margin: 0.45em 0.7em 0.35em;
  font-family: HUN, sans-serif;
  font-size: 2em;
  font-weight: 800;
  color: #ffffff;
  text-shadow: 0 2px 6px #000;
}
.twfox-col-heading.right { text-align: right; }
.twfox-col-heading.center { text-align: center; margin-bottom: 0.2em; }
.twfox-player-list {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0 0.7em 0.7em;
  display: flex;
  flex-direction: column;
  gap: 0.45em;
}
.twfox-player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55em 0.8em;
  background: linear-gradient(90deg, #2b2139 0%, #1c1626 100%);
  border-top: 2px solid #4f3b69;
  border-left: 2px solid #3c2e50;
  border-bottom: 2px solid #0e0a14;
  border-radius: 3px;
  color: #fff;
  font-weight: 800;
}
.twfox-lobby-tabs {
  display: flex;
  width: 100%;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.twfox-room-tab {
  flex: 1 1 0;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(to bottom, rgba(170,170,170,0.14) 0, transparent 100%);
  font-family: HUN, sans-serif;
  text-align: center;
  color: #aaa;
  padding: .42em 0;
  font-size: 1.35em;
  font-weight: 800;
  cursor: pointer;
  transition: .25s filter, .25s color;
}
.twfox-room-tab:hover { filter: brightness(1.3); color: #ddd; }
.twfox-room-tab.active {
  background: linear-gradient(to bottom, #fff 0, #fff 3px, rgba(170,170,170,0.28) 3px, transparent 100%);
  color: #fff;
}
.twfox-room-center-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.45);
  padding: 1em 1.2em;
  display: flex;
  flex-direction: column;
  gap: 0.8em;
}
.twfox-room-opt-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0.55em 0;
  border-top: 1px solid rgba(255,255,255,0.08);
  color: #c9b9db;
  font-size: 1.15em;
  font-weight: 700;
}
.twfox-room-opt-row:first-of-type { border-top: 0; }
.twfox-room-savebar {
  background: linear-gradient(to bottom, transparent 0, rgba(170,170,170,0.15) 100%);
  text-align: center;
  color: #d6c8eb;
  font-family: HUN, sans-serif;
  font-size: 1.4em;
  font-weight: 800;
  padding: .45em 0.6em;
}
.twfox-chat-log {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0 0.8em 0.5em;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: monospace;
  font-size: 0.95em;
}
.twfox-chat-bar {
  padding: 0.5em 0.7em 0.7em;
  display: flex;
  gap: 6px;
}
.twfox-chat-bar .twfox-input { flex: 1 1 auto; min-width: 0; }
.twfox-lobby-footer {
  flex: 0 0 auto;
  width: 100%;
  box-sizing: border-box;
  min-height: 3.4em;
  background: linear-gradient(to bottom, #1c1328 0%, #2a1a3d 100%);
  border-top: 2px solid #493066;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0.28em 1.2em;
}
.twfox-footer-wing-btn {
  justify-self: start;
  cursor: pointer;
  color: #d4b9f5;
  font-family: HUN, sans-serif;
  font-size: 1.5em;
  font-weight: 800;
  text-align: left;
  transition: .2s filter;
}
.twfox-footer-wing-btn span {
  display: block;
  font-size: 0.45em;
  color: #9378b5;
}
.twfox-footer-start-btn {
  background: linear-gradient(to bottom, #3b2754 0%, #221633 100%);
  border: 2px solid #7651a8;
  border-bottom-color: #160c24;
  border-radius: 4px;
  color: #e6d5ff;
  font-family: HUN, sans-serif;
  font-size: 1.55em;
  line-height: 1.08;
  font-weight: 900;
  padding: 0.18em 2.1em;
  cursor: pointer;
  text-align: center;
  box-shadow: 0 0 16px rgba(130, 80, 200, 0.35);
  transition: .2s filter, .1s transform;
}
.twfox-footer-start-btn:hover { filter: brightness(1.22); }
.twfox-footer-start-btn.is-disabled,
.twfox-footer-start-btn:disabled {
  opacity: 0.42;
  filter: grayscale(0.45);
  cursor: not-allowed;
  box-shadow: none;
}
.twfox-footer-start-btn.is-disabled:hover,
.twfox-footer-start-btn:disabled:hover {
  filter: grayscale(0.45);
}
.twfox-footer-start-btn span {
  display: block;
  font-size: 0.42em;
  font-weight: 700;
  color: #b79ce0;
}
.twfox-footer-mode-tag {
  justify-self: end;
  font-family: HUN, sans-serif;
  font-size: 1.45em;
  font-weight: 800;
  color: #b79ce0;
  letter-spacing: 0.06em;
}
.twfox-multi-arena {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 16px;
  max-width: 100vw;
  max-height: 96vh;
  padding: 0 12px;
  box-sizing: border-box;
}
.twfox-multi-side-col {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  min-width: 245px;
  max-width: 340px;
}
.twfox-score-lb {
  background: rgba(18, 22, 34, 0.88);
  border: 1px solid #354160;
  border-radius: 5px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  text-align: left;
  font-family: HUN, sans-serif;
}
.twfox-score-lb-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(31, 39, 60, 0.9);
  border-bottom: 1px solid #354160;
  font-size: 1.05em;
  font-weight: 800;
  color: #dbe4ff;
  letter-spacing: 0.06em;
}
.twfox-score-lb-rows {
  display: flex;
  flex-direction: column;
}
.twfox-score-lb-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 5px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 1.02em;
  font-weight: 800;
  color: #e6ecff;
}
.twfox-score-lb-row:first-child { border-top: 0; }
.twfox-score-lb-row.is-first { color: #ffe066; }
.twfox-score-lb-row.is-self { background: rgba(30, 86, 132, 0.65); }
.twfox-score-lb-row.is-ko { opacity: 0.58; }
.twfox-score-lb-val {
  font-variant-numeric: tabular-nums;
  color: #ffffff;
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
.twfox-invite-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.twfox-code-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(18, 12, 28, 0.88);
  border: 2px solid #634292;
  border-radius: 4px;
}
.twfox-code-value {
  font-family: HUN, monospace;
  font-size: 2.2em;
  font-weight: 900;
  letter-spacing: 0.14em;
  color: #ffffff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}
.twfox-code-input {
  font-family: HUN, monospace;
  font-size: 1.4em;
  font-weight: 800;
  letter-spacing: 0.1em;
}
.twfox-fallback-panel {
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.twfox-native-scroller .hidden,
.twfox-stage-scroller .hidden,
#twfoxtetrio-pane-multi .hidden {
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

  function resolveLocalUsername(runtimeApi, fallback) {
    const meEl = document.getElementById('me_username');
    const domName = meEl && typeof meEl.textContent === 'string' ? meEl.textContent.trim() : '';
    const stateName = runtimeApi && typeof runtimeApi.getState === 'function'
      ? String(runtimeApi.getState().selfUsername || '').trim()
      : '';
    const chosen = domName || stateName || fallback || 'PLAYER';
    return String(chosen).trim().slice(0, 20).toUpperCase();
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
    let multiSubMode = 'lobby';
    let multiRequestEl = null;
    let multiRequestOpen = false;
    let multiDom = null;

    function syncIngameChromeClass() {
      if (!document.body || !document.body.classList) return;
      const inStage =
        activeFoxView === 'foxmod_pentomino' ||
        (activeFoxView === 'foxmod_multi' && multiSubMode === 'playing');
      setClass(document.body, 'twfox-ingame', inStage);
    }

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

    function closeMultiRequest() {
      multiRequestOpen = false;
      if (multiRequestEl) {
        multiRequestEl.classList.remove('is-open');
      }
    }

    function openMultiRequest() {
      ensureNativeScrollers();
      if (!multiRequestEl) return;
      multiRequestOpen = true;
      multiRequestEl.classList.add('is-open');
    }

    function hideFoxmodScrollersImmediately() {
      closeMultiRequest();
      activeFoxView = null;
      syncIngameChromeClass();
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
      syncIngameChromeClass();

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
          if (cardSpec.view === 'foxmod_multi') {
            openMultiRequest();
          } else {
            navigateMenu(cardSpec.view);
          }
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
        attrs: { width: '640', height: '620' }
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
            practiceCanvas,
            createEl('div', { className: 'twfox-stage-corner-controls' }, [pieceSelect, modeSelect, restartBtn])
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
      multiSubMode = 'lobby';
      syncIngameChromeClass();
    }

    function showMultiSubMode(nextSub) {
      multiSubMode = nextSub;
      syncIngameChromeClass();
      if (!multiDom) return;
      setClass(multiDom.joinBox, 'hidden', nextSub !== 'join');
      setClass(multiDom.hostInviteBox, 'hidden', nextSub === 'join');
      setClass(multiDom.lobbyView, 'hidden', nextSub === 'playing');
      setClass(multiDom.gameView, 'hidden', nextSub !== 'playing');
      if (nextSub === 'join') {
        multiDom.setCenterTab('invite');
      }
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
        const cfg = detail.config || {};
        const matchMode = cfg.gameMode === 'blitz' ? 'blitz' : 'vs';
        multiGame = pentominoEngine.createGame({
          pieceSet: cfg.pieceSet || 'tetromino',
          mode: matchMode,
          seed: detail.seed,
          blitzDurationMs: cfg.blitzDurationMs || 120000,
          gravityLevel: cfg.gravityLevel || 1,
          garbageMultiplier: cfg.garbageMultiplier || 1,
          onAttack(amount, callout) {
            if (peerSession && matchMode === 'vs') peerSession.sendSelfAttack(amount, callout);
          },
          onTopOut() {
            if (peerSession) peerSession.reportSelfKo();
          },
          onFinish(gSnap) {
            if (peerSession && typeof peerSession.reportSelfFinish === 'function') {
              peerSession.reportSelfFinish(gSnap);
            }
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
      const roomCode = (snap.room && snap.room.roomCode) || '';
      const activeMode = (snap.room && snap.room.gameMode) === 'blitz' ? 'blitz' : 'vs';
      const activeSet = (snap.room && snap.room.pieceSet) || 'tetromino';
      multiDom.lobbyRoomTitle.textContent = snap.room.roomName || 'FOXMOD ROOM';
      if (multiDom.invitePillCode) {
        multiDom.invitePillCode.textContent = roomCode ? `#${roomCode}` : '#JOIN';
      }
      if (multiDom.inviteBannerSub) {
        multiDom.inviteBannerSub.textContent = isHost
          ? 'CLICK TO COPY ROOM CODE'
          : roomCode
            ? 'ROOM CODE · CLICK TO COPY'
            : 'ENTER #CODE TO JOIN';
      }
      if (multiDom.hostRoomCodeLabel) {
        multiDom.hostRoomCodeLabel.textContent = roomCode ? `#${roomCode}` : '#----';
      }
      const setLabel = activeSet === 'chaos' ? 'CAOS MIX' : activeSet === 'pentomino' ? 'PENTOMINOS' : 'NORMAL';
      const modeLabel = activeMode === 'blitz' ? 'BLITZ' : 'VS';
      multiDom.lobbyModeTag.textContent = `${setLabel} ${modeLabel}`;
      multiDom.roomInfoOwner.textContent = isHost ? 'YOU (HOST SERVER)' : 'REMOTE HOST SERVER';
      multiDom.roomInfoStatus.textContent = String(snap.room.status || 'lobby').toUpperCase();

      if (multiSubMode !== 'join') {
        setClass(multiDom.joinBox, 'hidden', true);
        setClass(multiDom.hostInviteBox, 'hidden', !isHost);
      }
      setClass(multiDom.hostStartBtn, 'hidden', !isHost);
      setClass(multiDom.clientReadyBtn, 'hidden', isHost);

      const count = (snap.players || []).length;
      const canStart = count >= 2;
      multiDom.playersHeading.textContent = `PLAYERS (${count})`;
      multiDom.hostStartBtn.disabled = !canStart;
      setClass(multiDom.hostStartBtn, 'is-disabled', !canStart);
      multiDom.startCountSub.textContent = canStart
        ? `${count} PLAYERS`
        : `NEED 2+ PLAYERS (${count}/2)`;

      if (multiDom.pieceSelect) {
        multiDom.pieceSelect.value = activeSet;
        multiDom.pieceSelect.disabled = !isHost;
      }
      if (multiDom.modeSelect) {
        multiDom.modeSelect.value = activeMode;
        multiDom.modeSelect.disabled = !isHost;
      }
      if (multiDom.garbageSelect) {
        multiDom.garbageSelect.value = String(snap.room.garbageMultiplier ?? 1);
        multiDom.garbageSelect.disabled = !isHost;
      }
      if (multiDom.gravitySelect) {
        multiDom.gravitySelect.value = String(snap.room.gravityLevel || 1);
        multiDom.gravitySelect.disabled = !isHost;
      }

      const hasWinner = snap.room.status === 'results' && snap.room.winner;
      multiDom.winnerBanner.textContent = evType === 'start_blocked'
        ? 'NEED AT LEAST 2 PLAYERS TO START'
        : hasWinner
          ? `WINNER RONDA #${snap.room.round}: ${snap.room.winner}`
          : isHost
            ? (snap.signalingStatus === 'offline'
                ? 'MANUAL FALLBACK ACTIVE'
                : roomCode
                  ? `HOST SERVER ACTIVE · CODE #${roomCode}`
                  : 'HOST SERVER ACTIVE')
            : snap.connected
              ? 'CONNECTED TO HOST SERVER'
              : 'ENTER #CODE TO JOIN';

      multiDom.playersList.innerHTML = '';
      for (const p of snap.players || []) {
        const roleTag = p.isHost ? 'HOST' : p.ready ? 'READY' : 'WAIT';
        multiDom.playersList.appendChild(
          createEl('div', { className: 'twfox-player-row' }, [
            createEl('span', { text: p.name }),
            createEl('span', { className: 'twfox-badge', text: `${roleTag} · ${p.wins || 0}/${snap.room.round || 0}` })
          ])
        );
      }

      multiDom.chatLog.innerHTML = '';
      if (!snap.chat || snap.chat.length === 0) {
        multiDom.chatLog.appendChild(
          createEl('div', {
            style: 'color:#8a7ca3',
            text: 'Welcome to FOXMOD P2P chat! Host PC acts as the room server.'
          })
        );
      } else {
        for (const entry of snap.chat) {
          multiDom.chatLog.appendChild(
            createEl('div', {
              style: entry.system ? 'color:#ffbe8e' : 'color:#dce4ff',
              text: entry.system ? `* ${entry.text}` : `${entry.author}: ${entry.text}`
            })
          );
        }
      }

      if (multiSubMode === 'playing' && foxmodCanvas) {
        const selfId = isHost ? 'host' : snap.selfId;
        const rankedPlayers = (snap.players || []).slice().sort(
          (a, b) => ((Number(b.score) || 0) - (Number(a.score) || 0)) || ((b.lines || 0) - (a.lines || 0))
        );
        if (multiDom.scoreLbCount) {
          multiDom.scoreLbCount.textContent = String(rankedPlayers.length);
        }
        if (multiDom.scoreLbRows) {
          multiDom.scoreLbRows.innerHTML = '';
          rankedPlayers.forEach((pl, idx) => {
            const isSelf = pl.id === selfId;
            const classes = [
              'twfox-score-lb-row',
              idx === 0 ? 'is-first' : '',
              isSelf ? 'is-self' : '',
              pl.alive === false ? 'is-ko' : ''
            ].filter(Boolean).join(' ');
            const koTag = pl.alive === false ? ' [KO]' : '';
            multiDom.scoreLbRows.appendChild(
              createEl('div', { className: classes }, [
                createEl('span', { text: `Nº${idx + 1} ${pl.name}${koTag}` }),
                createEl('span', {
                  className: 'twfox-score-lb-val',
                  text: Math.round(Number(pl.score) || 0).toLocaleString('en-US')
                })
              ])
            );
          });
        }

        const opponents = (snap.players || []).filter((p) => p.id !== selfId);
        multiDom.opponentsGrid.innerHTML = '';
        for (const opp of opponents) {
          const miniCanvas = createEl('canvas', {
            attrs: { width: '100', height: '200' },
            style: 'background:#000;display:block;'
          });
          foxmodCanvas.renderMiniBoard(miniCanvas, opp.board, opp.alive);
          const oppScore = Math.round(Number(opp.score) || 0).toLocaleString('en-US');
          multiDom.opponentsGrid.appendChild(
            createEl('div', { className: 'twfox-opp-card' }, [
              createEl('div', { style: 'font-weight:800;margin-bottom:4px;color:#fff', text: opp.name }),
              miniCanvas,
              createEl('div', { style: 'margin-top:4px;color:#9aa8cf', text: `${oppScore} PTS · L:${opp.lines || 0}` })
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
      // Top bar (EXIT & clickable room #CODE pill matching TETR.IO lobby top chrome)
      const leaveRoomBtn = createEl('div', {
        id: 'twfoxtetrio-leave-room-btn',
        className: 'ns',
        text: 'EXIT',
        attrs: { 'data-hover': 'hover', 'data-hit': 'back' }
      });
      const inviteBannerSub = createEl('div', { className: 'twfox-invite-sub', text: 'CLICK TO COPY ROOM CODE' });
      const invitePillCode = createEl('div', { id: 'twfoxtetrio-lobby-invite-code', className: 'twfox-invite-id', text: '#----' });
      const inviteBanner = createEl('div', { id: 'twfoxtetrio-lobby-invite-banner', className: 'ns', attrs: { 'data-hover': 'tap', 'data-hit': 'click' } }, [
        inviteBannerSub,
        invitePillCode
      ]);

      // Left column: PLAYERS
      const playersHeading = createEl('h1', { className: 'twfox-col-heading ns', text: 'PLAYERS (1)' });
      const playersList = createEl('div', { id: 'twfoxtetrio-lobby-players', className: 'twfox-player-list' });

      // Center column tabs: INVITE / ROOM / GAME
      const lobbyRoomTitle = createEl('h1', {
        id: 'twfoxtetrio-lobby-room-title',
        className: 'twfox-col-heading center ns',
        text: 'FOXMOD PRIVATE ROOM'
      });

      const tabInviteBtn = createEl('div', { id: 'twfoxtetrio-lobby-tab-invite', className: 'twfox-room-tab active', text: 'INVITE', attrs: { 'data-hover': 'tap', 'data-hit': 'click' } });
      const tabRoomBtn = createEl('div', { id: 'twfoxtetrio-lobby-tab-room', className: 'twfox-room-tab', text: 'ROOM', attrs: { 'data-hover': 'tap', 'data-hit': 'click' } });
      const tabGameBtn = createEl('div', { id: 'twfoxtetrio-lobby-tab-game', className: 'twfox-room-tab', text: 'GAME', attrs: { 'data-hover': 'tap', 'data-hit': 'click' } });

      // INVITE pane: primary 4-char #CODE card + collapsible manual P2P fallback
      const hostRoomCodeLabel = createEl('div', { id: 'twfoxtetrio-host-room-code', className: 'twfox-code-value', text: '#----' });
      const hostCopyCodeBtn = createEl('button', { id: 'twfoxtetrio-host-copy-code', className: 'twfox-btn is-pri', text: 'COPY CODE', type: 'button' });
      const hostInviteStatus = createEl('p', { style: 'margin:0;color:#b89de0;', text: 'Share this code on Discord — your PC acts as the room server.' });

      const hostGenInviteBtn = createEl('button', { id: 'twfoxtetrio-host-gen-invite', className: 'twfox-btn', text: '+ MANUAL INVITE', type: 'button' });
      const hostCopyInviteBtn = createEl('button', { id: 'twfoxtetrio-host-copy-invite', className: 'twfox-btn', text: 'COPY FOX1', type: 'button' });
      const hostOfferOutput = createEl('textarea', {
        id: 'twfoxtetrio-host-offer-output',
        className: 'twfox-textarea',
        attrs: { readonly: 'true', placeholder: 'Manual FOX1:... offer appears here' }
      });
      const hostAnswerInput = createEl('textarea', {
        id: 'twfoxtetrio-host-answer-input',
        className: 'twfox-textarea',
        attrs: { placeholder: 'Paste FOXR/FOX1 reply code from friend here' }
      });
      const hostAcceptBtn = createEl('button', { id: 'twfoxtetrio-host-accept-btn', className: 'twfox-btn is-pri', text: 'CONNECT PLAYER', type: 'button' });
      const hostManualPanel = createEl('div', { id: 'twfoxtetrio-host-manual-panel', className: 'twfox-fallback-panel hidden' }, [
        createEl('p', { style: 'margin:0;color:#8c7ba6;', text: 'Manual WebRTC fallback (no signaling server needed):' }),
        createEl('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;' }, [hostGenInviteBtn, hostCopyInviteBtn]),
        hostOfferOutput,
        hostAnswerInput,
        hostAcceptBtn
      ]);
      const hostManualToggleBtn = createEl('button', {
        id: 'twfoxtetrio-host-manual-toggle',
        className: 'twfox-btn',
        text: 'MANUAL P2P FALLBACK ▾',
        type: 'button',
        style: 'align-self:flex-start;'
      });
      hostManualToggleBtn.addEventListener('click', function () {
        setClass(hostManualPanel, 'hidden', !hostManualPanel.classList.contains('hidden'));
      });

      const hostInviteBox = createEl('div', { id: 'twfoxtetrio-host-invite-box', className: 'twfox-invite-stack' }, [
        createEl('p', { style: 'margin:0;color:#c9b9db;', text: 'ROOM INVITE CODE — Friends enter this #CODE in JOIN LOBBY:' }),
        createEl('div', { className: 'twfox-code-card' }, [hostRoomCodeLabel, hostCopyCodeBtn]),
        hostInviteStatus,
        hostManualToggleBtn,
        hostManualPanel
      ]);

      const joinOfferInput = createEl('input', {
        id: 'twfoxtetrio-join-offer-input',
        className: 'twfox-input twfox-code-input',
        attrs: { type: 'text', placeholder: '#K7M4  (or paste FOX1:... invite)' }
      });
      const joinGenerateBtn = createEl('button', { id: 'twfoxtetrio-join-generate-btn', className: 'twfox-btn is-pri', text: 'JOIN ROOM', type: 'button' });
      const joinStatus = createEl('p', { id: 'twfoxtetrio-join-status', style: 'margin:0;color:#b89de0;', text: '' });
      const joinAnswerOutput = createEl('textarea', {
        id: 'twfoxtetrio-join-answer-output',
        className: 'twfox-textarea',
        attrs: { readonly: 'true', placeholder: 'Send this generated FOX1 reply back to Host' }
      });
      const joinCopyBtn = createEl('button', { id: 'twfoxtetrio-join-copy-btn', className: 'twfox-btn', text: 'COPY REPLY', type: 'button' });
      const joinManualReplyBox = createEl('div', { id: 'twfoxtetrio-join-manual-reply', className: 'twfox-fallback-panel hidden' }, [
        joinAnswerOutput,
        joinCopyBtn
      ]);
      const joinBox = createEl('div', { id: 'twfoxtetrio-multi-join', className: 'twfox-invite-stack hidden' }, [
        createEl('p', { style: 'margin:0;color:#c9b9db;', text: 'ENTER ROOM CODE (#XXXX) TO JOIN AUTOMATICALLY:' }),
        joinOfferInput,
        createEl('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;' }, [joinGenerateBtn]),
        joinStatus,
        joinManualReplyBox
      ]);

      const centerTabInvite = createEl('div', { id: 'twfoxtetrio-center-invite' }, [hostInviteBox, joinBox]);

      // ROOM pane
      const roomInfoOwner = createEl('span', { text: 'HOST SERVER' });
      const roomInfoStatus = createEl('span', { text: 'LOBBY' });
      const centerTabRoom = createEl('div', { id: 'twfoxtetrio-center-room', className: 'hidden' }, [
        createEl('div', { className: 'twfox-room-opt-row' }, [createEl('span', { text: 'SERVER AUTHORITY' }), roomInfoOwner]),
        createEl('div', { className: 'twfox-room-opt-row' }, [createEl('span', { text: 'ROOM STATUS' }), roomInfoStatus]),
        createEl('div', { className: 'twfox-room-opt-row' }, [createEl('span', { text: 'TOPOLOGY' }), createEl('span', { text: 'WEBRTC DIRECT P2P' })])
      ]);

      // GAME pane
      const modeSelect = createEl('select', { id: 'twfoxtetrio-room-mode', className: 'twfox-select' }, [
        createEl('option', { text: 'VERSUS KO', attrs: { value: 'vs' } }),
        createEl('option', { text: 'BLITZ (2:00)', attrs: { value: 'blitz' } })
      ]);
      const pieceSelect = createEl('select', { id: 'twfoxtetrio-room-pieces', className: 'twfox-select' }, [
        createEl('option', { text: 'NORMAL (7 TETROMINOS)', attrs: { value: 'tetromino' } }),
        createEl('option', { text: 'PENTOMINOS (12)', attrs: { value: 'pentomino' } }),
        createEl('option', { text: 'CAOS MIX (19)', attrs: { value: 'chaos' } })
      ]);
      const garbageSelect = createEl('select', { id: 'twfoxtetrio-room-garbage', className: 'twfox-select' }, [
        createEl('option', { text: '0.5x', attrs: { value: '0.5' } }),
        createEl('option', { text: '1x', attrs: { value: '1' } }),
        createEl('option', { text: '1.5x', attrs: { value: '1.5' } }),
        createEl('option', { text: '2x', attrs: { value: '2' } })
      ]);
      const gravitySelect = createEl('select', { id: 'twfoxtetrio-room-gravity', className: 'twfox-select' }, [
        createEl('option', { text: 'LEVEL 1', attrs: { value: '1' } }),
        createEl('option', { text: 'LEVEL 2', attrs: { value: '2' } }),
        createEl('option', { text: 'LEVEL 3', attrs: { value: '3' } }),
        createEl('option', { text: 'LEVEL 5', attrs: { value: '5' } })
      ]);
      const centerTabGame = createEl('div', { id: 'twfoxtetrio-center-game', className: 'hidden' }, [
        createEl('div', { className: 'twfox-room-opt-row' }, [createEl('span', { text: 'GAME MODE' }), modeSelect]),
        createEl('div', { className: 'twfox-room-opt-row' }, [createEl('span', { text: 'PIECE SET' }), pieceSelect]),
        createEl('div', { className: 'twfox-room-opt-row' }, [createEl('span', { text: 'GARBAGE MULTIPLIER' }), garbageSelect]),
        createEl('div', { className: 'twfox-room-opt-row' }, [createEl('span', { text: 'GRAVITY LEVEL' }), gravitySelect])
      ]);

      function setCenterTab(tabName) {
        setClass(tabInviteBtn, 'active', tabName === 'invite');
        setClass(tabRoomBtn, 'active', tabName === 'room');
        setClass(tabGameBtn, 'active', tabName === 'game');
        setClass(centerTabInvite, 'hidden', tabName !== 'invite');
        setClass(centerTabRoom, 'hidden', tabName !== 'room');
        setClass(centerTabGame, 'hidden', tabName !== 'game');
      }

      tabInviteBtn.addEventListener('click', () => setCenterTab('invite'));
      tabRoomBtn.addEventListener('click', () => setCenterTab('room'));
      tabGameBtn.addEventListener('click', () => setCenterTab('game'));

      const winnerBanner = createEl('div', { id: 'twfoxtetrio-multi-winner', className: 'twfox-room-savebar', text: 'HOST SERVER ACTIVE' });

      // Right column: CHAT
      const chatLog = createEl('div', { id: 'twfoxtetrio-lobby-chat', className: 'twfox-chat-log' });
      const chatInput = createEl('input', {
        id: 'twfoxtetrio-lobby-chat-input',
        className: 'twfox-input',
        attrs: { type: 'text', placeholder: 'message...' }
      });
      const chatSendBtn = createEl('button', { id: 'twfoxtetrio-lobby-chat-send', className: 'twfox-btn', text: 'SEND', type: 'button' });

      // Bottom 3-wing bar
      const clientReadyBtn = createEl('div', { id: 'twfoxtetrio-client-ready-btn', className: 'twfox-footer-wing-btn hidden' }, [
        createEl('div', { text: 'READY' }),
        createEl('span', { text: 'CLICK TO TOGGLE READY STATUS' })
      ]);
      const startCountSub = createEl('span', { text: 'NEED 2+ PLAYERS (1/2)' });
      const hostStartBtn = createEl('button', { id: 'twfoxtetrio-host-start-btn', className: 'twfox-footer-start-btn is-disabled', type: 'button', attrs: { 'data-hover': 'hover', 'data-hit': 'confirm' } }, [
        createEl('div', { text: 'START' }),
        startCountSub
      ]);
      hostStartBtn.disabled = true;
      const lobbyModeTag = createEl('div', { className: 'twfox-footer-mode-tag', text: 'NORMAL VS' });

      const lobbyView = createEl('div', { id: 'twfoxtetrio-multi-lobby' }, [
        createEl('div', { id: 'twfoxtetrio-lobby-top' }, [leaveRoomBtn, inviteBanner]),
        createEl('div', { className: 'twfox-lobby-grid' }, [
          createEl('div', { className: 'twfox-lobby-col' }, [playersHeading, playersList]),
          createEl('div', { className: 'twfox-lobby-col' }, [
            lobbyRoomTitle,
            createEl('div', { className: 'twfox-lobby-tabs' }, [tabInviteBtn, tabRoomBtn, tabGameBtn]),
            createEl('div', { className: 'twfox-room-center-scroll' }, [centerTabInvite, centerTabRoom, centerTabGame]),
            winnerBanner
          ]),
          createEl('div', { className: 'twfox-lobby-col' }, [
            createEl('h1', { className: 'twfox-col-heading right ns', text: 'CHAT' }),
            chatLog,
            createEl('div', { className: 'twfox-chat-bar' }, [chatInput, chatSendBtn])
          ])
        ]),
        createEl('div', { className: 'twfox-lobby-footer' }, [
          createEl('div', {}, [clientReadyBtn]),
          hostStartBtn,
          lobbyModeTag
        ])
      ]);

      // In-game VS / BLITZ stage with right-side score leaderboard & opponent mini boards
      multiCanvas = createEl('canvas', {
        id: 'twfoxtetrio-multi-canvas',
        className: 'twfox-game-canvas',
        attrs: { width: '640', height: '620' }
      });
      const scoreLbCount = createEl('span', { id: 'twfoxtetrio-multi-lb-count', text: '2' });
      const scoreLbRows = createEl('div', { id: 'twfoxtetrio-multi-lb-rows', className: 'twfox-score-lb-rows' });
      const scoreLeaderboard = createEl('div', { id: 'twfoxtetrio-multi-leaderboard', className: 'twfox-score-lb' }, [
        createEl('div', { className: 'twfox-score-lb-hdr' }, [
          createEl('span', { text: 'SCORE LEADERBOARD' }),
          scoreLbCount
        ]),
        scoreLbRows
      ]);
      const opponentsGrid = createEl('div', { id: 'twfoxtetrio-multi-opponents', className: 'twfox-opponents-grid' });
      const sideCol = createEl('div', { className: 'twfox-multi-side-col' }, [scoreLeaderboard, opponentsGrid]);
      const backLobbyBtn = createEl('button', {
        id: 'twfoxtetrio-back-lobby-btn',
        className: 'twfox-corner-back-btn ns',
        text: 'LOBBY',
        type: 'button',
        attrs: { 'data-hover': 'hover', 'data-hit': 'back' }
      });
      const gameView = createEl('div', { id: 'twfoxtetrio-multi-game', className: 'twfox-stage-inner hidden' }, [
        backLobbyBtn,
        createEl('div', { className: 'twfox-multi-arena' }, [multiCanvas, sideCol])
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
        lobbyView,
        gameView,
        lobbyRoomTitle,
        inviteBannerSub,
        invitePillCode,
        hostRoomCodeLabel,
        lobbyModeTag,
        playersHeading,
        startCountSub,
        roomInfoOwner,
        roomInfoStatus,
        hostInviteBox,
        joinBox,
        hostStartBtn,
        clientReadyBtn,
        modeSelect,
        pieceSelect,
        garbageSelect,
        gravitySelect,
        scoreLbCount,
        scoreLbRows,
        winnerBanner,
        playersList,
        chatLog,
        opponentsGrid,
        setCenterTab
      };

      // #list_request style picker overlay (CREATE LOBBY / JOIN LOBBY)
      const createBtn = createEl(
        'div',
        { id: 'twfoxtetrio-create-room-btn', className: 'scroller_item ns', attrs: { 'data-hover': 'hover', 'data-hit': 'hit2' } },
        [
          createEl('h1', { text: 'CREATE LOBBY' }),
          createEl('p', { text: 'create a custom P2P room where your PC acts as the server' })
        ]
      );
      const joinBtn = createEl(
        'div',
        { id: 'twfoxtetrio-join-room-btn', className: 'scroller_item ns', attrs: { 'data-hover': 'hover', 'data-hit': 'hit2' } },
        [
          createEl('h1', { text: 'JOIN LOBBY' }),
          createEl('p', { text: 'connect to a friend room using their short #CODE' })
        ]
      );
      const reqBackBtn = createEl('div', { id: 'twfoxtetrio-req-back', className: 'ns', text: 'BACK', attrs: { 'data-hover': 'hover', 'data-hit': 'back' } });
      reqBackBtn.addEventListener('click', closeMultiRequest);

      multiRequestEl = createEl('div', { id: 'twfoxtetrio-multi-request' }, [
        reqBackBtn,
        createEl('div', { className: 'right_scroller ns' }, [createBtn, joinBtn])
      ]);
      multiRequestEl.addEventListener('click', function (ev) {
        if (ev && ev.target === multiRequestEl) closeMultiRequest();
      });

      const menusHost = document.getElementById('menus') || document.body;
      if (menusHost) menusHost.appendChild(multiRequestEl);

      let pendingInvitePeerId = null;
      let copyNoticeTimer = null;

      function copyRoomShortCode() {
        const snap = peerSession && peerSession.getSnapshot ? peerSession.getSnapshot() : null;
        const code = snap && snap.room && snap.room.roomCode ? '#' + snap.room.roomCode : '';
        if (!code) return false;
        copyToClipboard(code);
        inviteBannerSub.textContent = `COPIED ${code}!`;
        if (snap && snap.role === 'host') {
          hostInviteStatus.textContent = `Code ${code} copied! Share it with friends to join.`;
        }
        if (typeof root.clearTimeout === 'function') root.clearTimeout(copyNoticeTimer);
        if (typeof root.setTimeout === 'function') {
          copyNoticeTimer = root.setTimeout(function () {
            inviteBannerSub.textContent = 'CLICK TO COPY ROOM CODE';
          }, 1600);
          if (copyNoticeTimer && typeof copyNoticeTimer.unref === 'function') copyNoticeTimer.unref();
        }
        return true;
      }

      createBtn.addEventListener('click', function () {
        closeMultiRequest();
        if (!p2pRoom) return;
        const hostName = resolveLocalUsername(runtimeApi, 'HOST');
        bindPeerSession(p2pRoom.createHostServer({ hostName }));
        hostOfferOutput.value = '';
        hostAnswerInput.value = '';
        setClass(hostManualPanel, 'hidden', true);
        setClass(joinManualReplyBox, 'hidden', true);
        hostInviteStatus.textContent = 'Share the #CODE above — waiting for players to connect...';
        setCenterTab('invite');
        showMultiSubMode('lobby');
        navigateMenu('foxmod_multi');
      });

      joinBtn.addEventListener('click', function () {
        closeMultiRequest();
        teardownPeerSession();
        joinOfferInput.value = '';
        joinAnswerOutput.value = '';
        joinStatus.textContent = '';
        setClass(joinManualReplyBox, 'hidden', true);
        joinGenerateBtn.disabled = false;
        invitePillCode.textContent = '#JOIN';
        inviteBannerSub.textContent = 'ENTER #CODE TO JOIN';
        lobbyRoomTitle.textContent = 'JOIN FOXMOD ROOM';
        playersHeading.textContent = 'PLAYERS (0)';
        playersList.innerHTML = '';
        chatLog.innerHTML = '';
        winnerBanner.textContent = 'ENTER #CODE TO JOIN';
        showMultiSubMode('join');
        navigateMenu('foxmod_multi');
      });

      leaveRoomBtn.addEventListener('click', function () {
        if (typeof root.clearTimeout === 'function') root.clearTimeout(copyNoticeTimer);
        teardownPeerSession();
        navigateMenu('foxmod');
      });

      backLobbyBtn.addEventListener('click', function () {
        showMultiSubMode('lobby');
      });

      async function generateHostInvite() {
        if (!peerSession || peerSession.getSnapshot().role !== 'host') return;
        hostInviteStatus.textContent = 'Generating manual WebRTC invite code...';
        try {
          const invite = await peerSession.createInvite();
          pendingInvitePeerId = invite.peerId;
          hostOfferOutput.value = invite.code;
          copyToClipboard(invite.code);
          hostInviteStatus.textContent = 'Manual FOX1 invite copied! Paste your friend reply below.';
        } catch (err) {
          hostInviteStatus.textContent = 'Error: ' + (err && err.message ? err.message : err);
        }
      }

      hostCopyCodeBtn.addEventListener('click', copyRoomShortCode);
      inviteBanner.addEventListener('click', copyRoomShortCode);
      hostGenInviteBtn.addEventListener('click', generateHostInvite);

      hostCopyInviteBtn.addEventListener('click', function () {
        if (hostOfferOutput.value) {
          copyToClipboard(hostOfferOutput.value);
          hostInviteStatus.textContent = 'Manual FOX1 invite copied to clipboard.';
        }
      });

      hostAcceptBtn.addEventListener('click', async function () {
        if (!peerSession || peerSession.getSnapshot().role !== 'host') return;
        try {
          await peerSession.acceptAnswer(pendingInvitePeerId, hostAnswerInput.value);
          hostAnswerInput.value = '';
          hostOfferOutput.value = '';
          pendingInvitePeerId = null;
          hostInviteStatus.textContent = 'Player connected to your Host Server!';
        } catch (err) {
          hostInviteStatus.textContent = 'Error: ' + (err && err.message ? err.message : err);
        }
      });

      async function handleJoinSubmit() {
        if (!p2pRoom) return;
        const rawCode = String(joinOfferInput.value || '').trim();
        if (!rawCode) {
          joinStatus.textContent = 'Enter a #CODE (e.g. K7M4) or FOX1 invite.';
          return;
        }
        joinGenerateBtn.disabled = true;
        setClass(joinManualReplyBox, 'hidden', true);
        joinStatus.textContent = 'Connecting to room...';
        try {
          const playerName = resolveLocalUsername(runtimeApi, 'PLAYER');
          const client = p2pRoom.createClientPeer({ playerName });
          bindPeerSession(client);
          const res = await client.joinByCode(rawCode);
          if (res && res.mode === 'manual' && res.answerCode) {
            joinAnswerOutput.value = res.answerCode;
            copyToClipboard(res.answerCode);
            setClass(joinManualReplyBox, 'hidden', false);
            joinStatus.textContent = 'Manual reply copied! Send it to the Host to finish connecting.';
          } else {
            joinStatus.textContent = `Connected to #${res.roomCode}! Opening WebRTC tunnel...`;
          }
        } catch (err) {
          joinStatus.textContent = 'Error: ' + (err && err.message ? err.message : err);
        } finally {
          joinGenerateBtn.disabled = false;
        }
      }

      joinGenerateBtn.addEventListener('click', handleJoinSubmit);
      joinOfferInput.addEventListener('keydown', function (ev) {
        if (ev && (ev.key === 'Enter' || ev.code === 'Enter')) handleJoinSubmit();
      });

      joinCopyBtn.addEventListener('click', function () {
        if (joinAnswerOutput.value) {
          copyToClipboard(joinAnswerOutput.value);
          joinStatus.textContent = 'Reply copied to clipboard.';
        }
      });

      function pushRoomConfigPatch() {
        if (!peerSession || peerSession.getSnapshot().role !== 'host') return;
        peerSession.updateSettings({
          gameMode: modeSelect.value,
          pieceSet: pieceSelect.value,
          garbageMultiplier: Number(garbageSelect.value),
          gravityLevel: Number(gravitySelect.value)
        });
      }

      modeSelect.addEventListener('change', pushRoomConfigPatch);
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
          className: 'right_scroller hidden thidden',
          attrs: { 'data-menuview': 'foxmod_multi' }
        },
        [lobbyView, gameView]
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
          if (multiRequestOpen) {
            closeMultiRequest();
          } else {
            goBack();
          }
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
