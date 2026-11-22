'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { buildModSnippet } = require('../scripts/build');

function createFakeDomEnvironment(protocol, extraGlobals) {
  const elements = new Map();
  const observers = [];

  class FakeClassList {
    constructor(el, initial) {
      this.el = el;
      this.set = new Set((initial || '').split(/\s+/).filter(Boolean));
    }
    add(...cls) {
      cls.forEach((c) => this.set.add(c));
      notifyObservers(this.el, 'class');
    }
    remove(...cls) {
      cls.forEach((c) => this.set.delete(c));
      notifyObservers(this.el, 'class');
    }
    contains(c) {
      return this.set.has(c);
    }
    toggle(c, force) {
      const shouldAdd = force === undefined ? !this.set.has(c) : Boolean(force);
      if (shouldAdd) {
        this.add(c);
      } else {
        this.remove(c);
      }
      return shouldAdd;
    }
  }

  class FakeElement {
    constructor(tag, id, classes) {
      this.tagName = tag.toUpperCase();
      this.id = id || '';
      this.children = [];
      this.parentNode = null;
      this.attributes = {};
      this.listeners = new Map();
      this.checked = false;
      this.value = '';
      this.type = '';
      this._textContent = '';
      this.classList = new FakeClassList(this, classes);
      if (this.id) elements.set(this.id, this);
    }
    get nextSibling() {
      if (!this.parentNode) return null;
      const idx = this.parentNode.children.indexOf(this);
      if (idx === -1 || idx + 1 >= this.parentNode.children.length) return null;
      return this.parentNode.children[idx + 1];
    }
    get className() {
      return Array.from(this.classList.set).join(' ');
    }
    set className(val) {
      this.classList.set = new Set(String(val || '').split(/\s+/).filter(Boolean));
    }
    get textContent() {
      return this._textContent;
    }
    set textContent(val) {
      this._textContent = String(val);
      notifyObservers(this, 'text');
    }
    get innerHTML() {
      return this._textContent;
    }
    set innerHTML(val) {
      this._textContent = String(val);
      if (val === '') this.children = [];
      notifyObservers(this, 'text');
    }
    setAttribute(name, val) {
      this.attributes[name] = String(val);
      if (name === 'id') {
        this.id = String(val);
        elements.set(this.id, this);
      }
      notifyObservers(this, name);
    }
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    }
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      if (child.id) elements.set(child.id, child);
      return child;
    }
    insertBefore(child, refNode) {
      child.parentNode = this;
      if (child.id) elements.set(child.id, child);
      const idx = refNode ? this.children.indexOf(refNode) : -1;
      if (idx === -1) {
        this.children.push(child);
      } else {
        this.children.splice(idx, 0, child);
      }
      return child;
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    dispatchEvent(type, ev) {
      const eventObj = Object.assign(
        {
          type,
          target: this,
          preventDefault() {},
          stopPropagation() {}
        },
        ev || {}
      );
      for (const fn of this.listeners.get(type) || []) {
        fn(eventObj);
      }
    }
    click() {
      this.dispatchEvent('click');
    }
    querySelectorAll(sel) {
      const results = [];
      for (const child of this.children) {
        const matches =
          (sel.startsWith('.') && child.classList.contains(sel.slice(1))) ||
          (sel.startsWith('#') && child.id === sel.slice(1)) ||
          child.tagName.toLowerCase() === sel.toLowerCase();
        if (matches) results.push(child);
        results.push(...child.querySelectorAll(sel));
      }
      return results;
    }
    querySelector(sel) {
      const all = this.querySelectorAll(sel);
      return all.length > 0 ? all[0] : null;
    }
  }

  function notifyObservers(target, attrName) {
    let cur = target;
    let depth = 0;
    while (cur && depth < 32) {
      for (const obs of observers) {
        if (obs.target === cur && (cur === target || (obs.options && obs.options.subtree))) {
          obs.callback([{ target, attributeName: attrName }]);
        }
      }
      cur = cur.parentNode;
      depth += 1;
    }
  }

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.target = null;
      this.options = null;
    }
    observe(target, options) {
      this.target = target;
      this.options = options || {};
      observers.push(this);
    }
    disconnect() {
      this.target = null;
    }
  }

  const body = new FakeElement('body', '', '');
  const head = new FakeElement('head', '', '');
  const menus = new FakeElement('div', 'menus', '');
  menus.setAttribute('data-menu-type', 'home');
  const headerText = new FakeElement('div', 'header_text', 'ns');
  headerText.textContent = 'HOME';
  const footerText = new FakeElement('div', 'footer_text', 'ns');
  footerText.textContent = 'WELCOME TO TETR.IO!';
  const backBtn = new FakeElement('div', 'back', 'hidden ns');
  const exitElectron = new FakeElement('div', 'exit_electron', 'ns');
  const homeMenu = new FakeElement('div', 'home_menu', 'right_scroller');
  homeMenu.setAttribute('data-menuview', 'home');
  const sigConfig = new FakeElement('div', 'sig_config', 'scroller_item scroller_item_giant');
  const sigAbout = new FakeElement('div', 'sig_about', 'scroller_item scroller_item_giant');
  homeMenu.appendChild(sigConfig);
  homeMenu.appendChild(sigAbout);
  menus.appendChild(headerText);
  menus.appendChild(footerText);
  menus.appendChild(backBtn);
  menus.appendChild(exitElectron);
  menus.appendChild(homeMenu);

  const customContainer = new FakeElement('div', 'custom_content_container', '');
  const bwInput = new FakeElement('input', '', 'room_config_item');
  bwInput.setAttribute('data-index', 'boardwidth');
  bwInput.setAttribute('type', 'number');
  bwInput.value = '10';
  const objTypeSpinner = new FakeElement('div', '', 'room_config_item room_config_spinner');
  objTypeSpinner.setAttribute('data-index', 'objective_type');
  objTypeSpinner.textContent = 'lines';
  const objCountInput = new FakeElement('input', '', 'room_config_item');
  objCountInput.setAttribute('data-index', 'objective_count');
  objCountInput.setAttribute('type', 'number');
  objCountInput.value = '40';
  const levelsCheck = new FakeElement('input', '', 'room_config_item');
  levelsCheck.setAttribute('data-index', 'levels');
  levelsCheck.setAttribute('type', 'checkbox');
  levelsCheck.checked = false;
  customContainer.appendChild(bwInput);
  customContainer.appendChild(objTypeSpinner);
  customContainer.appendChild(objCountInput);
  customContainer.appendChild(levelsCheck);
  const startCustomBtn = new FakeElement('div', 'start_custom', 'start_game');
  let customStarts = 0;
  startCustomBtn.addEventListener('click', () => {
    customStarts += 1;
  });
  menus.appendChild(customContainer);
  menus.appendChild(startCustomBtn);
  const meUsername = new FakeElement('h1', 'me_username', '');
  meUsername.textContent = 'fox';
  const pbBlitz = new FakeElement('h1', 'pbdisplay_blitz_inner', '');
  pbBlitz.textContent = '100,000';
  const pb40l = new FakeElement('h1', 'pbdisplay_40l_inner', '');
  pb40l.textContent = '0:45.320';
  const pbZenith = new FakeElement('h1', 'pbdisplay_zenith_inner', '');
  pbZenith.textContent = '1,000.0 M';
  const pbZenithEx = new FakeElement('h1', 'pbdisplay_zenithex_inner', '');
  pbZenithEx.textContent = '500.0 M';
  const zenithMenu = new FakeElement('div', 'zenithmenu', '');
  const zenithResult = new FakeElement('h1', 'zenith_result', '');
  const zenPanel = new FakeElement('div', 'zen_panel', 'hidden');
  const zenPanelContent = new FakeElement('div', 'zen_panel_content', '');
  const zenGarbageOff = new FakeElement('div', '', 'panel_option selected');
  zenGarbageOff.setAttribute('data-key', 'garbagemode');
  zenGarbageOff.setAttribute('data-value', 'off');
  const zenGarbageBackfire = new FakeElement('div', '', 'panel_option');
  zenGarbageBackfire.setAttribute('data-key', 'garbagemode');
  zenGarbageBackfire.setAttribute('data-value', 'backfire_full');
  zenGarbageBackfire.addEventListener('click', () => {
    zenGarbageOff.classList.remove('selected');
    zenGarbageBackfire.classList.add('selected');
  });
  zenPanelContent.appendChild(zenGarbageOff);
  zenPanelContent.appendChild(zenGarbageBackfire);
  zenPanel.appendChild(zenPanelContent);
  body.appendChild(zenPanel);
  const resultHeader = new FakeElement('h1', 'result_header', '');
  const resultValue = new FakeElement('p', 'result_result', '');
  const loader = protocol === 'file:' ? new FakeElement('h1', 'loader', '') : null;
  const shade = protocol === 'file:' ? new FakeElement('div', 'shade', '') : null;
  const preload = protocol !== 'file:' ? new FakeElement('div', 'preload', '') : null;
  const desktopTransition = protocol !== 'file:' ? new FakeElement('div', 'desktop_transition', '') : null;

  const docListeners = new Map();
  const storage = new Map();
  const intervals = new Map();
  const openedExternalUrls = [];
  const copiedTexts = [];
  let nextIntervalId = 1;
  let fakeNow = 1000;

  const document = {
    readyState: 'loading',
    head,
    body,
    documentElement: body,
    createElement(tag) {
      return new FakeElement(tag);
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    }
  };

  const sandbox = {
    location: { protocol: protocol || 'https:', hostname: 'tetr.io' },
    document,
    MutationObserver: FakeMutationObserver,
    console,
    performance: { now: () => fakeNow },
    OPEN_EXTERNAL(url) {
      openedExternalUrls.push(url);
    },
    navigator: {
      clipboard: {
        writeText(text) {
          copiedTexts.push(String(text || ''));
          return Promise.resolve();
        }
      }
    },
    setTimeout,
    clearTimeout,
    TextEncoder,
    TextDecoder,
    btoa: (bin) => Buffer.from(String(bin), 'binary').toString('base64'),
    atob: (b64) => Buffer.from(String(b64), 'base64').toString('binary'),
    setInterval(fn) {
      const id = nextIntervalId++;
      intervals.set(id, fn);
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v))
    }
  };
  if (extraGlobals && typeof extraGlobals === 'object') {
    Object.assign(sandbox, extraGlobals);
  }
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(buildModSnippet(), context);

  return {
    context,
    elements,
    menus,
    homeMenu,
    headerText,
    footerText,
    backBtn,
    exitElectron,
    sigConfig,
    sigAbout,
    customContainer,
    getCustomStarts() {
      return customStarts;
    },
    storage,
    openedExternalUrls,
    copiedTexts,
    meUsername,
    pbBlitz,
    pb40l,
    resultHeader,
    resultValue,
    body,
    dispatchDocEvent(type, ev) {
      const eventObj = Object.assign(
        {
          type,
          preventDefault() {},
          stopPropagation() {}
        },
        ev || {}
      );
      for (const fn of docListeners.get(type) || []) {
        fn(eventObj);
      }
    },
    setNow(t) {
      fakeNow = t;
    },
    tickIntervals() {
      for (const fn of intervals.values()) {
        fn();
      }
    },
    triggerDOMContentLoaded() {
      document.readyState = 'interactive';
      for (const fn of docListeners.get('DOMContentLoaded') || []) {
        fn();
      }
    },
    emitUpdateCounts(score, pieces) {
      const spp = Math.round(score / Math.max(1, pieces));
      vm.runInContext(
        `(${score}).toLocaleString('en-US'); (${score}).toLocaleString('en-US'); (${spp}).toLocaleString('en-US');`,
        context
      );
    },
    emitUpdateTimers(elapsedMs) {
      const t = Math.round(elapsedMs);
      const ms = t % 1000;
      const sec = Math.floor(t / 1000) % 60;
      vm.runInContext(
        `String(${ms}).padStart(3, '0'); String(${sec}).padStart(2, '0'); String(0).padStart(3, '0'); String(0).padStart(2, '0'); String(0).padStart(3, '0'); String(0).padStart(2, '0');`,
        context
      );
    }
  };
}

test('bundled mod shows loading credit on local Electron loader and ignores gameplay hooks on file://', () => {
  const env = createFakeDomEnvironment('file:');
  env.triggerDOMContentLoaded();
  assert.equal(env.context.__TWFOX_TETRIO__, undefined);
  assert.equal(env.elements.has('twfoxtetrio-top-hud'), false);
  const fileCredit = env.elements.get('twfoxtetrio-file-credit');
  assert.ok(fileCredit, 'file loader credit should be mounted');
  assert.equal(fileCredit.textContent, 'Modded By: TWFoxcrack');
  env.elements.get('shade').classList.add('showing');
  assert.equal(fileCredit.classList.contains('is-hiding'), true);
});

test('bundled mod shows loading credit in #preload and #desktop_transition on tetr.io', () => {
  const env = createFakeDomEnvironment('https:');
  env.triggerDOMContentLoaded();
  const preloadCredit = env.elements.get('twfoxtetrio-preload-credit');
  const transCredit = env.elements.get('twfoxtetrio-transition-credit');
  assert.ok(preloadCredit, 'preload credit should be mounted inside #preload');
  assert.ok(transCredit, 'transition credit should be mounted inside #desktop_transition');
  assert.equal(preloadCredit.textContent, 'Modded By: TWFoxcrack');
  assert.equal(transCredit.textContent, 'Modded By: TWFoxcrack');
  assert.equal(env.elements.get('preload').children.includes(preloadCredit), true);
  assert.equal(env.elements.get('desktop_transition').children.includes(transCredit), true);
});

test('bundled mod tracks Blitz lifecycle, PB delta, red->green transition, quick-retry, and exit', () => {
  const env = createFakeDomEnvironment('https:');
  const { context } = env;

  vm.runInContext(`window._paq = window._paq || [];`, context);
  env.triggerDOMContentLoaded();

  const hud = env.elements.get('twfoxtetrio-top-hud');
  assert.ok(hud, 'HUD element should be mounted');
  assert.equal(hud.classList.contains('is-visible'), false);

  const valueEl = hud.querySelector('.twfox-delta-value');
  const subEl = hud.querySelector('.twfox-delta-sub');

  vm.runInContext(`window._paq = { push: function () {} };`, context);

  env.menus.classList.add('hidden');
  vm.runInContext(`window._paq.push(['trackEvent', 'Activity', 'Start Game', 'Blitz']);`, context);

  assert.equal(hud.classList.contains('is-visible'), true);
  assert.equal(hud.getAttribute('data-state'), 'behind');
  assert.equal(valueEl.textContent, '100,000');
  assert.equal(subEl.textContent, 'PB: 100,000');

  env.setNow(1050);
  env.emitUpdateCounts(32400, 14);
  assert.equal(hud.getAttribute('data-state'), 'behind');
  assert.equal(valueEl.textContent, '67,600');

  env.setNow(1100);
  env.emitUpdateCounts(100000, 35);
  assert.equal(hud.getAttribute('data-state'), 'behind');
  assert.equal(valueEl.textContent, '0');

  env.setNow(1150);
  env.emitUpdateCounts(104250, 36);
  assert.equal(hud.getAttribute('data-state'), 'ahead');
  assert.equal(valueEl.textContent, '+4,250');
  assert.equal(subEl.textContent, 'NEW PB • 100,000');
  assert.equal(hud.classList.contains('is-flash-ahead'), true);

  env.setNow(1200);
  env.emitUpdateCounts(112000, 38);
  assert.equal(hud.getAttribute('data-state'), 'ahead');
  assert.equal(valueEl.textContent, '+12,000');

  // Quick-retry (R)
  env.setNow(1250);
  env.emitUpdateCounts(0, 0);
  assert.equal(hud.classList.contains('is-visible'), true);
  assert.equal(hud.getAttribute('data-state'), 'behind');
  assert.equal(valueEl.textContent, '100,000');

  // Exit to menus
  env.menus.classList.remove('hidden');
  assert.equal(hud.classList.contains('is-visible'), false);
});

test('bundled mod tracks 40 Lines countdown in green and switches to red counting up at 0', () => {
  const env = createFakeDomEnvironment('https:');
  const { context } = env;

  vm.runInContext(`window._paq = window._paq || [];`, context);
  env.triggerDOMContentLoaded();

  const hud = env.elements.get('twfoxtetrio-top-hud');
  const valueEl = hud.querySelector('.twfox-delta-value');
  const subEl = hud.querySelector('.twfox-delta-sub');

  // Start 40 Lines
  env.menus.classList.add('hidden');
  vm.runInContext(`window._paq.push(['trackEvent', 'Activity', 'Start Game', '40 Lines']);`, context);

  assert.equal(hud.classList.contains('is-visible'), true);
  assert.equal(hud.getAttribute('data-mode'), '40l');
  assert.equal(hud.getAttribute('data-state'), 'ahead');
  assert.equal(valueEl.textContent, '0:45.320');
  assert.equal(subEl.textContent, '40L PB: 0:45.320');

  // Time advances -> counts down in green
  env.setNow(1050);
  env.emitUpdateTimers(15120);
  assert.equal(hud.getAttribute('data-state'), 'ahead');
  assert.equal(valueEl.textContent, '0:30.200');

  // Exactly hits PB time -> 0:00.000 in red + flash
  env.setNow(1100);
  env.emitUpdateTimers(45320);
  assert.equal(hud.getAttribute('data-state'), 'behind');
  assert.equal(valueEl.textContent, '0:00.000');
  assert.equal(subEl.textContent, 'OVER PB • 0:45.320');
  assert.equal(hud.classList.contains('is-flash-behind'), true);

  // Continues rising in red past PB
  env.setNow(1150);
  env.emitUpdateTimers(50570);
  assert.equal(hud.getAttribute('data-state'), 'behind');
  assert.equal(valueEl.textContent, '+0:05.250');

  // Quick-retry (R) -> resets back to green PB time
  env.setNow(1200);
  env.emitUpdateTimers(0);
  assert.equal(hud.classList.contains('is-visible'), true);
  assert.equal(hud.getAttribute('data-state'), 'ahead');
  assert.equal(valueEl.textContent, '0:45.320');

  // Switch to Custom Solo -> HUD hides
  vm.runInContext(`window._paq.push(['trackEvent', 'Activity', 'Start Game', 'Custom Solo']);`, context);
  assert.equal(hud.classList.contains('is-visible'), false);
});

test('bundled mod handles anonymous user fallback PB for both Blitz and 40 Lines', () => {
  const env = createFakeDomEnvironment('https:');
  env.body.classList.add('anon');
  env.pbBlitz.classList.add('hidden');
  env.pbBlitz.textContent = '';
  env.pb40l.classList.add('hidden');
  env.pb40l.textContent = '';

  vm.runInContext(`window._paq = window._paq || [];`, env.context);
  env.triggerDOMContentLoaded();

  const hud = env.elements.get('twfoxtetrio-top-hud');
  const valueEl = hud.querySelector('.twfox-delta-value');

  // Anon Blitz run
  env.menus.classList.add('hidden');
  vm.runInContext(`window._paq.push(['trackEvent', 'Activity', 'Start Game', 'Blitz']);`, env.context);
  env.setNow(1050);
  env.emitUpdateCounts(5200, 4);
  assert.equal(valueEl.textContent, '+5,200');

  env.resultHeader.textContent = 'FINAL SCORE';
  env.resultValue.textContent = '5,200';
  env.menus.setAttribute('data-menu-type', 'results');
  env.menus.classList.remove('hidden');

  env.menus.classList.add('hidden');
  vm.runInContext(`window._paq.push(['trackEvent', 'Activity', 'Start Game', 'Blitz']);`, env.context);
  assert.equal(hud.getAttribute('data-state'), 'behind');
  assert.equal(valueEl.textContent, '5,200');
  env.menus.classList.remove('hidden');

  // Anon 40 Lines run #1 -> finishes in 0:50.000
  env.menus.classList.add('hidden');
  vm.runInContext(`window._paq.push(['trackEvent', 'Activity', 'Start Game', '40 Lines']);`, env.context);
  assert.equal(hud.getAttribute('data-state'), 'ahead');
  assert.equal(valueEl.textContent, '0:00.000');

  env.resultHeader.textContent = 'FINAL TIME';
  env.resultValue.textContent = '0:50.000';
  env.menus.setAttribute('data-menu-type', 'results');
  env.menus.classList.remove('hidden');

  // Anon 40 Lines run #2 starts against 0:50.000 in green
  env.menus.classList.add('hidden');
  vm.runInContext(`window._paq.push(['trackEvent', 'Activity', 'Start Game', '40 Lines']);`, env.context);
  assert.equal(hud.getAttribute('data-state'), 'ahead');
  assert.equal(valueEl.textContent, '0:50.000');
});

test('bundled mod displays and sorts live multiplayer VS leaderboard on the right', () => {
  const env = createFakeDomEnvironment('https:');
  const { context } = env;

  vm.runInContext(`window._paq = window._paq || [];`, context);
  env.triggerDOMContentLoaded();

  const lbPanel = env.elements.get('twfoxtetrio-multi-lb');
  assert.ok(lbPanel, 'Leaderboard panel should be mounted');
  assert.equal(lbPanel.classList.contains('is-visible'), false);

  // Create fake Ja games Map inside VM realm so Map.prototype.set hook observes it
  vm.runInContext(`
    window.__fakeFrame = 600;
    window.__g1 = {
      id: 'g1',
      getOwner: () => 'fox',
      getFrame: () => window.__fakeFrame,
      isPlaying: () => true,
      state: { time: { zero: false, frameoffset: 0 }, stats: { piecesplaced: 30, garbage: { attack: 8, cleared: 4 } } }
    };
    window.__g2 = {
      id: 'g2',
      getOwner: () => 'topplayer',
      getFrame: () => window.__fakeFrame,
      isPlaying: () => true,
      state: { time: { zero: false, frameoffset: 0 }, stats: { piecesplaced: 40, garbage: { attack: 18, cleared: 6 } } }
    };
    window.__gamesMap = new Map();
    window.__gamesMap.self = window.__g1;
    window.__gamesMap.set('g1', window.__g1);
    window.__gamesMap.set('g2', window.__g2);
  `, context);

  // game.start adds multiplexed & hides menus
  env.menus.classList.add('hidden');
  env.body.classList.add('multiplexed');

  assert.equal(lbPanel.classList.contains('is-visible'), true);
  assert.equal(env.body.classList.contains('twfox-multi-lb-active'), true);
  const countEl = lbPanel.querySelector('.twfox-lb-count');
  const rowsEl = lbPanel.querySelector('.twfox-lb-rows');
  assert.equal(countEl.textContent, '2');
  assert.equal(rowsEl.children.length, 2);
  assert.equal(rowsEl.children[0].children[1].textContent, 'TOPPLAYER');
  assert.equal(rowsEl.children[0].children[2].textContent, '240.00');
  assert.equal(rowsEl.children[1].children[1].textContent, 'FOX');
  assert.equal(rowsEl.children[1].children[2].textContent, '120.00');

  // Fox overtakes topplayer in real time!
  vm.runInContext(`
    window.__fakeFrame = 900;
    window.__g1.state.stats.garbage.attack = 35; // (35+4)/15 * 100 = 260.00
    window.__g2.state.stats.garbage.attack = 21; // (21+6)/15 * 100 = 180.00
  `, context);
  env.tickIntervals();

  assert.equal(rowsEl.children[0].children[1].textContent, 'FOX');
  assert.equal(rowsEl.children[0].children[2].textContent, '260.00');
  assert.equal(rowsEl.children[1].children[1].textContent, 'TOPPLAYER');
  assert.equal(rowsEl.children[1].children[2].textContent, '180.00');

  // Match ends -> multiplexed removed -> hides cleanly
  env.body.classList.remove('multiplexed');
  env.menus.classList.remove('hidden');
  assert.equal(lbPanel.classList.contains('is-visible'), false);
  assert.equal(env.body.classList.contains('twfox-multi-lb-active'), false);
});

test('Home menu injects FOXMOD natively into #menus with Practice submenu (4Wide, Pentominoes, Marathon), userConfig keybinds, Multi P2P, Config, and Credits', async () => {
  const env = createFakeDomEnvironment('https:');
  // Configure real custom TETR.IO controls (like TWFoxcrack: KEYJ/KEYL/KEYK/DIGIT8/KEYZ) + instant handling
  env.storage.set(
    'userConfig',
    JSON.stringify({
      controls: {
        style: 'custom',
        custom: {
          moveLeft: ['KEYJ'],
          moveRight: ['KEYL'],
          softDrop: ['KEYK'],
          hardDrop: ['SPACE', 'DIGIT8'],
          rotateCCW: ['KEYZ'],
          rotateCW: ['KEYX'],
          rotate180: ['KEYA'],
          hold: ['KEYC'],
          retry: ['KEYR']
        }
      },
      handling: { das: 8, arr: 0, sdf: 41 }
    })
  );
  env.triggerDOMContentLoaded();

  const foxStyle = env.elements.get('twfoxtetrio-foxmod-style');
  assert.ok(foxStyle);
  assert.equal(/^\s*\.hidden\s*\{/m.test(foxStyle.textContent), false, 'Must never override global TETR.IO .hidden transitions');
  assert.equal(foxStyle.textContent.includes('#twfoxtetrio-multi-lobby'), true);
  assert.equal(foxStyle.textContent.includes('flex: 1 1 0'), true);

  const foxmodBtn = env.elements.get('twfoxtetrio-home-foxmod');
  assert.ok(foxmodBtn, 'FOXMOD button should be injected into #home_menu');
  assert.equal(env.homeMenu.children[env.homeMenu.children.length - 1], foxmodBtn);
  assert.equal(foxmodBtn.getAttribute('data-hover'), 'hover');
  assert.equal(foxmodBtn.getAttribute('data-hit'), 'hit1');
  assert.equal(foxmodBtn.querySelector('h1').textContent, 'FOXMOD');

  const foxView = env.elements.get('twfoxtetrio-view-foxmod');
  const practiceMenuPane = env.elements.get('twfoxtetrio-pane-practice');
  const pentominoStagePane = env.elements.get('twfoxtetrio-pane-pentomino');
  const multiPane = env.elements.get('twfoxtetrio-pane-multi');
  const configPane = env.elements.get('twfoxtetrio-pane-config');
  const creditsPane = env.elements.get('twfoxtetrio-pane-credits');

  assert.equal(foxView.classList.contains('hidden'), true);

  // Clicking FOXMOD in HOME transitions natively inside #menus like SOLO
  foxmodBtn.click();
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod');
  assert.equal(env.headerText.textContent, 'FOXMOD');
  assert.equal(env.backBtn.classList.contains('hidden'), false);
  assert.equal(env.exitElectron.classList.contains('hidden'), true);
  assert.equal(env.homeMenu.classList.contains('hidden'), true);
  assert.equal(foxView.classList.contains('hidden'), false);

  // Enter PRACTICA submenu -> shows 4WIDE, PENTOMINOS, MARATHON, ZEN
  env.elements.get('twfoxtetrio-card-practice').click();
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_practice');
  assert.equal(env.headerText.textContent, 'PRACTICA');
  assert.equal(practiceMenuPane.classList.contains('hidden'), false);
  assert.equal(foxView.classList.contains('hidden'), true);
  assert.ok(env.elements.get('twfoxtetrio-prac-4wide'));
  assert.ok(env.elements.get('twfoxtetrio-prac-pentomino'));
  assert.ok(env.elements.get('twfoxtetrio-prac-marathon'));
  assert.ok(env.elements.get('twfoxtetrio-prac-zen'));

  // Clicking 4WIDE configures TETR.IO custom boardwidth=4 & launches real engine (#start_custom)
  env.elements.get('twfoxtetrio-prac-4wide').click();
  assert.equal(env.getCustomStarts(), 1);
  assert.equal(env.customContainer.children[0].value, '4');
  assert.equal(env.customContainer.children[1].textContent, 'none');

  // Exiting 4WIDE (TETR.IO hides menus during game, then Ni('home')) returns directly to PRACTICA
  env.menus.setAttribute('data-menu-type', 'none');
  env.menus.classList.add('hidden');
  env.menus.setAttribute('data-menu-type', 'home');
  env.menus.classList.remove('hidden');
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_practice');
  assert.equal(env.headerText.textContent, 'PRACTICA');
  assert.equal(practiceMenuPane.classList.contains('hidden'), false);

  // Directly click MARATHON from returned PRACTICA -> configures 150 lines & levels=true -> exiting via results->custom returns to PRACTICA
  env.elements.get('twfoxtetrio-prac-marathon').click();
  assert.equal(env.getCustomStarts(), 2);
  assert.equal(env.customContainer.children[0].value, '10');
  assert.equal(env.customContainer.children[1].textContent, 'lines');
  assert.equal(env.customContainer.children[2].value, '150');
  assert.equal(env.customContainer.children[3].checked, true);
  env.menus.setAttribute('data-menu-type', 'none');
  env.menus.classList.add('hidden');
  env.menus.setAttribute('data-menu-type', 'results');
  env.menus.classList.remove('hidden');
  assert.equal(env.menus.getAttribute('data-menu-type'), 'results', 'Results screen stays visible before returning');
  env.menus.setAttribute('data-menu-type', 'custom');
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_practice');
  assert.equal(practiceMenuPane.classList.contains('hidden'), false);

  // Directly click PENTOMINOS from PRACTICA -> full-stage TETR.IO-styled Pentominoes + custom userConfig controls
  env.elements.get('twfoxtetrio-prac-pentomino').click();
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_pentomino');
  assert.equal(pentominoStagePane.classList.contains('hidden'), false);
  assert.equal(env.body.classList.contains('twfox-ingame'), true);
  assert.equal(env.elements.get('twfoxtetrio-practice-pieces').value, 'pentomino');

  // Custom keybinds read from userConfig (DIGIT8 hard-drops, J/L/Z/C work cleanly)
  const settings = env.context.__TWFOX_INTERNAL__.foxmodCanvas.readTetrioUserSettings();
  assert.deepEqual(Array.from(settings.binds.moveLeft), ['KEYJ']);
  assert.deepEqual(Array.from(settings.binds.hardDrop), ['SPACE', 'DIGIT8']);
  assert.equal(settings.sdf, 41);

  env.dispatchDocEvent('keydown', { key: '8', code: 'Digit8' });

  // Back returns PENTOMINOS -> PRACTICA -> FOXMOD (exits twfox-ingame chrome cleanly)
  env.backBtn.click();
  assert.equal(env.body.classList.contains('twfox-ingame'), false);
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_practice');
  env.backBtn.click();
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod');
  assert.equal(foxView.classList.contains('hidden'), false);

  // Delayed TETR.IO login populates #me_username -> runtime MutationObserver updates selfUsername automatically
  env.meUsername.textContent = 'TWFoxcrack';
  assert.equal(env.context.__TWFOX_TETRIO__.getState().selfUsername, 'TWFoxcrack');

  // Enter MULTIJUGADOR -> opens #list_request style CREATE LOBBY / JOIN LOBBY picker
  env.elements.get('twfoxtetrio-card-multi').click();
  const multiReq = env.elements.get('twfoxtetrio-multi-request');
  assert.ok(multiReq.classList.contains('is-open'));
  assert.equal(env.elements.get('twfoxtetrio-create-room-btn').querySelector('h1').textContent, 'CREATE LOBBY');
  assert.equal(env.elements.get('twfoxtetrio-join-room-btn').querySelector('h1').textContent, 'JOIN LOBBY');

  // Clicking CREATE LOBBY opens the 3-column TETR.IO room lobby as Host Server with real name & 4-char #CODE
  env.elements.get('twfoxtetrio-create-room-btn').click();
  assert.equal(multiReq.classList.contains('is-open'), false);
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_multi');
  assert.equal(multiPane.classList.contains('hidden'), false);
  assert.equal(env.elements.get('twfoxtetrio-multi-lobby').classList.contains('hidden'), false);
  assert.equal(env.elements.get('twfoxtetrio-host-invite-box').classList.contains('hidden'), false);
  assert.equal(env.elements.get('twfoxtetrio-host-invite-box').getAttribute('style'), null);
  assert.equal(env.elements.get('twfoxtetrio-lobby-room-title').textContent, "TWFOXCRACK'S FOXROOM");
  const playersBox = env.elements.get('twfoxtetrio-lobby-players');
  assert.equal(playersBox.children.length, 1);
  assert.equal(playersBox.children[0].children[0].textContent, 'TWFOXCRACK');

  // Top #CODE banner matches Host code card and clicking copies #CODE
  const topBannerCode = env.elements.get('twfoxtetrio-lobby-invite-code').textContent;
  const hostCardCode = env.elements.get('twfoxtetrio-host-room-code').textContent;
  assert.match(topBannerCode, /^#[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(topBannerCode, hostCardCode);
  env.elements.get('twfoxtetrio-lobby-invite-banner').click();
  assert.equal(env.copiedTexts[env.copiedTexts.length - 1], topBannerCode);

  // Manual P2P fallback starts collapsed and toggles cleanly
  const manualPanel = env.elements.get('twfoxtetrio-host-manual-panel');
  assert.equal(manualPanel.classList.contains('hidden'), true);
  env.elements.get('twfoxtetrio-host-manual-toggle').click();
  assert.equal(manualPanel.classList.contains('hidden'), false);

  // Switch center lobby tab to GAME -> default is normal tetrominoes, add Blitz option, and require 2+ players to start
  env.elements.get('twfoxtetrio-lobby-tab-game').click();
  assert.equal(env.elements.get('twfoxtetrio-center-game').classList.contains('hidden'), false);
  const roomPieces = env.elements.get('twfoxtetrio-room-pieces');
  const roomMode = env.elements.get('twfoxtetrio-room-mode');
  const startBtn = env.elements.get('twfoxtetrio-host-start-btn');
  assert.equal(roomPieces.value, 'tetromino');
  assert.equal(roomMode.value, 'vs');
  assert.equal(startBtn.disabled, true);
  assert.equal(startBtn.classList.contains('is-disabled'), true);

  // Clicking START with only 1 player stays in lobby and refuses to start
  startBtn.click();
  assert.equal(env.body.classList.contains('twfox-ingame'), false);
  assert.equal(env.elements.get('twfoxtetrio-multi-game').classList.contains('hidden'), true);
  assert.equal(env.elements.get('twfoxtetrio-multi-winner').textContent, 'NEED AT LEAST 2 PLAYERS TO START');

  // Switch room mode to BLITZ (2:00)
  roomMode.value = 'blitz';
  roomMode.dispatchEvent('change');

  // Connect a 2nd player via loopback WebRTC in the sandbox -> START unlocks and Leaderboard renders scores on right
  const backLobbyBtn = env.elements.get('twfoxtetrio-back-lobby-btn');
  assert.equal(backLobbyBtn.classList.contains('twfox-corner-back-btn'), true);
  assert.equal(env.elements.get('twfoxtetrio-multi-game').querySelectorAll('.twfox-stage-bar').length, 0);

  const rtcEndpoints = new Map();
  let rtcSeq = 1;
  env.context.RTCPeerConnection = function FakeRtc() {
    const id = 'rtcdom-' + rtcSeq++;
    const pc = {
      id,
      iceGatheringState: 'complete',
      localDescription: null,
      remoteDescription: null,
      ondatachannel: null,
      _pendingOpen: null,
      createDataChannel(label) {
        const ch = { label, readyState: 'connecting', onopen: null, onmessage: null, onclose: null };
        pc._pendingChannel = ch;
        return ch;
      },
      async createOffer() { return { type: 'offer', sdp: 'v=0\r\nfrom=' + id }; },
      async createAnswer() { return { type: 'answer', sdp: 'v=0\r\nfrom=' + id }; },
      async setLocalDescription(desc) { pc.localDescription = desc; },
      async setRemoteDescription(desc) {
        pc.remoteDescription = desc;
        if (desc.type === 'answer') {
          const remotePc = rtcEndpoints.get(desc.sdp.split('from=')[1]);
          const hostCh = pc._pendingChannel;
          const cliCh = { label: 'foxmod-room', readyState: 'open', onopen: null, onmessage: null, onclose: null };
          hostCh.send = (d) => { if (cliCh.onmessage) queueMicrotask(() => cliCh.onmessage({ data: d })); };
          cliCh.send = (d) => { if (hostCh.onmessage) queueMicrotask(() => hostCh.onmessage({ data: d })); };
          hostCh.close = () => { hostCh.readyState = 'closed'; if (hostCh.onclose) hostCh.onclose(); };
          cliCh.close = hostCh.close;
          hostCh.readyState = 'open';
          if (remotePc.ondatachannel) remotePc.ondatachannel({ channel: cliCh });
          if (hostCh.onopen) hostCh.onopen();
          if (cliCh.onopen) cliCh.onopen();
        }
      },
      close() {}
    };
    rtcEndpoints.set(id, pc);
    return pc;
  };

  env.elements.get('twfoxtetrio-host-gen-invite').click();
  await new Promise((r) => setTimeout(r, 10));
  const peerClient = env.context.__TWFOX_INTERNAL__.p2pRoom.createClientPeer({ playerName: 'Maekrix' });
  const manualAns = await peerClient.joinFromInvite(env.elements.get('twfoxtetrio-host-offer-output').value);
  env.elements.get('twfoxtetrio-host-answer-input').value = manualAns;
  env.elements.get('twfoxtetrio-host-accept-btn').click();
  await new Promise((r) => setTimeout(r, 30));

  assert.equal(startBtn.disabled, false);
  assert.equal(startBtn.classList.contains('is-disabled'), false);
  assert.equal(env.elements.get('twfoxtetrio-lobby-players').children.length, 2);

  startBtn.click();
  assert.equal(env.body.classList.contains('twfox-ingame'), true);
  assert.equal(env.elements.get('twfoxtetrio-multi-game').classList.contains('hidden'), false);

  peerClient.updateSelfBoard({ compactBoard: null, score: 4200, lines: 5, attackSent: 0, vs: 0 });
  await new Promise((r) => setTimeout(r, 30));

  const lbRows = env.elements.get('twfoxtetrio-multi-lb-rows');
  assert.equal(lbRows.children.length, 2);
  assert.match(lbRows.children[0].children[0].textContent, /MAEKRIX|Maekrix/);
  assert.equal(lbRows.children[0].children[1].textContent, '4,200');
  assert.match(lbRows.children[1].children[0].textContent, /TWFOXCRACK/);

  backLobbyBtn.click();
  assert.equal(env.body.classList.contains('twfox-ingame'), false);
  assert.equal(env.elements.get('twfoxtetrio-multi-lobby').classList.contains('hidden'), false);

  // Switch to VERSUS KO round: client KOs -> Victory finish animation overlay opens -> Podium Nº1 survivor -> Nº2 KO
  roomMode.value = 'vs';
  roomMode.dispatchEvent('change');
  await new Promise((r) => setTimeout(r, 20));
  startBtn.click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(env.elements.get('twfoxtetrio-multi-finish-overlay').classList.contains('hidden'), true);

  peerClient.reportSelfKo({ vs: 24.5, attackSent: 5, lines: 8 });
  await new Promise((r) => setTimeout(r, 30));

  const finishOverlay = env.elements.get('twfoxtetrio-multi-finish-overlay');
  assert.equal(finishOverlay.classList.contains('hidden'), false);
  assert.equal(env.elements.get('twfoxtetrio-finish-title').textContent, 'VICTORY!');

  // Advance/click through to dedicated Podium Results view (Nº1 survivor at top, Nº2 below)
  env.elements.get('twfoxtetrio-finish-skip-btn').click();
  assert.equal(env.elements.get('twfoxtetrio-multi-game').classList.contains('hidden'), true);
  assert.equal(env.elements.get('twfoxtetrio-multi-results').classList.contains('hidden'), false);
  const resRows = env.elements.get('twfoxtetrio-results-list').children;
  assert.equal(resRows.length, 2);
  assert.equal(resRows[0].children[0].textContent, 'Nº1');
  assert.match(resRows[0].children[1].children[0].textContent, /TWFOXCRACK/);
  assert.equal(resRows[0].children[1].children[1].textContent, 'SURVIVOR');
  assert.equal(resRows[1].children[0].textContent, 'Nº2');
  assert.match(resRows[1].children[1].children[0].textContent, /MAEKRIX|Maekrix/);
  assert.equal(resRows[1].children[1].children[1].textContent, 'KO');

  // Returning to lobby exposes VIEW RESULTS button cleanly and can reopen Results
  env.elements.get('twfoxtetrio-results-lobby-btn').click();
  assert.equal(env.elements.get('twfoxtetrio-multi-lobby').classList.contains('hidden'), false);
  assert.equal(env.elements.get('twfoxtetrio-view-results-btn').classList.contains('hidden'), false);
  env.elements.get('twfoxtetrio-view-results-btn').click();
  assert.equal(env.elements.get('twfoxtetrio-multi-results').classList.contains('hidden'), false);

  // PLAY AGAIN from Results launches Round 3 directly
  env.elements.get('twfoxtetrio-results-again-btn').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(env.elements.get('twfoxtetrio-multi-results').classList.contains('hidden'), true);
  assert.equal(env.elements.get('twfoxtetrio-multi-game').classList.contains('hidden'), false);
  backLobbyBtn.click();
  assert.equal(env.elements.get('twfoxtetrio-multi-lobby').classList.contains('hidden'), false);

  peerClient.close();
  assert.equal(env.body.classList.contains('twfox-ingame'), false);
  assert.equal(env.elements.get('twfoxtetrio-multi-lobby').classList.contains('hidden'), false);

  // EXIT -> MULTIJUGADOR -> JOIN LOBBY opens dedicated code prompt (does NOT enter empty PLAYERS(0) lobby)
  env.elements.get('twfoxtetrio-leave-room-btn').click();
  env.elements.get('twfoxtetrio-card-multi').click();
  env.elements.get('twfoxtetrio-join-room-btn').click();
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod');
  assert.ok(multiReq.classList.contains('is-open'));
  assert.equal(env.elements.get('twfoxtetrio-join-dialog').classList.contains('hidden'), false);
  assert.equal(env.elements.get('twfoxtetrio-join-manual-reply').classList.contains('hidden'), true);
  assert.equal(env.context.__TWFOX_INTERNAL__.p2pRoom.normalizeRoomCode('k7m4'), 'K7M4');
  assert.equal(env.context.__TWFOX_INTERNAL__.p2pRoom.normalizeRoomCode('#k7m4'), 'K7M4');
  env.elements.get('twfoxtetrio-join-cancel-btn').click();
  assert.equal(env.elements.get('twfoxtetrio-join-dialog').classList.contains('hidden'), true);
  assert.ok(multiReq.classList.contains('is-open'));
  env.elements.get('twfoxtetrio-req-back').click();
  assert.equal(multiReq.classList.contains('is-open'), false);

  // Navigate to CONFIG via card -> toggle Blitz & maxRows -> reset defaults
  env.elements.get('twfoxtetrio-card-config').click();
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_config');
  assert.equal(configPane.classList.contains('hidden'), false);

  const checkboxes = configPane.querySelectorAll('.twfox-toggle-input');
  assert.equal(checkboxes.length, 11);
  checkboxes[0].checked = false;
  checkboxes[0].dispatchEvent('change');
  assert.equal(env.context.__TWFOX_TETRIO__.getConfig().blitzTracker.enabled, false);
  const persisted = JSON.parse(env.storage.get('twfoxtetrio_config_v1'));
  assert.equal(persisted.blitzTracker.enabled, false);

  const stepBtns = configPane.querySelectorAll('.twfox-step-btn');
  assert.equal(stepBtns.length, 2);
  stepBtns[1].click();
  assert.equal(env.context.__TWFOX_TETRIO__.getConfig().multiplayerLeaderboard.maxRows, 13);
  assert.equal(env.elements.get('twfoxtetrio-maxrows-value').textContent, '13');

  env.elements.get('twfoxtetrio-reset-defaults').click();
  assert.equal(env.context.__TWFOX_TETRIO__.getConfig().blitzTracker.enabled, true);
  assert.equal(env.context.__TWFOX_TETRIO__.getConfig().multiplayerLeaderboard.maxRows, 12);
  assert.equal(checkboxes[0].checked, true);

  // Back to FOXMOD -> CREDITS -> check author & GitHub link
  env.backBtn.click();
  env.elements.get('twfoxtetrio-card-credits').click();
  assert.equal(creditsPane.classList.contains('hidden'), false);
  assert.match(creditsPane.querySelector('.twfox-credits-author').textContent, /TWFoxcrack/);

  env.elements.get('twfoxtetrio-github-link').click();
  assert.deepEqual(env.openedExternalUrls, ['https://github.com/Foxcrack/twfoxtetrio']);

  // Escape twice navigates CREDITS -> FOXMOD -> HOME
  env.dispatchDocEvent('keydown', { key: 'Escape', code: 'Escape' });
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod');
  env.dispatchDocEvent('keydown', { key: 'Escape', code: 'Escape' });
  assert.equal(env.menus.getAttribute('data-menu-type'), 'home');
  assert.equal(env.headerText.textContent, 'HOME');
  assert.equal(env.homeMenu.classList.contains('hidden'), false);
  assert.equal(env.backBtn.classList.contains('hidden'), true);
  assert.equal(env.exitElectron.classList.contains('hidden'), false);

  // External menu transition (e.g. entering Blitz) hides FOXMOD cleanly
  foxmodBtn.click();
  assert.equal(foxView.classList.contains('hidden'), false);
  env.menus.setAttribute('data-menu-type', 'blitz');
  env.menus.classList.add('hidden');
  assert.equal(foxView.classList.contains('hidden'), true);
});

test('bundled mod renders left Quick Play Weekly PB vertical bar, counts down in red, and hides bar in green once surpassed', () => {
  const env = createFakeDomEnvironment('https:');
  env.triggerDOMContentLoaded();

  const zenithHud = env.elements.get('twfoxtetrio-zenith-hud');
  const barWrap = env.elements.get('twfoxtetrio-zenith-bar-wrap');
  const barFill = env.elements.get('twfoxtetrio-zenith-bar-fill');
  assert.ok(zenithHud);
  assert.ok(barWrap);
  assert.ok(barFill);
  assert.equal(zenithHud.classList.contains('is-visible'), false);

  const zValEl = zenithHud.querySelector('.twfox-z-value');
  const zSubEl = zenithHud.querySelector('.twfox-z-sub');

  let currentAlt = 0;
  const selfGameWrapper = {
    id: 'self_z_1',
    getOwner: () => 'fox',
    getFrame: () => 300,
    getZenithAltitude: () => currentAlt,
    isPlaying: () => true,
    state: {
      playing: true,
      time: { zero: false, frameoffset: 0 },
      setoptions: { zenith_expert: false },
      stats: {
        piecesplaced: 12,
        garbage: { attack: 0, cleared: 0 },
        zenith: { altitude: 0 }
      }
    }
  };

  vm.runInContext(
    `
      const zMap = new Map();
      zMap.self = selfWrapperRef;
      zMap.set('self_z_1', selfWrapperRef);
    `,
    Object.assign(env.context, { selfWrapperRef: selfGameWrapper })
  );

  const zenithMenu = env.elements.get('zenithmenu');
  env.menus.classList.add('hidden');
  env.body.classList.add('multiplexed', 'inzenith');
  zenithMenu.classList.add('rolledup');

  assert.equal(zenithHud.classList.contains('is-visible'), true);
  assert.equal(zenithHud.getAttribute('data-state'), 'behind');
  assert.equal(zValEl.textContent, '1,000.0 M');
  assert.equal(zSubEl.textContent, 'WEEKLY PB: 1,000.0 M');
  assert.equal(barWrap.classList.contains('is-collapsed'), false);
  assert.equal(barFill.getAttribute('data-progress'), '0.00%');

  // Renders floor tick marks for floors strictly below Weekly PB (1000 M -> F2..F7: 50..850 M)
  const ticks = barWrap.querySelectorAll('.twfox-z-bar-tick');
  assert.equal(ticks.length, 6);
  assert.equal(ticks[0].getAttribute('data-floor'), '2');
  assert.equal(ticks[0].getAttribute('data-altitude'), '50');
  assert.equal(ticks[5].getAttribute('data-floor'), '7');
  assert.equal(ticks[5].getAttribute('data-altitude'), '850');

  // Climbing to 750.0m counts down to 250.0 M remaining, fills bar to 75%, marks crossed floor ticks
  currentAlt = 750.0;
  env.tickIntervals();
  assert.equal(zenithHud.getAttribute('data-state'), 'behind');
  assert.equal(zValEl.textContent, '250.0 M');
  assert.equal(barWrap.classList.contains('is-collapsed'), false);
  assert.equal(barFill.getAttribute('data-progress'), '75.00%');
  assert.equal(ticks[4].classList.contains('is-reached'), true);  // F6 (650 M) reached
  assert.equal(ticks[5].classList.contains('is-reached'), false); // F7 (850 M) not yet reached

  // Surpassing Weekly PB (1,142.3m): turns green, counts upward +142.3 M, and collapses vertical bar
  currentAlt = 1142.3;
  env.tickIntervals();
  assert.equal(zenithHud.getAttribute('data-state'), 'ahead');
  assert.ok(zenithHud.classList.contains('is-flash-ahead'));
  assert.equal(zValEl.textContent, '+142.3 M');
  assert.equal(zSubEl.textContent, 'NEW WEEKLY PB · 1,000.0 M');
  assert.equal(barWrap.classList.contains('is-collapsed'), true);

  // Dying shows results (adds inresults, removes rolledup and ingame_phys): HUD hides cleanly
  env.body.classList.remove('ingame_phys');
  zenithMenu.classList.remove('rolledup', 'hidden');
  zenithMenu.classList.add('inresults');
  assert.equal(zenithHud.classList.contains('is-visible'), false);

  // Clicking AGAIN starts a second run (body gets ingame_phys while #zenithmenu retains stale .inresults):
  // HUD and vertical bar MUST reappear and resume tracking from 0 M
  currentAlt = 120.0;
  env.body.classList.add('ingame_phys');
  zenithMenu.classList.add('rolledup', 'hidden');
  assert.equal(zenithHud.classList.contains('is-visible'), true);
  assert.equal(zenithHud.getAttribute('data-state'), 'behind');
  assert.equal(barWrap.classList.contains('is-collapsed'), false);
  assert.equal(zValEl.textContent, '880.0 M');
  assert.equal(barFill.getAttribute('data-progress'), '12.00%');

  // Exiting Quick Play results/menu hides HUD cleanly
  env.body.classList.remove('ingame_phys');
  zenithMenu.classList.remove('rolledup', 'hidden');
  assert.equal(zenithHud.classList.contains('is-visible'), false);
});

test('vanilla SOLO -> ZEN stays untouched while FOXMOD -> PRACTICA -> ZEN shows original #zen_panel + Quick Play Cards live', () => {
  const env = createFakeDomEnvironment('https:');
  env.triggerDOMContentLoaded();

  // Vanilla boot must NOT inject/show #twfoxtetrio-zen-qp-section on #zen_panel_content
  assert.equal(env.elements.get('twfoxtetrio-zen-qp-section'), undefined);

  // Vanilla SOLO -> ZEN wrapper (when launched outside PRACTICA) must stay untouched
  const vanillaZenWrapper = {
    state: {
      g: 0.02,
      holdlocked: false,
      stats: { zenlevel: 2 },
      setoptions: { usezenconfig: true, display_hold: true, spinbonuses: 'T-spins+' }
    }
  };
  vm.runInContext(
    `
      const vMap = new Map();
      vMap.set('zen_vanilla', vanillaRef);
    `,
    Object.assign(env.context, { vanillaRef: vanillaZenWrapper })
  );
  assert.equal(env.elements.get('twfoxtetrio-zen-qp-section'), undefined);
  assert.equal(vanillaZenWrapper.state.setoptions.__twfoxZenHooked, undefined);

  // Now open FOXMOD -> PRACTICA -> ZEN: arms Practice ZEN, starts custom preset, and opens #zen_panel + QP Cards
  env.elements.get('twfoxtetrio-home-foxmod').click();
  env.elements.get('twfoxtetrio-card-practice').click();
  env.elements.get('twfoxtetrio-prac-zen').click();
  assert.equal(env.getCustomStarts(), 1);

  let createHolderCalls = 0;
  const zenGameWrapper = {
    state: {
      g: 0.02,
      holdlocked: false,
      stats: { zenlevel: 3 },
      setoptions: {
        usezenconfig: false,
        zenlevels: false,
        display_hold: true,
        infinite_hold: false,
        infinite_movement: false,
        locktime: 30,
        spinbonuses: 'T-spins+',
        receivemultiplier: 1,
        survivalmode: 'none',
        messiness_change: 1,
        messiness_inner: 0,
        messiness_nosame: false,
        messiness_center: true,
        garbagefavor: 33,
        garbagephase: 165,
        survival_messiness: 100
      }
    },
    loadZenConfig() {},
    pullZenConfig() {
      const opts = zenGameWrapper.state.setoptions;
      opts.spinbonuses = 'T-spins+';
      opts.locktime = 30;
      zenGameWrapper.state.g = 0.02;
      opts.survivalmode = 'none';
      createHolderCalls += 1;
    }
  };

  env.menus.classList.add('hidden');
  vm.runInContext(
    `
      const zenMap = new Map();
      zenMap.set('prac_zen_self', zenWrapperRef);
    `,
    Object.assign(env.context, { zenWrapperRef: zenGameWrapper })
  );

  // Uses real #zen_panel sidebar (not hidden) with usezenconfig=true and zenlevels=false (no /api/games/zen writes)
  assert.equal(env.elements.get('zen_panel').classList.contains('hidden'), false);
  assert.equal(zenGameWrapper.state.setoptions.usezenconfig, true);
  assert.equal(zenGameWrapper.state.setoptions.zenlevels, false);
  const zenSection = env.elements.get('twfoxtetrio-zen-qp-section');
  assert.ok(zenSection, 'Expected Quick Play Cards section inside #zen_panel_content');
  assert.equal(zenSection.classList.contains('hidden'), false);

  // Toggle NO HOLD + ALL-SPIN + INVISIBLE + DOUBLE HOLE directly in #zen_panel
  env.elements.get('twfoxtetrio-zen-mod-nohold').click();
  env.elements.get('twfoxtetrio-zen-mod-allspin').click();
  env.elements.get('twfoxtetrio-zen-mod-invisible').click();
  env.elements.get('twfoxtetrio-zen-mod-doublehole').click();

  assert.equal(zenGameWrapper.state.setoptions.display_hold, false);
  assert.equal(zenGameWrapper.state.holdlocked, true);
  assert.equal(zenGameWrapper.state.setoptions.zenith_allspin, true);
  assert.equal(zenGameWrapper.state.setoptions.spinbonuses, 'all+');
  assert.equal(zenGameWrapper.state.setoptions.invisible, true);
  assert.equal(zenGameWrapper.state.setoptions.zenith_doublehole, true);
  assert.ok(createHolderCalls >= 4);

  // Garbage helper hint appears while garbagemode is OFF and clicking BACKFIRE 1X enables it
  const hint = env.elements.get('twfoxtetrio-zen-qp-hint');
  assert.equal(hint.classList.contains('hidden'), false);
  env.elements.get('twfoxtetrio-zen-qp-enable-backfire').click();
  assert.equal(hint.classList.contains('hidden'), true);

  // Flip GRAVITY -> REVERSED (20G Freefall) and check UpdateZenGravity locktime intercept preserves 20G
  env.elements.get('twfoxtetrio-zen-mod-gravity-rev').click();
  assert.equal(zenGameWrapper.state.g, 20);
  assert.equal(zenGameWrapper.state.setoptions.locktime, 16);
  zenGameWrapper.state.g = 0.05;
  zenGameWrapper.state.setoptions.locktime = 30;
  assert.equal(zenGameWrapper.state.g, 20);
  assert.equal(zenGameWrapper.state.setoptions.locktime, 16);

  // Clicking RESET clears all active QP cards and restores clean base ZEN flags
  env.elements.get('twfoxtetrio-zen-qp-reset').click();
  assert.equal(zenGameWrapper.state.setoptions.display_hold, true);
  assert.equal(zenGameWrapper.state.holdlocked, false);
  assert.equal(zenGameWrapper.state.setoptions.zenith_allspin, false);
  assert.equal(zenGameWrapper.state.setoptions.spinbonuses, 'T-spins+');
  assert.equal(zenGameWrapper.state.setoptions.invisible, false);
  assert.equal(zenGameWrapper.state.g, 0.02);
  assert.equal(zenGameWrapper.state.setoptions.locktime, 30);

  // Exiting back to menus hides #zen_panel & #twfoxtetrio-zen-qp-section and returns cleanly to PRACTICA
  env.menus.setAttribute('data-menu-type', 'home');
  env.menus.classList.remove('hidden');
  assert.equal(env.elements.get('zen_panel').classList.contains('hidden'), true);
  assert.equal(zenSection.classList.contains('hidden'), true);
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_practice');
  assert.equal(env.elements.get('twfoxtetrio-pane-practice').classList.contains('hidden'), false);
});

test('CONFIG Assets Studio connects to you.have.fail/tetrioplus, downloads/installs/uninstalls skins, boards, SFX & animated backgrounds', async () => {
  const customAssetsLogic = require('../src/features/custom-assets-logic');

  function pngDataUrl(w, h) {
    const buf = Buffer.alloc(24);
    buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47;
    buf[4] = 0x0d; buf[5] = 0x0a; buf[6] = 0x1a; buf[7] = 0x0a;
    buf.writeUInt32BE(13, 8);
    buf.write('IHDR', 12, 'ascii');
    buf.writeUInt32BE(w, 16);
    buf.writeUInt32BE(h, 20);
    return 'data:image/png;base64,' + buf.toString('base64');
  }

  const fakeCatalog = [
    {
      id: 'skin-4_false-carbon_fiber',
      name: 'Carbon Fiber',
      author: '4_false',
      description: 'Carbon weave minos + board',
      type: 'skin',
      format: 'tetrioraster',
      uploaded: 1620000000000,
      path: 'content/skin/4_false/carbon_fiber.png',
      tpsePath: 'tpsefiles/skin/4_false/carbon_fiber.png.tpse'
    },
    {
      id: 'sfx-8bJackie-Tetrio_retro_pack',
      name: 'Tetrio_retro_pack',
      author: '8bJackie',
      description: 'Retro 8bit sounds',
      type: 'sfx',
      format: 'tetrio',
      uploaded: 1630000000000,
      path: 'content/sfx/8bJackie/Tetrio_retro_pack.zip',
      tpsePath: null
    }
  ];
  const fakeVotes = { 'skin-4_false-carbon_fiber': { total: 15, active: 2 } };
  const fakeTpse = {
    version: '0.23.8',
    skin: pngDataUrl(2048, 2048),
    ghost: pngDataUrl(1024, 1024),
    board: pngDataUrl(512, 512)
  };
  const fakeSfxTpse = {
    version: '0.23.8',
    sfxEnabled: true,
    customSounds: 'data:audio/ogg;base64,T2dnUwACAAAA',
    customSoundAtlas: { move: [0, 50] }
  };

  class FakeHtmlImage {
    constructor() { this._src = ''; }
    get src() { return this._src; }
    set src(val) { this._src = String(val); }
  }
  const origDesc = Object.getOwnPropertyDescriptor(FakeHtmlImage.prototype, 'src');

  class FakeResponse {
    constructor(bytes, ct) {
      this._bytes = Buffer.from(bytes);
      this.ok = true;
      this.status = 200;
      this.headers = { get: () => ct || 'application/octet-stream' };
    }
    async arrayBuffer() {
      return this._bytes.buffer.slice(this._bytes.byteOffset, this._bytes.byteOffset + this._bytes.byteLength);
    }
  }

  class FakeAudioContext {
    async decodeAudioData() {
      const ch = new Float32Array(2205);
      ch.fill(0.25);
      return {
        sampleRate: 44100,
        numberOfChannels: 1,
        duration: 0.05,
        length: 2205,
        getChannelData: () => ch
      };
    }
    close() { return Promise.resolve(); }
  }

  const fetchedUrls = [];
  const env = createFakeDomEnvironment('https:', {
    URL,
    Response: FakeResponse,
    HTMLImageElement: FakeHtmlImage,
    Image: FakeHtmlImage,
    AudioContext: FakeAudioContext,
    fetch: async (url) => {
      fetchedUrls.push(String(url));
      if (String(url).includes('data.json')) {
        return new FakeResponse(Buffer.from(JSON.stringify(fakeCatalog), 'utf8'), 'application/json');
      }
      if (String(url).includes('votes.json')) {
        return new FakeResponse(Buffer.from(JSON.stringify(fakeVotes), 'utf8'), 'application/json');
      }
      if (String(url).includes('carbon_fiber.png.tpse')) {
        return new FakeResponse(Buffer.from(JSON.stringify(fakeTpse), 'utf8'), 'application/json');
      }
      if (String(url).includes('Tetrio_retro_pack')) {
        return new FakeResponse(Buffer.from(JSON.stringify(fakeSfxTpse), 'utf8'), 'application/json');
      }
      if (String(url).includes('/sfx/tetrio.desktop.rsd')) {
        const baseWav = customAssetsLogic.encodeWavPcm16([new Float32Array([0, 0.1, -0.1])], 44100);
        const baseTrsd = customAssetsLogic.buildTrsd([{ name: 'move', offsetSec: 0 }], 0.05, baseWav);
        return new FakeResponse(baseTrsd, 'application/octet-stream');
      }
      throw new Error('Unexpected fetch ' + url);
    }
  });
  env.triggerDOMContentLoaded();

  // Navigate to FOXMOD -> CONFIG -> triggers automatic catalog load
  env.elements.get('twfoxtetrio-home-foxmod').click();
  env.elements.get('twfoxtetrio-card-config').click();
  assert.ok(env.elements.get('twfoxtetrio-assets-block'));

  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }

  assert.ok(fetchedUrls.some((u) => u.includes('https://you.have.fail/tetrioplus/data/data.json')));
  const exploreList = env.elements.get('twfoxtetrio-assets-explore-list');
  assert.equal(exploreList.children.length, 2);

  // Verify only Todos, Skins, and SFX category buttons are shown
  assert.ok(env.elements.get('twfoxtetrio-assets-cat-all'));
  assert.ok(env.elements.get('twfoxtetrio-assets-cat-skins'));
  assert.ok(env.elements.get('twfoxtetrio-assets-cat-sfx'));
  assert.equal(env.elements.get('twfoxtetrio-assets-cat-board'), undefined);
  assert.equal(env.elements.get('twfoxtetrio-assets-cat-background'), undefined);
  assert.equal(env.elements.get('twfoxtetrio-assets-cat-animated'), undefined);

  env.elements.get('twfoxtetrio-assets-cat-skins').click();
  assert.equal(exploreList.children.length, 1);
  env.elements.get('twfoxtetrio-assets-cat-sfx').click();
  assert.equal(exploreList.children.length, 1);
  env.elements.get('twfoxtetrio-assets-cat-all').click();
  assert.equal(exploreList.children.length, 2);

  // Filter search -> narrows down to Carbon Fiber and click DESCARGAR E INSTALAR
  const searchEl = env.elements.get('twfoxtetrio-assets-search');
  searchEl.value = 'Carbon';
  searchEl.dispatchEvent('input');
  assert.equal(exploreList.children.length, 1);

  const dlBtn = exploreList.children[0].querySelector('button');
  dlBtn.click();
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }

  // Verify Installed tab shows 1 downloaded asset & HTMLImageElement.prototype.src intercepts TETR.IO connected/board URLs
  const tabInstalled = env.elements.get('twfoxtetrio-assets-tab-installed');
  assert.ok(tabInstalled.textContent.includes('(1)'));
  tabInstalled.click();
  const installedList = env.elements.get('twfoxtetrio-assets-installed-list');
  assert.equal(installedList.children.length, 1);

  const testSkinImg = new env.context.HTMLImageElement();
  testSkinImg.src = '/res/skins/minos/connected.2x.png';
  assert.ok(origDesc.get.call(testSkinImg).startsWith('data:image/png;base64,'));

  const testBoardImg = new env.context.HTMLImageElement();
  testBoardImg.src = '/res/skins/board/generic/board.png?v=3';
  assert.ok(origDesc.get.call(testBoardImg).startsWith('data:image/png;base64,'));

  // Download & activate SFX pack and verify /sfx/tetrio.desktop.rsd fetch rebuilds custom tRSD WAV pack
  env.elements.get('twfoxtetrio-assets-tab-explore').click();
  searchEl.value = 'retro';
  searchEl.dispatchEvent('input');
  assert.equal(exploreList.children.length, 1);
  exploreList.children[0].querySelector('button').click();
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
  const sfxResp = await env.context.fetch('/sfx/tetrio.desktop.rsd');
  const parsedSfx = customAssetsLogic.parseTrsd(await sfxResp.arrayBuffer());
  assert.equal(parsedSfx.entries[0].name, 'move');
  assert.ok(parsedSfx.audioBytes.length > 44);

  // Switch to FONDO / LOCAL tab -> activate preset + URL video background -> then clear
  env.elements.get('twfoxtetrio-assets-tab-bg').click();
  env.elements.get('twfoxtetrio-assets-bg-preset-synth_grid').click();
  await new Promise((r) => setTimeout(r, 10));
  const bgLayer = env.elements.get('twfoxtetrio-custom-bg');
  assert.ok(bgLayer && bgLayer.classList.contains('is-active'));
  assert.equal(env.body.classList.contains('twfox-has-custom-bg'), true);
  assert.equal(bgLayer.children[0].tagName, 'CANVAS');

  const urlInput = env.elements.get('twfoxtetrio-assets-bg-url');
  urlInput.value = 'https://example.com/loop.mp4';
  env.elements.get('twfoxtetrio-assets-bg-url-apply').click();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(bgLayer.children[0].tagName, 'VIDEO');
  assert.equal(bgLayer.children[0].src, 'https://example.com/loop.mp4');

  env.elements.get('twfoxtetrio-assets-bg-clear').click();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(env.body.classList.contains('twfox-has-custom-bg'), false);

  // Return to DESCARGADOS and uninstall Carbon Fiber -> restores Original TETR.IO cleanly
  tabInstalled.click();
  assert.ok(tabInstalled.textContent.includes('(2)'));
  const carbonUninstallBtn = installedList.children.find((card) =>
    card.querySelectorAll('button').some((b) => b.getAttribute('data-installed-id') === 'skin-4_false-carbon_fiber')
  ).querySelectorAll('button').find((b) => b.getAttribute('data-installed-action') === 'uninstall');
  carbonUninstallBtn.click();
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.ok(tabInstalled.textContent.includes('(1)'));
  const restoredImg = new env.context.HTMLImageElement();
  restoredImg.src = '/res/skins/minos/connected.2x.png';
  assert.equal(origDesc.get.call(restoredImg), '/res/skins/minos/connected.2x.png');
});

test('Skin variant compiler produces exact hd/uhd simple and connected textures and fires DEVHOOK_CONNECTED_SKIN on connected boot', async () => {
  const customAssetsLogic = require('../src/features/custom-assets-logic');
  function makePngBytes(w, h) {
    const buf = Buffer.alloc(24);
    buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47;
    buf[4] = 0x0d; buf[5] = 0x0a; buf[6] = 0x1a; buf[7] = 0x0a;
    buf.writeUInt32BE(13, 8);
    buf.write('IHDR', 12, 'ascii');
    buf.writeUInt32BE(w, 16);
    buf.writeUInt32BE(h, 20);
    return buf;
  }

  class FakeImageWithDims {
    constructor() {
      this._src = '';
      this.naturalWidth = 0;
      this.naturalHeight = 0;
      this.complete = false;
      this.onload = null;
    }
    get src() { return this._src; }
    set src(val) {
      this._src = String(val);
      const d = customAssetsLogic.readPngDimensionsFromDataUrl(this._src);
      this.naturalWidth = d ? d.width : 0;
      this.naturalHeight = d ? d.height : 0;
      this.complete = true;
      if (typeof this.onload === 'function') this.onload();
    }
  }

  const drawnOps = [];
  const env = createFakeDomEnvironment('https:', {
    URL,
    HTMLImageElement: FakeImageWithDims,
    Image: FakeImageWithDims
  });

  const origCreateEl = env.context.document.createElement.bind(env.context.document);
  env.context.document.createElement = function (tag) {
    if (String(tag).toLowerCase() === 'canvas') {
      const c = {
        tagName: 'CANVAS',
        width: 300,
        height: 150,
        classList: { contains: () => false, add() {}, remove() {} },
        setAttribute() {},
        getContext() {
          return {
            clearRect() {},
            drawImage(...args) {
              drawnOps.push({ dstW: c.width, dstH: c.height, args });
            }
          };
        },
        toDataURL() {
          return 'data:image/png;base64,' + makePngBytes(c.width, c.height).toString('base64');
        }
      };
      return c;
    }
    return origCreateEl(tag);
  };
  env.triggerDOMContentLoaded();

  const ca = env.context.__TWFOX_INTERNAL__.customAssets;

  // 1. Import 2048x2048 connected TPSE skin -> compiles exact connectedHd (1024), connectedUhd (2048), simpleHd (256), simpleUhd (512)
  const tpseJson = JSON.stringify({
    skin: 'data:image/png;base64,' + makePngBytes(2048, 2048).toString('base64'),
    ghost: 'data:image/png;base64,' + makePngBytes(1024, 1024).toString('base64')
  });
  await ca.importLocalAsset({
    name: 'connected_skin.tpse',
    bytes: new Uint8Array(Buffer.from(tpseJson, 'utf8')),
    autoApply: true
  });

  assert.deepEqual(customAssetsLogic.readPngDimensionsFromDataUrl(ca.resolveSkinOverrideUrl('/res/skins/minos/connected.png')), { width: 1024, height: 1024 });
  assert.deepEqual(customAssetsLogic.readPngDimensionsFromDataUrl(ca.resolveSkinOverrideUrl('/res/skins/minos/connected.2x.png')), { width: 2048, height: 2048 });
  assert.deepEqual(customAssetsLogic.readPngDimensionsFromDataUrl(ca.resolveSkinOverrideUrl('/res/skins/minos/tetrio.png')), { width: 256, height: 256 });
  assert.deepEqual(customAssetsLogic.readPngDimensionsFromDataUrl(ca.resolveSkinOverrideUrl('/res/skins/minos/tetrio.2x.png')), { width: 512, height: 512 });
  assert.deepEqual(customAssetsLogic.readPngDimensionsFromDataUrl(ca.resolveSkinOverrideUrl('/res/skins/ghost/connected.png')), { width: 512, height: 512 });
  assert.deepEqual(customAssetsLogic.readPngDimensionsFromDataUrl(ca.resolveSkinOverrideUrl('/res/skins/ghost/connected.2x.png')), { width: 1024, height: 1024 });
  assert.deepEqual(customAssetsLogic.readPngDimensionsFromDataUrl(ca.resolveSkinOverrideUrl('/res/skins/ghost/tetrio.png')), { width: 128, height: 128 });
  assert.deepEqual(customAssetsLogic.readPngDimensionsFromDataUrl(ca.resolveSkinOverrideUrl('/res/skins/ghost/tetrio.2x.png')), { width: 256, height: 256 });

  // Verify DEVHOOK_CONNECTED_SKIN is invoked automatically when defined on window
  let devhookCalled = 0;
  env.context.DEVHOOK_CONNECTED_SKIN = () => { devhookCalled += 1; };
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(devhookCalled, 1);

  // 2. Import raw 816x64 12-tile tetrioraster PNG -> generates BOTH simple minos (256/512) & simple ghost (128/256)
  drawnOps.length = 0;
  await ca.importLocalAsset({
    name: '1bit_sci-fi.png',
    bytes: new Uint8Array(makePngBytes(816, 64)),
    format: 'tetrioraster',
    autoApply: true
  });
  assert.deepEqual(customAssetsLogic.readPngDimensionsFromDataUrl(ca.resolveSkinOverrideUrl('/res/skins/minos/tetrio.png')), { width: 256, height: 256 });
  assert.deepEqual(customAssetsLogic.readPngDimensionsFromDataUrl(ca.resolveSkinOverrideUrl('/res/skins/ghost/tetrio.png')), { width: 128, height: 128 });
  // Ensure tile #7 (index 7 * (816/12) = 476) was extracted for simple ghost 'g' onto 128x128 canvas
  assert.ok(drawnOps.some((op) => op.dstW === 128 && Math.round(op.args[1]) === 476));
});

test('Explore catalog renders static strip previews for raster/SVG skins and lazy-renders block strips for connected TPSE skins', async () => {
  const customAssetsLogic = require('../src/features/custom-assets-logic');
  function makePngBytes(w, h) {
    const buf = Buffer.alloc(24);
    buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47;
    buf[4] = 0x0d; buf[5] = 0x0a; buf[6] = 0x1a; buf[7] = 0x0a;
    buf.writeUInt32BE(13, 8);
    buf.write('IHDR', 12, 'ascii');
    buf.writeUInt32BE(w, 16);
    buf.writeUInt32BE(h, 20);
    return buf;
  }

  class FakeImageWithDims {
    constructor() {
      this._src = '';
      this.naturalWidth = 0;
      this.naturalHeight = 0;
      this.complete = false;
      this.onload = null;
    }
    get src() { return this._src; }
    set src(val) {
      this._src = String(val);
      const d = customAssetsLogic.readPngDimensionsFromDataUrl(this._src);
      this.naturalWidth = d ? d.width : 0;
      this.naturalHeight = d ? d.height : 0;
      this.complete = true;
      if (typeof this.onload === 'function') this.onload();
    }
  }

  class FakeResponse {
    constructor(bytes, ct) {
      this._bytes = Buffer.from(bytes);
      this.ok = true;
      this.status = 200;
      this.headers = { get: () => ct || 'application/octet-stream' };
    }
    async arrayBuffer() {
      return this._bytes.buffer.slice(this._bytes.byteOffset, this._bytes.byteOffset + this._bytes.byteLength);
    }
  }

  const catalog = [
    {
      id: 'skin-8bJackie-1bit_sci_fi',
      name: '1bit sci-fi',
      author: '8bJackie',
      type: 'skin',
      format: 'tetrioraster',
      path: 'content/skin/8bJackie/1bit_sci-fi.png',
      tpsePath: null
    },
    {
      id: 'skin-4_false-Complex_Simplification',
      name: 'Complex Simplification',
      author: '4_false',
      type: 'skin',
      format: 'tetrio61connected',
      path: 'content/skin/4_false/Complex_Simplification.zip',
      tpsePath: 'tpsefiles/skin/4_false/Complex_Simplification.zip.tpse'
    }
  ];
  const connectedTpse = {
    skin: 'data:image/png;base64,' + makePngBytes(2048, 2048).toString('base64'),
    ghost: null
  };

  const env = createFakeDomEnvironment('https:', {
    URL,
    Response: FakeResponse,
    HTMLImageElement: FakeImageWithDims,
    Image: FakeImageWithDims,
    fetch: async (url) => {
      const u = String(url);
      if (u.includes('data.json')) return new FakeResponse(Buffer.from(JSON.stringify(catalog)), 'application/json');
      if (u.includes('votes.json')) return new FakeResponse(Buffer.from('{}'), 'application/json');
      if (u.includes('Complex_Simplification.zip.tpse')) {
        return new FakeResponse(Buffer.from(JSON.stringify(connectedTpse)), 'application/json');
      }
      throw new Error('Unexpected fetch ' + u);
    }
  });

  const stripDraws = [];
  const origCreateEl = env.context.document.createElement.bind(env.context.document);
  env.context.document.createElement = function (tag) {
    if (String(tag).toLowerCase() === 'canvas') {
      const c = {
        tagName: 'CANVAS',
        width: 300,
        height: 150,
        classList: { contains: () => false, add() {}, remove() {} },
        setAttribute() {},
        getContext() {
          return {
            clearRect() {},
            drawImage(...args) {
              if (c.width === 308 && c.height === 28) stripDraws.push(args);
            }
          };
        },
        toDataURL() {
          return 'data:image/png;base64,' + makePngBytes(c.width, c.height).toString('base64');
        }
      };
      return c;
    }
    return origCreateEl(tag);
  };
  env.triggerDOMContentLoaded();

  env.elements.get('twfoxtetrio-home-foxmod').click();
  env.elements.get('twfoxtetrio-card-config').click();
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 8));
  }

  const exploreList = env.elements.get('twfoxtetrio-assets-explore-list');
  const imgs = exploreList.querySelectorAll('img');
  const rasterImg = imgs.find((im) => im.getAttribute('data-preview-id') === 'skin-8bJackie-1bit_sci_fi');
  const connectedImg = imgs.find((im) => im.getAttribute('data-preview-id') === 'skin-4_false-Complex_Simplification');
  assert.ok(rasterImg && rasterImg.getAttribute('src').includes('1bit_sci-fi.png'));
  assert.ok(connectedImg && !connectedImg.classList.contains('hidden'));
  assert.deepEqual(customAssetsLogic.readPngDimensionsFromDataUrl(connectedImg.getAttribute('src')), { width: 308, height: 28 });
  assert.equal(stripDraws.length, 10); // 10 minos drawn (Minos only pack skips ghost slot)
});

function encodeMqttVarLenTest(len) {
  const bytes = [];
  let value = len;
  do {
    let encoded = value % 128;
    value = Math.floor(value / 128);
    if (value > 0) encoded |= 128;
    bytes.push(encoded);
  } while (value > 0);
  return Uint8Array.from(bytes);
}

function buildMqttConnackFrame() {
  return Uint8Array.from([0x20, 0x02, 0x00, 0x00]);
}

function buildMqttPublishFrame(topic, text, retain) {
  const topicBytes = Buffer.from(topic, 'utf8');
  const payloadBytes = Buffer.from(text, 'utf8');
  const body = Buffer.concat([
    Buffer.from([(topicBytes.length >> 8) & 0xff, topicBytes.length & 0xff]),
    topicBytes,
    payloadBytes
  ]);
  const remLen = encodeMqttVarLenTest(body.length);
  return new Uint8Array(Buffer.concat([Buffer.from([retain ? 0x31 : 0x30]), Buffer.from(remLen), body]));
}

function parseMqttClientFrame(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const type = u8[0] & 0xf0;
  const flags = u8[0] & 0x0f;
  let len = 0;
  let mult = 1;
  let idx = 1;
  while (idx < u8.length) {
    const b = u8[idx++];
    len += (b & 0x7f) * mult;
    mult *= 128;
    if ((b & 0x80) === 0) break;
  }
  const body = u8.slice(idx, idx + len);
  if (type === 0x80 && body.length >= 4) {
    const tLen = (body[2] << 8) | body[3];
    const topic = Buffer.from(body.slice(4, 4 + tLen)).toString('utf8');
    return { type: 'SUBSCRIBE', topic };
  }
  if (type === 0x30 && body.length >= 2) {
    const tLen = (body[0] << 8) | body[1];
    const topic = Buffer.from(body.slice(2, 2 + tLen)).toString('utf8');
    const text = Buffer.from(body.slice(2 + tLen)).toString('utf8');
    return { type: 'PUBLISH', retain: (flags & 1) === 1, topic, text };
  }
  if (type === 0x10) return { type: 'CONNECT' };
  if (type === 0xe0) return { type: 'DISCONNECT' };
  return { type: 'OTHER', rawType: type };
}

test('fox-paw-badge discovers FOXMOD users via MQTT retain, marks DOM without altering textContent, and respects config toggle', async () => {
  const sentFrames = [];
  let activeSocket = null;

  class MockMqttWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.binaryType = 'arraybuffer';
      activeSocket = this;
      setTimeout(() => {
        if (this.readyState !== 0) return;
        this.readyState = 1;
        if (this.onopen) this.onopen({});
      }, 2);
    }
    send(bytes) {
      const parsed = parseMqttClientFrame(bytes);
      sentFrames.push(parsed);
      if (parsed.type === 'CONNECT') {
        setTimeout(() => {
          if (this.readyState === 1 && this.onmessage) {
            this.onmessage({ data: buildMqttConnackFrame().buffer });
          }
        }, 2);
      } else if (parsed.type === 'SUBSCRIBE' && parsed.topic === 'twfoxtetrio/v1/foxers/+') {
        setTimeout(() => {
          if (this.readyState === 1 && this.onmessage) {
            const retained = buildMqttPublishFrame(
              'twfoxtetrio/v1/foxers/amigo_fox',
              JSON.stringify({ u: 'amigo_fox', v: '0.5.0', ts: Date.now() }),
              true
            );
            this.onmessage({ data: retained.buffer });
          }
        }, 2);
      }
    }
    close() {
      this.readyState = 3;
      if (this.onclose) this.onclose({});
    }
  }

  const env = createFakeDomEnvironment('https:', {
    WebSocket: MockMqttWebSocket
  });
  const doc = env.context.document;
  const FakeEl = env.elements.get('me_username').constructor;

  // Set logged-in user and populate realistic TETR.IO DOM nodes before init
  const meEl = env.elements.get('me_username');
  meEl.textContent = 'TWFoxcrack';

  const roomPlayers = new FakeEl('div', 'room_players', '');
  const spAmigo = new FakeEl('div', '', 'scroller_player');
  spAmigo.setAttribute('data-username', 'amigo_fox');
  const spAmigoH1 = new FakeEl('h1', '', '');
  spAmigoH1.textContent = 'AMIGO_FOX';
  spAmigo.appendChild(spAmigoH1);

  const spOther = new FakeEl('div', '', 'scroller_player');
  spOther.setAttribute('data-username', 'sinmod');
  const spOtherH1 = new FakeEl('h1', '', '');
  spOtherH1.textContent = 'SINMOD';
  spOther.appendChild(spOtherH1);

  roomPlayers.appendChild(spAmigo);
  roomPlayers.appendChild(spOther);
  doc.body.appendChild(roomPlayers);

  const chatTagAmigo = new FakeEl('h1', '', 'chat_tag');
  chatTagAmigo.textContent = 'AMIGO_FOX';
  const chatTagOther = new FakeEl('h1', '', 'chat_tag');
  chatTagOther.textContent = 'SINMOD';
  const mentionNuevo = new FakeEl('a', '', 'chatlink tetra_pop');
  mentionNuevo.setAttribute('data-username', 'nuevo_fox');
  mentionNuevo.textContent = 'nuevo_fox';
  const resultOwner = new FakeEl('div', '', 'playerresult');
  const ownerSpan = new FakeEl('div', '', 'record_owner');
  ownerSpan.textContent = 'TWFOXCRACK';
  resultOwner.appendChild(ownerSpan);

  doc.body.appendChild(chatTagAmigo);
  doc.body.appendChild(chatTagOther);
  doc.body.appendChild(mentionNuevo);
  doc.body.appendChild(resultOwner);

  // Social PEOPLE list (.social_relationship), NOTIFICATIONS (.social_notification), DM header, and Profile card (.tetra_modal)
  const relAmigo = new FakeEl('div', '', 'social_relationship');
  const relAmigoH1 = new FakeEl('h1', '', '');
  const relAmigoSpan = new FakeEl('span', '', '');
  relAmigoSpan.textContent = 'AMIGO_FOX';
  relAmigoH1.appendChild(relAmigoSpan);
  relAmigo.appendChild(relAmigoH1);

  const relSinmod = new FakeEl('div', '', 'social_relationship');
  const relSinmodH1 = new FakeEl('h1', '', '');
  const relSinmodSpan = new FakeEl('span', '', '');
  relSinmodSpan.textContent = 'SINMOD';
  relSinmodH1.appendChild(relSinmodSpan);
  relSinmod.appendChild(relSinmodH1);

  const notifAmigo = new FakeEl('div', '', 'social_notification');
  const notifAmigoH1 = new FakeEl('h1', '', '');
  const notifAmigoSpan = new FakeEl('span', '', '');
  notifAmigoSpan.textContent = 'AMIGO_FOX';
  notifAmigoH1.appendChild(notifAmigoSpan);
  notifAmigo.appendChild(notifAmigoH1);

  const notifAch = new FakeEl('div', '', 'social_notification');
  const notifAchH1 = new FakeEl('h1', '', '');
  notifAchH1.textContent = 'Achievement get!';
  notifAch.appendChild(notifAchH1);

  const dmHeaderUser = new FakeEl('p', 'social_dm_username', '');
  dmHeaderUser.textContent = 'AMIGO_FOX';

  const profileModal = new FakeEl('div', '', 'tetra_modal');
  const modalAvatar = new FakeEl('img', '', 'avatar');
  const modalH2 = new FakeEl('h2', '', '');
  modalH2.textContent = 'TWFOXCRACK';
  profileModal.appendChild(modalAvatar);
  profileModal.appendChild(modalH2);

  doc.body.appendChild(relAmigo);
  doc.body.appendChild(relSinmod);
  doc.body.appendChild(notifAmigo);
  doc.body.appendChild(notifAch);
  doc.body.appendChild(dmHeaderUser);
  doc.body.appendChild(profileModal);

  env.triggerDOMContentLoaded();

  try {
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }

    // Verify MQTT handshake + retained self presence publish
    assert.ok(sentFrames.some((f) => f.type === 'CONNECT'));
    assert.ok(sentFrames.some((f) => f.type === 'SUBSCRIBE' && f.topic === 'twfoxtetrio/v1/foxers/+'));
    const selfPub = sentFrames.find((f) => f.type === 'PUBLISH' && f.topic === 'twfoxtetrio/v1/foxers/twfoxcrack' && f.text !== '');
    assert.ok(selfPub && selfPub.retain === true);
    assert.equal(JSON.parse(selfPub.text).u, 'twfoxcrack');

    // Verify self + discovered amigo_fox get paw attribute with unchanged textContent
    assert.equal(meEl.getAttribute('data-twfox-paw'), '1');
    assert.equal(meEl.textContent, 'TWFoxcrack');
    assert.equal(spAmigoH1.getAttribute('data-twfox-paw'), '1');
    assert.equal(spAmigoH1.textContent, 'AMIGO_FOX');
    assert.equal(chatTagAmigo.getAttribute('data-twfox-paw'), '1');
    assert.equal(ownerSpan.getAttribute('data-twfox-paw'), '1');
    assert.equal(relAmigoSpan.getAttribute('data-twfox-paw'), '1');
    assert.equal(notifAmigoSpan.getAttribute('data-twfox-paw'), '1');
    assert.equal(dmHeaderUser.getAttribute('data-twfox-paw'), '1');
    assert.equal(modalH2.getAttribute('data-twfox-paw'), '1');
    assert.equal(modalH2.textContent, 'TWFOXCRACK');

    // Non-FOXMOD player and system notifications do not receive paw
    assert.equal(spOtherH1.getAttribute('data-twfox-paw'), null);
    assert.equal(chatTagOther.getAttribute('data-twfox-paw'), null);
    assert.equal(mentionNuevo.getAttribute('data-twfox-paw'), null);
    assert.equal(relSinmodSpan.getAttribute('data-twfox-paw'), null);
    assert.equal(notifAchH1.getAttribute('data-twfox-paw'), null);

    // Live incoming MQTT publish for nuevo_fox immediately badges nuevo_fox mention
    const incomingNuevo = buildMqttPublishFrame(
      'twfoxtetrio/v1/foxers/nuevo_fox',
      JSON.stringify({ u: 'nuevo_fox', v: '0.5.0', ts: Date.now() }),
      true
    );
    activeSocket.onmessage({ data: incomingNuevo.buffer });
    await new Promise((r) => setTimeout(r, 70));
    assert.equal(mentionNuevo.getAttribute('data-twfox-paw'), '1');

    // Live VS Leaderboard displays fox paw on FOXMOD players only
    vm.runInContext(`
      window.__gamesMap = new Map();
      window.__g1 = {
        id: 'g1',
        getOwner: () => 'twfoxcrack',
        getFrame: () => 600,
        isPlaying: () => true,
        state: { time: { zero: false, frameoffset: 0 }, stats: { piecesplaced: 40, garbage: { attack: 18, cleared: 6 } } }
      };
      window.__g2 = {
        id: 'g2',
        getOwner: () => 'sinmod',
        getFrame: () => 600,
        isPlaying: () => true,
        state: { time: { zero: false, frameoffset: 0 }, stats: { piecesplaced: 35, garbage: { attack: 12, cleared: 4 } } }
      };
      window.__g3 = {
        id: 'g3',
        getOwner: () => 'amigo_fox',
        getFrame: () => 600,
        isPlaying: () => true,
        state: { time: { zero: false, frameoffset: 0 }, stats: { piecesplaced: 30, garbage: { attack: 8, cleared: 4 } } }
      };
      window.__gamesMap.self = window.__g1;
      window.__gamesMap.set('g1', window.__g1);
      window.__gamesMap.set('g2', window.__g2);
      window.__gamesMap.set('g3', window.__g3);
    `, env.context);
    env.menus.classList.add('hidden');
    doc.body.classList.add('multiplexed');
    const lbRows = env.elements.get('twfoxtetrio-multi-lb').querySelectorAll('.twfox-lb-name');
    assert.equal(lbRows.length, 3);
    assert.equal(lbRows[0].getAttribute('data-twfox-paw'), '1');
    assert.equal(lbRows[1].getAttribute('data-twfox-paw'), null);
    assert.equal(lbRows[2].getAttribute('data-twfox-paw'), '1');

    // FOXMOD P2P lobby / card targets also pick up paw badge without mutating textContent
    const p2pNameEl = new FakeEl('span', '', 'twfox-player-name twfox-paw-target');
    p2pNameEl.setAttribute('data-username', 'amigo_fox');
    p2pNameEl.textContent = 'amigo_fox';
    doc.body.appendChild(p2pNameEl);
    env.context.__TWFOX_INTERNAL__.foxPawBadge.rescan();
    assert.equal(p2pNameEl.getAttribute('data-twfox-paw'), '1');
    assert.equal(p2pNameEl.textContent, 'amigo_fox');

    // Toggle FOXMOD Config off in menus -> clears retained presence & removes all badges immediately
    doc.body.classList.remove('multiplexed');
    env.menus.classList.remove('hidden');
    env.elements.get('twfoxtetrio-home-foxmod').click();
    env.elements.get('twfoxtetrio-card-config').click();
    const configPane = env.elements.get('twfoxtetrio-pane-config');
    const toggles = configPane.querySelectorAll('.twfox-toggle-input');
    assert.equal(toggles.length, 11);
    const pawToggle = toggles[10];
    assert.ok(pawToggle, 'Fox Paw config checkbox should be rendered in FOXMOD CONFIG');
    assert.equal(pawToggle.checked, true);
    pawToggle.checked = false;
    pawToggle.dispatchEvent('change');
    assert.equal(env.context.__TWFOX_TETRIO__.getConfig().foxPawBadge.enabled, false);

    const clearPub = sentFrames.find((f) => f.type === 'PUBLISH' && f.topic === 'twfoxtetrio/v1/foxers/twfoxcrack' && f.text === '' && f.retain === true);
    assert.ok(clearPub, 'Disabling toggle should clear retained MQTT presence with empty payload');
    assert.notEqual(meEl.getAttribute('data-twfox-paw'), '1');
    assert.notEqual(spAmigoH1.getAttribute('data-twfox-paw'), '1');
    assert.notEqual(mentionNuevo.getAttribute('data-twfox-paw'), '1');
    assert.notEqual(p2pNameEl.getAttribute('data-twfox-paw'), '1');

    // Entering multiplayer while toggle is OFF keeps VS leaderboard free of badges
    vm.runInContext(`
      window.__gamesMap.set('g1', window.__g1);
      window.__gamesMap.set('g2', window.__g2);
      window.__gamesMap.set('g3', window.__g3);
    `, env.context);
    env.menus.classList.add('hidden');
    doc.body.classList.add('multiplexed');
    const offLbRows = env.elements.get('twfoxtetrio-multi-lb').querySelectorAll('.twfox-lb-name');
    assert.equal(offLbRows.length, 3);
    assert.notEqual(offLbRows[0].getAttribute('data-twfox-paw'), '1');
    doc.body.classList.remove('multiplexed');
    env.menus.classList.remove('hidden');

    // Re-enabling restores retained presence and fox paws across UI & leaderboard
    pawToggle.checked = true;
    pawToggle.dispatchEvent('change');
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(meEl.getAttribute('data-twfox-paw'), '1');
    vm.runInContext(`
      window.__gamesMap.set('g1', window.__g1);
      window.__gamesMap.set('g2', window.__g2);
      window.__gamesMap.set('g3', window.__g3);
    `, env.context);
    env.menus.classList.add('hidden');
    doc.body.classList.add('multiplexed');
    const restoredLbRows = env.elements.get('twfoxtetrio-multi-lb').querySelectorAll('.twfox-lb-name');
    assert.equal(restoredLbRows.length, 3);
    assert.equal(restoredLbRows[0].getAttribute('data-twfox-paw'), '1');
    assert.notEqual(restoredLbRows[1].getAttribute('data-twfox-paw'), '1');
    assert.equal(restoredLbRows[2].getAttribute('data-twfox-paw'), '1');
    doc.body.classList.remove('multiplexed');
  } finally {
    if (env.context.__TWFOX_INTERNAL__.foxPawBadge) {
      env.context.__TWFOX_INTERNAL__.foxPawBadge.destroy();
    }
  }
});
