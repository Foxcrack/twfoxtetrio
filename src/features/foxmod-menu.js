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
    zen: buildPixelBadgeSvg(
      [
        '11111..11111.1...1',
        '....1..2.....11..1',
        '...2...2222..2.2.2',
        '..2....2.....2..22',
        '.3.....3.....3...3',
        '33333..33333.3...3'
      ],
      ['#fdb9ff', '#c953c7', '#6b2b69']
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
      subtitle: 'skins, tablero, SFX, fondos animados & ajustes HUD',
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
    },
    zen: {
      bagtype: '7-bag',
      spinbonuses: 'T-spins+',
      combotable: 'multiplier',
      kickset: 'SRS+',
      allclears: true,
      seed_random: true,
      can_retry: true,
      stock: 0,
      clutch: true,
      nolockout: true,
      boardwidth: 10,
      boardheight: 20,
      survivalmode: 'none',
      allow180: true,
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
      mission: 'ZEN',
      slot_counter1: '---empty---',
      slot_counter2: '---empty---',
      slot_counter3: '---empty---',
      slot_counter4: '---empty---',
      slot_counter5: '---empty---',
      song: 'RANDOMcalm'
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
      key: 'quickPlayTracker',
      title: 'QUICK PLAY WEEKLY PB BAR',
      accent: '#ff8c42',
      toggles: [
        {
          field: 'enabled',
          label: 'Enable Quick Play Weekly PB Bar',
          description: 'Show left vertical progress bar + countdown to Weekly PB, hiding the bar in green when surpassed.'
        },
        {
          field: 'showSubtitle',
          label: 'Show Weekly PB Subtitle',
          description: 'Display your current Weekly PB altitude beneath the digits.'
        },
        {
          field: 'signedBehind',
          label: 'Show Minus Sign While Behind Weekly PB',
          description: 'Prefix a "-" sign before remaining meters while below your Weekly PB.'
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
#twfoxtetrio-multi-request .hidden { display: none; }
#twfoxtetrio-multi-request.is-open .right_scroller.hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateX(30vw);
}
.twfox-join-modal-wrap {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  pointer-events: all;
}
.twfox-join-modal {
  width: min(460px, 92vw);
  background: linear-gradient(180deg, #1b1526 0%, #120e1a 100%);
  border: 2px solid #5c3f84;
  border-bottom-color: #0b0711;
  border-radius: 6px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.78);
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
}
.twfox-join-modal h2 {
  margin: 0;
  font-family: HUN, sans-serif;
  font-size: 1.9em;
  color: #ffffff;
  letter-spacing: 0.05em;
}
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
  padding-top: 3.4em;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  background: radial-gradient(ellipse at top center, rgba(96, 56, 160, 0.22) 0%, rgba(10, 8, 16, 0.35) 70%);
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
  background: linear-gradient(180deg, #1b1426 0%, #100b17 100%);
  border-top: 3px solid #3c2e52;
  border-right: 3px solid #2b213b;
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
  height: 3.45em;
  background: linear-gradient(180deg, rgba(35, 23, 56, 0.9) 0%, rgba(18, 12, 30, 0.94) 100%);
  border: 1px solid rgba(154, 108, 224, 0.45);
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.38);
  border-radius: 5px;
  text-align: center;
  cursor: pointer;
  transition: border-color 180ms ease, filter 180ms ease, transform 120ms ease;
}
#twfoxtetrio-lobby-invite-banner:hover {
  filter: brightness(1.18);
  border-color: rgba(196, 152, 255, 0.78);
}
#twfoxtetrio-lobby-invite-banner.is-copied {
  border-color: #42e88a;
  box-shadow: 0 0 18px rgba(66, 232, 138, 0.35);
}
.twfox-invite-sub { color: #b7a2db; font-size: 0.76em; font-weight: 700; letter-spacing: 0.1em; margin-top: 4px; }
.twfox-invite-id { color: #ffffff; font-size: 1.6em; font-weight: 900; letter-spacing: 0.12em; text-shadow: 0 2px 8px rgba(0,0,0,0.65); }
.twfox-lobby-grid {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(14em, 25%) minmax(0, 1fr) minmax(14em, 25%);
  gap: 0.85em;
  padding: 0.3em 0.8em 0.7em;
  box-sizing: border-box;
}
.twfox-lobby-col {
  background: linear-gradient(180deg, rgba(16, 13, 25, 0.78) 0%, rgba(10, 9, 16, 0.84) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.38);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  backdrop-filter: blur(4px);
}
.twfox-col-heading {
  margin: 0.45em 0.7em 0.35em;
  font-family: HUN, sans-serif;
  font-size: 1.9em;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.04em;
  text-shadow: 0 2px 6px #000;
}
.twfox-col-heading.right { text-align: right; }
.twfox-col-heading.center {
  text-align: center;
  margin-bottom: 0.25em;
  padding-bottom: 0.2em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.twfox-player-list {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0 0.7em 0.7em;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}
.twfox-player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0.52em 0.72em;
  background: linear-gradient(90deg, rgba(46, 35, 64, 0.92) 0%, rgba(25, 20, 36, 0.94) 100%);
  border-top: 2px solid #594178;
  border-left: 3px solid #6b4e93;
  border-bottom: 2px solid #0d0913;
  border-radius: 4px;
  color: #fff;
  font-weight: 800;
  transition: transform 120ms ease, border-color 140ms ease;
}
.twfox-player-row.is-host {
  border-left-color: #ff9c42;
  background: linear-gradient(90deg, rgba(64, 41, 28, 0.88) 0%, rgba(27, 20, 34, 0.94) 100%);
}
.twfox-player-row.is-ready {
  border-left-color: #42e88a;
}
.twfox-player-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.02em;
}
.twfox-player-name::before {
  content: attr(data-initial);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 1.65em;
  height: 1.65em;
  border-radius: 4px;
  font-family: HUN, sans-serif;
  font-size: 0.88em;
  font-weight: 900;
  color: #fff;
  background: linear-gradient(135deg, #7449ba 0%, #442775 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
}
.twfox-player-row.is-host .twfox-player-name::before {
  background: linear-gradient(135deg, #e87a24 0%, #993f10 100%);
}
.twfox-lobby-tabs {
  display: flex;
  width: 100%;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.twfox-room-tab {
  flex: 1 1 0;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(to bottom, rgba(170,170,170,0.1) 0, transparent 100%);
  font-family: HUN, sans-serif;
  text-align: center;
  color: #9e96b3;
  padding: .45em 0;
  font-size: 1.3em;
  font-weight: 800;
  cursor: pointer;
  transition: .2s filter, .2s color, .2s background;
}
.twfox-room-tab:hover { filter: brightness(1.3); color: #eee; }
.twfox-room-tab.active {
  background: linear-gradient(to bottom, #b785ff 0, #b785ff 3px, rgba(168, 115, 255, 0.22) 3px, transparent 100%);
  color: #fff;
}
.twfox-room-center-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  background: rgba(5, 4, 10, 0.36);
  padding: 1em 1.25em;
  display: flex;
  flex-direction: column;
  gap: 0.85em;
}
.twfox-room-opt-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0.65em 0.85em;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 5px;
  color: #d6c8eb;
  font-size: 1.08em;
  font-weight: 700;
}
.twfox-room-opt-row:first-of-type { margin-top: 2px; }
.twfox-room-savebar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 0, rgba(140, 100, 210, 0.14) 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  text-align: center;
  color: #e2d6f5;
  font-family: HUN, sans-serif;
  font-size: 1.25em;
  font-weight: 800;
  padding: .48em 0.7em;
}
.twfox-room-savebar.has-winner {
  color: #ffe066;
  background: linear-gradient(to bottom, rgba(255, 215, 80, 0.06) 0, rgba(255, 190, 50, 0.16) 100%);
}
.twfox-chat-log {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0 0.7em 0.5em;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-family: monospace;
  font-size: 0.94em;
}
.twfox-chat-entry {
  padding: 4px 7px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.03);
  line-height: 1.3;
  word-break: break-word;
}
.twfox-chat-entry.is-system {
  background: rgba(255, 162, 75, 0.11);
  border-left: 2px solid #ffbe8e;
}
.twfox-chat-bar {
  padding: 0.5em 0.7em 0.7em;
  display: flex;
  gap: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.twfox-chat-bar .twfox-input { flex: 1 1 auto; min-width: 0; }
.twfox-lobby-footer {
  flex: 0 0 auto;
  width: 100%;
  box-sizing: border-box;
  min-height: 3.6em;
  background: linear-gradient(to bottom, #1c1328 0%, #2b1a40 100%);
  border-top: 2px solid #593b7d;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0.32em 1.2em;
}
.twfox-footer-wing-btn {
  justify-self: start;
  cursor: pointer;
  color: #d4b9f5;
  font-family: HUN, sans-serif;
  font-size: 1.5em;
  font-weight: 800;
  text-align: left;
  transition: .2s filter, .2s color;
}
.twfox-footer-wing-btn.is-ready {
  color: #5aff9c;
}
.twfox-footer-wing-btn span {
  display: block;
  font-size: 0.45em;
  color: #9378b5;
}
.twfox-footer-start-btn {
  background: linear-gradient(to bottom, #6335a6 0%, #3a1c66 100%);
  border: 2px solid #a674eb;
  border-bottom-color: #190b2e;
  border-radius: 5px;
  color: #ffffff;
  font-family: HUN, sans-serif;
  font-size: 1.55em;
  line-height: 1.08;
  font-weight: 900;
  padding: 0.2em 2.3em;
  cursor: pointer;
  text-align: center;
  box-shadow: 0 0 22px rgba(154, 98, 240, 0.46);
  transition: filter 160ms ease, transform 90ms ease, box-shadow 160ms ease;
}
.twfox-footer-start-btn:hover {
  filter: brightness(1.2);
  box-shadow: 0 0 28px rgba(178, 125, 255, 0.65);
}
.twfox-footer-start-btn.is-disabled,
.twfox-footer-start-btn:disabled {
  background: linear-gradient(to bottom, #2a2138 0%, #191224 100%);
  border-color: #4f3d69;
  color: #a99bc2;
  opacity: 0.55;
  filter: grayscale(0.45);
  cursor: not-allowed;
  box-shadow: none;
}
.twfox-footer-start-btn.is-disabled:hover,
.twfox-footer-start-btn:disabled:hover {
  filter: grayscale(0.45);
  box-shadow: none;
}
.twfox-footer-start-btn span {
  display: block;
  font-size: 0.42em;
  font-weight: 700;
  color: #d7c3f7;
}
.twfox-footer-mode-tag {
  justify-self: end;
  font-family: HUN, sans-serif;
  font-size: 1.4em;
  font-weight: 800;
  color: #cab3eb;
  letter-spacing: 0.06em;
}
.twfox-multi-arena {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: clamp(12px, 2vw, 24px);
  max-width: 100vw;
  max-height: 96vh;
  padding: 0 14px;
  box-sizing: border-box;
}
.twfox-multi-side-col {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  min-width: 255px;
  max-width: 360px;
}
.twfox-score-lb {
  background: rgba(14, 18, 29, 0.9);
  border: 1px solid #41517a;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.52);
  overflow: hidden;
  text-align: left;
  font-family: HUN, sans-serif;
}
.twfox-score-lb-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 11px;
  background: linear-gradient(90deg, rgba(44, 56, 88, 0.92) 0%, rgba(25, 32, 52, 0.92) 100%);
  border-bottom: 1px solid #41517a;
  font-size: 1.05em;
  font-weight: 800;
  color: #e4ecff;
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
  padding: 6px 11px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 1.02em;
  font-weight: 800;
  color: #e6ecff;
}
.twfox-score-lb-row:first-child { border-top: 0; }
.twfox-score-lb-row.is-first { color: #ffe066; }
.twfox-score-lb-row.is-self { background: rgba(34, 96, 148, 0.65); }
.twfox-score-lb-row.is-ko { opacity: 0.55; color: #ffa0b2; }
.twfox-score-lb-val {
  font-variant-numeric: tabular-nums;
  color: #ffffff;
}
.twfox-opponents-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.twfox-opp-card {
  background: rgba(12, 15, 24, 0.9);
  border: 1.5px solid #4d6294;
  border-radius: 6px;
  padding: 6px 8px;
  text-align: center;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
  transition: border-color 180ms ease, opacity 180ms ease;
}
.twfox-opp-card.is-ko {
  border-color: #ff4666;
  opacity: 0.78;
}
.twfox-opp-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-family: HUN, sans-serif;
  font-weight: 800;
  font-size: 0.92em;
  margin-bottom: 4px;
  color: #ffffff;
}
.twfox-opp-rank {
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.85em;
  background: rgba(255, 255, 255, 0.12);
  color: #dce4ff;
}
.twfox-opp-card.is-ko .twfox-opp-rank {
  background: rgba(255, 70, 102, 0.25);
  color: #ff9eb0;
}
.twfox-opp-stats {
  margin-top: 4px;
  font-size: 0.84em;
  font-weight: 700;
  color: #9aa8cf;
  font-variant-numeric: tabular-nums;
}
.twfox-finish-overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, rgba(16, 12, 28, 0.72) 0%, rgba(4, 5, 10, 0.88) 100%);
  backdrop-filter: blur(4px);
}
.twfox-finish-card {
  position: relative;
  overflow: hidden;
  min-width: min(460px, 88vw);
  padding: 26px 38px;
  border-radius: 10px;
  text-align: center;
  background: linear-gradient(180deg, rgba(35, 24, 56, 0.96) 0%, rgba(16, 12, 26, 0.98) 100%);
  border: 2px solid #ffd84d;
  box-shadow: 0 0 48px rgba(255, 216, 77, 0.35), 0 18px 46px rgba(0, 0, 0, 0.78);
  animation: twfoxWinnerBurst 460ms cubic-bezier(0.2, 1.28, 0.4, 1) forwards;
}
.twfox-finish-card::after {
  content: "";
  position: absolute;
  top: -30%;
  left: -60%;
  width: 45%;
  height: 160%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transform: rotate(22deg);
  animation: twfoxWinnerSweep 1.3s ease-out 180ms forwards;
}
.twfox-finish-card.is-defeat {
  border-color: #7c96db;
  box-shadow: 0 0 38px rgba(100, 140, 255, 0.28), 0 18px 46px rgba(0, 0, 0, 0.78);
}
.twfox-finish-kicker {
  font-family: HUN, sans-serif;
  font-size: 1em;
  font-weight: 800;
  letter-spacing: 0.2em;
  color: #ffdf80;
  text-transform: uppercase;
}
.twfox-finish-card.is-defeat .twfox-finish-kicker {
  color: #a8beff;
}
.twfox-finish-title {
  margin: 6px 0 4px;
  font-family: HUN, sans-serif;
  font-size: clamp(30px, 4.4vw, 52px);
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #ffffff;
  text-shadow: 0 4px 18px rgba(255, 216, 77, 0.45);
}
.twfox-finish-sub {
  font-family: HUN, sans-serif;
  font-size: 1.25em;
  font-weight: 800;
  color: #d7e2ff;
  letter-spacing: 0.06em;
}
@keyframes twfoxWinnerBurst {
  0% { opacity: 0; transform: scale(0.68) translateY(18px); }
  70% { opacity: 1; transform: scale(1.04) translateY(-2px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes twfoxWinnerSweep {
  0% { left: -60%; }
  100% { left: 150%; }
}
#twfoxtetrio-multi-results {
  width: 100%;
  height: 100%;
  padding: 2.2em 1.2em 1.4em;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at top center, rgba(112, 74, 184, 0.24) 0%, rgba(8, 7, 14, 0.85) 75%);
  overflow: hidden;
}
.twfox-results-shell {
  width: min(820px, 94vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: linear-gradient(180deg, rgba(20, 16, 32, 0.95) 0%, rgba(11, 10, 19, 0.97) 100%);
  border: 1.5px solid rgba(154, 108, 224, 0.48);
  border-radius: 10px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.72);
  padding: 18px 22px;
  box-sizing: border-box;
}
.twfox-res-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 14px 18px;
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(255, 208, 72, 0.16) 0%, rgba(110, 62, 180, 0.24) 100%);
  border: 1px solid rgba(255, 214, 92, 0.45);
}
.twfox-res-hero-tag {
  font-family: HUN, sans-serif;
  font-size: 0.9em;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: #ffe285;
}
.twfox-res-hero-name {
  font-family: HUN, sans-serif;
  font-size: clamp(24px, 3vw, 36px);
  font-weight: 900;
  color: #ffffff;
  letter-spacing: 0.05em;
  text-shadow: 0 2px 12px rgba(255, 208, 72, 0.35);
}
.twfox-res-hero-meta {
  text-align: right;
  font-family: HUN, sans-serif;
  color: #d9cdf0;
  font-size: 1em;
  font-weight: 800;
}
.twfox-res-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  overflow-y: auto;
  max-height: 52vh;
  padding-right: 2px;
}
.twfox-res-row {
  display: grid;
  grid-template-columns: 58px minmax(0, 1.3fr) repeat(4, auto);
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-left: 4px solid #63739c;
  font-family: HUN, sans-serif;
  color: #eef3ff;
  animation: twfoxResultRowIn 320ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
.twfox-res-row.is-rank-1 {
  background: linear-gradient(90deg, rgba(255, 210, 68, 0.2) 0%, rgba(44, 34, 22, 0.72) 100%);
  border-color: rgba(255, 216, 77, 0.45);
  border-left-color: #ffd84d;
}
.twfox-res-row.is-rank-2 {
  background: linear-gradient(90deg, rgba(210, 222, 240, 0.14) 0%, rgba(28, 32, 46, 0.7) 100%);
  border-left-color: #d6e0f0;
}
.twfox-res-row.is-rank-3 {
  background: linear-gradient(90deg, rgba(224, 152, 92, 0.14) 0%, rgba(36, 26, 22, 0.7) 100%);
  border-left-color: #e0985c;
}
.twfox-res-row.is-self {
  box-shadow: inset 0 0 0 1px rgba(96, 198, 255, 0.65);
}
.twfox-res-place {
  font-size: 1.35em;
  font-weight: 900;
  color: #c8d2eb;
  letter-spacing: 0.04em;
}
.twfox-res-row.is-rank-1 .twfox-res-place { color: #ffe066; }
.twfox-res-row.is-rank-2 .twfox-res-place { color: #e2ecfa; }
.twfox-res-row.is-rank-3 .twfox-res-place { color: #f0ad75; }
.twfox-res-player {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 1.15em;
  font-weight: 800;
}
.twfox-res-stat {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 0.96em;
  font-weight: 700;
  color: #bfcbe8;
  min-width: 64px;
}
.twfox-res-stat span {
  display: block;
  font-size: 0.72em;
  color: #7d8cb3;
  letter-spacing: 0.06em;
}
.twfox-res-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
@keyframes twfoxResultRowIn {
  0% { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
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
.twfox-assets-block {
  border-top-color: #cf6427 !important;
}
.twfox-assets-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.twfox-assets-slots {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}
.twfox-asset-slot {
  background: rgba(11, 15, 24, 0.85);
  border: 1px solid #2b3552;
  border-radius: 4px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.twfox-asset-slot.is-filled {
  border-color: #cf6427;
}
.twfox-asset-slot-k {
  font-size: 0.78em;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #8f9fc9;
}
.twfox-asset-slot-v {
  font-size: 1em;
  font-weight: 800;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.twfox-asset-slot-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.twfox-assets-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 10px;
}
.twfox-assets-tab.is-active,
.twfox-assets-cat.is-active {
  background-color: #3d2215;
  border-top-color: #ff9c54;
  border-left-color: #cf6427;
  color: #ffbe8e;
}
.twfox-assets-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}
.twfox-assets-toolbar .twfox-input {
  flex: 1 1 200px;
  min-width: 160px;
}
.twfox-assets-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.twfox-btn.is-sm {
  font-size: 0.85em;
  padding: 0.32em 0.7em;
}
.twfox-btn.is-danger {
  background-color: #3a171e;
  border-top-color: #c93b52;
  border-left-color: #8f2436;
  color: #ffb0be;
}
.twfox-btn.is-ok {
  background-color: #153823;
  border-top-color: #34c76a;
  border-left-color: #218c48;
  color: #a6ffc5;
}
.twfox-assets-status {
  font-size: 0.92em;
  color: #9bb0e6;
  margin-bottom: 8px;
}
.twfox-assets-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.twfox-asset-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(12, 16, 26, 0.88);
  border: 1px solid #2b3552;
  border-radius: 4px;
}
.twfox-asset-card.is-active {
  border-color: #34c76a;
}
.twfox-asset-main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1 1 260px;
  min-width: 0;
}
.twfox-asset-thumb {
  width: 44px;
  height: 44px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  object-fit: cover;
  background: #060810;
  flex: 0 0 auto;
}
.twfox-asset-info {
  min-width: 0;
  flex: 1 1 auto;
}
.twfox-asset-title {
  font-size: 1.1em;
  font-weight: 800;
  color: #ffffff;
}
.twfox-asset-meta {
  font-size: 0.85em;
  color: #8f9fc9;
  margin-top: 2px;
}
.twfox-asset-desc {
  font-size: 0.84em;
  color: #b7c2e2;
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 520px;
}
.twfox-asset-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.twfox-assets-pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.twfox-bg-preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}
.twfox-hidden-file {
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

    const musicPicker = document.getElementById('music_picker_custom');
    const prevSong = musicPicker ? musicPicker.getAttribute('data-song') : null;
    if (musicPicker && presetMap.song) {
      musicPicker.setAttribute('data-song', String(presetMap.song));
    }
    try {
      startBtn.click();
    } finally {
      if (musicPicker && presetMap.song && prevSong !== null) {
        musicPicker.setAttribute('data-song', prevSong);
      }
    }
    return true;
  }

  function initFoxmodMenu(runtimeApi) {
    ensureStyle();

    let activeFoxView = null;
    let isNavigatingInternal = false;
    let pendingPracticeReturn = false;
    let practiceRunEntered = false;
    let scrollersInjected = false;
    let backHooked = false;
    let statusEl = null;
    let refreshAssetsStudio = null;
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
    let multiReqScrollerEl = null;
    let joinDialogEl = null;
    let multiRequestOpen = false;
    let multiDom = null;
    let resultsTransitionTimer = null;

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

    function clearFinishTransition() {
      if (resultsTransitionTimer && typeof root.clearTimeout === 'function') {
        root.clearTimeout(resultsTransitionTimer);
      }
      resultsTransitionTimer = null;
      if (multiDom && multiDom.finishOverlay) {
        setClass(multiDom.finishOverlay, 'hidden', true);
      }
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

    function resetMultiRequestModalView(showJoinDialog) {
      if (multiReqScrollerEl) setClass(multiReqScrollerEl, 'hidden', Boolean(showJoinDialog));
      if (joinDialogEl) setClass(joinDialogEl, 'hidden', !showJoinDialog);
    }

    function closeMultiRequest() {
      multiRequestOpen = false;
      resetMultiRequestModalView(false);
      if (multiRequestEl) {
        multiRequestEl.classList.remove('is-open');
      }
    }

    function openMultiRequest() {
      ensureNativeScrollers();
      if (!multiRequestEl) return;
      resetMultiRequestModalView(false);
      multiRequestOpen = true;
      multiRequestEl.classList.add('is-open');
    }

    function hideFoxmodScrollersImmediately() {
      closeMultiRequest();
      clearFinishTransition();
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

      if (!isFoxTarget) {
        pendingPracticeReturn = false;
        practiceRunEntered = false;
      }
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
        if (typeof refreshAssetsStudio === 'function') {
          refreshAssetsStudio(true);
        }
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

    function launchCustomPracticeMode(presetMap, isZen) {
      hideFoxmodScrollersImmediately();
      pendingPracticeReturn = true;
      practiceRunEntered = false;
      if (isZen && typeof runtimeApi.enterPracticeZen === 'function') {
        runtimeApi.enterPracticeZen();
      }
      applyCustomSoloPreset(presetMap);
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
            launchCustomPracticeMode(CUSTOM_SOLO_PRESETS.fourWide, false);
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
            launchCustomPracticeMode(CUSTOM_SOLO_PRESETS.marathon, false);
          }
        ),
        makeGiantBanner(
          {
            cardId: 'twfoxtetrio-prac-zen',
            icon: ICONS.zen,
            title: 'ZEN',
            subtitle: 'original zen + quick play cards (expert, all-spin, gravity, volatile...)',
            bg: '#331933',
            top: '#6b2b69',
            left: '#582957',
            bottom: '#2e162e',
            titleColor: '#fdb9ff',
            descColor: '#c993cc',
            hit: 'confirm'
          },
          function () {
            launchCustomPracticeMode(CUSTOM_SOLO_PRESETS.zen, true);
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
          mode: modeSelect.value || 'zen'
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
      clearFinishTransition();
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
      if (nextSub === 'lobby' || nextSub === 'playing') {
        clearFinishTransition();
      }
      multiSubMode = nextSub;
      syncIngameChromeClass();
      if (!multiDom) return;
      setClass(multiDom.lobbyView, 'hidden', nextSub !== 'lobby');
      setClass(multiDom.gameView, 'hidden', nextSub !== 'playing');
      if (multiDom.resultsView) {
        setClass(multiDom.resultsView, 'hidden', nextSub !== 'results');
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

    function formatMatchDuration(ms) {
      const totalSec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function renderResultsScreen(snap, detail) {
      if (!multiDom || !multiDom.resultsList) return;
      const roomInfo = (snap && snap.room) || {};
      const isHost = Boolean(snap && snap.role === 'host');
      const selfId = isHost ? 'host' : snap && snap.selfId;
      const standings = (detail && Array.isArray(detail.standings) && detail.standings) ||
        (Array.isArray(roomInfo.lastResults) && roomInfo.lastResults) ||
        [];
      const mode = (detail && detail.gameMode) || roomInfo.gameMode || 'vs';
      const roundNum = (detail && detail.round) || roomInfo.round || 1;
      const winnerName = (detail && detail.winner) || roomInfo.winner || (standings[0] && standings[0].name) || 'DRAW';
      const activeSet = roomInfo.pieceSet === 'chaos' ? 'CAOS MIX' : roomInfo.pieceSet === 'pentomino' ? 'PENTOMINOS' : 'NORMAL';
      const modeText = mode === 'blitz' ? 'BLITZ 2:00' : 'VERSUS KO';

      if (multiDom.resultsHeroTag) {
        multiDom.resultsHeroTag.textContent = `RONDA #${roundNum} · ${activeSet} ${modeText}`;
      }
      if (multiDom.resultsHeroName) {
        multiDom.resultsHeroName.textContent = winnerName === 'DRAW' ? 'EMPATE / DRAW' : `Nº1 ${winnerName}`;
      }
      if (multiDom.resultsHeroMeta) {
        const top = standings[0];
        if (top) {
          multiDom.resultsHeroMeta.textContent = mode === 'blitz'
            ? `${Math.round(top.score || 0).toLocaleString('en-US')} PTS · ${top.lines || 0} LINES`
            : `SURVIVOR · ${Number(top.vs || 0).toFixed(1)} VS · ${top.attack || 0} ATK`;
        } else {
          multiDom.resultsHeroMeta.textContent = `${standings.length} PLAYERS`;
        }
      }

      multiDom.resultsList.innerHTML = '';
      standings.forEach((entry, idx) => {
        const rank = entry.placement || idx + 1;
        const isSelf = entry.id === selfId;
        const rowClasses = [
          'twfox-res-row',
          rank === 1 ? 'is-rank-1' : rank === 2 ? 'is-rank-2' : rank === 3 ? 'is-rank-3' : '',
          isSelf ? 'is-self' : ''
        ].filter(Boolean).join(' ');

        const roleBadgeText = rank === 1
          ? (mode === 'blitz' ? 'CHAMPION' : 'SURVIVOR')
          : entry.disconnected
            ? 'LEFT'
            : mode === 'vs'
              ? 'KO'
              : `Nº${rank}`;

        const statCol1 = mode === 'blitz'
          ? createEl('div', { className: 'twfox-res-stat', html: `<span>SCORE</span>${Math.round(entry.score || 0).toLocaleString('en-US')}` })
          : createEl('div', { className: 'twfox-res-stat', html: `<span>VS</span>${Number(entry.vs || 0).toFixed(1)}` });
        const statCol2 = mode === 'blitz'
          ? createEl('div', { className: 'twfox-res-stat', html: `<span>LINES</span>${entry.lines || 0}` })
          : createEl('div', { className: 'twfox-res-stat', html: `<span>ATK</span>${entry.attack || 0}` });
        const statCol3 = createEl('div', { className: 'twfox-res-stat', html: `<span>TIME</span>${formatMatchDuration(entry.durationMs)}` });
        const statCol4 = createEl('div', { className: 'twfox-res-stat', html: `<span>WINS</span>${entry.wins || 0}` });

        const row = createEl(
          'div',
          {
            className: rowClasses,
            style: `animation-delay:${idx * 85}ms`
          },
          [
            createEl('div', { className: 'twfox-res-place', text: `Nº${rank}` }),
            createEl('div', { className: 'twfox-res-player' }, [
              createEl('span', { text: entry.name + (isSelf ? ' (YOU)' : '') }),
              createEl('span', { className: 'twfox-badge', text: roleBadgeText })
            ]),
            statCol1,
            statCol2,
            statCol3,
            statCol4
          ]
        );
        multiDom.resultsList.appendChild(row);
      });

      const playerCount = (snap && snap.players ? snap.players.length : 0);
      if (multiDom.resultsPlayAgainBtn) {
        setClass(multiDom.resultsPlayAgainBtn, 'hidden', !isHost);
        const canAgain = playerCount >= 2;
        multiDom.resultsPlayAgainBtn.disabled = !canAgain;
        setClass(multiDom.resultsPlayAgainBtn, 'is-disabled', !canAgain);
      }
      if (multiDom.resultsStatusNote) {
        multiDom.resultsStatusNote.textContent = isHost
          ? (playerCount >= 2 ? 'READY TO START NEXT ROUND OR RETURN TO LOBBY' : 'NEED 2+ PLAYERS FOR NEXT ROUND')
          : 'WAITING FOR HOST TO START NEXT ROUND...';
      }
    }

    function renderMultiSnapshot(snap, evType, detail) {
      if (!multiDom || !snap) return;

      if (evType === 'match_start' && detail && pentominoEngine && foxmodCanvas) {
        clearFinishTransition();
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
          onTopOut(gSnap) {
            const finalSnap = gSnap || (multiGame && typeof multiGame.getSnapshot === 'function' ? multiGame.getSnapshot() : null);
            if (peerSession) {
              if (finalSnap && typeof peerSession.updateSelfBoard === 'function') {
                peerSession.updateSelfBoard(finalSnap);
              }
              peerSession.reportSelfKo(finalSnap);
            }
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
        if (multiController) multiController.stop();
        renderResultsScreen(snap, detail);
        if (multiSubMode === 'playing') {
          const isHostRole = snap.role === 'host';
          const myId = isHostRole ? 'host' : snap.selfId;
          const standings = Array.isArray(detail.standings) ? detail.standings : [];
          const selfEntry = standings.find((r) => r.id === myId) || null;
          const winnerName = detail.winner || snap.room.winner || 'DRAW';
          const isVictory = Boolean(winnerName !== 'DRAW' && selfEntry && selfEntry.placement === 1);
          if (multiDom.finishCard) {
            setClass(multiDom.finishCard, 'is-defeat', !isVictory);
          }
          if (multiDom.finishKicker) {
            multiDom.finishKicker.textContent = `RONDA #${detail.round || snap.room.round || 1} COMPLETE`;
          }
          if (multiDom.finishTitle) {
            multiDom.finishTitle.textContent = winnerName === 'DRAW'
              ? 'DRAW!'
              : isVictory
                ? 'VICTORY!'
                : `${winnerName} WINS!`;
          }
          if (multiDom.finishSub) {
            multiDom.finishSub.textContent = winnerName === 'DRAW'
              ? 'ROUND ENDED IN A TIE'
              : isVictory
                ? ((detail.gameMode || snap.room.gameMode) === 'blitz' ? 'Nº1 HIGH SCORE CHAMPION' : 'Nº1 LAST SURVIVOR')
                : (selfEntry ? `YOU PLACED Nº${selfEntry.placement} OF ${standings.length}` : 'MATCH RESULTS READY');
          }
          if (multiDom.finishOverlay) {
            setClass(multiDom.finishOverlay, 'hidden', false);
          }
          if (typeof root.clearTimeout === 'function' && resultsTransitionTimer) {
            root.clearTimeout(resultsTransitionTimer);
          }
          if (typeof root.setTimeout === 'function') {
            resultsTransitionTimer = root.setTimeout(function () {
              resultsTransitionTimer = null;
              if (multiDom && multiDom.finishOverlay) {
                setClass(multiDom.finishOverlay, 'hidden', true);
              }
              if (activeFoxView === 'foxmod_multi' && multiSubMode === 'playing') {
                showMultiSubMode('results');
              }
            }, 1750);
            if (resultsTransitionTimer && typeof resultsTransitionTimer.unref === 'function') {
              resultsTransitionTimer.unref();
            }
          }
        }
      }

      if (evType === 'connected' && snap.role !== 'host') {
        closeMultiRequest();
        multiDom.setCenterTab('invite');
        showMultiSubMode('lobby');
        if (activeFoxView !== 'foxmod_multi') {
          navigateMenu('foxmod_multi');
        }
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

      setClass(multiDom.hostInviteBox, 'hidden', false);
      if (multiDom.hostManualToggleBtn) {
        setClass(multiDom.hostManualToggleBtn, 'hidden', !isHost);
      }
      if (!isHost && multiDom.hostManualPanel) {
        setClass(multiDom.hostManualPanel, 'hidden', true);
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
      const hasResults = Array.isArray(snap.room.lastResults) && snap.room.lastResults.length > 0;
      if (multiDom.winnerBarWrap) {
        setClass(multiDom.winnerBarWrap, 'has-winner', Boolean(hasWinner));
      }
      if (multiDom.viewResultsBtn) {
        setClass(multiDom.viewResultsBtn, 'hidden', !hasResults);
      }
      multiDom.winnerBanner.textContent = evType === 'start_blocked'
        ? 'NEED AT LEAST 2 PLAYERS TO START'
        : hasWinner
          ? `WINNER RONDA #${snap.room.round}: ${snap.room.winner}`
          : isHost
            ? (snap.signalingStatus === 'offline'
                ? 'RELAY OFFLINE · USE MANUAL FALLBACK'
                : snap.signalingStatus === 'connecting'
                  ? `CONNECTING RELAY · CODE #${roomCode}`
                  : roomCode
                    ? `ROOM ONLINE · CODE #${roomCode}`
                    : 'HOST SERVER ACTIVE')
            : snap.connected
              ? 'CONNECTED TO HOST SERVER'
              : 'ENTER #CODE TO JOIN';

      if (isHost && multiDom.hostInviteStatus) {
        if (evType === 'signaling_ready') {
          multiDom.hostInviteStatus.textContent = `Relay online — share #${roomCode} so friends can join immediately.`;
        } else if (evType === 'signaling_offline') {
          multiDom.hostInviteStatus.textContent = 'Relay offline — open MANUAL P2P FALLBACK below to share FOX1 code.';
        }
      }

      if (!isHost && multiDom.joinStatus) {
        if (evType === 'exchanging_sdp') {
          multiDom.joinStatus.textContent = `Room #${roomCode} found! Opening WebRTC tunnel...`;
        } else if (evType === 'webrtc_failed' && detail && detail.reason) {
          multiDom.joinStatus.textContent = `Error: ${detail.reason}`;
        }
      }

      if (!isHost && multiDom.clientReadyBtn) {
        setClass(multiDom.clientReadyBtn, 'is-ready', Boolean(snap.ready));
      }

      multiDom.playersList.innerHTML = '';
      for (const p of snap.players || []) {
        const roleTag = p.isHost ? 'HOST' : p.ready ? 'READY' : 'WAIT';
        const initial = String(p.name || 'P').trim().charAt(0).toUpperCase() || 'P';
        const rowClass = [
          'twfox-player-row',
          p.isHost ? 'is-host' : (p.ready ? 'is-ready' : '')
        ].filter(Boolean).join(' ');
        multiDom.playersList.appendChild(
          createEl('div', { className: rowClass }, [
            createEl('span', { className: 'twfox-player-name', text: p.name, attrs: { 'data-initial': initial } }),
            createEl('span', { className: 'twfox-badge', text: `${roleTag} · ${p.wins || 0}/${snap.room.round || 0}` })
          ])
        );
      }

      multiDom.chatLog.innerHTML = '';
      if (!snap.chat || snap.chat.length === 0) {
        multiDom.chatLog.appendChild(
          createEl('div', {
            className: 'twfox-chat-entry',
            style: 'color:#8a7ca3',
            text: 'Welcome to FOXMOD P2P chat! Host PC acts as the room server.'
          })
        );
      } else {
        for (const entry of snap.chat) {
          multiDom.chatLog.appendChild(
            createEl('div', {
              className: entry.system ? 'twfox-chat-entry is-system' : 'twfox-chat-entry',
              style: entry.system ? 'color:#ffbe8e' : 'color:#dce4ff',
              text: entry.system ? `* ${entry.text}` : `${entry.author}: ${entry.text}`
            })
          );
        }
      }

      if (multiSubMode === 'playing' && foxmodCanvas) {
        const selfId = isHost ? 'host' : snap.selfId;
        const rankedPlayers = (snap.players || []).slice().sort((a, b) => {
          if (activeMode === 'blitz') {
            return ((Number(b.score) || 0) - (Number(a.score) || 0)) || ((b.lines || 0) - (a.lines || 0));
          }
          return (
            (Number(b.alive !== false) - Number(a.alive !== false)) ||
            ((b.koOrder || 0) - (a.koOrder || 0)) ||
            ((Number(b.vs) || 0) - (Number(a.vs) || 0)) ||
            ((Number(b.score) || 0) - (Number(a.score) || 0))
          );
        });
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
            const rankNum = pl.alive === false && pl.placement ? pl.placement : idx + 1;
            const koTag = pl.alive === false ? ' [KO]' : '';
            const metricText = activeMode === 'blitz'
              ? Math.round(Number(pl.score) || 0).toLocaleString('en-US')
              : `${Number(pl.vs || 0).toFixed(1)} VS`;
            multiDom.scoreLbRows.appendChild(
              createEl('div', { className: classes }, [
                createEl('span', { text: `Nº${rankNum} ${pl.name}${koTag}` }),
                createEl('span', {
                  className: 'twfox-score-lb-val',
                  text: metricText
                })
              ])
            );
          });
        }

        const opponents = (snap.players || []).filter((p) => p.id !== selfId);
        multiDom.opponentsGrid.innerHTML = '';
        for (const opp of opponents) {
          const oppRankIdx = rankedPlayers.findIndex((x) => x.id === opp.id);
          const oppRank = opp.alive === false && opp.placement ? opp.placement : (oppRankIdx >= 0 ? oppRankIdx + 1 : '-');
          const miniCanvas = createEl('canvas', {
            attrs: { width: '100', height: '200' },
            style: 'background:#06080f;display:block;border-radius:3px;'
          });
          foxmodCanvas.renderMiniBoard(miniCanvas, opp.board, opp.alive, opp.placement);
          const statText = activeMode === 'blitz'
            ? `${Math.round(Number(opp.score) || 0).toLocaleString('en-US')} PTS · L:${opp.lines || 0}`
            : `${Number(opp.vs || 0).toFixed(1)} VS · ATK:${opp.attack || 0}`;
          multiDom.opponentsGrid.appendChild(
            createEl('div', { className: opp.alive === false ? 'twfox-opp-card is-ko' : 'twfox-opp-card' }, [
              createEl('div', { className: 'twfox-opp-hdr' }, [
                createEl('span', { text: opp.name }),
                createEl('span', { className: 'twfox-opp-rank', text: opp.alive === false ? `KO Nº${oppRank}` : `Nº${oppRank}` })
              ]),
              miniCanvas,
              createEl('div', { className: 'twfox-opp-stats', text: statText })
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
        attrs: { type: 'text', placeholder: 'Q3BE  o  #Q3BE' }
      });
      const joinGenerateBtn = createEl('button', { id: 'twfoxtetrio-join-generate-btn', className: 'twfox-btn is-pri', text: 'JOIN ROOM', type: 'button' });
      const joinCancelBtn = createEl('button', { id: 'twfoxtetrio-join-cancel-btn', className: 'twfox-btn', text: 'BACK', type: 'button' });
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

      const centerTabInvite = createEl('div', { id: 'twfoxtetrio-center-invite' }, [hostInviteBox]);

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

      const winnerBanner = createEl('span', { id: 'twfoxtetrio-multi-winner', text: 'HOST SERVER ACTIVE' });
      const viewResultsBtn = createEl('button', {
        id: 'twfoxtetrio-view-results-btn',
        className: 'twfox-btn is-pri hidden',
        text: 'VIEW RESULTS',
        type: 'button',
        style: 'font-size:0.72em;padding:0.25em 0.7em;'
      });
      const winnerBarWrap = createEl('div', { className: 'twfox-room-savebar' }, [winnerBanner, viewResultsBtn]);

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
            winnerBarWrap
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

      // In-game VS / BLITZ stage with right-side score leaderboard, opponent mini boards & finish overlay
      multiCanvas = createEl('canvas', {
        id: 'twfoxtetrio-multi-canvas',
        className: 'twfox-game-canvas',
        attrs: { width: '640', height: '620' }
      });
      const scoreLbCount = createEl('span', { id: 'twfoxtetrio-multi-lb-count', text: '2' });
      const scoreLbRows = createEl('div', { id: 'twfoxtetrio-multi-lb-rows', className: 'twfox-score-lb-rows' });
      const scoreLeaderboard = createEl('div', { id: 'twfoxtetrio-multi-leaderboard', className: 'twfox-score-lb' }, [
        createEl('div', { className: 'twfox-score-lb-hdr' }, [
          createEl('span', { text: 'LIVE STANDINGS' }),
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
      const finishKicker = createEl('div', { className: 'twfox-finish-kicker', text: 'ROUND COMPLETE' });
      const finishTitle = createEl('div', { id: 'twfoxtetrio-finish-title', className: 'twfox-finish-title', text: 'VICTORY!' });
      const finishSub = createEl('div', { className: 'twfox-finish-sub', text: 'Nº1 SURVIVOR' });
      const finishSkipBtn = createEl('button', {
        id: 'twfoxtetrio-finish-skip-btn',
        className: 'twfox-btn is-pri',
        text: 'RESULTS →',
        type: 'button',
        style: 'margin-top:16px;'
      });
      const finishCard = createEl('div', { className: 'twfox-finish-card' }, [
        finishKicker,
        finishTitle,
        finishSub,
        finishSkipBtn
      ]);
      const finishOverlay = createEl('div', {
        id: 'twfoxtetrio-multi-finish-overlay',
        className: 'twfox-finish-overlay hidden'
      }, [finishCard]);
      const gameView = createEl('div', { id: 'twfoxtetrio-multi-game', className: 'twfox-stage-inner hidden' }, [
        backLobbyBtn,
        createEl('div', { className: 'twfox-multi-arena' }, [multiCanvas, sideCol]),
        finishOverlay
      ]);

      // Post-match podium & standings view (Nº1 survivor down to NºN)
      const resultsHeroTag = createEl('div', { className: 'twfox-res-hero-tag', text: 'RONDA #1 · VERSUS KO' });
      const resultsHeroName = createEl('div', { id: 'twfoxtetrio-results-winner-name', className: 'twfox-res-hero-name', text: 'Nº1 WINNER' });
      const resultsHeroMeta = createEl('div', { className: 'twfox-res-hero-meta', text: 'SURVIVOR' });
      const resultsList = createEl('div', { id: 'twfoxtetrio-results-list', className: 'twfox-res-list' });
      const resultsBackLobbyBtn = createEl('button', {
        id: 'twfoxtetrio-results-lobby-btn',
        className: 'twfox-btn',
        text: 'BACK TO LOBBY',
        type: 'button'
      });
      const resultsPlayAgainBtn = createEl('button', {
        id: 'twfoxtetrio-results-again-btn',
        className: 'twfox-btn is-pri hidden',
        text: 'PLAY AGAIN',
        type: 'button'
      });
      const resultsStatusNote = createEl('span', { style: 'color:#a695c7;font-weight:700;', text: '' });
      const resultsView = createEl('div', { id: 'twfoxtetrio-multi-results', className: 'hidden' }, [
        createEl('div', { className: 'twfox-results-shell' }, [
          createEl('div', { className: 'twfox-res-hero' }, [
            createEl('div', {}, [resultsHeroTag, resultsHeroName]),
            resultsHeroMeta
          ]),
          resultsList,
          createEl('div', { className: 'twfox-res-actions' }, [
            resultsStatusNote,
            createEl('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;' }, [
              resultsBackLobbyBtn,
              resultsPlayAgainBtn
            ])
          ])
        ])
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
        resultsView,
        lobbyRoomTitle,
        inviteBannerSub,
        invitePillCode,
        inviteBanner,
        hostRoomCodeLabel,
        hostInviteStatus,
        lobbyModeTag,
        playersHeading,
        startCountSub,
        roomInfoOwner,
        roomInfoStatus,
        hostInviteBox,
        hostManualToggleBtn,
        hostManualPanel,
        joinStatus,
        hostStartBtn,
        clientReadyBtn,
        modeSelect,
        pieceSelect,
        garbageSelect,
        gravitySelect,
        scoreLbCount,
        scoreLbRows,
        winnerBarWrap,
        winnerBanner,
        viewResultsBtn,
        finishOverlay,
        finishCard,
        finishKicker,
        finishTitle,
        finishSub,
        resultsHeroTag,
        resultsHeroName,
        resultsHeroMeta,
        resultsList,
        resultsBackLobbyBtn,
        resultsPlayAgainBtn,
        resultsStatusNote,
        playersList,
        chatLog,
        opponentsGrid,
        setCenterTab
      };

      // #list_request style picker overlay (CREATE LOBBY / JOIN LOBBY + Join Room Code Modal)
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
      multiReqScrollerEl = createEl('div', { className: 'right_scroller ns' }, [createBtn, joinBtn]);

      const joinModalBox = createEl('div', { className: 'twfox-join-modal' }, [
        createEl('h2', { text: 'JOIN BY ROOM CODE' }),
        createEl('p', { style: 'margin:0;color:#c9b9db;', text: 'Enter the room code from your friend (with or without #):' }),
        joinOfferInput,
        createEl('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;' }, [joinGenerateBtn, joinCancelBtn]),
        joinStatus,
        joinManualReplyBox
      ]);
      joinDialogEl = createEl('div', { id: 'twfoxtetrio-join-dialog', className: 'twfox-join-modal-wrap hidden' }, [joinModalBox]);

      function cancelJoinFlow(backToPicker) {
        if (activeFoxView !== 'foxmod_multi') {
          teardownPeerSession();
        }
        joinGenerateBtn.disabled = false;
        joinStatus.textContent = '';
        setClass(joinManualReplyBox, 'hidden', true);
        if (backToPicker) {
          resetMultiRequestModalView(false);
        } else {
          closeMultiRequest();
        }
      }

      reqBackBtn.addEventListener('click', function () {
        if (joinDialogEl && !joinDialogEl.classList.contains('hidden')) {
          cancelJoinFlow(true);
        } else {
          cancelJoinFlow(false);
        }
      });
      joinCancelBtn.addEventListener('click', function () {
        cancelJoinFlow(true);
      });
      joinDialogEl.addEventListener('click', function (ev) {
        if (ev && ev.target === joinDialogEl) {
          cancelJoinFlow(true);
        }
      });

      multiRequestEl = createEl('div', { id: 'twfoxtetrio-multi-request' }, [
        reqBackBtn,
        multiReqScrollerEl,
        joinDialogEl
      ]);
      multiRequestEl.addEventListener('click', function (ev) {
        if (ev && ev.target === multiRequestEl) cancelJoinFlow(false);
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
        setClass(inviteBanner, 'is-copied', true);
        if (snap && snap.role === 'host') {
          hostInviteStatus.textContent = `Code ${code} copied! Share it with friends to join.`;
        }
        if (typeof root.clearTimeout === 'function') root.clearTimeout(copyNoticeTimer);
        if (typeof root.setTimeout === 'function') {
          copyNoticeTimer = root.setTimeout(function () {
            inviteBannerSub.textContent = 'CLICK TO COPY ROOM CODE';
            setClass(inviteBanner, 'is-copied', false);
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
        if (activeFoxView !== 'foxmod_multi') {
          teardownPeerSession();
        }
        joinOfferInput.value = '';
        joinAnswerOutput.value = '';
        joinStatus.textContent = '';
        setClass(joinManualReplyBox, 'hidden', true);
        joinGenerateBtn.disabled = false;
        resetMultiRequestModalView(true);
        if (typeof joinOfferInput.focus === 'function') {
          joinOfferInput.focus();
        }
      });

      leaveRoomBtn.addEventListener('click', function () {
        if (typeof root.clearTimeout === 'function') root.clearTimeout(copyNoticeTimer);
        teardownPeerSession();
        navigateMenu('foxmod');
      });

      backLobbyBtn.addEventListener('click', function () {
        showMultiSubMode('lobby');
      });

      finishSkipBtn.addEventListener('click', function () {
        showMultiSubMode('results');
      });

      viewResultsBtn.addEventListener('click', function () {
        const snap = peerSession && peerSession.getSnapshot ? peerSession.getSnapshot() : null;
        if (snap && snap.room && Array.isArray(snap.room.lastResults)) {
          renderResultsScreen(snap, {
            winner: snap.room.winner,
            round: snap.room.round,
            gameMode: snap.room.gameMode,
            standings: snap.room.lastResults
          });
          showMultiSubMode('results');
        }
      });

      resultsBackLobbyBtn.addEventListener('click', function () {
        showMultiSubMode('lobby');
      });

      resultsPlayAgainBtn.addEventListener('click', function () {
        if (peerSession && peerSession.getSnapshot().role === 'host') {
          peerSession.startMatch();
        }
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
            joinStatus.textContent = `Room #${res.roomCode} answered! Opening P2P tunnel...`;
            if (typeof root.setTimeout === 'function') {
              const natHintTimer = root.setTimeout(function () {
                if (peerSession === client && multiRequestOpen && !client.getSnapshot().connected) {
                  joinStatus.textContent = 'P2P tunnel taking long (NAT/firewall may block UDP between peers).';
                }
              }, 10000);
              if (natHintTimer && typeof natHintTimer.unref === 'function') natHintTimer.unref();
            }
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
        [lobbyView, gameView, resultsView]
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

      function buildAssetsStudioBlock() {
        const assetsApi = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.customAssets;
        const assetsLogic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.customAssetsLogic;
        const presets = (assetsLogic && assetsLogic.BUILTIN_BG_PRESETS) || [
          { id: 'none', name: 'Original TETR.IO', description: 'Fondo nativo de TETR.IO.' },
          { id: 'starfield', name: 'Hyper Starfield', description: 'Estrellas neon 3D.' },
          { id: 'synth_grid', name: 'Synthwave Horizon', description: 'Grilla synthwave animada.' },
          { id: 'cyber_wave', name: 'Cyber Aurora', description: 'Ondas luminosas animadas.' }
        ];

        let currentTab = 'explore'; // 'explore' | 'installed' | 'background'
        let currentCategory = 'all';
        let currentQuery = '';
        let currentSort = 'votes';
        let currentPage = 0;
        const PAGE_SIZE = 16;
        const downloadingIds = new Set();
        let catalogRequested = false;
        let bgUrlSynced = false;

        const slotsWrap = createEl('div', { id: 'twfoxtetrio-assets-slots', className: 'twfox-assets-slots' });
        const reloadBtn = createEl('button', {
          id: 'twfoxtetrio-assets-reload-btn',
          className: 'twfox-btn is-sm is-pri hidden',
          text: 'RECARGAR TETR.IO (APLICAR SFX/SKIN)',
          type: 'button',
          attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
        });
        reloadBtn.addEventListener('click', function () {
          if (root.location && typeof root.location.reload === 'function') {
            root.location.reload();
          }
        });

        const tabExploreBtn = createEl('button', {
          id: 'twfoxtetrio-assets-tab-explore',
          className: 'twfox-btn is-sm twfox-assets-tab is-active',
          text: 'EXPLORAR (TETR.IO+)',
          type: 'button'
        });
        const tabInstalledBtn = createEl('button', {
          id: 'twfoxtetrio-assets-tab-installed',
          className: 'twfox-btn is-sm twfox-assets-tab',
          text: 'DESCARGADOS (0)',
          type: 'button'
        });
        const tabBgBtn = createEl('button', {
          id: 'twfoxtetrio-assets-tab-bg',
          className: 'twfox-btn is-sm twfox-assets-tab',
          text: 'FONDO / LOCAL',
          type: 'button'
        });

        // Explore controls
        const searchInput = createEl('input', {
          id: 'twfoxtetrio-assets-search',
          className: 'twfox-input',
          type: 'text',
          attrs: { placeholder: 'Buscar skin, tablero, sfx o autor en TETR.IO+...' }
        });
        const sortSelect = createEl('select', { id: 'twfoxtetrio-assets-sort', className: 'twfox-select' }, [
          createEl('option', { text: 'Mas votados', attrs: { value: 'votes' } }),
          createEl('option', { text: 'Recientes', attrs: { value: 'recent' } }),
          createEl('option', { text: 'Nombre A-Z', attrs: { value: 'name' } }),
          createEl('option', { text: 'Autor', attrs: { value: 'author' } })
        ]);
        const refreshCatalogBtn = createEl('button', {
          id: 'twfoxtetrio-assets-refresh',
          className: 'twfox-btn is-sm',
          text: 'ACTUALIZAR',
          type: 'button'
        });
        const catDefs = [
          ['all', 'Todos'],
          ['skins', 'Skins'],
          ['sfx', 'SFX']
        ];
        const catWrap = createEl('div', { className: 'twfox-assets-cats' });
        const catButtons = new Map();
        for (const [catKey, catLabel] of catDefs) {
          const btn = createEl('button', {
            id: `twfoxtetrio-assets-cat-${catKey}`,
            className: 'twfox-btn is-sm twfox-assets-cat' + (catKey === 'all' ? ' is-active' : ''),
            text: catLabel,
            type: 'button'
          });
          btn.addEventListener('click', function () {
            currentCategory = catKey;
            currentPage = 0;
            for (const [k, b] of catButtons.entries()) {
              setClass(b, 'is-active', k === catKey);
            }
            renderExploreList();
          });
          catButtons.set(catKey, btn);
          catWrap.appendChild(btn);
        }

        const exploreStatusEl = createEl('div', {
          id: 'twfoxtetrio-assets-catalog-status',
          className: 'twfox-assets-status',
          text: 'Listo para conectar con https://you.have.fail/tetrioplus/'
        });
        const exploreListEl = createEl('div', { id: 'twfoxtetrio-assets-explore-list', className: 'twfox-assets-list' });
        const pageInfoEl = createEl('span', { id: 'twfoxtetrio-assets-page-info', className: 'twfox-assets-status', text: 'Pagina 1' });
        const prevPageBtn = createEl('button', { id: 'twfoxtetrio-assets-prev-page', className: 'twfox-btn is-sm', text: 'ANTERIOR', type: 'button' });
        const nextPageBtn = createEl('button', { id: 'twfoxtetrio-assets-next-page', className: 'twfox-btn is-sm', text: 'SIGUIENTE', type: 'button' });
        const explorePanel = createEl('div', { id: 'twfoxtetrio-assets-panel-explore' }, [
          createEl('div', { className: 'twfox-assets-toolbar' }, [searchInput, sortSelect, refreshCatalogBtn]),
          catWrap,
          exploreStatusEl,
          exploreListEl,
          createEl('div', { className: 'twfox-assets-pager' }, [prevPageBtn, pageInfoEl, nextPageBtn])
        ]);

        // Installed panel
        const installedStatusEl = createEl('div', {
          id: 'twfoxtetrio-assets-installed-status',
          className: 'twfox-assets-status',
          text: ''
        });
        const installedListEl = createEl('div', { id: 'twfoxtetrio-assets-installed-list', className: 'twfox-assets-list' });
        const installedPanel = createEl('div', { id: 'twfoxtetrio-assets-panel-installed', className: 'hidden' }, [
          installedStatusEl,
          installedListEl
        ]);

        // Background & Local Import panel
        const presetWrap = createEl('div', { id: 'twfoxtetrio-assets-bg-presets', className: 'twfox-bg-preset-grid' });
        const presetButtons = new Map();
        for (const preset of presets) {
          const b = createEl('button', {
            id: `twfoxtetrio-assets-bg-preset-${preset.id}`,
            className: 'twfox-btn is-sm',
            text: preset.name,
            type: 'button'
          });
          b.addEventListener('click', function () {
            if (!assetsApi) return;
            assetsApi.setBackgroundConfig({
              mode: preset.id === 'none' ? 'none' : 'preset',
              presetId: preset.id
            });
          });
          presetButtons.set(preset.id, b);
          presetWrap.appendChild(b);
        }

        const bgUrlInput = createEl('input', {
          id: 'twfoxtetrio-assets-bg-url',
          className: 'twfox-input',
          type: 'text',
          attrs: { placeholder: 'URL imagen, GIF o video (.mp4 / .webm)...' }
        });
        const bgUrlApplyBtn = createEl('button', {
          id: 'twfoxtetrio-assets-bg-url-apply',
          className: 'twfox-btn is-sm is-pri',
          text: 'APLICAR URL',
          type: 'button'
        });
        const bgClearBtn = createEl('button', {
          id: 'twfoxtetrio-assets-bg-clear',
          className: 'twfox-btn is-sm is-danger',
          text: 'QUITAR FONDO',
          type: 'button'
        });
        bgUrlApplyBtn.addEventListener('click', function () {
          if (!assetsApi) return;
          const url = String(bgUrlInput.value || '').trim();
          if (!url) {
            assetsApi.deactivateSlot('background');
          } else {
            assetsApi.setBackgroundConfig({ mode: 'url', url });
          }
        });
        bgClearBtn.addEventListener('click', function () {
          if (!assetsApi) return;
          bgUrlInput.value = '';
          assetsApi.deactivateSlot('background');
        });

        const bgOpacityInput = createEl('input', {
          id: 'twfoxtetrio-assets-bg-opacity',
          className: 'twfox-range-input',
          type: 'range',
          attrs: { min: '10', max: '100', step: '5', value: '72' }
        });
        const bgOpacityVal = createEl('span', { id: 'twfoxtetrio-assets-bg-opacity-val', className: 'twfox-range-val', text: '72%' });
        bgOpacityInput.addEventListener('input', function () {
          const pct = Math.max(10, Math.min(100, Number(bgOpacityInput.value) || 72));
          bgOpacityVal.textContent = pct + '%';
          if (assetsApi) assetsApi.setBackgroundConfig({ opacity: pct / 100 });
        });

        const bgBlurInput = createEl('input', {
          id: 'twfoxtetrio-assets-bg-blur',
          className: 'twfox-range-input',
          type: 'range',
          attrs: { min: '0', max: '16', step: '1', value: '0' }
        });
        const bgBlurVal = createEl('span', { id: 'twfoxtetrio-assets-bg-blur-val', className: 'twfox-range-val', text: '0px' });
        bgBlurInput.addEventListener('input', function () {
          const px = Math.max(0, Math.min(16, Number(bgBlurInput.value) || 0));
          bgBlurVal.textContent = px + 'px';
          if (assetsApi) assetsApi.setBackgroundConfig({ blur: px });
        });

        const bgFileInput = createEl('input', {
          id: 'twfoxtetrio-assets-bg-file',
          className: 'twfox-hidden-file',
          type: 'file',
          attrs: { accept: 'image/*,video/mp4,video/webm' }
        });
        const bgFileBtn = createEl('button', {
          id: 'twfoxtetrio-assets-bg-file-btn',
          className: 'twfox-btn is-sm is-pri',
          text: 'SUBIR FONDO (PNG/GIF/MP4/WEBM)',
          type: 'button'
        });
        bgFileBtn.addEventListener('click', function () {
          if (typeof bgFileInput.click === 'function') bgFileInput.click();
        });

        const assetFileInput = createEl('input', {
          id: 'twfoxtetrio-assets-import-file',
          className: 'twfox-hidden-file',
          type: 'file',
          attrs: { accept: '.tpse,.zip,.png,.gif,.webp,.svg,.mp4,.webm,.ogg,.wav,.mp3' }
        });
        const assetFileBtn = createEl('button', {
          id: 'twfoxtetrio-assets-import-btn',
          className: 'twfox-btn is-sm',
          text: 'IMPORTAR LOCAL (.TPSE / .ZIP / .PNG)',
          type: 'button'
        });
        assetFileBtn.addEventListener('click', function () {
          if (typeof assetFileInput.click === 'function') assetFileInput.click();
        });

        const localStatusEl = createEl('div', { id: 'twfoxtetrio-assets-local-status', className: 'twfox-assets-status', text: '' });

        async function handleFileSelection(fileObj, forcedCategory) {
          if (!fileObj || !assetsApi) return;
          localStatusEl.textContent = `Importando ${fileObj.name}...`;
          try {
            const buf = await fileObj.arrayBuffer();
            const rec = await assetsApi.importLocalAsset({
              name: fileObj.name,
              type: fileObj.type || '',
              bytes: new Uint8Array(buf),
              category: forcedCategory,
              autoApply: true
            });
            localStatusEl.textContent = `Instalado y activado: ${rec.name}`;
          } catch (err) {
            localStatusEl.textContent = 'Error importando archivo: ' + (err && err.message ? err.message : String(err));
          }
        }
        bgFileInput.addEventListener('change', function () {
          const f = bgFileInput.files && bgFileInput.files[0];
          if (f) handleFileSelection(f, 'background');
          bgFileInput.value = '';
        });
        assetFileInput.addEventListener('change', function () {
          const f = assetFileInput.files && assetFileInput.files[0];
          if (f) handleFileSelection(f);
          assetFileInput.value = '';
        });

        const bgPanel = createEl('div', { id: 'twfoxtetrio-assets-panel-bg', className: 'hidden' }, [
          createEl('div', { className: 'twfox-native-row' }, [
            createEl('div', {}, [
              createEl('span', { className: 'twfox-native-label', text: 'Fondos Animados Integrados' }),
              createEl('span', { className: 'twfox-native-desc', text: 'Se muestran detras de los menus y tableros sin descargas externas.' })
            ])
          ]),
          presetWrap,
          createEl('div', { className: 'twfox-assets-toolbar' }, [bgUrlInput, bgUrlApplyBtn, bgClearBtn]),
          createEl('div', { className: 'twfox-native-row' }, [
            createEl('span', { className: 'twfox-native-label', text: 'Opacidad del Fondo' }),
            createEl('div', { className: 'twfox-range-wrap' }, [bgOpacityInput, bgOpacityVal])
          ]),
          createEl('div', { className: 'twfox-native-row' }, [
            createEl('span', { className: 'twfox-native-label', text: 'Desenfoque (Blur)' }),
            createEl('div', { className: 'twfox-range-wrap' }, [bgBlurInput, bgBlurVal])
          ]),
          createEl('div', { className: 'twfox-assets-toolbar' }, [bgFileInput, bgFileBtn, assetFileInput, assetFileBtn]),
          localStatusEl
        ]);

        function setAssetsTab(nextTab) {
          currentTab = nextTab;
          setClass(tabExploreBtn, 'is-active', nextTab === 'explore');
          setClass(tabInstalledBtn, 'is-active', nextTab === 'installed');
          setClass(tabBgBtn, 'is-active', nextTab === 'background');
          setClass(explorePanel, 'hidden', nextTab !== 'explore');
          setClass(installedPanel, 'hidden', nextTab !== 'installed');
          setClass(bgPanel, 'hidden', nextTab !== 'background');
          if (nextTab === 'explore') loadCatalogIfNeeded(false);
          if (nextTab === 'installed') renderInstalledList();
        }

        tabExploreBtn.addEventListener('click', () => setAssetsTab('explore'));
        tabInstalledBtn.addEventListener('click', () => setAssetsTab('installed'));
        tabBgBtn.addEventListener('click', () => setAssetsTab('background'));

        function formatBytesLabel(bytes) {
          const n = Number(bytes) || 0;
          if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
          if (n >= 1024) return Math.round(n / 1024) + ' KB';
          return n + ' B';
        }

        function categoryLabel(cat) {
          if (cat === 'board') return 'TABLERO';
          if (cat === 'sfx') return 'SFX';
          if (cat === 'background') return 'FONDO';
          return 'PIEZAS';
        }

        function renderActiveSlots(state) {
          slotsWrap.innerHTML = '';
          const installed = (state && state.installed) || [];
          const findName = (id) => {
            if (!id) return null;
            const rec = installed.find((x) => x.id === id);
            return rec ? rec.name : id;
          };
          const a = (state && state.active) || {};

          let bgName = null;
          if (a.bgMode === 'preset' && a.bgPresetId && a.bgPresetId !== 'none') {
            const pr = presets.find((p) => p.id === a.bgPresetId);
            bgName = pr ? pr.name : a.bgPresetId;
          } else if (a.bgMode === 'asset' && a.bgAssetId) {
            bgName = findName(a.bgAssetId) || 'Fondo personalizado';
          } else if (a.bgMode === 'url' && a.bgUrl) {
            bgName = 'URL personalizada';
          }

          const slotDefs = [
            { slot: 'skin', title: 'PIEZAS / MINOS', value: findName(a.skinId), extra: a.skinFormat ? `(${a.skinFormat})` : '' },
            { slot: 'board', title: 'TABLERO / QUEUE', value: findName(a.boardId) },
            { slot: 'sfx', title: 'SONIDOS (SFX)', value: findName(a.sfxId), hasPreview: Boolean(a.sfxId) },
            { slot: 'background', title: 'FONDO / ANIMADO', value: bgName }
          ];

          for (const s of slotDefs) {
            const filled = Boolean(s.value);
            const actions = [];
            if (s.hasPreview && assetsApi) {
              const pBtn = createEl('button', {
                className: 'twfox-btn is-sm',
                text: 'PROBAR',
                type: 'button'
              });
              pBtn.addEventListener('click', () => assetsApi.previewSfxPack(a.sfxId));
              actions.push(pBtn);
            }
            if (filled && assetsApi) {
              const cBtn = createEl('button', {
                id: `twfoxtetrio-assets-clear-${s.slot}`,
                className: 'twfox-btn is-sm is-danger',
                text: 'QUITAR',
                type: 'button'
              });
              cBtn.addEventListener('click', () => assetsApi.deactivateSlot(s.slot));
              actions.push(cBtn);
            }
            slotsWrap.appendChild(
              createEl('div', { className: 'twfox-asset-slot' + (filled ? ' is-filled' : '') }, [
                createEl('span', { className: 'twfox-asset-slot-k', text: `${s.title} ${s.extra || ''}`.trim() }),
                createEl('span', { className: 'twfox-asset-slot-v', text: s.value || 'Original TETR.IO' }),
                actions.length > 0 ? createEl('div', { className: 'twfox-asset-slot-actions' }, actions) : null
              ])
            );
          }

          setClass(reloadBtn, 'hidden', !(state && state.needsReload));
        }

        function renderExploreList() {
          exploreListEl.innerHTML = '';
          if (!assetsApi) {
            exploreStatusEl.textContent = 'Modulo de assets no inicializado.';
            return;
          }
          const state = assetsApi.getState();
          if (!state.catalogLoaded) {
            return;
          }
          const matched = assetsApi.searchCatalog({
            category: currentCategory,
            search: currentQuery,
            sort: currentSort
          });
          const totalPages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
          if (currentPage >= totalPages) currentPage = totalPages - 1;
          const start = currentPage * PAGE_SIZE;
          const pageItems = matched.slice(start, start + PAGE_SIZE);

          exploreStatusEl.textContent = `Mostrando ${pageItems.length} de ${matched.length} resultados (${state.catalogCount} en TETR.IO+)`;
          pageInfoEl.textContent = `Pagina ${currentPage + 1} / ${totalPages}`;
          prevPageBtn.disabled = currentPage <= 0;
          nextPageBtn.disabled = currentPage + 1 >= totalPages;

          if (pageItems.length === 0) {
            exploreListEl.appendChild(
              createEl('div', { className: 'twfox-assets-status', text: 'No se encontraron assets con ese filtro.' })
            );
            return;
          }

          for (const item of pageItems) {
            const downloaded = assetsApi.isDownloaded(item.id);
            const active = assetsApi.isActive(item.id);
            const busy = downloadingIds.has(item.id);
            const tags = [categoryLabel(item.category)];
            if (item.format) tags.push(item.format.toUpperCase());
            if (item.animated) tags.push('ANIMADO');
            if (item.votes > 0) tags.push(`★ ${item.votes}`);

            const actionBtns = [];
            if (busy) {
              const b = createEl('button', { className: 'twfox-btn is-sm', text: 'DESCARGANDO...', type: 'button' });
              b.disabled = true;
              actionBtns.push(b);
            } else if (downloaded) {
              if (active) {
                actionBtns.push(createEl('span', { className: 'twfox-badge', text: 'ACTIVO ✓' }));
              } else {
                const actBtn = createEl('button', {
                  className: 'twfox-btn is-sm is-ok',
                  text: 'ACTIVAR',
                  type: 'button',
                  attrs: { 'data-asset-id': item.id, 'data-asset-action': 'activate' }
                });
                actBtn.addEventListener('click', () => assetsApi.activateAsset(item.id));
                actionBtns.push(actBtn);
              }
              const rmBtn = createEl('button', {
                className: 'twfox-btn is-sm is-danger',
                text: 'DESINSTALAR',
                type: 'button',
                attrs: { 'data-asset-id': item.id, 'data-asset-action': 'uninstall' }
              });
              rmBtn.addEventListener('click', () => assetsApi.uninstallAsset(item.id));
              actionBtns.push(rmBtn);
            } else {
              const dlBtn = createEl('button', {
                className: 'twfox-btn is-sm is-pri',
                text: 'DESCARGAR E INSTALAR',
                type: 'button',
                attrs: { 'data-asset-id': item.id, 'data-asset-action': 'download' }
              });
              dlBtn.addEventListener('click', async function () {
                downloadingIds.add(item.id);
                renderExploreList();
                try {
                  await assetsApi.downloadAndInstallCatalogItem(item, { autoApply: true });
                } catch (err) {
                  exploreStatusEl.textContent = 'Error descargando ' + item.name + ': ' + (err && err.message ? err.message : String(err));
                } finally {
                  downloadingIds.delete(item.id);
                  renderExploreList();
                }
              });
              actionBtns.push(dlBtn);
            }

            exploreListEl.appendChild(
              createEl('div', { className: 'twfox-asset-card' + (active ? ' is-active' : '') }, [
                createEl('div', { className: 'twfox-asset-info' }, [
                  createEl('div', { className: 'twfox-asset-title', text: item.name }),
                  createEl('div', { className: 'twfox-asset-meta', text: `por ${item.author} · ${tags.join(' · ')}` }),
                  item.description ? createEl('div', { className: 'twfox-asset-desc', text: item.description }) : null
                ]),
                createEl('div', { className: 'twfox-asset-actions' }, actionBtns)
              ])
            );
          }
        }

        function renderInstalledList() {
          installedListEl.innerHTML = '';
          if (!assetsApi) return;
          const state = assetsApi.getState();
          const list = state.installed || [];
          tabInstalledBtn.textContent = `DESCARGADOS (${list.length})`;
          installedStatusEl.textContent = list.length > 0
            ? `${list.length} assets guardados localmente en tu equipo.`
            : 'Aun no tienes assets descargados. Ve a EXPLORAR (TETR.IO+) o FONDO / LOCAL.';

          for (const rec of list) {
            const active = assetsApi.isActive(rec.id);
            const caps = rec.capabilities || {};
            const capTags = [];
            if (caps.skin) capTags.push('PIEZAS' + (rec.skinFormat ? ` (${rec.skinFormat})` : ''));
            if (caps.board || caps.queue || caps.grid) capTags.push('TABLERO');
            if (caps.sfx) capTags.push('SFX');
            if (caps.background) capTags.push(`FONDO x${rec.backgroundCount || 1}`);
            capTags.push(formatBytesLabel(rec.bytesEstimate));

            const thumb = rec.previewSkin
              ? createEl('img', { className: 'twfox-asset-thumb', attrs: { src: rec.previewSkin, alt: '' } })
              : null;

            const btns = [];
            if (active) {
              btns.push(createEl('span', { className: 'twfox-badge', text: 'ACTIVO ✓' }));
            } else {
              const useBtn = createEl('button', {
                className: 'twfox-btn is-sm is-ok',
                text: 'ACTIVAR',
                type: 'button',
                attrs: { 'data-installed-id': rec.id, 'data-installed-action': 'activate' }
              });
              useBtn.addEventListener('click', () => assetsApi.activateAsset(rec.id));
              btns.push(useBtn);
            }
            if (caps.sfx) {
              const testBtn = createEl('button', {
                className: 'twfox-btn is-sm',
                text: 'PROBAR SFX',
                type: 'button'
              });
              testBtn.addEventListener('click', () => assetsApi.previewSfxPack(rec.id));
              btns.push(testBtn);
            }
            if (caps.background && rec.backgroundCount > 1 && state.active.bgMode === 'asset' && state.active.bgAssetId === rec.id) {
              const nextBgBtn = createEl('button', {
                className: 'twfox-btn is-sm',
                text: `FONDO ${(state.active.bgIndex || 0) + 1}/${rec.backgroundCount}`,
                type: 'button'
              });
              nextBgBtn.addEventListener('click', () => {
                assetsApi.setBackgroundConfig({ bgIndex: ((state.active.bgIndex || 0) + 1) % rec.backgroundCount });
              });
              btns.push(nextBgBtn);
            }
            const delBtn = createEl('button', {
              className: 'twfox-btn is-sm is-danger',
              text: 'DESINSTALAR',
              type: 'button',
              attrs: { 'data-installed-id': rec.id, 'data-installed-action': 'uninstall' }
            });
            delBtn.addEventListener('click', () => assetsApi.uninstallAsset(rec.id));
            btns.push(delBtn);

            installedListEl.appendChild(
              createEl('div', { className: 'twfox-asset-card' + (active ? ' is-active' : '') }, [
                createEl('div', { className: 'twfox-asset-main' }, [
                  thumb,
                  createEl('div', { className: 'twfox-asset-info' }, [
                    createEl('div', { className: 'twfox-asset-title', text: rec.name }),
                    createEl('div', { className: 'twfox-asset-meta', text: `${rec.author} · ${capTags.join(' · ')}` })
                  ])
                ]),
                createEl('div', { className: 'twfox-asset-actions' }, btns)
              ])
            );
          }
        }

        function syncBgPanel(state) {
          const a = (state && state.active) || {};
          for (const [pid, btn] of presetButtons.entries()) {
            const active = (a.bgMode === 'none' && pid === 'none') || (a.bgMode === 'preset' && a.bgPresetId === pid);
            setClass(btn, 'is-active', active);
          }
          if (!bgUrlSynced && a.bgMode === 'url') {
            bgUrlInput.value = a.bgUrl || '';
            bgUrlSynced = true;
          }
          const pct = Math.round(clampNumber((a.bgOpacity || 0.72) * 100, 10, 100));
          bgOpacityInput.value = String(pct);
          bgOpacityVal.textContent = pct + '%';
          const blurPx = clampNumber(a.bgBlur || 0, 0, 16);
          bgBlurInput.value = String(blurPx);
          bgBlurVal.textContent = blurPx + 'px';
        }

        async function loadCatalogIfNeeded(force) {
          if (!assetsApi) return;
          if (!force && catalogRequested) {
            renderExploreList();
            return;
          }
          catalogRequested = true;
          exploreStatusEl.textContent = 'Conectando con https://you.have.fail/tetrioplus/ ...';
          try {
            await assetsApi.fetchCatalog(Boolean(force));
            renderExploreList();
          } catch (err) {
            exploreStatusEl.textContent = 'No se pudo conectar con TETR.IO+ (' + (err && err.message ? err.message : String(err)) + ')';
          }
        }

        searchInput.addEventListener('input', function () {
          currentQuery = String(searchInput.value || '');
          currentPage = 0;
          renderExploreList();
        });
        sortSelect.addEventListener('change', function () {
          currentSort = String(sortSelect.value || 'votes');
          currentPage = 0;
          renderExploreList();
        });
        refreshCatalogBtn.addEventListener('click', function () {
          currentPage = 0;
          loadCatalogIfNeeded(true);
        });
        prevPageBtn.addEventListener('click', function () {
          if (currentPage > 0) {
            currentPage -= 1;
            renderExploreList();
          }
        });
        nextPageBtn.addEventListener('click', function () {
          currentPage += 1;
          renderExploreList();
        });

        refreshAssetsStudio = function (allowAutoCatalog) {
          if (!assetsApi) return;
          const st = assetsApi.getState();
          renderActiveSlots(st);
          renderInstalledList();
          syncBgPanel(st);
          if (allowAutoCatalog && currentTab === 'explore' && !st.catalogLoaded) {
            loadCatalogIfNeeded(false);
          } else {
            renderExploreList();
          }
        };

        if (assetsApi && typeof assetsApi.subscribe === 'function') {
          assetsApi.subscribe(function (st) {
            renderActiveSlots(st);
            renderInstalledList();
            syncBgPanel(st);
            if (currentTab === 'explore' && st.catalogLoaded) {
              renderExploreList();
            }
          });
        }

        return createEl('div', { id: 'twfoxtetrio-assets-block', className: 'scroller_block twfox-assets-block' }, [
          createEl('div', { className: 'twfox-assets-top' }, [
            createEl('div', {}, [
              createEl('h1', { text: 'SKINS, TABLERO, SFX Y FONDOS (TETR.IO+)' }),
              createEl('p', { text: 'Descarga directa desde https://you.have.fail/tetrioplus/ · piezas, tablero, sonidos y fondos animados.' })
            ]),
            reloadBtn
          ]),
          slotsWrap,
          createEl('div', { className: 'twfox-assets-tabs' }, [tabExploreBtn, tabInstalledBtn, tabBgBtn]),
          explorePanel,
          installedPanel,
          bgPanel
        ]);
      }

      const blocks = [buildAssetsStudioBlock()].concat(CONFIG_SECTIONS.map(buildConfigSection));
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
        if (isNavigatingInternal) return;
        const menusHidden = menusEl.classList.contains('hidden');
        const menuType = menusEl.getAttribute('data-menu-type');

        if (pendingPracticeReturn) {
          if (menusHidden || menuType === 'none') {
            practiceRunEntered = true;
          } else if (practiceRunEntered && (menuType === 'home' || menuType === 'custom')) {
            pendingPracticeReturn = false;
            practiceRunEntered = false;
            navigateMenu('foxmod_practice');
            return;
          } else if (practiceRunEntered && menuType !== 'results') {
            pendingPracticeReturn = false;
            practiceRunEntered = false;
          }
        }

        if (!activeFoxView) return;
        if (menusHidden || (menuType && !menuType.startsWith('foxmod'))) {
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
      if (state && state.inGame && state.mode && state.mode !== 'Custom Solo') {
        pendingPracticeReturn = false;
        practiceRunEntered = false;
      }
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
