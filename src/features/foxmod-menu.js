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
  const soloLobbyLogic = internals.soloLobbyLogic || null;
  const foxInviteLogic = internals.foxInviteLogic || root.TWFOX_INVITE_LOGIC || null;

  function getFoxPawBadge() {
    const bag = root.__TWFOX_INTERNAL__ || internals;
    return (bag && bag.foxPawBadge) || null;
  }

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
      title: 'PRACTICE',
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
      title: 'MULTIPLAYER',
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
      subtitle: 'skins, board, SFX, language, updates & HUD settings',
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
      can_undo: true,
      retryisclear: true,
      stride: true,
      usezenconfig: true,
      display_zen: true,
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
    foxmod_practice: { header: 'PRACTICE', footer: 'pick a practice mode', back: 'foxmod' },
    foxmod_solo_lobby: {
      header: '4WIDE',
      footer: 'press start to begin playing',
      back: 'foxmod_practice'
    },
    foxmod_pentomino: {
      header: 'PENTOMINOS',
      footer: '12 pentominoes · real TETR.IO controls & skin',
      back: 'foxmod_solo_lobby'
    },
    foxmod_multi: {
      header: 'MULTIPLAYER',
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
    },
    {
      key: 'foxPawBadge',
      title: 'FOXMOD PAW BADGE (MOD IDENTIFIER)',
      accent: '#ff8b38',
      toggles: [
        {
          field: 'enabled',
          label: 'Show FOXMOD Fox Paw Badge',
          description: 'Display a fox paw icon next to your name and other players running FOXMOD.'
        }
      ]
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
  background-color: #0006;
  border: 0;
  border-top: 3px solid #1116;
  border-right: 3px solid #2226;
  border-bottom: 3px solid #0006;
  box-shadow: 0 0 8px #0004;
  color: #fffA;
  font-family: HUN, sans-serif;
  font-size: 1.65em;
  padding: .34em .85em .24em 2em;
  border-radius: 3px;
  cursor: pointer;
  transition: .35s transform, .35s filter;
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
body #menus[data-menu-type='foxmod_multi'] #header {
  background: linear-gradient(to bottom, #472869 0, #221344 100%);
  border-bottom: 2px solid #351d77;
}
body #menus[data-menu-type='foxmod_multi'] #header_text,
body #menus[data-menu-type='foxmod_multi'] #back,
body #menus[data-menu-type='foxmod_multi'] #footer_text {
  opacity: 0 !important;
  pointer-events: none !important;
}
body #menus[data-menu-type='foxmod_multi'] #footer {
  background: linear-gradient(to bottom, #251c3f 0, #371d53 100%);
  border-top: 2px solid #3f1c7a;
}
body.twfox-spectating #menus[data-menu-type='foxmod_multi'] #header {
  background: linear-gradient(to bottom, #160529 0, #090218 100%);
  border-bottom: 2px solid #5225cf;
}
body.twfox-spectating #menus[data-menu-type='foxmod_multi'] #footer {
  background: linear-gradient(to bottom, #120b26 0, #210e35 100%);
  border-top: 2px solid #5225cf;
}
.twfox-pfw {
  font-family: PFW, 'Segoe UI', sans-serif !important;
}
#twfoxtetrio-pane-multi {
  position: fixed !important;
  top: 4.2em !important;
  right: 0 !important;
  bottom: 3.2em !important;
  left: 0 !important;
  width: auto !important;
  height: auto !important;
  max-width: 100vw !important;
  max-height: 100vh !important;
  padding: 0 !important;
  margin: 0 !important;
  background: transparent !important;
  text-align: left;
  transform: none !important;
  overflow: visible !important;
  overflow-x: visible !important;
  overflow-y: visible !important;
  transition: .3s opacity !important;
  box-sizing: border-box !important;
  z-index: 11;
  pointer-events: none;
}
#twfoxtetrio-pane-multi.hidden,
#twfoxtetrio-pane-multi.thidden {
  display: none !important;
}
#twfoxtetrio-multi-lobby {
  width: 100%;
  height: 100%;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: visible;
  box-sizing: border-box;
  background: transparent;
}
#twfoxtetrio-lobby-top {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  height: 4.2em;
  pointer-events: none;
  z-index: 12;
}
#twfoxtetrio-leave-room-btn {
  pointer-events: all;
  position: fixed;
  left: 0;
  top: 0.35em;
  transform: translateX(-1.4em);
  background-color: #0006;
  border-top: 3px solid #1116;
  border-right: 3px solid #2226;
  border-bottom: 3px solid #0006;
  box-shadow: 0 0 8px #0004;
  color: #fffA;
  font-family: HUN, sans-serif;
  font-size: 1.8em;
  padding: .34em .85em .24em 2.5em;
  border-radius: 3px;
  cursor: pointer;
  transition: .25s transform, .25s filter, .25s background-color, .25s color;
}
#twfoxtetrio-leave-room-btn:hover {
  transform: translateX(-.45em);
  filter: brightness(1.2);
  background-color: #4006;
  border-top-color: #4116;
  border-right-color: #4226;
  border-bottom-color: #4006;
  color: #faa;
}
#twfoxtetrio-lobby-invite-banner {
  pointer-events: all;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: min(22em, calc(100vw - 28em));
  top: 0.32em;
  height: 3.45em;
  background-color: #0004;
  border: 1px solid #1114;
  box-shadow: inset 0 4px 8px #0003;
  border-radius: 3px;
  text-align: center;
  cursor: pointer;
  font-family: HUN, sans-serif;
  overflow: hidden;
  transition: filter 180ms ease, border-color 180ms ease;
}
#twfoxtetrio-lobby-invite-banner:hover {
  filter: brightness(1.1);
}
#twfoxtetrio-lobby-invite-banner.is-copied {
  border-color: #42e88a;
  box-shadow: inset 0 0 12px rgba(66, 232, 138, 0.28);
}
.twfox-invite-sub {
  color: #fff4;
  font-family: HUN, sans-serif;
  font-size: 0.78em;
  font-weight: 700;
  letter-spacing: 0.06em;
  margin-top: 0.18em;
  text-transform: uppercase;
}
.twfox-invite-id {
  color: #ffffff;
  font-family: PFW, 'Segoe UI', sans-serif;
  font-size: 2.0em;
  font-weight: 900;
  letter-spacing: 0.06em;
  line-height: 1.0;
  text-shadow: 0 0 4px #fff;
}
.twfox-lobby-grid {
  flex: 1 1 0;
  min-height: 0;
  width: calc(100% + 1.5em);
  margin: 0 -0.75em;
  display: grid;
  grid-template-columns: minmax(15em, 26%) minmax(0, 1fr) minmax(15em, 26%);
  gap: 0.75em;
  padding: 0.85em 0 1.4em;
  box-sizing: border-box;
  pointer-events: all;
}
.twfox-lobby-col {
  background-color: #0006;
  border: 0;
  box-shadow: none;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.twfox-col-heading {
  margin: 0.42em 0.8em 0.25em;
  font-family: HUN, sans-serif;
  font-size: 2.0em;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.02em;
  text-shadow: 0 2px 6px #000;
}
.twfox-lobby-col:first-child .twfox-col-heading { margin-left: 1.35em; }
.twfox-col-heading.right { text-align: right; margin-right: 1.35em; }
.twfox-col-heading.center {
  text-align: center;
  margin: 0.42em 0.65em 0.25em;
}
.twfox-player-list {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0.1em 0.55em 0.5em 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.twfox-player-row {
  order: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  padding: 0.3em 0.5em 0.22em 1.85em;
  margin-bottom: 0.45em;
  background-color: #372b51;
  border-top: 3px solid #453469;
  border-left: 0;
  border-right: 3px solid #302742;
  border-bottom: 3px solid #211c2c;
  box-shadow: 0 0 8px #000;
  border-radius: 0 3px 3px 0;
  font-family: HUN, sans-serif;
  color: #d9bef3;
  font-weight: 700;
  cursor: pointer;
  transition: .18s filter;
}
.twfox-player-row:hover {
  filter: brightness(1.18);
}
.twfox-player-row.is-spectator {
  order: 2;
  background-color: #150b2b;
  border-top-color: #211340;
  border-right-color: #120923;
  border-bottom-color: #090415;
}
.twfox-player-row.is-ready .twfox-player-name {
  color: #fff;
}
.twfox-player-row.is-spectator .twfox-player-name {
  color: #583ab8;
}
.twfox-player-name {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.4em;
  font-weight: 800;
  color: #d9bef3;
  letter-spacing: 0.02em;
}
.twfox-player-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.88em;
  color: #d9bef3;
}
.twfox-player-tag {
  display: inline-block;
  min-width: 4em;
  text-align: center;
  padding: 1px 7px;
  border-radius: 3px;
  background-color: #0004;
  box-shadow: inset 0 2px 8px #0006;
  color: #fff;
  font-size: 0.9em;
  font-weight: 800;
  letter-spacing: 0.04em;
}
.twfox-player-tag.is-ready {
  background-color: #0f3626aa;
  color: #82ffba;
}
.twfox-player-tag.is-spectator {
  color: #7c5fd1;
}
.twfox-player-wins {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: #d9bef3;
}
.twfox-lobby-tabs {
  display: flex;
  width: 100%;
  padding: 0 0.5em;
  box-sizing: border-box;
}
.twfox-room-tab {
  flex: 1 1 0;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(to bottom, #aaa2 0, transparent 100%);
  font-family: HUN, sans-serif;
  text-align: center;
  color: #aaa;
  padding: .4em 0;
  font-size: 1.4em;
  font-weight: 800;
  cursor: pointer;
  filter: brightness(1);
  transition: .3s filter, .2s color;
}
.twfox-room-tab:hover { filter: brightness(1.3); color: #eee; }
.twfox-room-tab.active {
  background: linear-gradient(to bottom, #fff 0, #fff 3px, #aaa4 3px, transparent 100%);
  color: #fff;
}
.twfox-room-center-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  background-color: #0005;
  margin: 0 0.5em;
  border-radius: 0 0 3px 3px;
  padding: 0.7em 0.9em;
  display: flex;
  flex-direction: column;
  gap: 0.35em;
}
.twfox-room-opt-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0.45em 0.2em;
  background: transparent;
  border: 0;
  border-top: 1px solid #fff1;
  border-radius: 0;
  color: #b7a3d4;
  font-family: HUN, sans-serif;
  font-size: 1.15em;
  font-weight: 700;
  text-transform: uppercase;
}
.twfox-room-opt-row:first-of-type { border-top: 0; }
.twfox-room-savebar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  border-radius: 0 0 8px 8px;
  background: linear-gradient(to bottom, transparent 0, #aaa2 100%);
  border-top: 0;
  text-align: center;
  color: #aaa;
  font-family: HUN, sans-serif;
  font-size: 1.35em;
  font-weight: 800;
  padding: .38em 0.7em;
}
.twfox-room-savebar.has-winner {
  color: #ffe066;
}
#twfoxtetrio-multi-winner {
  font-family: PFW, 'Segoe UI', sans-serif;
  font-size: 0.78em;
  font-weight: 800;
  letter-spacing: 0.04em;
}
.twfox-chat-log {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0.15em 1.25em 0.5em 0.65em;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: PFW, 'Segoe UI', sans-serif;
  font-size: 0.98em;
}
.twfox-chat-entry {
  padding: 2px 4px;
  border-radius: 0;
  background: transparent;
  line-height: 1.3;
  word-break: break-word;
  color: #ddd;
}
.twfox-chat-entry .chat_tag {
  display: inline;
  font-family: HUN, sans-serif;
  font-size: 1em;
  font-weight: 900;
  color: #fff;
  margin: 0 0.45em 0 0;
}
.twfox-chat-entry.is-system {
  background: transparent;
  border-left: 2px solid #9e7bd6;
  padding-left: 6px;
  color: #b5a3d4;
}
.twfox-chat-bar {
  padding: 0.45em 1.25em 0.65em 0.65em;
  display: flex;
  gap: 6px;
  border-top: 0;
}
.twfox-chat-bar .twfox-input {
  flex: 1 1 auto;
  min-width: 0;
  font-family: PFW, 'Segoe UI', sans-serif;
  color: #fff;
  font-size: 1.05em;
  background: #000D;
  box-shadow: 0 2px 6px #000A;
  border: 1px solid #060606;
  border-radius: 3px;
  padding: 0.22em 0.4em;
}
#twfoxtetrio-lobby-chat-send {
  background: #000B;
  border: 1px solid #221c2e;
  border-radius: 3px;
  color: #888;
  padding: 0.2em 0.55em;
  font-size: 0.9em;
}
#twfoxtetrio-lobby-chat-send:hover {
  color: #fff;
  border-color: #4f3a75;
}
.twfox-lobby-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 4.4em;
  background: transparent;
  border-top: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: end;
  padding: 0;
  z-index: 12;
  pointer-events: none;
}
.twfox-footer-wing-wrap {
  position: relative;
  justify-self: start;
  pointer-events: all;
  min-width: min(19em, 30vw);
  padding: 0.42em 2.2em 0.45em 1.25em;
  filter: brightness(1) drop-shadow(0px -2px #16101E) drop-shadow(-2px 0px #16101E) drop-shadow(2px 0px #16101E) drop-shadow(0px 4px 8px #0004);
  transition: .2s transform, .2s filter;
}
.twfox-footer-wing-wrap::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, #2e1c49 0, #221437 100%);
  clip-path: polygon(0 100%, 0% 0, 90% 0, 100% 100%);
  z-index: -1;
}
.twfox-footer-wing-wrap:hover {
  transform: translateY(-0.12em);
  filter: brightness(1.2) drop-shadow(0px -2px #16101E) drop-shadow(-2px 0px #16101E) drop-shadow(2px 0px #16101E) drop-shadow(0px 4px 8px #0004);
}
body.twfox-spectating .twfox-footer-wing-wrap {
  filter: brightness(1) drop-shadow(0px -2px #5225CF) drop-shadow(-2px 0px #5225CF) drop-shadow(2px 0px #5225CF) drop-shadow(0px 4px 8px #0004);
}
body.twfox-spectating .twfox-footer-wing-wrap::before {
  background: linear-gradient(to bottom, #110721 0, #0c0319 100%);
}
.twfox-footer-wing-btn {
  cursor: pointer;
  color: #b190e2;
  font-family: HUN, sans-serif;
  font-size: 1.75em;
  line-height: 1.0;
  font-weight: 900;
  text-align: center;
  transition: .2s color;
}
.twfox-footer-wing-btn.is-spectating {
  color: #cbb2ff;
}
.twfox-footer-wing-btn span {
  display: block;
  margin-top: 2px;
  font-size: 0.36em;
  font-weight: 500;
  color: #634c85;
}
.twfox-footer-wing-btn.is-spectating span {
  color: #8f6ee0;
}
.twfox-footer-wait-tag {
  position: relative;
  pointer-events: none;
  min-width: min(19em, 34vw);
  background: linear-gradient(to bottom, #2e1c49 0, #221437 100%);
  clip-path: polygon(0 100%, 10% 0, 90% 0, 100% 100%);
  color: #b190e2;
  font-family: HUN, sans-serif;
  font-size: 1.55em;
  line-height: 1.05;
  font-weight: 900;
  padding: 0.48em 2.4em 0.52em;
  text-align: center;
  filter: drop-shadow(0px -2px #16101E) drop-shadow(-2px 0px #16101E) drop-shadow(2px 0px #16101E) drop-shadow(0px 4px 8px #0004);
}
.twfox-footer-start-btn {
  pointer-events: all;
  min-width: min(19em, 34vw);
  background: linear-gradient(to bottom, #2e1c49 0, #221437 100%);
  border: 0;
  clip-path: polygon(0 100%, 10% 0, 90% 0, 100% 100%);
  color: #b190e2;
  font-family: HUN, sans-serif;
  font-size: 1.75em;
  line-height: 1.0;
  font-weight: 900;
  padding: 0.38em 2.6em 0.44em;
  cursor: pointer;
  text-align: center;
  filter: brightness(1) drop-shadow(0px -2px #16101E) drop-shadow(-2px 0px #16101E) drop-shadow(2px 0px #16101E) drop-shadow(0px 4px 8px #0004);
  transition: .2s transform, .2s filter, .2s opacity;
}
.twfox-footer-start-btn:hover {
  transform: translateY(-0.12em);
  filter: brightness(1.2) drop-shadow(0px -2px #16101E) drop-shadow(-2px 0px #16101E) drop-shadow(2px 0px #16101E) drop-shadow(0px 4px 8px #0004);
}
.twfox-footer-start-btn.is-disabled,
.twfox-footer-start-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.twfox-footer-start-btn.is-disabled:hover,
.twfox-footer-start-btn:disabled:hover {
  transform: none;
  filter: drop-shadow(0px -2px #16101E) drop-shadow(-2px 0px #16101E) drop-shadow(2px 0px #16101E) drop-shadow(0px 4px 8px #0004);
}
.twfox-footer-start-btn span {
  display: block;
  margin-top: 2px;
  font-size: 0.36em;
  font-weight: 500;
  color: #634c85;
}
.twfox-footer-mode-tag {
  justify-self: end;
  text-align: right;
  font-family: HUN, sans-serif;
  font-size: 1.7em;
  line-height: 1.0;
  font-weight: 900;
  color: #634d83;
  letter-spacing: 0.03em;
  background: transparent;
  border: 0;
  padding: 0 0.65em 0.38em 0;
  clip-path: none;
}
#twfoxtetrio-multi-game,
#twfoxtetrio-multi-results {
  position: fixed;
  inset: 0;
  pointer-events: all;
  z-index: 15;
}
.twfox-spectator-banner {
  padding: 4px 12px;
  background: rgba(17, 7, 33, 0.88);
  border: 1px solid #5225cf;
  border-radius: 3px;
  color: #cbb2ff;
  font-family: HUN, sans-serif;
  font-size: 1.05em;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-align: center;
  margin-bottom: 6px;
}
.twfox-multi-arena {
  position: relative;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: clamp(14px, 2.4vw, 32px);
  width: 100%;
  max-width: 100vw;
  max-height: 96vh;
  padding: 0 20px;
  box-sizing: border-box;
}
.twfox-multi-arena.is-duel {
  gap: clamp(22px, 3.8vw, 56px);
}
#twfoxtetrio-multi-game .twfox-game-canvas {
  max-height: 88vh;
  width: auto;
  height: auto;
}
.twfox-multi-side-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 0;
  max-width: none;
}
.twfox-score-lb {
  position: fixed;
  top: 14px;
  right: 16px;
  width: 248px;
  z-index: 8;
  background: rgba(0, 0, 0, 0.56);
  border: 0;
  border-top: 2px solid rgba(255, 255, 255, 0.22);
  border-radius: 2px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.52);
  backdrop-filter: blur(4px);
  overflow: hidden;
  text-align: left;
  font-family: HUN, sans-serif;
}
.twfox-score-lb-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid #fff2;
  font-size: 0.88em;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.08em;
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
  padding: 4px 10px;
  border-top: 1px solid #fff1;
  font-size: 0.92em;
  font-weight: 800;
  color: #edf1ff;
}
.twfox-score-lb-row:first-child { border-top: 0; }
.twfox-score-lb-row.is-first { color: #ffe066; }
.twfox-score-lb-row.is-self { background: rgba(72, 184, 255, 0.16); }
.twfox-score-lb-row.is-ko { opacity: 0.48; color: #ff8ea3; }
.twfox-score-lb-val {
  font-variant-numeric: tabular-nums;
  color: #ffffff;
}
.twfox-opponents-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  justify-content: center;
  align-items: flex-start;
  max-width: min(44vw, 560px);
}
.twfox-opponents-grid.is-duel {
  max-width: none;
  flex-wrap: nowrap;
  align-items: center;
}
.twfox-opp-card {
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 2px 4px;
  text-align: center;
  box-shadow: none;
  transition: opacity 180ms ease;
}
.twfox-opp-card.is-duel {
  padding: 0;
  margin-top: 12px;
}
.twfox-opp-card.is-duel canvas {
  height: min(62vh, 440px);
  width: auto;
  aspect-ratio: 1 / 2;
}
.twfox-opp-card.is-ko {
  opacity: 0.65;
}
.twfox-opp-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 3px 6px;
  background: linear-gradient(to right, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0.34));
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 2px 2px 0 0;
  font-family: HUN, sans-serif;
  font-weight: 800;
  font-size: 0.94em;
  margin-bottom: 2px;
  color: #ffffff;
  text-shadow: 0 1px 4px #000;
}
.twfox-opp-card.is-duel .twfox-opp-hdr {
  padding: 4px 8px;
  font-size: 1.08em;
  margin-bottom: 4px;
}
.twfox-opp-card.is-ko .twfox-opp-hdr {
  color: #ff8ea3;
}
.twfox-opp-rank {
  padding: 0 4px;
  border-radius: 2px;
  font-size: 0.85em;
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}
.twfox-opp-card.is-ko .twfox-opp-rank {
  background: rgba(217, 54, 84, 0.35);
  color: #ffb8c4;
}
.twfox-opp-stats {
  margin-top: 4px;
  font-family: HUN, sans-serif;
  font-size: 0.84em;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.78);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  text-shadow: 0 1px 4px #000;
}
.twfox-opp-card.is-duel .twfox-opp-stats {
  font-size: 0.96em;
  margin-top: 6px;
}
.twfox-finish-overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.65);
}
.twfox-finish-card {
  position: relative;
  overflow: hidden;
  min-width: min(440px, 86vw);
  padding: 24px 36px;
  border-radius: 3px;
  text-align: center;
  background-color: #271c38;
  border-top: 3px solid #594182;
  border-left: 3px solid #412f61;
  border-right: 3px solid #201730;
  border-bottom: 3px solid #140d1f;
  box-shadow: 0 12px 42px rgba(0, 0, 0, 0.85);
  animation: twfoxWinnerBurst 380ms cubic-bezier(0.2, 1.2, 0.4, 1) forwards;
}
.twfox-finish-card::after {
  content: "";
  position: absolute;
  top: -30%;
  left: -60%;
  width: 45%;
  height: 160%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.16), transparent);
  transform: rotate(22deg);
  animation: twfoxWinnerSweep 1.1s ease-out 150ms forwards;
}
.twfox-finish-card.is-defeat {
  background-color: #1c1829;
  border-top-color: #463a66;
}
.twfox-finish-kicker {
  font-family: HUN, sans-serif;
  font-size: 1em;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: #c9b2ed;
  text-transform: uppercase;
}
.twfox-finish-card.is-defeat .twfox-finish-kicker {
  color: #a69ac7;
}
.twfox-finish-title {
  margin: 6px 0 4px;
  font-family: HUN, sans-serif;
  font-size: clamp(30px, 4.4vw, 50px);
  font-weight: 900;
  letter-spacing: 0.06em;
  color: #ffffff;
  text-shadow: 0 3px 14px rgba(0, 0, 0, 0.7);
}
.twfox-finish-sub {
  font-family: HUN, sans-serif;
  font-size: 1.2em;
  font-weight: 800;
  color: #dfd1f7;
  letter-spacing: 0.05em;
}
@keyframes twfoxWinnerBurst {
  0% { opacity: 0; transform: scale(0.72) translateY(14px); }
  75% { opacity: 1; transform: scale(1.03) translateY(-1px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes twfoxWinnerSweep {
  0% { left: -60%; }
  100% { left: 150%; }
}
#twfoxtetrio-multi-results {
  width: 100%;
  height: 100%;
  padding: 2em 1.2em 1.2em;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  overflow: hidden;
}
.twfox-results-shell {
  width: min(820px, 94vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background-color: #0007;
  border: 0;
  border-radius: 6px;
  box-shadow: 0 18px 54px rgba(0, 0, 0, 0.72);
  padding: 16px 20px;
  box-sizing: border-box;
}
.twfox-res-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 12px 16px;
  border-radius: 3px;
  background-color: #372b51;
  border-top: 3px solid #453469;
  border-left: 3px solid #413163;
  border-right: 3px solid #2b2140;
  border-bottom: 3px solid #1b1429;
}
.twfox-res-hero-tag {
  font-family: HUN, sans-serif;
  font-size: 0.9em;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #cbb5ed;
}
.twfox-res-hero-name {
  font-family: HUN, sans-serif;
  font-size: clamp(24px, 3vw, 36px);
  font-weight: 900;
  color: #ffffff;
  letter-spacing: 0.04em;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.55);
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
  gap: 6px;
  overflow-y: auto;
  max-height: 52vh;
  padding-right: 2px;
}
.twfox-res-row {
  display: grid;
  grid-template-columns: 58px minmax(0, 1.3fr) repeat(4, auto);
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-radius: 3px;
  background-color: #2c2242;
  border-top: 2px solid #3f315e;
  border-right: 2px solid #241c36;
  border-bottom: 2px solid #171224;
  border-left: 4px solid #6b5399;
  font-family: HUN, sans-serif;
  color: #eef3ff;
  animation: twfoxResultRowIn 300ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
.twfox-res-row.is-rank-1 {
  background-color: #3d3120;
  border-top-color: #7d6438;
  border-left-color: #ffd84d;
}
.twfox-res-row.is-rank-2 {
  background-color: #2f3344;
  border-left-color: #d6e0f0;
}
.twfox-res-row.is-rank-3 {
  background-color: #352926;
  border-left-color: #e0985c;
}
.twfox-res-row.is-self {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
}
.twfox-res-place {
  font-size: 1.35em;
  font-weight: 900;
  color: #cbbbe6;
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
  color: #d5cce6;
  min-width: 64px;
}
.twfox-res-stat span {
  display: block;
  font-size: 0.72em;
  color: #9382b3;
  letter-spacing: 0.06em;
}
.twfox-res-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 6px;
  border-top: 1px solid #fff1;
}
@keyframes twfoxResultRowIn {
  0% { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}
.twfox-badge {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 2px;
  font-size: 0.85em;
  font-weight: 800;
  background: rgba(0, 0, 0, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #e4d9f5;
}
#twfoxtetrio-pane-multi .twfox-btn {
  background-color: #29203b;
  border-top-color: #463666;
  border-left-color: #36294f;
  border-right-color: #1f172e;
  border-bottom-color: #140f1f;
  color: #e2d6f5;
}
#twfoxtetrio-pane-multi .twfox-btn.is-pri {
  background-color: #472e6b;
  border-top-color: #7952b3;
  border-left-color: #5e3e8c;
  border-right-color: #33204f;
  border-bottom-color: #1d1130;
  color: #ffffff;
}
#twfoxtetrio-pane-multi .twfox-select,
#twfoxtetrio-pane-multi .twfox-input {
  background: #000B;
  border: 1px solid #fff2;
  color: #fff;
}
#twfoxtetrio-pane-multi .twfox-code-card {
  background: #0006;
  border: 1px solid #fff2;
  border-radius: 3px;
}
#twfoxtetrio-pane-multi .twfox-code-value {
  font-family: PFW, 'Segoe UI', monospace;
  font-size: 1.9em;
  letter-spacing: 0.12em;
}
#menus[data-menu-type^='foxmod']:not([data-menu-type='foxmod_multi']) #header_text {
  color: #ffbe8e;
  transition: .5s color;
}
#menus[data-menu-type^='foxmod']:not([data-menu-type='foxmod_multi']) #footer {
  background: linear-gradient(to bottom, #1e1510 0, #362218 100%);
  border-top: 2px solid #4d2c1b;
}
#menus[data-menu-type^='foxmod']:not([data-menu-type='foxmod_multi']) #footer_text {
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
  padding: 10px 14px;
  background: #0006;
  border: 1px solid #fff2;
  border-radius: 3px;
}
.twfox-code-value {
  font-family: PFW, 'Segoe UI', monospace;
  font-size: 2.0em;
  font-weight: 900;
  letter-spacing: 0.12em;
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
.twfox-mutual-invite-wrap {
  margin-top: 4px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.36);
  border: 1px solid rgba(255, 123, 28, 0.28);
  border-left: 3px solid #FF7B1C;
  border-radius: 3px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.twfox-mutual-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-family: HUN, sans-serif;
  font-size: 0.92em;
  font-weight: 900;
  letter-spacing: 0.06em;
  color: #ffb47a;
}
.twfox-mutual-badge {
  padding: 1px 6px;
  border-radius: 2px;
  font-size: 0.76em;
  background: rgba(255, 123, 28, 0.22);
  border: 1px solid rgba(255, 123, 28, 0.45);
  color: #ffd3ad;
}
.twfox-mutual-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 185px;
  overflow-y: auto;
}
.twfox-mutual-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 8px;
  background: rgba(20, 14, 28, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}
.twfox-mutual-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.twfox-mutual-name {
  font-family: HUN, sans-serif;
  font-size: 1em;
  font-weight: 800;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.twfox-mutual-sub {
  font-size: 0.76em;
  color: #b7a3d4;
}
.twfox-mutual-empty {
  margin: 0;
  font-size: 0.85em;
  color: #b5a3d4;
  line-height: 1.35;
}
.twfox-friend-invite-btn.is-fox-orange {
  border-color: #FF7B1C;
  background: linear-gradient(180deg, rgba(255, 123, 28, 0.36) 0%, rgba(168, 66, 8, 0.5) 100%);
  color: #ffe3cc;
}
.twfox-friend-invite-btn.is-fox-orange:hover:not(:disabled) {
  filter: brightness(1.16);
  border-color: #ffa55c;
}
.twfox-friend-invite-btn.is-cooldown {
  border-color: rgba(255, 123, 28, 0.42);
  background: rgba(255, 123, 28, 0.14);
  color: #ffb87e;
  opacity: 0.82;
  cursor: not-allowed;
}
.twfox-friend-invite-btn.is-in-room {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: #9ba5c4;
  opacity: 0.65;
  cursor: not-allowed;
}
.social_relationship .social_relationship_button.twfox-social-invite-btn,
.twfox-social-invite-btn {
  display: none;
  margin-left: .25em;
  border: 1px solid #8a3d0a;
  background-color: rgba(42, 18, 5, 0.72);
  box-sizing: border-box;
  height: 2.5em;
  width: 2.5em;
  border-radius: 3px;
  cursor: pointer;
  position: relative;
  vertical-align: top;
  transition: .2s border-color, .2s background-color, .2s opacity;
}
body.twfox-in-multi-room .social_relationship .social_relationship_button.twfox-social-invite-btn,
body.twfox-in-multi-room .twfox-social-invite-btn {
  display: inline-block;
}
.social_relationship .social_relationship_button.twfox-social-invite-btn:hover:not(.active):not(.is-in-room),
.twfox-social-invite-btn:hover:not(.active):not(.is-in-room) {
  border-color: #FF7B1C;
  background-color: rgba(255, 123, 28, 0.26);
}
.social_relationship .social_relationship_button.twfox-social-invite-btn svg,
.twfox-social-invite-btn svg {
  position: absolute;
  left: calc(.375em - 1px);
  top: calc(.375em - 1px);
  height: 1.75em;
  width: 1.75em;
  opacity: .78;
  transition: .2s opacity, .2s transform;
  pointer-events: none;
}
.social_relationship .social_relationship_button.twfox-social-invite-btn:hover svg,
.twfox-social-invite-btn:hover svg {
  opacity: 1;
}
.social_relationship .social_relationship_button.twfox-social-invite-btn.active,
.twfox-social-invite-btn.active {
  border-color: #FF7B1C;
  background-color: rgba(255, 123, 28, 0.42);
  cursor: not-allowed;
}
.social_relationship .social_relationship_button.twfox-social-invite-btn.active svg,
.twfox-social-invite-btn.active svg {
  opacity: 0;
  transition: .3s opacity;
}
.social_relationship .social_relationship_button.twfox-social-invite-btn.activated svg,
.twfox-social-invite-btn.activated svg {
  animation: .3s SocialRelationshipButtonInvite cubic-bezier(.16, -.55, .54, 1.3);
}
.social_relationship .social_relationship_button.twfox-social-invite-btn span,
.twfox-social-invite-btn span {
  position: absolute;
  left: 0;
  right: 0;
  top: .4em;
  font-family: HUN, sans-serif;
  font-size: 1.5em;
  text-align: center;
  color: #ffe3cc;
  transform: scale(.5);
  opacity: 0;
  transition: .2s opacity, .2s transform;
  pointer-events: none;
}
.social_relationship .social_relationship_button.twfox-social-invite-btn.active:not(.activated) span,
.twfox-social-invite-btn.active:not(.activated) span {
  transform: scale(1);
  opacity: 1;
}
.social_relationship .social_relationship_button.twfox-social-invite-btn.is-in-room,
.twfox-social-invite-btn.is-in-room {
  border-color: rgba(255, 255, 255, 0.16);
  background-color: rgba(0, 0, 0, 0.55);
  opacity: .38;
  cursor: not-allowed;
}
.social_relationship .social_relationship_button.twfox-social-invite-btn.is-in-room svg,
.twfox-social-invite-btn.is-in-room svg {
  opacity: .42;
}
.notification.twfox-invite-notif {
  --pri: #FF7B1C;
  --sec: #FF7B1C;
  border-color: #FF7B1C !important;
  border-left: 4px solid #FF7B1C !important;
  background: linear-gradient(135deg, rgba(48, 22, 7, 0.96) 0%, rgba(22, 11, 5, 0.98) 100%) !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.78), 0 0 20px rgba(255, 123, 28, 0.3) !important;
  color: #fff3e8;
}
.notification.twfox-invite-notif .notification_icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 123, 28, 0.18);
  border: 1px solid rgba(255, 123, 28, 0.55);
  border-radius: 3px;
}
.notification.twfox-invite-notif .notification_icon svg {
  width: 24px;
  height: 24px;
}
.notification.twfox-invite-notif h1 {
  color: #ffb070 !important;
  font-family: HUN, sans-serif;
  letter-spacing: 0.05em;
}
.notification.twfox-invite-notif p {
  color: #ffe8d6 !important;
}
.notification.twfox-invite-notif .notification_timeoutbar {
  background: #FF7B1C !important;
}
.notification.twfox-invite-notif .notification_button.pri {
  background: #FF7B1C !important;
  color: #190b02 !important;
  font-weight: 900;
}
.twfox-notif-fallback {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 10000010;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
.twfox-notif-fallback .twfox-invite-notif {
  pointer-events: all;
  min-width: 310px;
  max-width: 390px;
  padding: 10px 12px;
  border-radius: 4px;
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
.twfox-asset-preview-wrap {
  margin-top: 6px;
  min-height: 20px;
}
.twfox-asset-preview-strip {
  display: block;
  height: 28px;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  background: #070a12;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 3px;
  padding: 2px 5px;
}
.twfox-asset-preview-loading {
  display: inline-block;
  font-size: 0.78em;
  color: #7e8fb8;
  font-style: italic;
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
/* Pre-game Solo Mode Lobby (matching TETR.IO 40 LINES / BLITZ screen) */
#twfoxtetrio-pane-solo-lobby {
  --solo-bg: #523d2d;
  --solo-top: #99633b;
  --solo-left: #77563e;
  --solo-bottom: #271c14;
  --solo-right: #3b291c;
  --solo-title: #ffd28c;
  --solo-muted: #c9954c;
  --solo-start-bg: #70523c;
  --solo-start-border: #b3825d;
  --solo-start-color: #f4c19a;
}
#twfoxtetrio-pane-solo-lobby .scroller_block {
  background-color: var(--solo-bg) !important;
  border-top: 3px solid var(--solo-top) !important;
  border-left: 3px solid var(--solo-left) !important;
  border-bottom: 3px solid var(--solo-bottom) !important;
  border-right: 3px solid var(--solo-right) !important;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
}
.twfox-solo-toprow {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.twfox-solo-toprow h1 {
  margin: 0 !important;
  font-size: 2.35em;
  letter-spacing: 0.04em;
  color: var(--solo-title) !important;
}
.twfox-solo-pill {
  padding: 5px 11px;
  border-radius: 3px;
  font-family: HUN, sans-serif;
  font-size: 0.85em;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--solo-title);
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--solo-top);
}
.twfox-solo-desc {
  margin: 0.55em 0 1em !important;
  font-size: 1em;
  line-height: 1.3;
  color: var(--solo-muted) !important;
  text-transform: uppercase;
}
.twfox-solo-pb-label {
  margin: 0.45em 0 0 !important;
  font-size: 1.05em;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--solo-title) !important;
}
.twfox-solo-pb-value {
  margin: 0.02em 0 0 !important;
  font-family: HUN, sans-serif;
  font-size: 2.85em;
  font-weight: 900;
  letter-spacing: 0.02em;
  color: #ffffff !important;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
}
.twfox-solo-pb-sub {
  margin-top: 0.2em;
  font-size: 0.86em;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--solo-muted);
  text-transform: uppercase;
}
.twfox-solo-starter {
  padding: 0 !important;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  overflow: hidden;
}
.twfox-solo-music {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 0.65em 1.15em;
  font-family: HUN, sans-serif;
  font-size: 1.35em;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--solo-muted);
  cursor: pointer;
  user-select: none;
  background: rgba(0, 0, 0, 0.12);
  transition: filter 120ms ease, color 120ms ease;
}
.twfox-solo-music:hover {
  filter: brightness(1.2);
  color: var(--solo-title);
}
.twfox-solo-start {
  flex: 0 0 auto;
  min-width: 4.1em;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.16em 0.55em;
  border: 0;
  border-left: 2px solid var(--solo-start-border);
  background: var(--solo-start-bg);
  color: var(--solo-start-color);
  font-family: HUN, sans-serif;
  font-size: 3.15em;
  font-weight: 900;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: filter 120ms ease, transform 90ms ease;
}
.twfox-solo-start:hover {
  filter: brightness(1.18);
}
.twfox-solo-start:active {
  transform: scale(0.985);
}
.twfox-solo-opts-title {
  margin: 0 0 0.55em !important;
  font-size: 1.8em;
  color: var(--solo-title) !important;
}
.twfox-solo-pent-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.twfox-solo-pent-field {
  flex: 1 1 200px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.twfox-solo-pent-field span {
  font-family: HUN, sans-serif;
  font-size: 0.85em;
  font-weight: 800;
  color: var(--solo-title);
  letter-spacing: 0.06em;
}
.twfox-solo-check-row {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 5px 0;
  cursor: pointer;
  user-select: none;
  font-family: HUN, sans-serif;
  font-size: 1.18em;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--solo-title);
}
.twfox-solo-check-row.is-disabled {
  opacity: 0.42;
}
.twfox-solo-check-input {
  appearance: none;
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  margin: 0;
  border: 2px solid var(--solo-muted);
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.25);
  display: inline-grid;
  place-content: center;
  cursor: pointer;
  flex: 0 0 auto;
}
.twfox-solo-check-input:checked {
  background: var(--solo-title);
  border-color: #ffffff;
}
.twfox-solo-check-input:checked::after {
  content: "✓";
  color: #1f140d;
  font-size: 15px;
  font-weight: 900;
  line-height: 1;
}
.twfox-solo-check-note {
  font-size: 0.7em;
  font-weight: 600;
  color: var(--solo-muted);
  margin-left: auto;
  text-transform: uppercase;
}
.twfox-lang-upd-block {
  border-top-color: #FF7B1C !important;
}
.twfox-lang-pills,
.twfox-updater-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.twfox-lang-pill.is-active {
  border-color: #FF7B1C !important;
  background: linear-gradient(180deg, rgba(255, 123, 28, 0.38) 0%, rgba(168, 66, 8, 0.56) 100%) !important;
  color: #fff3e8 !important;
  box-shadow: 0 0 12px rgba(255, 123, 28, 0.28);
}
.twfox-updater-status.is-avail {
  border-color: rgba(255, 123, 28, 0.65);
  background: rgba(255, 123, 28, 0.22);
  color: #ffcca1;
}
.twfox-updater-status.is-ok {
  border-color: rgba(66, 232, 138, 0.55);
  background: rgba(66, 232, 138, 0.14);
  color: #a6ffd0;
}
.twfox-updater-cmd-wrap {
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.42);
  border: 1px solid rgba(255, 123, 28, 0.35);
  border-radius: 4px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.twfox-updater-cmd {
  font-family: Consolas, monospace;
  font-size: 0.88em;
  color: #ffd3ad;
  user-select: all;
  word-break: break-all;
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

  const EXTRA_CUSTOM_OPTION_KEYS = new Set([
    'can_undo',
    'retryisclear',
    'stride',
    'no_szo',
    'pro',
    'pro_alert',
    'pro_retry',
    'countdown',
    'countdown_interval',
    'precountdown',
    'prestart',
    'usezenconfig',
    'display_zen'
  ]);

  function applyCustomSoloPreset(presetMap) {
    const container = document.getElementById('custom_content_container');
    const startBtn = document.getElementById('start_custom');
    if (!container || !startBtn) return false;

    const existingKeys = new Set();
    for (const item of collectIndexedItems(container)) {
      const key = item.getAttribute('data-index');
      if (key) existingKeys.add(key);
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

    const tempInjected = [];
    for (const extraKey of EXTRA_CUSTOM_OPTION_KEYS) {
      if (existingKeys.has(extraKey)) continue;
      if (!Object.prototype.hasOwnProperty.call(presetMap, extraKey)) continue;
      const val = presetMap[extraKey];
      const input = document.createElement('input');
      input.className = 'room_config_item twfox-temp-opt';
      if (input.setAttribute) {
        input.setAttribute('data-index', extraKey);
        input.setAttribute('type', typeof val === 'boolean' ? 'checkbox' : 'number');
        input.setAttribute('style', 'display:none');
      }
      if (typeof val === 'boolean') {
        input.checked = val;
      } else {
        input.value = String(val);
      }
      container.appendChild(input);
      tempInjected.push(input);
    }

    const musicPicker = document.getElementById('music_picker_custom');
    const prevSong = musicPicker ? musicPicker.getAttribute('data-song') : null;
    if (musicPicker && presetMap.song) {
      musicPicker.setAttribute('data-song', String(presetMap.song));
    }
    try {
      startBtn.click();
    } finally {
      for (const tempEl of tempInjected) {
        if (typeof container.removeChild === 'function') {
          try {
            container.removeChild(tempEl);
          } catch (_) {}
        } else if (Array.isArray(container.children)) {
          const idx = container.children.indexOf(tempEl);
          if (idx >= 0) container.children.splice(idx, 1);
        }
      }
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
    let pendingPracticeReturnView = 'foxmod_practice';
    let practiceRunEntered = false;
    let scrollersInjected = false;
    let backHooked = false;
    let statusEl = null;
    let refreshAssetsStudio = null;
    let currentSoloModeKey = 'fourWide';
    let soloOptionsMap = soloLobbyLogic ? soloLobbyLogic.loadAllOptions() : {
      fourWide: { pro: false, proAlert: false, proRetry: false, stride: true, song: 'RANDOMcalm' },
      pentomino: { pro: false, stride: true, song: 'RANDOMcalm', pieceSet: 'pentomino', subMode: 'zen' },
      marathon: { pro: false, proAlert: false, proRetry: false, stride: true, song: 'RANDOMcalm' }
    };
    let refreshSoloLobbyUi = null;
    const scrollerMap = new Map();
    const toggleControls = [];
    const rangeControls = [];
    const langControls = [];

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
    const inviteTracker = foxInviteLogic && typeof foxInviteLogic.createInviteTracker === 'function'
      ? foxInviteLogic.createInviteTracker()
      : null;
    let inviteTicker = null;
    let refreshMutualInviteUi = null;
    let joinRoomByInviteCode = null;
    let showOrangeInviteNotification = null;
    let showOrangeNoticeNotification = null;
    let ejectFromClosedRoom = null;
    let sendInviteToFriend = null;
    const activeInviteToasts = new Map();
    let badgeInviteUnsub = null;
    let badgePresenceUnsub = null;
    let socialObserver = null;
    let hostMigrateTimer = null;

    const INVITE_PLANE_SVG =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" aria-hidden="true">' +
      '<g transform="translate(0,-267)">' +
      '<path style="fill:#ff7b1c;fill-opacity:0.55;" d="m 6.944345,285.10281 v 5.19917 l 4.448307,-3.4091 8.884236,-8.3552 z"/>' +
      '<path style="fill:#ffb370;fill-opacity:1;" d="m 28.610701,273.69802 -27.221402,9.16734 5.554826,2.23749 11.289643,-5.09419 -8.016206,6.41069 -3.273217,3.88263 4.448307,-3.4091 4.402474,1.77223 z"/>' +
      '</g></svg>';
    let bodyClassObserver = null;

    function isInActiveFoxRoom(snap) {
      const currentSnap = snap || (peerSession && peerSession.getSnapshot ? peerSession.getSnapshot() : null);
      const hasCode = Boolean(currentSnap && currentSnap.room && currentSnap.room.roomCode);
      if (!hasCode || activeFoxView !== 'foxmod_multi') return false;
      if (document.body && document.body.classList && document.body.classList.contains('innormalmulti')) {
        return false;
      }
      const menusEl = document.getElementById('menus');
      const menuType = menusEl && typeof menusEl.getAttribute === 'function' ? menusEl.getAttribute('data-menu-type') : '';
      if (menuType && menuType !== 'foxmod_multi') return false;
      return true;
    }

    let isSyncingBodyRoom = false;
    function syncBodyRoomClass() {
      if (isSyncingBodyRoom || !document.body || !document.body.classList) return;
      isSyncingBodyRoom = true;
      try {
        const inRoom = isInActiveFoxRoom();
        if (document.body.classList.contains('twfox-in-multi-room') !== inRoom) {
          setClass(document.body, 'twfox-in-multi-room', inRoom);
        }
        if (!inRoom) {
          clearSocialInviteButtons();
        }
      } finally {
        isSyncingBodyRoom = false;
      }
    }

    function syncIngameChromeClass() {
      if (!document.body || !document.body.classList) return;
      const inStage =
        activeFoxView === 'foxmod_pentomino' ||
        (activeFoxView === 'foxmod_multi' && multiSubMode === 'playing');
      setClass(document.body, 'twfox-ingame', inStage);
      if (activeFoxView !== 'foxmod_multi') {
        setClass(document.body, 'twfox-spectating', false);
      }
      syncBodyRoomClass();
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
      const activeLocale = cfg && cfg.language && cfg.language.locale === 'es' ? 'es' : 'en';
      for (const lc of langControls) {
        const active = lc.locale === activeLocale;
        setClass(lc.btn, 'is-active', active);
        if (typeof lc.btn.setAttribute === 'function') {
          lc.btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        }
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
      if (peerSession && !pendingPracticeReturn) {
        teardownPeerSession();
      }
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

      syncIngameChromeClass();
      if (targetView === 'foxmod_multi' && typeof refreshMutualInviteUi === 'function') {
        refreshMutualInviteUi();
      }

      if (targetView === 'foxmod_config') {
        syncConfigControls(runtimeApi.getConfig());
        if (typeof refreshAssetsStudio === 'function') {
          refreshAssetsStudio(true);
        }
      } else if (targetView === 'foxmod_solo_lobby') {
        if (typeof refreshSoloLobbyUi === 'function') {
          refreshSoloLobbyUi();
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
      if (activeFoxView === 'foxmod_multi' && peerSession) {
        teardownPeerSession();
      }
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

    function launchCustomPracticeMode(presetMap, isZen, returnView) {
      hideFoxmodScrollersImmediately();
      pendingPracticeReturn = true;
      pendingPracticeReturnView = returnView || 'foxmod_practice';
      practiceRunEntered = false;
      if (isZen && typeof runtimeApi.enterPracticeZen === 'function') {
        runtimeApi.enterPracticeZen();
      }
      applyCustomSoloPreset(presetMap);
    }

    function openSoloLobby(modeKey) {
      currentSoloModeKey = modeKey && (modeKey === 'pentomino' || modeKey === 'marathon') ? modeKey : 'fourWide';
      if (typeof refreshSoloLobbyUi === 'function') {
        refreshSoloLobbyUi();
      }
      navigateMenu('foxmod_solo_lobby');
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
            openSoloLobby('fourWide');
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
            openSoloLobby('pentomino');
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
            openSoloLobby('marathon');
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
            if (typeof runtimeApi.clearSoloPracticeLaunch === 'function') {
              runtimeApi.clearSoloPracticeLaunch();
            }
            launchCustomPracticeMode(CUSTOM_SOLO_PRESETS.zen, true, 'foxmod_practice');
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

    let syncPentStageSelectors = null;

    function buildSoloLobbyScroller() {
      const titleEl = createEl('h1', { id: 'twfoxtetrio-solo-title', text: '4WIDE' });
      const pillEl = createEl('span', { className: 'twfox-solo-pill', text: 'FOXMOD SOLO' });
      const descEl = createEl('p', { id: 'twfoxtetrio-solo-desc', className: 'twfox-solo-desc', text: '' });
      const pbLabelEl = createEl('h2', { id: 'twfoxtetrio-solo-pb-label', className: 'twfox-solo-pb-label', text: 'PERSONAL BEST SCORE' });
      const pbValueEl = createEl('h1', { id: 'twfoxtetrio-solo-pb-value', className: 'twfox-solo-pb-value', text: '0' });
      const pbSubEl = createEl('div', { id: 'twfoxtetrio-solo-pb-sub', className: 'twfox-solo-pb-sub', text: '' });

      const musicPickerEl = createEl('div', {
        id: 'twfoxtetrio-solo-music',
        className: 'twfox-solo-music',
        text: '♪ RANDOM: CALM',
        attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
      });
      const startBtnEl = createEl('button', {
        id: 'twfoxtetrio-solo-start',
        className: 'twfox-solo-start',
        text: 'START',
        type: 'button',
        attrs: { 'data-hover': 'hover', 'data-hit': 'confirm' }
      });

      const pentPieceSelect = createEl('select', { id: 'twfoxtetrio-solo-piece-select', className: 'twfox-select' }, [
        createEl('option', { text: 'PENTOMINOS (12)', attrs: { value: 'pentomino' } }),
        createEl('option', { text: 'TETROMINOS (7)', attrs: { value: 'tetromino' } }),
        createEl('option', { text: 'CHAOS MIX (19)', attrs: { value: 'chaos' } })
      ]);
      const pentModeSelect = createEl('select', { id: 'twfoxtetrio-solo-submode-select', className: 'twfox-select' }, [
        createEl('option', { text: 'ZEN / PRACTICE', attrs: { value: 'zen' } }),
        createEl('option', { text: '40 LINES', attrs: { value: '40l' } }),
        createEl('option', { text: 'BLITZ 2:00', attrs: { value: 'blitz' } })
      ]);
      const pentSelectorsRow = createEl('div', { id: 'twfoxtetrio-solo-pent-controls', className: 'twfox-solo-pent-row hidden' }, [
        createEl('label', { className: 'twfox-solo-pent-field' }, [
          createEl('span', { text: 'PIECE SET' }),
          pentPieceSelect
        ]),
        createEl('label', { className: 'twfox-solo-pent-field' }, [
          createEl('span', { text: 'SOLO MODE' }),
          pentModeSelect
        ])
      ]);

      function makeOptRow(id, labelText, noteText) {
        const input = createEl('input', { id, type: 'checkbox', className: 'twfox-solo-check-input' });
        const row = createEl(
          'label',
          {
            className: 'twfox-solo-check-row',
            attrs: { 'data-hover': 'tap', 'data-hit': 'click', for: id }
          },
          [
            input,
            createEl('span', { text: labelText }),
            noteText ? createEl('span', { className: 'twfox-solo-check-note', text: noteText }) : null
          ].filter(Boolean)
        );
        return { row, input };
      }

      const optPro = makeOptRow('twfoxtetrio-solo-opt-pro', 'PRO MODE', 'EXTRA STATS & FINESSE');
      const optProAlert = makeOptRow('twfoxtetrio-solo-opt-pro-alert', 'ALERT ON FINESSE FAULT', '');
      const optProRetry = makeOptRow('twfoxtetrio-solo-opt-pro-retry', 'RETRY ON FINESSE FAULT', '');
      const optStride = makeOptRow('twfoxtetrio-solo-opt-stride', 'STRIDE MODE', 'INSTANT R RETRY · FAST START · NO S/Z/O FIRST');

      const pane = createEl(
        'div',
        {
          id: 'twfoxtetrio-pane-solo-lobby',
          className: 'right_scroller hidden thidden twfox-native-scroller',
          attrs: { 'data-menuview': 'foxmod_solo_lobby' }
        },
        [
          createEl('div', { className: 'scroller_block ns' }, [
            createEl('div', { className: 'twfox-solo-toprow' }, [titleEl, pillEl]),
            descEl,
            pbLabelEl,
            pbValueEl,
            pbSubEl
          ]),
          createEl('div', { className: 'scroller_block twfox-solo-starter ns' }, [
            musicPickerEl,
            startBtnEl
          ]),
          createEl('div', { className: 'scroller_block ns' }, [
            createEl('h1', { className: 'twfox-solo-opts-title', text: 'OPTIONS' }),
            pentSelectorsRow,
            optPro.row,
            optProAlert.row,
            optProRetry.row,
            optStride.row
          ])
        ]
      );

      function getCurrentOpts() {
        const cur = soloOptionsMap[currentSoloModeKey] || {};
        return soloLobbyLogic ? soloLobbyLogic.normalizeModeOptions(cur) : cur;
      }

      function commitOpts(patch) {
        const next = Object.assign({}, getCurrentOpts(), patch || {});
        soloOptionsMap[currentSoloModeKey] = soloLobbyLogic ? soloLobbyLogic.normalizeModeOptions(next) : next;
        if (soloLobbyLogic) {
          soloLobbyLogic.saveAllOptions(soloOptionsMap);
        }
        renderSoloLobby();
      }

      function renderSoloLobby() {
        const specs = soloLobbyLogic && soloLobbyLogic.SOLO_MODE_SPECS;
        const spec = (specs && specs[currentSoloModeKey]) || (specs && specs.fourWide);
        const opts = getCurrentOpts();

        if (spec) {
          titleEl.textContent = spec.title;
          descEl.textContent = spec.subtitle;
          const headerText = document.getElementById('header_text');
          const footerText = document.getElementById('footer_text');
          if (activeFoxView === 'foxmod_solo_lobby') {
            if (headerText) headerText.textContent = spec.title;
            if (footerText) footerText.textContent = spec.footer;
          }
          if (spec.theme) {
            const t = spec.theme;
            pane.setAttribute(
              'style',
              `--solo-bg:${t.blockBg};--solo-top:${t.blockTop};--solo-left:${t.blockLeft};--solo-bottom:${t.blockBottom};--solo-right:${t.blockRight};--solo-title:${t.text};--solo-muted:${t.muted};--solo-start-bg:${t.startBg};--solo-start-border:${t.startBorder};--solo-start-color:${t.startColor};`
            );
          }
          setClass(pentSelectorsRow, 'hidden', !spec.hasPentominoSelectors);
          setClass(optProAlert.row, 'hidden', !spec.hasProFinesseSubOpts);
          setClass(optProRetry.row, 'hidden', !spec.hasProFinesseSubOpts);
        }

        const allPbs = soloLobbyLogic ? soloLobbyLogic.loadAllPbs() : {};
        const pbDisplay = soloLobbyLogic
          ? soloLobbyLogic.formatSoloPbDisplay(currentSoloModeKey, opts, allPbs)
          : { title: 'PERSONAL BEST', value: '0', subtitle: '' };
        pbLabelEl.textContent = pbDisplay.title;
        pbValueEl.textContent = pbDisplay.value;
        pbSubEl.textContent = pbDisplay.subtitle;

        if (currentSoloModeKey === 'pentomino') {
          pentPieceSelect.value = opts.pieceSet || 'pentomino';
          pentModeSelect.value = opts.subMode || 'zen';
          const setDesc = opts.pieceSet === 'chaos' ? 'CAOS 19' : opts.pieceSet === 'tetromino' ? 'TETROMINO 7' : 'PENTOMINO 12';
          const modeDesc = opts.subMode === '40l' ? '40 LINES' : opts.subMode === 'blitz' ? 'BLITZ 2:00' : 'ZEN / PRACTICA';
          musicPickerEl.textContent = `♪ ${setDesc} · ${modeDesc}`;
        } else {
          const choices = (soloLobbyLogic && soloLobbyLogic.SOLO_MUSIC_CHOICES) || [];
          const found = choices.find((m) => m.id === opts.song) || choices[0];
          musicPickerEl.textContent = `♪ ${found ? found.label : 'RANDOM: CALM'}`;
        }

        optPro.input.checked = Boolean(opts.pro);
        optProAlert.input.checked = Boolean(opts.proAlert);
        optProRetry.input.checked = Boolean(opts.proRetry);
        optStride.input.checked = Boolean(opts.stride);

        const disableSub = !opts.pro;
        setClass(optProAlert.row, 'is-disabled', disableSub);
        setClass(optProRetry.row, 'is-disabled', disableSub);
        optProAlert.input.disabled = disableSub;
        optProRetry.input.disabled = disableSub;
      }

      refreshSoloLobbyUi = renderSoloLobby;

      musicPickerEl.addEventListener('click', function () {
        if (currentSoloModeKey === 'pentomino') {
          const order = ['zen', '40l', 'blitz'];
          const opts = getCurrentOpts();
          const idx = order.indexOf(opts.subMode);
          commitOpts({ subMode: order[(idx + 1) % order.length] });
          return;
        }
        const choices = (soloLobbyLogic && soloLobbyLogic.SOLO_MUSIC_CHOICES) || [];
        if (choices.length === 0) return;
        const opts = getCurrentOpts();
        const curIdx = choices.findIndex((m) => m.id === opts.song);
        const nextChoice = choices[(curIdx + 1) % choices.length];
        commitOpts({ song: nextChoice.id });
      });

      pentPieceSelect.addEventListener('change', function () {
        commitOpts({ pieceSet: pentPieceSelect.value || 'pentomino' });
      });
      pentModeSelect.addEventListener('change', function () {
        commitOpts({ subMode: pentModeSelect.value || 'zen' });
      });
      optPro.input.addEventListener('change', function () {
        commitOpts({ pro: Boolean(optPro.input.checked) });
      });
      optProAlert.input.addEventListener('change', function () {
        commitOpts({ proAlert: Boolean(optProAlert.input.checked) });
      });
      optProRetry.input.addEventListener('change', function () {
        commitOpts({ proRetry: Boolean(optProRetry.input.checked) });
      });
      optStride.input.addEventListener('change', function () {
        commitOpts({ stride: Boolean(optStride.input.checked) });
      });

      startBtnEl.addEventListener('click', function () {
        const opts = getCurrentOpts();
        if (currentSoloModeKey === 'pentomino') {
          if (practiceGame) {
            practiceGame.reset({
              pieceSet: opts.pieceSet || 'pentomino',
              mode: opts.subMode || 'zen',
              noSzoFirst: Boolean(opts.stride),
              proMode: Boolean(opts.pro),
              strideMode: Boolean(opts.stride)
            });
          }
          if (typeof syncPentStageSelectors === 'function') {
            syncPentStageSelectors(opts.pieceSet || 'pentomino', opts.subMode || 'zen');
          }
          navigateMenu('foxmod_pentomino');
          return;
        }

        const basePreset = CUSTOM_SOLO_PRESETS[currentSoloModeKey] || CUSTOM_SOLO_PRESETS.fourWide;
        const built = soloLobbyLogic
          ? soloLobbyLogic.buildCustomLaunchConfig(basePreset, opts)
          : { preset: basePreset, options: opts };
        if (typeof runtimeApi.prepareSoloPracticeLaunch === 'function') {
          runtimeApi.prepareSoloPracticeLaunch(currentSoloModeKey, built.options);
        }
        launchCustomPracticeMode(built.preset, false, 'foxmod_solo_lobby');
      });

      renderSoloLobby();
      return pane;
    }

    function buildPentominoStageScroller() {
      const pieceSelect = createEl('select', { id: 'twfoxtetrio-practice-pieces', className: 'twfox-select' }, [
        createEl('option', { text: 'PENTOMINOS (12)', attrs: { value: 'pentomino' } }),
        createEl('option', { text: 'TETROMINOS (7)', attrs: { value: 'tetromino' } }),
        createEl('option', { text: 'CHAOS MIX (19)', attrs: { value: 'chaos' } })
      ]);
      pieceSelect.value = 'pentomino';

      const modeSelect = createEl('select', { id: 'twfoxtetrio-practice-mode', className: 'twfox-select' }, [
        createEl('option', { text: 'ZEN / PRACTICE', attrs: { value: 'zen' } }),
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

      function recordPentominoRun(snap) {
        if (!soloLobbyLogic || !snap) return;
        const completed = snap.winReason === '40l_complete';
        if ((snap.score || 0) <= 0 && (snap.lines || 0) <= 0 && !completed) return;
        soloLobbyLogic.recordSoloResult(
          'pentomino',
          { pieceSet: snap.pieceSet, subMode: snap.mode },
          {
            score: snap.score || 0,
            lines: snap.lines || 0,
            timeMs: snap.elapsedMs || 0,
            completed
          }
        );
      }

      if (pentominoEngine && foxmodCanvas) {
        const initPentOpts = soloOptionsMap.pentomino || {};
        practiceGame = pentominoEngine.createGame({
          pieceSet: initPentOpts.pieceSet || 'pentomino',
          mode: initPentOpts.subMode || 'zen',
          noSzoFirst: initPentOpts.stride !== false,
          proMode: Boolean(initPentOpts.pro),
          strideMode: initPentOpts.stride !== false,
          onFinish: recordPentominoRun,
          onReset: recordPentominoRun
        });
        practiceController = foxmodCanvas.createPlayfieldController({
          canvas: practiceCanvas,
          game: practiceGame,
          allowRestart: true
        });
      }

      syncPentStageSelectors = function (pSet, pMode) {
        pieceSelect.value = pSet || 'pentomino';
        modeSelect.value = pMode || 'zen';
      };

      function applyPracticeSettings() {
        if (!practiceGame) return;
        const nextSet = pieceSelect.value || 'pentomino';
        const nextMode = modeSelect.value || 'zen';
        const pOpts = soloOptionsMap.pentomino || {};
        soloOptionsMap.pentomino = soloLobbyLogic
          ? soloLobbyLogic.normalizeModeOptions(Object.assign({}, pOpts, { pieceSet: nextSet, subMode: nextMode }))
          : Object.assign({}, pOpts, { pieceSet: nextSet, subMode: nextMode });
        if (soloLobbyLogic) {
          soloLobbyLogic.saveAllOptions(soloOptionsMap);
        }
        practiceGame.reset({
          pieceSet: nextSet,
          mode: nextMode,
          noSzoFirst: soloOptionsMap.pentomino.stride !== false,
          proMode: Boolean(soloOptionsMap.pentomino.pro),
          strideMode: soloOptionsMap.pentomino.stride !== false
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

    function clearSocialInviteButtons() {
      const queryRoot = document.body || document.documentElement || document;
      if (!queryRoot || typeof queryRoot.querySelectorAll !== 'function') return;
      const btns = queryRoot.querySelectorAll('.twfox-social-invite-btn');
      for (let i = 0; i < btns.length; i++) {
        if (btns[i] && btns[i].parentNode && typeof btns[i].parentNode.removeChild === 'function') {
          btns[i].parentNode.removeChild(btns[i]);
        }
      }
    }

    function teardownPeerSession() {
      clearFinishTransition();
      if (hostMigrateTimer && typeof root.clearTimeout === 'function') {
        root.clearTimeout(hostMigrateTimer);
        hostMigrateTimer = null;
      }
      if (multiController) multiController.stop();
      if (inviteTicker && typeof root.clearInterval === 'function') {
        root.clearInterval(inviteTicker);
        inviteTicker = null;
      }
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
      clearSocialInviteButtons();
      if (typeof refreshMutualInviteUi === 'function') {
        refreshMutualInviteUi();
      }
    }

    function detachCurrentPeerOnly() {
      clearFinishTransition();
      if (hostMigrateTimer && typeof root.clearTimeout === 'function') {
        root.clearTimeout(hostMigrateTimer);
        hostMigrateTimer = null;
      }
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
      const activeSet = roomInfo.pieceSet === 'chaos' ? 'CHAOS MIX' : roomInfo.pieceSet === 'pentomino' ? 'PENTOMINOS' : 'NORMAL';
      const modeText = mode === 'blitz' ? 'BLITZ 2:00' : 'VERSUS KO';

      if (multiDom.resultsHeroTag) {
        multiDom.resultsHeroTag.textContent = `ROUND #${roundNum} · ${activeSet} ${modeText}`;
      }
      if (multiDom.resultsHeroName) {
        multiDom.resultsHeroName.textContent = winnerName === 'DRAW' ? 'DRAW' : `Nº1 ${winnerName}`;
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

        const resUser = String(entry.name || '').trim().toLowerCase();
        const isRealResUser = /^[a-z0-9_-]{2,20}$/.test(resUser) && !['host', 'player', 'anon'].includes(resUser);
        const row = createEl(
          'div',
          {
            className: rowClasses,
            style: `animation-delay:${idx * 85}ms`
          },
          [
            createEl('div', { className: 'twfox-res-place', text: `Nº${rank}` }),
            createEl('div', { className: 'twfox-res-player' }, [
              createEl('span', {
                className: isRealResUser ? 'twfox-paw-target tetra_pop' : 'twfox-paw-target',
                text: entry.name + (isSelf ? ' (YOU)' : ''),
                style: isRealResUser ? 'cursor:pointer;' : '',
                attrs: { 'data-username': isRealResUser ? resUser : (entry.name || '') }
              }),
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

      const foxBadge = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.foxPawBadge;
      if (foxBadge && typeof foxBadge.rescan === 'function') {
        foxBadge.rescan();
      }

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

      const isHost = snap.role === 'host';
      const selfId = isHost ? 'host' : snap.selfId;
      const selfPlayer = (snap.players || []).find((p) => p.id === selfId) || null;
      const amSpectating = Boolean(selfPlayer ? selfPlayer.spectator : snap.spectator);

      if (evType === 'match_start' && detail && pentominoEngine && foxmodCanvas) {
        clearFinishTransition();
        if (amSpectating) {
          multiGame = null;
          if (multiController) multiController.setGame(null);
          setClass(multiCanvas, 'hidden', true);
          if (multiDom.spectatorBanner) setClass(multiDom.spectatorBanner, 'hidden', false);
          showMultiSubMode('playing');
        } else {
          setClass(multiCanvas, 'hidden', false);
          if (multiDom.spectatorBanner) setClass(multiDom.spectatorBanner, 'hidden', true);
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
      }

      if (evType === 'garbage' && detail && multiGame && !amSpectating) {
        multiGame.receiveGarbage(detail.amount || 0);
      }

      if (evType === 'round_end' && detail) {
        if (multiController) multiController.stop();
        renderResultsScreen(snap, detail);
        if (multiSubMode === 'playing') {
          const myId = isHost ? 'host' : snap.selfId;
          const standings = Array.isArray(detail.standings) ? detail.standings : [];
          const selfEntry = standings.find((r) => r.id === myId) || null;
          const winnerName = detail.winner || snap.room.winner || 'DRAW';
          const isVictory = Boolean(!amSpectating && winnerName !== 'DRAW' && selfEntry && selfEntry.placement === 1);
          if (multiDom.finishCard) {
            setClass(multiDom.finishCard, 'is-defeat', !isVictory);
          }
          if (multiDom.finishKicker) {
            multiDom.finishKicker.textContent = `ROUND #${detail.round || snap.room.round || 1} COMPLETE`;
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
                : amSpectating
                  ? 'SPECTATOR VIEW · MATCH COMPLETE'
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

      if (evType === 'host_migrate_self' && detail && p2pRoom) {
        const myName = resolveLocalUsername(runtimeApi, detail.successorName || 'HOST');
        const nextCode = detail.roomCode || '';
        const prevHost = detail.previousHostName || 'Previous HOST';
        detachCurrentPeerOnly();
        const promotedHost = p2pRoom.createHostServer({
          hostName: myName,
          roomCode: nextCode,
          roomName: `${myName}'S FOXROOM`,
          pieceSet: detail.pieceSet || 'tetromino',
          gameMode: detail.gameMode || 'vs',
          blitzDurationMs: detail.blitzDurationMs || 120000,
          garbageMultiplier: detail.garbageMultiplier ?? 1,
          gravityLevel: detail.gravityLevel || 1,
          round: detail.round || 0,
          chat: Array.isArray(detail.chat) ? detail.chat : []
        });
        bindPeerSession(promotedHost);
        multiDom.setCenterTab('invite');
        showMultiSubMode('lobby');
        if (activeFoxView !== 'foxmod_multi') {
          navigateMenu('foxmod_multi');
        }
        promotedHost.sendChat(`[HOST] ${prevHost} left — ${myName} is now the room HOST.`);
        if (multiDom.hostInviteStatus) {
          multiDom.hostInviteStatus.textContent = `Host rotated — you are now HOST of #${nextCode}!`;
        }
        if (typeof showOrangeNoticeNotification === 'function') {
          showOrangeNoticeNotification('FOXMOD HOST ROTATED', `You are now the HOST of room #${nextCode}.`);
        }
        return;
      }

      if (evType === 'host_migrating' && detail && p2pRoom) {
        const nextCode = detail.roomCode || '';
        const nextHostLabel = detail.successorName || 'next player';
        const prevSpec = Boolean(snap && snap.spectator);
        detachCurrentPeerOnly();
        showMultiSubMode('lobby');
        if (multiDom.winnerBanner) {
          multiDom.winnerBanner.textContent = `HOST LEFT · ROTATING TO ${nextHostLabel}...`;
        }
        if (multiDom.hostInviteStatus) {
          multiDom.hostInviteStatus.textContent = `Previous Host left — reconnecting to ${nextHostLabel} on #${nextCode}...`;
        }
        if (typeof root.setTimeout === 'function') {
          hostMigrateTimer = root.setTimeout(async function () {
            hostMigrateTimer = null;
            if (!nextCode || activeFoxView !== 'foxmod_multi') return;
            try {
              const myName = resolveLocalUsername(runtimeApi, 'PLAYER');
              const migratedClient = p2pRoom.createClientPeer({
                playerName: myName,
                spectator: prevSpec,
                joinTimeoutMs: 9000
              });
              bindPeerSession(migratedClient);
              await migratedClient.joinByCode(nextCode);
            } catch (_) {
              ejectFromClosedRoom(`Host left and migration to ${nextHostLabel} failed.`);
            }
          }, 420);
          if (hostMigrateTimer && typeof hostMigrateTimer.unref === 'function') {
            hostMigrateTimer.unref();
          }
        } else {
          ejectFromClosedRoom('Host left — returned to FOXMOD.');
        }
        return;
      }

      if (evType === 'host_closed') {
        const closedHost = (detail && detail.hostName) || 'HOST';
        ejectFromClosedRoom(`${closedHost} left — FOXMOD room closed.`);
        return;
      }

      if (evType === 'connected' && snap.role !== 'host') {
        closeMultiRequest();
        multiDom.setCenterTab('invite');
        showMultiSubMode('lobby');
        if (activeFoxView !== 'foxmod_multi') {
          navigateMenu('foxmod_multi');
        }
      }

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
      if (document.body && document.body.classList) {
        setClass(document.body, 'twfox-spectating', activeFoxView === 'foxmod_multi' && amSpectating);
      }
      if (multiDom.hostWingLabel) {
        setClass(multiDom.hostWingLabel, 'hidden', false);
        setClass(multiDom.hostWingLabel, 'is-spectating', amSpectating);
      }
      if (multiDom.hostWingTitle) {
        multiDom.hostWingTitle.textContent = amSpectating ? 'SPECTATING' : 'PLAYING';
      }
      if (multiDom.hostWingSub) {
        multiDom.hostWingSub.textContent = amSpectating
          ? 'CLICK TO SWITCH TO PLAYERS'
          : 'CLICK TO SWITCH TO SPECTATORS';
      }
      if (multiDom.clientReadyBtn) {
        setClass(multiDom.clientReadyBtn, 'hidden', true);
      }
      setClass(multiDom.hostStartBtn, 'hidden', !isHost);
      if (multiDom.clientWaitTag) {
        setClass(multiDom.clientWaitTag, 'hidden', isHost);
        multiDom.clientWaitTag.textContent = amSpectating ? 'SPECTATING MATCH' : 'WAITING FOR HOST';
      }

      const activePlayers = (snap.players || []).filter((p) => !p.spectator);
      const activeCount = activePlayers.length;
      const specCount = (snap.players || []).length - activeCount;
      const canStart = activeCount >= 2;
      multiDom.playersHeading.textContent = specCount > 0
        ? `PLAYERS (${activeCount} + ${specCount} SPEC)`
        : `PLAYERS (${activeCount})`;
      multiDom.hostStartBtn.disabled = !canStart;
      setClass(multiDom.hostStartBtn, 'is-disabled', !canStart);
      multiDom.startCountSub.textContent = canStart
        ? `${activeCount} PLAYERS`
        : `NEED 2+ PLAYERS (${activeCount}/2)`;

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
          ? `ROUND #${snap.room.round} WINNER: ${snap.room.winner}`
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

      multiDom.playersList.innerHTML = '';
      for (const p of snap.players || []) {
        const isSpec = Boolean(p.spectator);
        const roleTag = isSpec ? 'SPECTATOR' : (p.isHost ? 'HOST' : p.ready ? 'READY' : 'WAIT');
        const profileUser = String(p.name || '').trim().toLowerCase();
        const isRealUser = /^[a-z0-9_-]{2,20}$/.test(profileUser) && !['host', 'player', 'anon'].includes(profileUser);
        const rowClass = [
          'twfox-player-row',
          isSpec ? 'is-spectator' : (p.isHost ? 'is-host' : (p.ready ? 'is-ready' : '')),
          isRealUser ? 'tetra_pop' : ''
        ].filter(Boolean).join(' ');
        const tagClass = isSpec
          ? 'twfox-player-tag is-spectator'
          : (!p.isHost && p.ready ? 'twfox-player-tag is-ready' : 'twfox-player-tag');
        const rowAttrs = isRealUser
          ? { 'data-username': profileUser, 'data-hover': 'tap', 'data-hit': 'click', title: 'Click to view TETR.IO profile' }
          : undefined;
        multiDom.playersList.appendChild(
          createEl('div', { className: rowClass, attrs: rowAttrs }, [
            createEl('span', {
              className: 'twfox-player-name twfox-paw-target',
              text: p.name,
              attrs: { 'data-username': p.name || '' }
            }),
            createEl('div', { className: 'twfox-player-meta' }, [
              createEl('span', { className: tagClass, text: roleTag }),
              createEl('span', { className: 'twfox-player-wins', text: `${p.wins || 0} / ${snap.room.round || 0}` })
            ])
          ])
        );
      }

      multiDom.chatLog.innerHTML = '';
      if (!snap.chat || snap.chat.length === 0) {
        multiDom.chatLog.appendChild(
          createEl('div', {
            className: 'twfox-chat-entry is-system',
            text: 'Welcome to chat! Host PC acts as the room server.'
          })
        );
      } else {
        for (const entry of snap.chat) {
          if (entry.system) {
            multiDom.chatLog.appendChild(
              createEl('div', {
                className: 'twfox-chat-entry is-system',
                text: entry.text
              })
            );
          } else {
            const chatUser = String(entry.author || '').trim().toLowerCase();
            const isRealChatUser = /^[a-z0-9_-]{2,20}$/.test(chatUser) && !['host', 'player', 'anon'].includes(chatUser);
            multiDom.chatLog.appendChild(
              createEl('div', { className: 'twfox-chat-entry' }, [
                createEl('h1', {
                  className: isRealChatUser ? 'chat_tag twfox-paw-target tetra_pop' : 'chat_tag twfox-paw-target',
                  text: entry.author,
                  attrs: { 'data-username': isRealChatUser ? chatUser : (entry.author || '') }
                }),
                createEl('span', { text: entry.text })
              ])
            );
          }
        }
      }

      if (multiSubMode === 'playing' && foxmodCanvas) {
        const playingPool = (snap.players || []).filter((p) => !p.spectator);
        const rankedPlayers = playingPool.slice().sort((a, b) => {
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
                createEl('span', {
                  className: 'twfox-paw-target',
                  text: `Nº${rankNum} ${pl.name}${koTag}`,
                  attrs: { 'data-username': pl.name || '' }
                }),
                createEl('span', {
                  className: 'twfox-score-lb-val',
                  text: metricText
                })
              ])
            );
          });
        }

        const opponents = playingPool.filter((p) => p.id !== selfId);
        const isDuel = opponents.length === 1;
        if (multiDom.multiArena) {
          setClass(multiDom.multiArena, 'is-duel', isDuel);
        }
        setClass(multiDom.opponentsGrid, 'is-duel', isDuel);
        multiDom.opponentsGrid.innerHTML = '';
        for (const opp of opponents) {
          const oppRankIdx = rankedPlayers.findIndex((x) => x.id === opp.id);
          const oppRank = opp.alive === false && opp.placement ? opp.placement : (oppRankIdx >= 0 ? oppRankIdx + 1 : '-');
          const miniCanvas = createEl('canvas', {
            attrs: isDuel ? { width: '220', height: '440' } : { width: '120', height: '240' },
            style: 'background:transparent;display:block;'
          });
          foxmodCanvas.renderMiniBoard(miniCanvas, opp.board, opp.alive, opp.placement);
          const statText = activeMode === 'blitz'
            ? `${Math.round(Number(opp.score) || 0).toLocaleString('en-US')} PTS · L:${opp.lines || 0}`
            : `${Number(opp.vs || 0).toFixed(1)} VS · ATK:${opp.attack || 0}`;
          const cardClasses = ['twfox-opp-card'];
          if (isDuel) cardClasses.push('is-duel');
          if (opp.alive === false) cardClasses.push('is-ko');
          multiDom.opponentsGrid.appendChild(
            createEl('div', { className: cardClasses.join(' ') }, [
              createEl('div', { className: 'twfox-opp-hdr' }, [
                createEl('span', {
                  className: 'twfox-paw-target',
                  text: opp.name,
                  attrs: { 'data-username': opp.name || '' }
                }),
                createEl('span', { className: 'twfox-opp-rank', text: opp.alive === false ? `KO Nº${oppRank}` : `Nº${oppRank}` })
              ]),
              miniCanvas,
              createEl('div', { className: 'twfox-opp-stats', text: statText })
            ])
          );
        }
      }

      const foxBadge = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.foxPawBadge;
      if (foxBadge && typeof foxBadge.rescan === 'function') {
        foxBadge.rescan();
      }
      syncBodyRoomClass();
      if (typeof refreshMutualInviteUi === 'function') {
        refreshMutualInviteUi();
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

      const mutualInviteList = createEl('div', { id: 'twfoxtetrio-mutual-invite-list', className: 'twfox-mutual-list' });
      const mutualInviteEmpty = createEl('p', {
        id: 'twfoxtetrio-mutual-invite-empty',
        className: 'twfox-mutual-empty',
        text: 'No online mutual FOXMOD friends detected yet. Open PEOPLE once to sync mutual friends.'
      });
      const mutualInviteWrap = createEl('div', { id: 'twfoxtetrio-mutual-invite-wrap', className: 'twfox-mutual-invite-wrap' }, [
        createEl('div', { className: 'twfox-mutual-hdr' }, [
          createEl('span', { text: 'INVITE MUTUAL FRIENDS' }),
          createEl('span', { className: 'twfox-mutual-badge', text: 'FOXMOD · 1-CLICK' })
        ]),
        mutualInviteEmpty,
        mutualInviteList
      ]);

      const hostInviteBox = createEl('div', { id: 'twfoxtetrio-host-invite-box', className: 'twfox-invite-stack' }, [
        createEl('p', { style: 'margin:0;color:#c9b9db;', text: 'ROOM INVITE CODE — Friends enter this #CODE in JOIN LOBBY:' }),
        createEl('div', { className: 'twfox-code-card' }, [hostRoomCodeLabel, hostCopyCodeBtn]),
        hostInviteStatus,
        mutualInviteWrap,
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
      const hostWingTitle = createEl('div', { text: 'PLAYING' });
      const hostWingSub = createEl('span', { text: 'CLICK TO SWITCH TO SPECTATORS' });
      const hostWingLabel = createEl('div', {
        id: 'twfoxtetrio-host-wing-btn',
        className: 'twfox-footer-wing-btn ns',
        attrs: { 'data-hover': 'hover', 'data-hit': 'click' }
      }, [
        hostWingTitle,
        hostWingSub
      ]);
      const clientReadySub = createEl('span', { text: 'CLICK TO TOGGLE READY STATUS' });
      const clientReadyBtn = createEl('div', { id: 'twfoxtetrio-client-ready-btn', className: 'twfox-footer-wing-btn hidden' }, [
        createEl('div', { text: 'READY' }),
        clientReadySub
      ]);
      const clientWaitTag = createEl('div', {
        id: 'twfoxtetrio-client-wait-tag',
        className: 'twfox-footer-wait-tag hidden',
        text: 'WAITING FOR HOST'
      });
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
          createEl('div', { className: 'twfox-footer-wing-wrap' }, [hostWingLabel, clientReadyBtn]),
          hostStartBtn,
          clientWaitTag,
          lobbyModeTag
        ])
      ]);

      // In-game VS / BLITZ stage with right-side score leaderboard, opponent mini boards & finish overlay
      const spectatorBanner = createEl('div', {
        id: 'twfoxtetrio-spectator-banner',
        className: 'twfox-spectator-banner hidden',
        text: 'SPECTATING · WATCHING MATCH LIVE'
      });
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
      const multiArena = createEl('div', { className: 'twfox-multi-arena' }, [multiCanvas, sideCol]);
      const gameView = createEl('div', { id: 'twfoxtetrio-multi-game', className: 'twfox-stage-inner hidden' }, [
        backLobbyBtn,
        spectatorBanner,
        multiArena,
        finishOverlay
      ]);

      // Post-match podium & standings view (Nº1 survivor down to NºN)
      const resultsHeroTag = createEl('div', { className: 'twfox-res-hero-tag', text: 'ROUND #1 · VERSUS KO' });
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
        mutualInviteWrap,
        mutualInviteList,
        mutualInviteEmpty,
        multiArena,
        hostManualToggleBtn,
        hostManualPanel,
        joinStatus,
        hostStartBtn,
        hostWingLabel,
        hostWingTitle,
        hostWingSub,
        spectatorBanner,
        clientReadyBtn,
        clientReadySub,
        clientWaitTag,
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

      function applyInviteBtnState(btn, username, players, hasRoomCode, baseClass, idleLabel) {
        const now = Date.now();
        const inRoom = Boolean(foxInviteLogic && foxInviteLogic.isUserInRoom(username, players));
        const cooldownSec = inviteTracker ? inviteTracker.getCooldownRemainingSec(username, now) : 0;
        let nextDisabled = false;
        let nextText = idleLabel;
        let nextClass = `${baseClass} is-fox-orange`;
        let inCooldown = false;

        if (!hasRoomCode) {
          nextDisabled = true;
          nextText = 'NO CODE';
          nextClass = `${baseClass} is-in-room`;
        } else if (inRoom) {
          nextDisabled = true;
          nextText = 'IN ROOM';
          nextClass = `${baseClass} is-in-room`;
        } else if (cooldownSec > 0) {
          nextDisabled = true;
          nextText = `WAIT ${cooldownSec}S`;
          nextClass = `${baseClass} is-cooldown`;
          inCooldown = true;
        }

        if (btn.disabled !== nextDisabled) btn.disabled = nextDisabled;
        if (btn.textContent !== nextText) btn.textContent = nextText;
        if (btn.className !== nextClass) btn.className = nextClass;
        return inCooldown;
      }

      function ensureInviteTicker() {
        if (inviteTicker || typeof root.setInterval !== 'function') return;
        inviteTicker = root.setInterval(function () {
          let anyCooldown = false;
          const now = Date.now();
          const snap = peerSession && peerSession.getSnapshot ? peerSession.getSnapshot() : null;
          const players = (snap && snap.players) || [];
          const hasRoomCode = Boolean(snap && snap.room && snap.room.roomCode);

          if (multiDom && multiDom.mutualInviteList && typeof multiDom.mutualInviteList.querySelectorAll === 'function') {
            const btns = multiDom.mutualInviteList.querySelectorAll('.twfox-friend-invite-btn');
            for (let i = 0; i < btns.length; i++) {
              const btn = btns[i];
              const uname = btn.getAttribute ? btn.getAttribute('data-fox-invite-user') : '';
              if (uname && applyInviteBtnState(btn, uname, players, hasRoomCode, 'twfox-btn is-sm twfox-friend-invite-btn', 'INVITE')) {
                anyCooldown = true;
              }
            }
          }

          const docRoot = document.body || document.documentElement || document;
          if (docRoot && typeof docRoot.querySelectorAll === 'function') {
            const sBtns = docRoot.querySelectorAll('.twfox-social-invite-btn');
            for (let i = 0; i < sBtns.length; i++) {
              const btn = sBtns[i];
              const uname = btn.getAttribute ? btn.getAttribute('data-fox-invite-user') : '';
              if (uname && applySocialInviteBtnState(btn, uname, players, hasRoomCode)) {
                anyCooldown = true;
              }
            }
          }

          if (!anyCooldown && inviteTracker) {
            if (!hasRoomCode && typeof root.clearInterval === 'function') {
              root.clearInterval(inviteTicker);
              inviteTicker = null;
            } else if (anyCooldown === false && inviteTicker) {
              // Keep idle ticker stopped until next invite is sent.
              if (typeof root.clearInterval === 'function') {
                root.clearInterval(inviteTicker);
                inviteTicker = null;
              }
            }
          }
          void now;
        }, 1000);
        if (inviteTicker && typeof inviteTicker.unref === 'function') {
          inviteTicker.unref();
        }
      }

      sendInviteToFriend = function (targetUsername) {
        const foxBadge = getFoxPawBadge();
        const snap = peerSession && peerSession.getSnapshot ? peerSession.getSnapshot() : null;
        const room = snap && snap.room ? snap.room : null;
        const roomCode = room && room.roomCode ? String(room.roomCode) : '';
        if (!roomCode) {
          if (multiDom && multiDom.hostInviteStatus) {
            multiDom.hostInviteStatus.textContent = 'Create or join a room before inviting friends.';
          }
          return false;
        }
        if (!foxInviteLogic || !foxBadge || typeof foxBadge.sendRoomInvite !== 'function') {
          if (multiDom && multiDom.hostInviteStatus) {
            multiDom.hostInviteStatus.textContent = 'FOXMOD invite relay unavailable right now.';
          }
          return false;
        }
        const targetNorm = foxInviteLogic.normalizeUsername(targetUsername);
        if (!targetNorm) return false;
        if (foxInviteLogic.isUserInRoom(targetNorm, snap.players)) {
          if (multiDom && multiDom.hostInviteStatus) {
            multiDom.hostInviteStatus.textContent = `${targetNorm.toUpperCase()} is already in the room.`;
          }
          if (typeof refreshMutualInviteUi === 'function') refreshMutualInviteUi();
          return false;
        }
        const now = Date.now();
        if (inviteTracker && !inviteTracker.canInvite(targetNorm, now, snap.players)) {
          const rem = inviteTracker.getCooldownRemainingSec(targetNorm, now);
          if (multiDom && multiDom.hostInviteStatus && rem > 0) {
            multiDom.hostInviteStatus.textContent = `Wait ${rem}s before inviting ${targetNorm.toUpperCase()} again.`;
          }
          return false;
        }
        if (typeof foxBadge.hasFoxer === 'function' && !foxBadge.hasFoxer(targetNorm)) {
          if (multiDom && multiDom.hostInviteStatus) {
            multiDom.hostInviteStatus.textContent = `${targetNorm.toUpperCase()} does not appear online with FOXMOD.`;
          }
          return false;
        }

        const fromName = resolveLocalUsername(runtimeApi, 'HOST');
        const res = foxBadge.sendRoomInvite(targetNorm, {
          from: fromName,
          roomCode,
          roomName: room.roomName || '',
          gameMode: room.gameMode || 'vs',
          pieceSet: room.pieceSet || 'tetromino',
          ts: now
        });

        if (res && res.ok) {
          if (inviteTracker) inviteTracker.recordSent(targetNorm, now);
          const qRoot = document.body || document.documentElement || document;
          if (qRoot && typeof qRoot.querySelectorAll === 'function') {
            const sBtns = qRoot.querySelectorAll('.twfox-social-invite-btn');
            for (let i = 0; i < sBtns.length; i++) {
              const sBtn = sBtns[i];
              if (sBtn.getAttribute && sBtn.getAttribute('data-fox-invite-user') === targetNorm && sBtn.classList) {
                sBtn.classList.add('activated');
                if (typeof root.setTimeout === 'function') {
                  const animTimer = root.setTimeout(function () {
                    if (sBtn.classList) sBtn.classList.remove('activated');
                  }, 300);
                  if (animTimer && typeof animTimer.unref === 'function') animTimer.unref();
                }
              }
            }
          }
          if (multiDom && multiDom.hostInviteStatus) {
            multiDom.hostInviteStatus.textContent = `Sent orange FOXMOD invite to ${targetNorm.toUpperCase()}! (30s cooldown)`;
          }
          if (typeof refreshMutualInviteUi === 'function') refreshMutualInviteUi();
          ensureInviteTicker();
          return true;
        }

        if (multiDom && multiDom.hostInviteStatus) {
          const errMsg = res && res.reason === 'offline'
            ? 'Relay offline — cannot deliver direct FOXMOD invite yet.'
            : 'Could not send invite right now.';
          multiDom.hostInviteStatus.textContent = errMsg;
        }
        return false;
      };

      function applySocialInviteBtnState(btn, username, players, hasRoomCode) {
        const now = Date.now();
        const inRoom = Boolean(foxInviteLogic && foxInviteLogic.isUserInRoom(username, players));
        const cooldownSec = inviteTracker ? inviteTracker.getCooldownRemainingSec(username, now) : 0;
        const countEl = btn.querySelector ? btn.querySelector('span') : null;
        let nextDisabled = false;
        let nextActive = false;
        let nextInRoom = false;
        let nextCount = '';
        let nextTitle = 'Invite to your FOXMOD room';
        let inCooldown = false;

        if (!hasRoomCode) {
          nextDisabled = true;
          nextInRoom = true;
          nextTitle = 'Join or create a FOXMOD room first';
        } else if (inRoom) {
          nextDisabled = true;
          nextInRoom = true;
          nextTitle = 'Already in your FOXMOD room';
        } else if (cooldownSec > 0) {
          nextDisabled = true;
          nextActive = true;
          nextCount = String(cooldownSec);
          nextTitle = `Wait ${cooldownSec}s before inviting again`;
          inCooldown = true;
        }

        if (btn.disabled !== nextDisabled) btn.disabled = nextDisabled;
        if (btn.classList) {
          setClass(btn, 'active', nextActive);
          setClass(btn, 'is-in-room', nextInRoom);
        }
        if (countEl && countEl.textContent !== nextCount) {
          countEl.textContent = nextCount;
        }
        if (btn.getAttribute && btn.setAttribute) {
          if (btn.getAttribute('title') !== nextTitle) btn.setAttribute('title', nextTitle);
          const nextAria = nextDisabled ? 'true' : 'false';
          if (btn.getAttribute('aria-disabled') !== nextAria) btn.setAttribute('aria-disabled', nextAria);
        }
        return inCooldown;
      }

      function syncSocialInviteButtons(snap) {
        const queryRoot = document.body || document.documentElement || document;
        if (!foxInviteLogic || !queryRoot || typeof queryRoot.querySelectorAll !== 'function') return;
        if (!isInActiveFoxRoom(snap)) {
          clearSocialInviteButtons();
          syncBodyRoomClass();
          return;
        }
        const roomCode = snap && snap.room && snap.room.roomCode ? snap.room.roomCode : '';
        const foxBadge = getFoxPawBadge();
        if (!foxBadge || typeof foxBadge.hasFoxer !== 'function') return;
        if (typeof foxBadge.refreshMutualFriends === 'function') {
          foxBadge.refreshMutualFriends(document);
        }
        const mutualList = typeof foxBadge.listMutualFriends === 'function' ? foxBadge.listMutualFriends() : [];
        const mutualSet = new Set(mutualList.map((m) => m.username));
        const rows = queryRoot.querySelectorAll('.social_relationship');
        const players = (snap && snap.players) || [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || typeof row.querySelector !== 'function') continue;
          const h1El = row.querySelector('h1');
          const spanEl = h1El && typeof h1El.querySelector === 'function' ? h1El.querySelector('span') : null;
          const nameEl = spanEl || h1El;
          const uname = foxInviteLogic.normalizeUsername(nameEl && nameEl.textContent ? nameEl.textContent : '');
          let existingBtn = row.querySelector('.twfox-social-invite-btn');
          const statusEl = row.querySelector('p');
          const statusTxt = statusEl && statusEl.textContent ? statusEl.textContent : '';
          const invBtn = row.querySelector('.social_relationship_button_invite');
          const invVisible = Boolean(invBtn && (!invBtn.classList || !invBtn.classList.contains('hidden')));
          const isOffline = Boolean(row.classList && row.classList.contains('offline'));
          const isBadStatus = /\b(not a friend|blocked|outgoing request|incoming request)\b/i.test(statusTxt);
          const isMutualVerified = Boolean(uname && !isOffline && !isBadStatus && (invVisible || mutualSet.has(uname)));
          const eligible = Boolean(isMutualVerified && foxBadge.hasFoxer(uname));

          if (!eligible) {
            if (existingBtn && existingBtn.parentNode) {
              existingBtn.parentNode.removeChild(existingBtn);
            }
            continue;
          }

          const holder = row.querySelector('.social_relationship_button_holder') || row;
          if (!existingBtn) {
            existingBtn = createEl(
              'div',
              {
                className: 'social_relationship_button twfox-social-invite-btn',
                html: INVITE_PLANE_SVG,
                attrs: {
                  role: 'button',
                  tabindex: '0',
                  title: 'Invite to your FOXMOD room',
                  'data-fox-invite-user': uname
                }
              },
              [createEl('span', { className: 'twfox-social-invite-count', text: '' })]
            );
            existingBtn.addEventListener('click', function (ev) {
              if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
              if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
              sendInviteToFriend(uname);
            });
            holder.appendChild(existingBtn);
          } else {
            if (existingBtn.parentNode !== holder) {
              holder.appendChild(existingBtn);
            }
            if (existingBtn.getAttribute && existingBtn.getAttribute('data-fox-invite-user') !== uname && existingBtn.setAttribute) {
              existingBtn.setAttribute('data-fox-invite-user', uname);
            }
          }

          if (applySocialInviteBtnState(existingBtn, uname, players, Boolean(roomCode))) {
            ensureInviteTicker();
          }
        }
      }

      let isRefreshingMutualUi = false;
      refreshMutualInviteUi = function () {
        if (isRefreshingMutualUi) return;
        isRefreshingMutualUi = true;
        try {
          const snap = peerSession && peerSession.getSnapshot ? peerSession.getSnapshot() : null;
          syncSocialInviteButtons(snap);
          if (!multiDom || !multiDom.mutualInviteList) return;

          const foxBadge = getFoxPawBadge();
          if (foxBadge && typeof foxBadge.refreshMutualFriends === 'function') {
            foxBadge.refreshMutualFriends(document);
          }
          const friends =
            foxInviteLogic && foxBadge && typeof foxBadge.listOnlineMutualFoxers === 'function'
              ? foxBadge.listOnlineMutualFoxers()
              : [];

          const players = (snap && snap.players) || [];
          const roomCode = (snap && snap.room && snap.room.roomCode) || '';
          multiDom.mutualInviteList.innerHTML = '';

          if (!friends || friends.length === 0) {
            if (multiDom.mutualInviteEmpty) {
              setClass(multiDom.mutualInviteEmpty, 'hidden', false);
            }
            return;
          }

          if (multiDom.mutualInviteEmpty) {
            setClass(multiDom.mutualInviteEmpty, 'hidden', true);
          }

          let needsTicker = false;
          for (const friend of friends) {
            const uname = friend.username;
            const invBtn = createEl('button', {
              className: 'twfox-btn is-sm twfox-friend-invite-btn',
              type: 'button',
              text: 'INVITE',
              attrs: { 'data-fox-invite-user': uname }
            });
            invBtn.addEventListener('click', function () {
              sendInviteToFriend(uname);
            });
            if (applyInviteBtnState(invBtn, uname, players, Boolean(roomCode), 'twfox-btn is-sm twfox-friend-invite-btn', 'INVITE')) {
              needsTicker = true;
            }
            multiDom.mutualInviteList.appendChild(
              createEl('div', { className: 'twfox-mutual-row' }, [
                createEl('div', { className: 'twfox-mutual-meta' }, [
                  createEl('span', {
                    className: 'twfox-mutual-name twfox-paw-target',
                    text: uname.toUpperCase(),
                    attrs: { 'data-username': uname }
                  }),
                  createEl('span', {
                    className: 'twfox-mutual-sub',
                    text: friend.statusText || 'FOXMOD Mutual Friend'
                  })
                ]),
                invBtn
              ])
            );
          }

          if (needsTicker) {
            ensureInviteTicker();
          }
          if (foxBadge && typeof foxBadge.rescan === 'function') {
            foxBadge.rescan();
          }
        } finally {
          isRefreshingMutualUi = false;
        }
      };

      joinRoomByInviteCode = async function (rawRoomCode) {
        if (!p2pRoom || !foxInviteLogic) return;
        const cleanCode = foxInviteLogic.normalizeRoomCode(rawRoomCode);
        if (!cleanCode) return;

        const socialEl = document.getElementById('social');
        const socialBg = document.getElementById('social_bg');
        if (socialEl && socialEl.classList && socialEl.classList.contains('open') && socialBg && typeof socialBg.click === 'function') {
          socialBg.click();
        }

        closeMultiRequest();
        if (peerSession) {
          teardownPeerSession();
        }
        const playerName = resolveLocalUsername(runtimeApi, 'PLAYER');
        const client = p2pRoom.createClientPeer({ playerName });
        bindPeerSession(client);
        multiDom.setCenterTab('invite');
        showMultiSubMode('lobby');
        navigateMenu('foxmod_multi');
        if (multiDom.hostInviteStatus) {
          multiDom.hostInviteStatus.textContent = `Accepting FOXMOD invite — joining #${cleanCode}...`;
        }
        try {
          const res = await client.joinByCode(cleanCode);
          if (multiDom.hostInviteStatus) {
            multiDom.hostInviteStatus.textContent = `Joined room #${(res && res.roomCode) || cleanCode}!`;
          }
        } catch (err) {
          if (multiDom.hostInviteStatus) {
            multiDom.hostInviteStatus.textContent = 'Error joining room: ' + (err && err.message ? err.message : err);
          }
        }
      };

      function removeInviteToast(toastKey) {
        const rec = activeInviteToasts.get(toastKey);
        if (!rec) return;
        activeInviteToasts.delete(toastKey);
        if (rec.timer && typeof root.clearTimeout === 'function') {
          root.clearTimeout(rec.timer);
        }
        if (rec.el && rec.el.parentNode) {
          rec.el.parentNode.removeChild(rec.el);
        }
      }

      function resolveNotificationsHost() {
        const nativeHost = document.getElementById('notifications');
        if (nativeHost) return nativeHost;
        let fallback = document.getElementById('twfoxtetrio-notif-fallback');
        if (!fallback && document.body) {
          fallback = createEl('div', { id: 'twfoxtetrio-notif-fallback', className: 'twfox-notif-fallback' });
          document.body.appendChild(fallback);
        }
        return fallback;
      }

      showOrangeNoticeNotification = function (titleText, bodyText) {
        const host = resolveNotificationsHost();
        if (!host) return;
        const toastKey = `notice:${titleText}`;
        removeInviteToast(toastKey);
        const okBtn = createEl('div', {
          className: 'notification_button flex-item pri',
          text: 'OK',
          attrs: { role: 'button', tabindex: '0' }
        });
        const toastEl = createEl(
          'div',
          {
            className: 'notification ns snotify modalnotify twfox-invite-notif',
            style: '--pri:#FF7B1C;--sec:#FF7B1C;border-color:#FF7B1C;',
            attrs: { 'data-fox-notice': titleText }
          },
          [
            createEl('div', { className: 'notification_icon', html: ICONS.fox }, [
              createEl('div', { className: 'notification_icon_sub' })
            ]),
            createEl('div', { className: 'notification_body' }, [
              createEl('h1', { text: titleText || 'FOXMOD' }),
              createEl('p', { text: bodyText || '' })
            ]),
            createEl('div', { className: 'notification_timeoutbar', style: '--time: 9s; background: #FF7B1C;' }),
            createEl('div', { className: 'notification_button_holder flex-row ns' }, [okBtn])
          ]
        );
        okBtn.addEventListener('click', function () {
          removeInviteToast(toastKey);
        });
        host.appendChild(toastEl);
        let dismissTimer = null;
        if (typeof root.setTimeout === 'function') {
          dismissTimer = root.setTimeout(function () {
            removeInviteToast(toastKey);
          }, 9000);
          if (dismissTimer && typeof dismissTimer.unref === 'function') {
            dismissTimer.unref();
          }
        }
        activeInviteToasts.set(toastKey, { el: toastEl, timer: dismissTimer });
      };

      ejectFromClosedRoom = function (reasonMsg) {
        const wasInMulti = activeFoxView === 'foxmod_multi';
        teardownPeerSession();
        if (wasInMulti) {
          navigateMenu('foxmod');
        }
        if (typeof showOrangeNoticeNotification === 'function') {
          showOrangeNoticeNotification('FOXMOD ROOM CLOSED', reasonMsg || 'The Host left the room.');
        }
      };

      showOrangeInviteNotification = function (invite) {
        if (!invite || !invite.roomCode || !invite.from) return;
        const currentSnap = peerSession && peerSession.getSnapshot ? peerSession.getSnapshot() : null;
        if (currentSnap && currentSnap.room && currentSnap.room.roomCode === invite.roomCode) {
          return;
        }
        const host = resolveNotificationsHost();
        if (!host) return;

        const toastKey = `${invite.from}:${invite.roomCode}`;
        removeInviteToast(toastKey);

        const modeStr = invite.gameMode === 'blitz' ? 'BLITZ' : 'VS';
        const setStr = invite.pieceSet === 'pentomino' ? 'PENTOMINOS' : invite.pieceSet === 'chaos' ? 'CAOS MIX' : 'NORMAL';

        const ignoreBtn = createEl('div', {
          className: 'notification_button flex-item',
          text: 'IGNORE',
          attrs: { role: 'button', tabindex: '0' }
        });
        const acceptBtn = createEl('div', {
          className: 'notification_button flex-item pri',
          text: 'ACCEPT',
          attrs: { role: 'button', tabindex: '0' }
        });

        const toastEl = createEl(
          'div',
          {
            className: 'notification ns snotify modalnotify twfox-invite-notif',
            style: '--pri:#FF7B1C;--sec:#FF7B1C;border-color:#FF7B1C;',
            attrs: {
              'data-fox-invite-id': invite.id || toastKey,
              'data-room-code': invite.roomCode
            }
          },
          [
            createEl('div', { className: 'notification_icon', html: ICONS.fox }, [
              createEl('div', { className: 'notification_icon_sub' })
            ]),
            createEl('div', { className: 'notification_body' }, [
              createEl('h1', { text: 'FOXMOD INVITE' }),
              createEl('p', {
                text: `${invite.from.toUpperCase()} invited you to #${invite.roomCode} (${setStr} ${modeStr})`
              })
            ]),
            createEl('div', { className: 'notification_timeoutbar', style: '--time: 24s; background: #FF7B1C;' }),
            createEl('div', { className: 'notification_button_holder flex-row ns' }, [ignoreBtn, acceptBtn])
          ]
        );

        ignoreBtn.addEventListener('click', function () {
          removeInviteToast(toastKey);
        });
        acceptBtn.addEventListener('click', function () {
          removeInviteToast(toastKey);
          if (typeof joinRoomByInviteCode === 'function') {
            joinRoomByInviteCode(invite.roomCode);
          }
        });

        host.appendChild(toastEl);

        let dismissTimer = null;
        if (typeof root.setTimeout === 'function') {
          dismissTimer = root.setTimeout(function () {
            removeInviteToast(toastKey);
          }, 24000);
          if (dismissTimer && typeof dismissTimer.unref === 'function') {
            dismissTimer.unref();
          }
        }
        activeInviteToasts.set(toastKey, { el: toastEl, timer: dismissTimer });
      };

      if (typeof refreshMutualInviteUi === 'function') {
        refreshMutualInviteUi();
      }

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

      hostWingLabel.addEventListener('click', function () {
        const snap = peerSession && peerSession.getSnapshot ? peerSession.getSnapshot() : null;
        if (!snap) return;
        const selfId = snap.role === 'host' ? 'host' : snap.selfId;
        const selfPlayer = (snap.players || []).find((p) => p.id === selfId);
        const nextSpec = !(selfPlayer ? selfPlayer.spectator : snap.spectator);
        if (snap.role === 'host' && typeof peerSession.setSelfSpectator === 'function') {
          peerSession.setSelfSpectator(nextSpec);
        } else if (snap.role === 'client' && typeof peerSession.setSpectator === 'function') {
          peerSession.setSpectator(nextSpec);
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
          text: 'RELOAD TETR.IO (APPLY SFX/SKIN)',
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
          text: 'EXPLORE (TETR.IO+)',
          type: 'button'
        });
        const tabInstalledBtn = createEl('button', {
          id: 'twfoxtetrio-assets-tab-installed',
          className: 'twfox-btn is-sm twfox-assets-tab',
          text: 'DOWNLOADED (0)',
          type: 'button'
        });
        const tabBgBtn = createEl('button', {
          id: 'twfoxtetrio-assets-tab-bg',
          className: 'twfox-btn is-sm twfox-assets-tab',
          text: 'BACKGROUND / LOCAL',
          type: 'button'
        });

        // Explore controls
        const searchInput = createEl('input', {
          id: 'twfoxtetrio-assets-search',
          className: 'twfox-input',
          type: 'text',
          attrs: { placeholder: 'Search skin, board, sfx or author in TETR.IO+...' }
        });
        const sortSelect = createEl('select', { id: 'twfoxtetrio-assets-sort', className: 'twfox-select' }, [
          createEl('option', { text: 'Most voted', attrs: { value: 'votes' } }),
          createEl('option', { text: 'Recent', attrs: { value: 'recent' } }),
          createEl('option', { text: 'Name A-Z', attrs: { value: 'name' } }),
          createEl('option', { text: 'Author', attrs: { value: 'author' } })
        ]);
        const refreshCatalogBtn = createEl('button', {
          id: 'twfoxtetrio-assets-refresh',
          className: 'twfox-btn is-sm',
          text: 'REFRESH',
          type: 'button'
        });
        const catDefs = [
          ['all', 'All'],
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
          text: 'Ready to connect with https://you.have.fail/tetrioplus/'
        });
        const exploreListEl = createEl('div', { id: 'twfoxtetrio-assets-explore-list', className: 'twfox-assets-list' });
        const pageInfoEl = createEl('span', { id: 'twfoxtetrio-assets-page-info', className: 'twfox-assets-status', text: 'Page 1' });
        const prevPageBtn = createEl('button', { id: 'twfoxtetrio-assets-prev-page', className: 'twfox-btn is-sm', text: 'PREV', type: 'button' });
        const nextPageBtn = createEl('button', { id: 'twfoxtetrio-assets-next-page', className: 'twfox-btn is-sm', text: 'NEXT', type: 'button' });
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
          attrs: { placeholder: 'Image, GIF or video URL (.mp4 / .webm)...' }
        });
        const bgUrlApplyBtn = createEl('button', {
          id: 'twfoxtetrio-assets-bg-url-apply',
          className: 'twfox-btn is-sm is-pri',
          text: 'APPLY URL',
          type: 'button'
        });
        const bgClearBtn = createEl('button', {
          id: 'twfoxtetrio-assets-bg-clear',
          className: 'twfox-btn is-sm is-danger',
          text: 'CLEAR BACKGROUND',
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
          text: 'UPLOAD BACKGROUND (PNG/GIF/MP4/WEBM)',
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
          text: 'IMPORT LOCAL (.TPSE / .ZIP / .PNG)',
          type: 'button'
        });
        assetFileBtn.addEventListener('click', function () {
          if (typeof assetFileInput.click === 'function') assetFileInput.click();
        });

        const localStatusEl = createEl('div', { id: 'twfoxtetrio-assets-local-status', className: 'twfox-assets-status', text: '' });

        async function handleFileSelection(fileObj, forcedCategory) {
          if (!fileObj || !assetsApi) return;
          localStatusEl.textContent = `Importing ${fileObj.name}...`;
          try {
            const buf = await fileObj.arrayBuffer();
            const rec = await assetsApi.importLocalAsset({
              name: fileObj.name,
              type: fileObj.type || '',
              bytes: new Uint8Array(buf),
              category: forcedCategory,
              autoApply: true
            });
            localStatusEl.textContent = `Imported & activated: ${rec.name}`;
          } catch (err) {
            localStatusEl.textContent = 'Error importing file: ' + (err && err.message ? err.message : String(err));
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
              createEl('span', { className: 'twfox-native-label', text: 'Built-in Animated Backgrounds' }),
              createEl('span', { className: 'twfox-native-desc', text: 'Displayed behind menus and boards with no external downloads.' })
            ])
          ]),
          presetWrap,
          createEl('div', { className: 'twfox-assets-toolbar' }, [bgUrlInput, bgUrlApplyBtn, bgClearBtn]),
          createEl('div', { className: 'twfox-native-row' }, [
            createEl('span', { className: 'twfox-native-label', text: 'Background Opacity' }),
            createEl('div', { className: 'twfox-range-wrap' }, [bgOpacityInput, bgOpacityVal])
          ]),
          createEl('div', { className: 'twfox-native-row' }, [
            createEl('span', { className: 'twfox-native-label', text: 'Blur' }),
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
          if (cat === 'board') return 'BOARD';
          if (cat === 'sfx') return 'SFX';
          if (cat === 'background') return 'BACKGROUND';
          return 'MINOS';
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
            bgName = findName(a.bgAssetId) || 'Custom background';
          } else if (a.bgMode === 'url' && a.bgUrl) {
            bgName = 'Custom URL';
          }

          const slotDefs = [
            { slot: 'skin', title: 'BLOCKS / MINOS', value: findName(a.skinId), extra: a.skinFormat ? `(${a.skinFormat})` : '' },
            { slot: 'board', title: 'BOARD / QUEUE', value: findName(a.boardId) },
            { slot: 'sfx', title: 'SOUNDS (SFX)', value: findName(a.sfxId), hasPreview: Boolean(a.sfxId) },
            { slot: 'background', title: 'BACKGROUND / ANIMATED', value: bgName }
          ];

          for (const s of slotDefs) {
            const filled = Boolean(s.value);
            const actions = [];
            if (s.hasPreview && assetsApi) {
              const pBtn = createEl('button', {
                className: 'twfox-btn is-sm',
                text: 'TEST',
                type: 'button'
              });
              pBtn.addEventListener('click', () => assetsApi.previewSfxPack(a.sfxId));
              actions.push(pBtn);
            }
            if (filled && assetsApi) {
              const cBtn = createEl('button', {
                id: `twfoxtetrio-assets-clear-${s.slot}`,
                className: 'twfox-btn is-sm is-danger',
                text: 'REMOVE',
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
            exploreStatusEl.textContent = 'Assets module not initialized.';
            return;
          }
          if (typeof assetsApi.resetPreviewQueue === 'function') {
            assetsApi.resetPreviewQueue();
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

          exploreStatusEl.textContent = `Showing ${pageItems.length} of ${matched.length} results (${state.catalogCount} on TETR.IO+)`;
          pageInfoEl.textContent = `Page ${currentPage + 1} / ${totalPages}`;
          prevPageBtn.disabled = currentPage <= 0;
          nextPageBtn.disabled = currentPage + 1 >= totalPages;

          if (pageItems.length === 0) {
            exploreListEl.appendChild(
              createEl('div', { className: 'twfox-assets-status', text: 'No assets matched that filter.' })
            );
            return;
          }

          for (const item of pageItems) {
            const downloaded = assetsApi.isDownloaded(item.id);
            const active = assetsApi.isActive(item.id);
            const busy = downloadingIds.has(item.id);
            const tags = [categoryLabel(item.category)];
            if (item.format) tags.push(item.format.toUpperCase());
            if (item.animated) tags.push('ANIMATED');
            if (item.votes > 0) tags.push(`★ ${item.votes}`);

            const actionBtns = [];
            if (busy) {
              const b = createEl('button', { className: 'twfox-btn is-sm', text: 'DOWNLOADING...', type: 'button' });
              b.disabled = true;
              actionBtns.push(b);
            } else if (downloaded) {
              if (active) {
                actionBtns.push(createEl('span', { className: 'twfox-badge', text: 'ACTIVE ✓' }));
              } else {
                const actBtn = createEl('button', {
                  className: 'twfox-btn is-sm is-ok',
                  text: 'ACTIVATE',
                  type: 'button',
                  attrs: { 'data-asset-id': item.id, 'data-asset-action': 'activate' }
                });
                actBtn.addEventListener('click', () => assetsApi.activateAsset(item.id));
                actionBtns.push(actBtn);
              }
              const rmBtn = createEl('button', {
                className: 'twfox-btn is-sm is-danger',
                text: 'UNINSTALL',
                type: 'button',
                attrs: { 'data-asset-id': item.id, 'data-asset-action': 'uninstall' }
              });
              rmBtn.addEventListener('click', () => assetsApi.uninstallAsset(item.id));
              actionBtns.push(rmBtn);
            } else {
              const dlBtn = createEl('button', {
                className: 'twfox-btn is-sm is-pri',
                text: 'DOWNLOAD & INSTALL',
                type: 'button',
                attrs: { 'data-asset-id': item.id, 'data-asset-action': 'download' }
              });
              dlBtn.addEventListener('click', async function () {
                downloadingIds.add(item.id);
                renderExploreList();
                try {
                  await assetsApi.downloadAndInstallCatalogItem(item, { autoApply: true });
                } catch (err) {
                  exploreStatusEl.textContent = 'Error downloading ' + item.name + ': ' + (err && err.message ? err.message : String(err));
                } finally {
                  downloadingIds.delete(item.id);
                  renderExploreList();
                }
              });
              actionBtns.push(dlBtn);
            }

            const previewUrl =
              typeof assetsApi.getCatalogItemPreviewUrl === 'function'
                ? assetsApi.getCatalogItemPreviewUrl(item)
                : null;
            let previewEl = null;
            if (previewUrl) {
              const pImg = createEl('img', {
                className: 'twfox-asset-preview-strip',
                attrs: {
                  src: previewUrl,
                  loading: 'lazy',
                  alt: '',
                  'data-preview-id': item.id
                }
              });
              pImg.src = previewUrl;
              previewEl = createEl('div', { className: 'twfox-asset-preview-wrap' }, [pImg]);
            } else if (
              typeof assetsApi.requestCatalogItemPreview === 'function' &&
              item.category !== 'sfx' &&
              item.category !== 'background' &&
              (item.tpsePath || (item.path && !/\.zip$/i.test(item.path)))
            ) {
              const pImg = createEl('img', {
                className: 'twfox-asset-preview-strip hidden',
                attrs: { alt: '', 'data-preview-id': item.id }
              });
              const loadMsg = createEl('span', {
                className: 'twfox-asset-preview-loading',
                text: 'Loading block preview...'
              });
              previewEl = createEl('div', { className: 'twfox-asset-preview-wrap' }, [pImg, loadMsg]);
              assetsApi.requestCatalogItemPreview(item).then((resolvedUrl) => {
                if (!pImg) return;
                setClass(loadMsg, 'hidden', true);
                if (resolvedUrl) {
                  pImg.src = resolvedUrl;
                  pImg.setAttribute('src', resolvedUrl);
                  setClass(pImg, 'hidden', false);
                }
              });
            }

            exploreListEl.appendChild(
              createEl('div', { className: 'twfox-asset-card' + (active ? ' is-active' : '') }, [
                createEl('div', { className: 'twfox-asset-info' }, [
                  createEl('div', { className: 'twfox-asset-title', text: item.name }),
                  createEl('div', { className: 'twfox-asset-meta', text: `by ${item.author} · ${tags.join(' · ')}` }),
                  item.description ? createEl('div', { className: 'twfox-asset-desc', text: item.description }) : null,
                  previewEl
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
          tabInstalledBtn.textContent = `DOWNLOADED (${list.length})`;
          installedStatusEl.textContent = list.length > 0
            ? `${list.length} assets saved locally on your device.`
            : 'No downloaded assets yet. Visit EXPLORE (TETR.IO+) or BACKGROUND / LOCAL.';

          for (const rec of list) {
            const active = assetsApi.isActive(rec.id);
            const caps = rec.capabilities || {};
            const capTags = [];
            if (caps.skin) capTags.push('MINOS' + (rec.skinFormat ? ` (${rec.skinFormat})` : ''));
            if (caps.board || caps.queue || caps.grid) capTags.push('BOARD');
            if (caps.sfx) capTags.push('SFX');
            if (caps.background) capTags.push(`BACKGROUND x${rec.backgroundCount || 1}`);
            capTags.push(formatBytesLabel(rec.bytesEstimate));

            const previewNode = rec.previewSkin
              ? (() => {
                  const pImg = createEl('img', {
                    className: 'twfox-asset-preview-strip',
                    attrs: { src: rec.previewSkin, alt: '', 'data-installed-preview-id': rec.id }
                  });
                  pImg.src = rec.previewSkin;
                  return createEl('div', { className: 'twfox-asset-preview-wrap' }, [pImg]);
                })()
              : null;

            const btns = [];
            if (active) {
              btns.push(createEl('span', { className: 'twfox-badge', text: 'ACTIVE ✓' }));
            } else {
              const useBtn = createEl('button', {
                className: 'twfox-btn is-sm is-ok',
                text: 'ACTIVATE',
                type: 'button',
                attrs: { 'data-installed-id': rec.id, 'data-installed-action': 'activate' }
              });
              useBtn.addEventListener('click', () => assetsApi.activateAsset(rec.id));
              btns.push(useBtn);
            }
            if (caps.sfx) {
              const testBtn = createEl('button', {
                className: 'twfox-btn is-sm',
                text: 'TEST SFX',
                type: 'button'
              });
              testBtn.addEventListener('click', () => assetsApi.previewSfxPack(rec.id));
              btns.push(testBtn);
            }
            if (caps.background && rec.backgroundCount > 1 && state.active.bgMode === 'asset' && state.active.bgAssetId === rec.id) {
              const nextBgBtn = createEl('button', {
                className: 'twfox-btn is-sm',
                text: `BACKGROUND ${(state.active.bgIndex || 0) + 1}/${rec.backgroundCount}`,
                type: 'button'
              });
              nextBgBtn.addEventListener('click', () => {
                assetsApi.setBackgroundConfig({ bgIndex: ((state.active.bgIndex || 0) + 1) % rec.backgroundCount });
              });
              btns.push(nextBgBtn);
            }
            const delBtn = createEl('button', {
              className: 'twfox-btn is-sm is-danger',
              text: 'UNINSTALL',
              type: 'button',
              attrs: { 'data-installed-id': rec.id, 'data-installed-action': 'uninstall' }
            });
            delBtn.addEventListener('click', () => assetsApi.uninstallAsset(rec.id));
            btns.push(delBtn);

            installedListEl.appendChild(
              createEl('div', { className: 'twfox-asset-card' + (active ? ' is-active' : '') }, [
                createEl('div', { className: 'twfox-asset-info' }, [
                  createEl('div', { className: 'twfox-asset-title', text: rec.name }),
                  createEl('div', { className: 'twfox-asset-meta', text: `${rec.author} · ${capTags.join(' · ')}` }),
                  previewNode
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
          exploreStatusEl.textContent = 'Connecting to https://you.have.fail/tetrioplus/ ...';
          try {
            await assetsApi.fetchCatalog(Boolean(force));
            renderExploreList();
          } catch (err) {
            exploreStatusEl.textContent = 'Could not connect to TETR.IO+ (' + (err && err.message ? err.message : String(err)) + ')';
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
              createEl('h1', { text: 'SKINS, BOARD, SFX & BACKGROUNDS (TETR.IO+)' }),
              createEl('p', { text: 'Direct download from https://you.have.fail/tetrioplus/ · blocks, board, sounds & animated backgrounds.' })
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

      function buildLangAndUpdaterBlock() {
        const enBtn = createEl('button', {
          id: 'twfoxtetrio-lang-en-btn',
          className: 'twfox-btn is-sm twfox-lang-pill',
          text: 'ENGLISH',
          type: 'button',
          attrs: { 'data-twfox-no-i18n': '1', 'data-hover': 'tap', 'data-hit': 'click' }
        });
        const esBtn = createEl('button', {
          id: 'twfoxtetrio-lang-es-btn',
          className: 'twfox-btn is-sm twfox-lang-pill',
          text: 'ESPAÑOL',
          type: 'button',
          attrs: { 'data-twfox-no-i18n': '1', 'data-hover': 'tap', 'data-hit': 'click' }
        });
        langControls.push({ locale: 'en', btn: enBtn });
        langControls.push({ locale: 'es', btn: esBtn });

        function selectLocale(nextLoc) {
          const nextCfg = runtimeApi.updateConfig({ language: { locale: nextLoc } });
          syncConfigControls(nextCfg);
          if (statusEl) statusEl.textContent = 'SETTINGS SAVED';
        }
        enBtn.addEventListener('click', function () {
          selectLocale('en');
        });
        esBtn.addEventListener('click', function () {
          selectLocale('es');
        });

        const updStatusEl = createEl('span', {
          id: 'twfoxtetrio-updater-status',
          className: 'twfox-badge twfox-updater-status',
          text: `Up to date (v${runtimeApi.version})`
        });
        const checkBtn = createEl('button', {
          id: 'twfoxtetrio-check-update-btn',
          className: 'twfox-btn is-sm',
          text: 'CHECK UPDATES',
          type: 'button',
          attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
        });
        const applyBtn = createEl('button', {
          id: 'twfoxtetrio-apply-update-btn',
          className: 'twfox-btn is-sm is-pri hidden',
          text: 'UPDATE & RESTART',
          type: 'button',
          attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
        });
        const cmdCodeEl = createEl('code', {
          id: 'twfoxtetrio-updater-cmd',
          className: 'twfox-updater-cmd',
          text: 'git pull && install.bat',
          attrs: { 'data-twfox-no-i18n': '1' }
        });
        const copyCmdBtn = createEl('button', {
          id: 'twfoxtetrio-updater-copy-btn',
          className: 'twfox-btn is-sm',
          text: 'COPY COMMAND',
          type: 'button',
          attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
        });
        const cmdWrap = createEl('div', { id: 'twfoxtetrio-updater-cmd-wrap', className: 'twfox-updater-cmd-wrap hidden' }, [
          cmdCodeEl,
          copyCmdBtn
        ]);

        function getUpdater() {
          const bag = root.__TWFOX_INTERNAL__ || internals;
          return (bag && bag.modUpdater) || null;
        }

        function syncUpdaterUi(st) {
          if (!st) return;
          setClass(updStatusEl, 'is-avail', Boolean(st.updateAvailable));
          setClass(updStatusEl, 'is-ok', st.status === 'up_to_date' || st.status === 'applied');
          if (st.checking) {
            updStatusEl.textContent = 'Checking for updates...';
          } else if (st.updating) {
            updStatusEl.textContent = 'Downloading and installing update...';
          } else if (st.status === 'available' && st.remoteVersion) {
            updStatusEl.textContent = `Update available: v${st.remoteVersion} (installed v${st.installedVersion})`;
          } else if (st.status === 'applied') {
            updStatusEl.textContent = 'Update installed! Restarting TETR.IO...';
          } else if (st.status === 'manual_required') {
            updStatusEl.textContent = 'Manual update required';
          } else if (st.status === 'error' && st.error) {
            updStatusEl.textContent = String(st.error);
          } else if (st.status === 'up_to_date') {
            updStatusEl.textContent = `Up to date (v${st.installedVersion})`;
          } else {
            updStatusEl.textContent = `Up to date (v${st.installedVersion})`;
          }

          checkBtn.disabled = Boolean(st.checking || st.updating);
          const showApply = Boolean(st.updateAvailable || st.updating || st.status === 'applied');
          setClass(applyBtn, 'hidden', !showApply);
          applyBtn.disabled = Boolean(st.updating || st.status === 'applied');
          applyBtn.textContent = st.updating ? 'UPDATING...' : st.status === 'applied' ? 'RESTARTING...' : 'UPDATE & RESTART';

          cmdCodeEl.textContent = st.manualCommand || 'git pull && install.bat';
          setClass(cmdWrap, 'hidden', st.status !== 'manual_required');
        }

        checkBtn.addEventListener('click', function () {
          const upd = getUpdater();
          if (upd && typeof upd.checkForUpdates === 'function') {
            upd.checkForUpdates({ force: true, notify: true });
          }
        });
        applyBtn.addEventListener('click', function () {
          const upd = getUpdater();
          if (upd && typeof upd.applyUpdate === 'function') {
            upd.applyUpdate();
          }
        });
        copyCmdBtn.addEventListener('click', function () {
          copyToClipboard(cmdCodeEl.textContent || '');
          if (statusEl) statusEl.textContent = 'SETTINGS SAVED';
        });

        const updApi = getUpdater();
        if (updApi && typeof updApi.subscribe === 'function') {
          updApi.subscribe(syncUpdaterUi);
        }

        return createEl('div', { id: 'twfoxtetrio-lang-updater-block', className: 'scroller_block twfox-lang-upd-block' }, [
          createEl('h1', { style: 'color:#ffb070', text: 'LANGUAGE & UPDATES' }),
          createEl('div', { className: 'twfox-native-row' }, [
            createEl('div', {}, [
              createEl('span', { className: 'twfox-native-label', text: 'Interface Language (Global)' }),
              createEl('span', {
                className: 'twfox-native-desc',
                text: 'Applies Spanish or English across both FOXMOD and TETR.IO menus.'
              })
            ]),
            createEl('div', { className: 'twfox-lang-pills' }, [enBtn, esBtn])
          ]),
          createEl('div', { className: 'twfox-native-row' }, [
            createEl('div', {}, [
              createEl('span', { className: 'twfox-native-label', text: 'FOXMOD Version & Auto-Updater' }),
              updStatusEl
            ]),
            createEl('div', { className: 'twfox-updater-actions' }, [checkBtn, applyBtn])
          ]),
          cmdWrap
        ]);
      }

      const blocks = [buildLangAndUpdaterBlock(), buildAssetsStudioBlock()].concat(CONFIG_SECTIONS.map(buildConfigSection));
      blocks.push(
        createEl('div', { className: 'scroller_block twfox-scroller-header' }, [statusEl, resetBtn])
      );
      syncConfigControls(runtimeApi.getConfig());

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
        ['foxmod_solo_lobby', buildSoloLobbyScroller()],
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
          createEl('p', { text: 'practice, P2P rooms, config & credits' })
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

    function wireInviteSystems() {
      const foxBadge = getFoxPawBadge();
      if (foxBadge) {
        if (!badgeInviteUnsub && typeof foxBadge.onInvite === 'function') {
          badgeInviteUnsub = foxBadge.onInvite(function (invite) {
            if (typeof showOrangeInviteNotification === 'function') {
              showOrangeInviteNotification(invite);
            }
          });
        }
        if (!badgePresenceUnsub && typeof foxBadge.onPresenceUpdate === 'function') {
          badgePresenceUnsub = foxBadge.onPresenceUpdate(function () {
            if (typeof refreshMutualInviteUi === 'function') {
              refreshMutualInviteUi();
            }
          });
        }
      }

      if (!socialObserver && typeof root.MutationObserver === 'function') {
        const socialRels = document.getElementById('social_relationships');
        if (socialRels) {
          socialObserver = new root.MutationObserver(function () {
            if (typeof refreshMutualInviteUi === 'function') {
              refreshMutualInviteUi();
            }
          });
          socialObserver.observe(socialRels, { childList: true, subtree: true });
        }
      }

      if (!bodyClassObserver && document.body && typeof root.MutationObserver === 'function') {
        bodyClassObserver = new root.MutationObserver(function () {
          if (isSyncingBodyRoom) return;
          const inOfficialMulti = Boolean(document.body && document.body.classList && document.body.classList.contains('innormalmulti'));
          if (inOfficialMulti && peerSession) {
            teardownPeerSession();
          } else {
            syncBodyRoomClass();
          }
        });
        bodyClassObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ['class']
        });
      }
    }

    ensureHomeButton();
    ensureNativeScrollers();
    wireInviteSystems();
    if (typeof root.setTimeout === 'function') {
      const deferWire = root.setTimeout(wireInviteSystems, 0);
      if (deferWire && typeof deferWire.unref === 'function') deferWire.unref();
    }

    if (typeof root.addEventListener === 'function') {
      const flushPeerOnUnload = function () {
        if (peerSession) {
          teardownPeerSession();
        }
      };
      root.addEventListener('beforeunload', flushPeerOnUnload);
      root.addEventListener('pagehide', flushPeerOnUnload);
    }

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
            navigateMenu(pendingPracticeReturnView || 'foxmod_practice');
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
      wireInviteSystems();
      if (state && state.inGame && state.mode && state.mode !== 'Custom Solo') {
        pendingPracticeReturn = false;
        practiceRunEntered = false;
      }
      const inOfficialMulti = Boolean(
        (state && state.inMultiplayer) ||
        (document.body && document.body.classList && document.body.classList.contains('innormalmulti'))
      );
      if (inOfficialMulti) {
        if (activeFoxView) {
          hideFoxmodScrollersImmediately();
        } else if (peerSession) {
          teardownPeerSession();
        } else {
          syncBodyRoomClass();
        }
        return;
      }
      if (state && state.inGame && activeFoxView) {
        hideFoxmodScrollersImmediately();
        return;
      }
      syncBodyRoomClass();
      if (activeFoxView === 'foxmod_config') {
        syncConfigControls(cfg);
      } else if (activeFoxView === 'foxmod_solo_lobby' && typeof refreshSoloLobbyUi === 'function') {
        refreshSoloLobbyUi();
      } else if (activeFoxView === 'foxmod_multi' && typeof refreshMutualInviteUi === 'function') {
        refreshMutualInviteUi();
      }
    });
  }

  api.registerFeature('foxmod-menu', initFoxmodMenu);
}(typeof globalThis !== 'undefined' ? globalThis : window));
