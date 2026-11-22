'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { buildModSnippet } = require('../scripts/build');

function createFakeDomEnvironment(protocol) {
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
    for (const obs of observers) {
      if (obs.target === target) {
        obs.callback([{ target, attributeName: attrName }]);
      }
    }
  }

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.target = null;
    }
    observe(target) {
      this.target = target;
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

  // Enter PRACTICA submenu -> shows 4WIDE, PENTOMINOS, MARATHON
  env.elements.get('twfoxtetrio-card-practice').click();
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_practice');
  assert.equal(env.headerText.textContent, 'PRACTICA');
  assert.equal(practiceMenuPane.classList.contains('hidden'), false);
  assert.equal(foxView.classList.contains('hidden'), true);
  assert.ok(env.elements.get('twfoxtetrio-prac-4wide'));
  assert.ok(env.elements.get('twfoxtetrio-prac-pentomino'));
  assert.ok(env.elements.get('twfoxtetrio-prac-marathon'));

  // Clicking 4WIDE configures TETR.IO custom boardwidth=4 & launches real engine (#start_custom)
  env.elements.get('twfoxtetrio-prac-4wide').click();
  assert.equal(env.getCustomStarts(), 1);
  assert.equal(env.customContainer.children[0].value, '4');
  assert.equal(env.customContainer.children[1].textContent, 'none');

  // Reopen FOXMOD -> PRACTICA -> click MARATHON -> configures 150 lines & levels=true
  foxmodBtn.click();
  env.elements.get('twfoxtetrio-card-practice').click();
  env.elements.get('twfoxtetrio-prac-marathon').click();
  assert.equal(env.getCustomStarts(), 2);
  assert.equal(env.customContainer.children[0].value, '10');
  assert.equal(env.customContainer.children[1].textContent, 'lines');
  assert.equal(env.customContainer.children[2].value, '150');
  assert.equal(env.customContainer.children[3].checked, true);

  // Reopen FOXMOD -> PRACTICA -> click PENTOMINOS -> full-stage TETR.IO-styled Pentominoes + custom userConfig controls
  foxmodBtn.click();
  env.elements.get('twfoxtetrio-card-practice').click();
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

  peerClient.close();
  backLobbyBtn.click();
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
  assert.equal(checkboxes.length, 10);
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

  // Climbing to 750.0m counts down to 250.0 M remaining and fills bar to 75%
  currentAlt = 750.0;
  env.tickIntervals();
  assert.equal(zenithHud.getAttribute('data-state'), 'behind');
  assert.equal(zValEl.textContent, '250.0 M');
  assert.equal(barWrap.classList.contains('is-collapsed'), false);
  assert.equal(barFill.getAttribute('data-progress'), '75.00%');

  // Surpassing Weekly PB (1,142.3m): turns green, counts upward +142.3 M, and collapses vertical bar
  currentAlt = 1142.3;
  env.tickIntervals();
  assert.equal(zenithHud.getAttribute('data-state'), 'ahead');
  assert.ok(zenithHud.classList.contains('is-flash-ahead'));
  assert.equal(zValEl.textContent, '+142.3 M');
  assert.equal(zSubEl.textContent, 'NEW WEEKLY PB · 1,000.0 M');
  assert.equal(barWrap.classList.contains('is-collapsed'), true);

  // Exiting Quick Play climb (menu unrolls / results) hides HUD cleanly
  zenithMenu.classList.remove('rolledup');
  assert.equal(zenithHud.classList.contains('is-visible'), false);
});
