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
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) {
        this.children.splice(idx, 1);
      }
      if (child && child.parentNode === this) {
        child.parentNode = null;
      }
      if (child && child.id && elements.get(child.id) === child) {
        elements.delete(child.id);
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
    querySelector(sel) {
      return body.querySelector(sel);
    },
    querySelectorAll(sel) {
      return body.querySelectorAll(sel);
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

  // Enter PRACTICE submenu -> shows 4WIDE, PENTOMINOS, MARATHON, ZEN
  env.elements.get('twfoxtetrio-card-practice').click();
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_practice');
  assert.equal(env.headerText.textContent, 'PRACTICE');
  assert.equal(practiceMenuPane.classList.contains('hidden'), false);
  assert.equal(foxView.classList.contains('hidden'), true);
  assert.ok(env.elements.get('twfoxtetrio-prac-4wide'));
  assert.ok(env.elements.get('twfoxtetrio-prac-pentomino'));
  assert.ok(env.elements.get('twfoxtetrio-prac-marathon'));
  assert.ok(env.elements.get('twfoxtetrio-prac-zen'));

  // Clicking 4WIDE opens its pre-game Solo Lobby (Personal Best, Start button, Pro & Stride options) WITHOUT auto-starting
  env.elements.get('twfoxtetrio-prac-4wide').click();
  assert.equal(env.getCustomStarts(), 0);
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_solo_lobby');
  assert.equal(env.headerText.textContent, '4WIDE');
  const soloLobbyPane = env.elements.get('twfoxtetrio-pane-solo-lobby');
  assert.equal(soloLobbyPane.classList.contains('hidden'), false);
  assert.equal(env.elements.get('twfoxtetrio-solo-pb-value').textContent, '0');
  const strideCheck = env.elements.get('twfoxtetrio-solo-opt-stride');
  const proCheck = env.elements.get('twfoxtetrio-solo-opt-pro');
  assert.equal(strideCheck.checked, true);
  assert.equal(proCheck.checked, false);

  // Clicking START launches TETR.IO custom 4-wide engine & applies real Stride/no_szo options to wrapper
  env.elements.get('twfoxtetrio-solo-start').click();
  assert.equal(env.getCustomStarts(), 1);
  assert.equal(env.customContainer.children[0].value, '4');
  assert.equal(env.customContainer.children[1].textContent, 'none');

  const fake4wWrapper = {
    state: {
      frame: 1800,
      stats: { score: 88500, lines: 44 },
      setoptions: { stride: false, no_szo: false, pro: false, precountdown: 3000 }
    }
  };
  env.menus.setAttribute('data-menu-type', 'none');
  env.menus.classList.add('hidden');
  vm.runInContext(`new Map().set('custom_4w', fake4wWrapperRef);`, Object.assign(env.context, { fake4wWrapperRef: fake4wWrapper }));
  assert.equal(fake4wWrapper.state.setoptions.stride, true);
  assert.equal(fake4wWrapper.state.setoptions.no_szo, true);
  assert.equal(fake4wWrapper.state.setoptions.precountdown, 0);

  // Exiting 4WIDE returns directly to the 4WIDE pre-game lobby showing the updated Personal Best!
  env.menus.setAttribute('data-menu-type', 'home');
  env.menus.classList.remove('hidden');
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_solo_lobby');
  assert.equal(env.headerText.textContent, '4WIDE');
  assert.equal(env.elements.get('twfoxtetrio-solo-pb-value').textContent, '88,500');

  // BACK from 4WIDE pre-game lobby returns to PRACTICA -> click MARATHON opens MARATHON pre-game lobby
  env.backBtn.click();
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_practice');
  assert.equal(practiceMenuPane.classList.contains('hidden'), false);

  env.elements.get('twfoxtetrio-prac-marathon').click();
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_solo_lobby');
  assert.equal(env.headerText.textContent, 'MARATHON');
  assert.equal(env.getCustomStarts(), 1);

  // Enable Pro Mode on Marathon, launch, verify results return -> lobby -> BACK to PRACTICA
  proCheck.checked = true;
  proCheck.dispatchEvent('change');
  env.elements.get('twfoxtetrio-solo-start').click();
  assert.equal(env.getCustomStarts(), 2);
  assert.equal(env.customContainer.children[0].value, '10');
  assert.equal(env.customContainer.children[1].textContent, 'lines');
  assert.equal(env.customContainer.children[2].value, '150');
  assert.equal(env.customContainer.children[3].checked, true);
  const fakeMarWrapper = {
    state: {
      frame: 7200,
      stats: { score: 250400, lines: 150 },
      setoptions: { stride: false, no_szo: false, pro: false }
    }
  };
  env.menus.setAttribute('data-menu-type', 'none');
  env.menus.classList.add('hidden');
  vm.runInContext(`new Map().set('custom_mar', fakeMarRef);`, Object.assign(env.context, { fakeMarRef: fakeMarWrapper }));
  assert.equal(fakeMarWrapper.state.setoptions.pro, true);
  assert.equal(fakeMarWrapper.state.setoptions.stride, true);
  env.menus.setAttribute('data-menu-type', 'results');
  env.menus.classList.remove('hidden');
  assert.equal(env.menus.getAttribute('data-menu-type'), 'results', 'Results screen stays visible before returning');
  env.menus.setAttribute('data-menu-type', 'custom');
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_solo_lobby');
  assert.equal(env.elements.get('twfoxtetrio-solo-pb-value').textContent, '250,400');
  env.backBtn.click();
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_practice');

  // Click PENTOMINOS -> opens PENTOMINOS pre-game lobby -> switch to 40L -> START launches playable stage with custom userConfig controls
  env.elements.get('twfoxtetrio-prac-pentomino').click();
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_solo_lobby');
  assert.equal(env.headerText.textContent, 'PENTOMINOS');
  const pentSubModeSelect = env.elements.get('twfoxtetrio-solo-submode-select');
  pentSubModeSelect.value = '40l';
  pentSubModeSelect.dispatchEvent('change');
  assert.match(env.elements.get('twfoxtetrio-solo-pb-label').textContent, /40L/);
  env.elements.get('twfoxtetrio-solo-start').click();
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_pentomino');
  assert.equal(pentominoStagePane.classList.contains('hidden'), false);
  assert.equal(env.body.classList.contains('twfox-ingame'), true);
  assert.equal(env.elements.get('twfoxtetrio-practice-pieces').value, 'pentomino');
  assert.equal(env.elements.get('twfoxtetrio-practice-mode').value, '40l');

  // Custom keybinds read from userConfig (DIGIT8 hard-drops, J/L/Z/C work cleanly)
  const settings = env.context.__TWFOX_INTERNAL__.foxmodCanvas.readTetrioUserSettings();
  assert.deepEqual(Array.from(settings.binds.moveLeft), ['KEYJ']);
  assert.deepEqual(Array.from(settings.binds.hardDrop), ['SPACE', 'DIGIT8']);
  assert.equal(settings.sdf, 41);

  env.dispatchDocEvent('keydown', { key: '8', code: 'Digit8' });

  // Back returns PENTOMINOS -> PENTOMINOS lobby -> PRACTICA -> FOXMOD (exits twfox-ingame chrome cleanly)
  env.backBtn.click();
  assert.equal(env.body.classList.contains('twfox-ingame'), false);
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_solo_lobby');
  env.backBtn.click();
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
  const wingBtn = env.elements.get('twfoxtetrio-host-wing-btn');
  assert.equal(wingBtn.classList.contains('hidden'), false);
  assert.equal(wingBtn.children[0].textContent, 'PLAYING');
  assert.equal(wingBtn.children[1].textContent, 'CLICK TO SWITCH TO SPECTATORS');
  assert.equal(env.elements.get('twfoxtetrio-client-ready-btn').classList.contains('hidden'), true);
  assert.equal(env.elements.get('twfoxtetrio-client-wait-tag').classList.contains('hidden'), true);
  const playersBox = env.elements.get('twfoxtetrio-lobby-players');
  assert.equal(playersBox.children.length, 1);
  assert.equal(playersBox.children[0].children[0].textContent, 'TWFOXCRACK');
  assert.equal(playersBox.children[0].children[0].classList.contains('twfox-paw-target'), true);
  assert.equal(playersBox.children[0].classList.contains('tetra_pop'), true);
  assert.equal(playersBox.children[0].getAttribute('data-username'), 'twfoxcrack');
  assert.equal(foxStyle.textContent.includes('transform: none !important;'), true);
  // Clicking bottom-left wing switches Host between PLAYING and SPECTATING
  wingBtn.click();
  assert.equal(wingBtn.children[0].textContent, 'SPECTATING');
  assert.equal(wingBtn.children[1].textContent, 'CLICK TO SWITCH TO PLAYERS');
  assert.equal(env.body.classList.contains('twfox-spectating'), true);
  assert.equal(playersBox.children[0].classList.contains('is-spectator'), true);
  wingBtn.click();
  assert.equal(wingBtn.children[0].textContent, 'PLAYING');
  assert.equal(env.body.classList.contains('twfox-spectating'), false);
  assert.equal(playersBox.children[0].classList.contains('is-spectator'), false);
  assert.equal(foxStyle.textContent.includes("#menus[data-menu-type='foxmod_multi'] #header"), true);
  assert.equal(foxStyle.textContent.includes('background-color: #372b51;'), true);

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

  // Capture temporary #custom_content_container boolean options during #start_custom dispatch
  const capturedCustomKeys = {};
  env.elements.get('start_custom').addEventListener('click', () => {
    for (const item of env.customContainer.children) {
      const k = item.getAttribute('data-index');
      if (k === 'can_undo' || k === 'retryisclear' || k === 'stride') {
        capturedCustomKeys[k] = Boolean(item.checked);
      }
    }
  });

  // Now open FOXMOD -> PRACTICA -> ZEN: arms Practice ZEN, starts custom preset (with can_undo=true), and opens #zen_panel + QP Cards
  env.elements.get('twfoxtetrio-home-foxmod').click();
  env.elements.get('twfoxtetrio-card-practice').click();
  env.elements.get('twfoxtetrio-prac-zen').click();
  assert.equal(env.getCustomStarts(), 1);
  assert.equal(capturedCustomKeys.can_undo, true);
  assert.equal(capturedCustomKeys.retryisclear, true);
  assert.equal(capturedCustomKeys.stride, true);
  assert.equal(env.customContainer.children.length, 4, 'Temporary custom option inputs must be cleaned up after launch');

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

  // Uses real #zen_panel sidebar (not hidden) with usezenconfig=true, can_undo=true (Ctrl+Z / Ctrl+Y) and zenlevels=false
  assert.equal(env.elements.get('zen_panel').classList.contains('hidden'), false);
  assert.equal(zenGameWrapper.state.setoptions.usezenconfig, true);
  assert.equal(zenGameWrapper.state.setoptions.can_undo, true);
  assert.equal(zenGameWrapper.state.setoptions.stride, true);
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

  // Clicking RESET clears all active QP cards and restores clean base ZEN flags while keeping can_undo active
  env.elements.get('twfoxtetrio-zen-qp-reset').click();
  assert.equal(zenGameWrapper.state.setoptions.can_undo, true);
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

test('foxmod mutual invite panel, PEOPLE button, 30s cooldown, in-room guard, and orange toast work end-to-end', async () => {
  const sentFrames = [];
  let badgeSocket = null;

  class MockInviteMqttWs {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.binaryType = 'arraybuffer';
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
        badgeSocket = this;
        setTimeout(() => {
          if (this.readyState !== 1 || !this.onmessage) return;
          for (const uname of ['amigo_fox', 'alejandroweb', 'stranger_fox']) {
            const pkt = buildMqttPublishFrame(
              `twfoxtetrio/v1/foxers/${uname}`,
              JSON.stringify({ u: uname, v: '0.5.0', ts: Date.now() }),
              true
            );
            this.onmessage({ data: pkt.buffer });
          }
        }, 2);
      }
    }
    close() {
      this.readyState = 3;
      if (this.onclose) this.onclose({});
    }
  }

  const rtcEndpoints = new Map();
  let rtcSeq = 1;
  class MockRtcPeerConnection {
    constructor() {
      this._id = 'dom-rtc-' + rtcSeq++;
      this.iceGatheringState = 'complete';
      this.localDescription = null;
      this.remoteDescription = null;
      this.ondatachannel = null;
      this._pendingChannel = null;
      this._pendingOpen = null;
      rtcEndpoints.set(this._id, this);
    }
    createDataChannel(label) {
      const ch = { label, readyState: 'connecting', onopen: null, onmessage: null, onclose: null };
      this._pendingChannel = ch;
      return ch;
    }
    async createOffer() {
      return { type: 'offer', sdp: 'v=0\r\nfrom=' + this._id };
    }
    async createAnswer() {
      return { type: 'answer', sdp: 'v=0\r\nfrom=' + this._id };
    }
    async setLocalDescription(desc) {
      this.localDescription = desc;
    }
    async setRemoteDescription(desc) {
      this.remoteDescription = desc;
      if (desc && desc.type === 'answer') {
        const remoteId = String(desc.sdp || '').split('from=')[1];
        const remotePc = rtcEndpoints.get(remoteId);
        const a = { label: 'foxmod-room', readyState: 'open', onopen: null, onmessage: null, onclose: null };
        const b = { label: 'foxmod-room', readyState: 'open', onopen: null, onmessage: null, onclose: null };
        a.send = (data) => {
          if (b.onmessage) queueMicrotask(() => b.onmessage({ data }));
        };
        b.send = (data) => {
          if (a.onmessage) queueMicrotask(() => a.onmessage({ data }));
        };
        a.close = () => {
          a.readyState = 'closed';
          b.readyState = 'closed';
          if (a.onclose) a.onclose();
          if (b.onclose) b.onclose();
        };
        b.close = a.close;
        if (this._pendingChannel) {
          a.onopen = this._pendingChannel.onopen;
          a.onmessage = this._pendingChannel.onmessage;
          a.onclose = this._pendingChannel.onclose;
          this._pendingChannel.send = a.send;
          this._pendingChannel.close = a.close;
          Object.defineProperty(this._pendingChannel, 'readyState', { get: () => a.readyState });
        }
        if (remotePc && remotePc.ondatachannel) remotePc.ondatachannel({ channel: b });
        if (a.onopen) a.onopen();
        if (b.onopen) b.onopen();
      }
    }
    close() {}
  }

  const env = createFakeDomEnvironment('https:', {
    WebSocket: MockInviteMqttWs,
    RTCPeerConnection: MockRtcPeerConnection
  });
  const doc = env.context.document;
  const FakeEl = env.elements.get('me_username').constructor;

  env.elements.get('me_username').textContent = 'TWFoxcrack';

  // Notifications & PEOPLE DOM scaffolding
  const notifications = new FakeEl('div', 'notifications', '');
  const social = new FakeEl('div', 'social', '');
  const socialBg = new FakeEl('div', 'social_bg', '');
  let socialClosedClicks = 0;
  socialBg.addEventListener('click', () => {
    socialClosedClicks += 1;
    social.classList.remove('open');
  });
  const socialRels = new FakeEl('div', 'social_relationships', '');

  function makeSocialRel(username, statusText, { offline = false, invitable = false } = {}) {
    const row = new FakeEl('div', '', offline ? 'social_relationship offline' : 'social_relationship');
    const h1 = new FakeEl('h1', '', '');
    const sp = new FakeEl('span', '', '');
    sp.textContent = username;
    h1.appendChild(sp);
    const p = new FakeEl('p', '', '');
    p.textContent = statusText;
    const holder = new FakeEl('div', '', 'social_relationship_button_holder');
    const invBtn = new FakeEl(
      'div',
      '',
      invitable ? 'social_relationship_button social_relationship_button_invite' : 'social_relationship_button social_relationship_button_invite hidden'
    );
    holder.appendChild(invBtn);
    row.appendChild(h1);
    row.appendChild(p);
    row.appendChild(holder);
    return row;
  }

  const relAmigo = makeSocialRel('AMIGO_FOX', 'In Menus', { offline: false, invitable: true });
  const relSinmod = makeSocialRel('SINMOD', 'In Menus', { offline: false, invitable: true });
  const relAlejandro = makeSocialRel('ALEJANDROWEB', 'In Menus', { offline: false, invitable: true });
  const relStranger = makeSocialRel('STRANGER_FOX', 'Not a friend', { offline: false, invitable: true });
  const relOffline = makeSocialRel('DORMIDO_FOX', 'Offline', { offline: true, invitable: false });

  socialRels.appendChild(relAmigo);
  socialRels.appendChild(relSinmod);
  socialRels.appendChild(relAlejandro);
  socialRels.appendChild(relStranger);
  socialRels.appendChild(relOffline);
  doc.body.appendChild(notifications);
  doc.body.appendChild(social);
  doc.body.appendChild(socialBg);
  doc.body.appendChild(socialRels);

  env.triggerDOMContentLoaded();

  try {
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }

    // Subscribed to own invite MQTT topic on connect
    assert.ok(sentFrames.some((f) => f.type === 'SUBSCRIBE' && f.topic === 'twfoxtetrio/v1/invites/twfoxcrack'));

    // Open FOXMOD -> MULTI -> CREATE LOBBY
    env.elements.get('twfoxtetrio-home-foxmod').click();
    env.elements.get('twfoxtetrio-card-multi').click();
    env.elements.get('twfoxtetrio-create-room-btn').click();
    await new Promise((r) => setTimeout(r, 15));

    assert.equal(doc.body.classList.contains('twfox-in-multi-room'), true);
    const mutualList = env.elements.get('twfoxtetrio-mutual-invite-list');
    assert.ok(mutualList, 'Mutual invite list should exist inside room INVITE tab');
    const lobbyInviteBtns = mutualList.querySelectorAll('.twfox-friend-invite-btn');
    const invitedUsers = lobbyInviteBtns.map((b) => b.getAttribute('data-fox-invite-user'));
    assert.deepEqual(invitedUsers, ['alejandroweb', 'amigo_fox']);

    // PEOPLE drawer inline orange paper-plane icon button: inside .social_relationship_button_holder, only for mutual online FOXMOD friends
    const relAmigoHolder = relAmigo.querySelector('.social_relationship_button_holder');
    const relAmigoFoxBtn = relAmigoHolder.querySelector('.twfox-social-invite-btn');
    assert.ok(relAmigoFoxBtn);
    assert.equal(relAmigoFoxBtn.classList.contains('social_relationship_button'), true);
    assert.match(relAmigoFoxBtn.innerHTML || '', /<svg /i);
    assert.ok(relAlejandro.querySelector('.social_relationship_button_holder').querySelector('.twfox-social-invite-btn'));
    assert.equal(relSinmod.querySelector('.twfox-social-invite-btn'), null);
    assert.equal(relStranger.querySelector('.twfox-social-invite-btn'), null);
    assert.equal(relOffline.querySelector('.twfox-social-invite-btn'), null);

    // Click INVITE for amigo_fox -> emits non-retained MQTT invite packet and starts 30s cooldown
    const amigoBtn = lobbyInviteBtns.find((b) => b.getAttribute('data-fox-invite-user') === 'amigo_fox');
    assert.equal(amigoBtn.disabled, false);
    assert.equal(amigoBtn.textContent, 'INVITE');
    amigoBtn.click();

    const invPubs = sentFrames.filter((f) => f.type === 'PUBLISH' && f.topic === 'twfoxtetrio/v1/invites/amigo_fox');
    assert.equal(invPubs.length, 1);
    assert.equal(invPubs[0].retain, false);
    const invBody = JSON.parse(invPubs[0].text);
    assert.equal(invBody.from, 'twfoxcrack');
    assert.match(invBody.roomCode, /^[2-9A-HJ-NP-Z]{4,8}$/);

    // Immediately transitions to disabled WAIT 30S in lobby card and .active + 30/29 span on paper-plane arrow in PEOPLE
    const amigoBtnAfter = mutualList.querySelectorAll('.twfox-friend-invite-btn').find(
      (b) => b.getAttribute('data-fox-invite-user') === 'amigo_fox'
    );
    const socialAmigoBtn = relAmigo.querySelector('.twfox-social-invite-btn');
    assert.equal(amigoBtnAfter.disabled, true);
    assert.match(amigoBtnAfter.textContent, /^WAIT (29|30)S$/);
    assert.equal(socialAmigoBtn.disabled, true);
    assert.equal(socialAmigoBtn.classList.contains('active'), true);
    assert.match(socialAmigoBtn.querySelector('span').textContent, /^(29|30)$/);

    // Clicking during cooldown does not send another invite packet
    socialAmigoBtn.click();
    assert.equal(sentFrames.filter((f) => f.type === 'PUBLISH' && f.topic === 'twfoxtetrio/v1/invites/amigo_fox').length, 1);

    // Simulate alejandroweb connecting to the room via loopback WebRTC offer/answer + verify IN ROOM block & 1v1 duel layout
    const p2pApi = env.context.__TWFOX_INTERNAL__.p2pRoom;
    const hostInviteCode = env.elements.get('twfoxtetrio-lobby-invite-code').textContent;
    env.elements.get('twfoxtetrio-host-gen-invite').click();
    await new Promise((r) => setTimeout(r, 15));
    const foxOffer = env.elements.get('twfoxtetrio-host-offer-output').value;
    assert.ok(foxOffer && foxOffer.startsWith('FOX'));

    const clientPeer = p2pApi.createClientPeer({ playerName: 'AlejandroWeb', rtcFactory: () => new MockRtcPeerConnection() });
    const answerCode = await clientPeer.joinFromInvite(foxOffer);
    env.elements.get('twfoxtetrio-host-answer-input').value = answerCode;
    env.elements.get('twfoxtetrio-host-accept-btn').click();
    await new Promise((r) => setTimeout(r, 35));

    // Now alejandroweb is inside snap.players -> INVITE button blocked as IN ROOM
    const alejBtn = mutualList.querySelectorAll('.twfox-friend-invite-btn').find(
      (b) => b.getAttribute('data-fox-invite-user') === 'alejandroweb'
    );
    const alejSocialBtn = relAlejandro.querySelector('.twfox-social-invite-btn');
    assert.equal(alejBtn.disabled, true);
    assert.equal(alejBtn.textContent, 'IN ROOM');
    assert.equal(alejSocialBtn.disabled, true);
    assert.equal(alejSocialBtn.classList.contains('is-in-room'), true);
    assert.equal(alejSocialBtn.classList.contains('active'), false);

    // Start 1v1 match -> verify side-by-side is-duel layout with 220x440 opponent canvas + leaderboard
    assert.ok(hostInviteCode);
    env.elements.get('twfoxtetrio-host-start-btn').click();
    await new Promise((r) => setTimeout(r, 15));

    const multiArena = env.elements.get('twfoxtetrio-multi-game').querySelector('.twfox-multi-arena');
    const oppGrid = env.elements.get('twfoxtetrio-multi-opponents');
    assert.equal(multiArena.classList.contains('is-duel'), true);
    assert.equal(oppGrid.classList.contains('is-duel'), true);
    const oppCards = oppGrid.querySelectorAll('.twfox-opp-card');
    assert.equal(oppCards.length, 1);
    assert.equal(oppCards[0].classList.contains('is-duel'), true);
    const oppCanvas = oppCards[0].querySelector('canvas');
    assert.equal(oppCanvas.getAttribute('width'), '220');
    assert.equal(oppCanvas.getAttribute('height'), '440');
    assert.equal(env.elements.get('twfoxtetrio-multi-lb-count').textContent, '2');

    // Entering an official TETR.IO custom room immediately removes FOXMOD PEOPLE invite arrows & tears down room state
    doc.body.classList.add('innormalmulti');
    env.menus.setAttribute('data-menu-type', 'custom');
    assert.equal(doc.body.classList.contains('twfox-in-multi-room'), false);
    assert.equal(relAmigo.querySelector('.twfox-social-invite-btn'), null);
    assert.equal(relAlejandro.querySelector('.twfox-social-invite-btn'), null);
    doc.body.classList.remove('innormalmulti');
    env.menus.setAttribute('data-menu-type', 'home');

    // Also close cleanly if peer stays active across official menu leave
    clientPeer.close();
    assert.equal(doc.body.classList.contains('twfox-in-multi-room'), false);
    assert.equal(relAmigo.querySelector('.twfox-social-invite-btn'), null);

    // Incoming orange notification over #notifications + IGNORE + ACCEPT
    const incomingInv1 = buildMqttPublishFrame(
      'twfoxtetrio/v1/invites/twfoxcrack',
      JSON.stringify({
        v: 1,
        type: 'room_invite',
        id: 'inv-orange-1',
        from: 'amigo_fox',
        roomCode: 'K7M4',
        gameMode: 'vs',
        pieceSet: 'pentomino',
        ts: Date.now()
      }),
      false
    );
    badgeSocket.onmessage({ data: incomingInv1.buffer });
    await new Promise((r) => setTimeout(r, 15));

    const toast1 = notifications.querySelector('.twfox-invite-notif');
    assert.ok(toast1, 'Orange FOXMOD notification should render inside #notifications');
    assert.equal(toast1.getAttribute('data-room-code'), 'K7M4');
    assert.match(toast1.getAttribute('style') || '', /#FF7B1C/i);
    assert.equal(toast1.classList.contains('modalnotify'), true);
    const toastBtns1 = toast1.querySelectorAll('.notification_button');
    assert.equal(toastBtns1.length, 2);
    assert.equal(toastBtns1[0].textContent, 'IGNORE');
    assert.equal(toastBtns1[1].textContent, 'ACCEPT');

    toastBtns1[0].click();
    assert.equal(notifications.querySelector('.twfox-invite-notif'), null);

    // Test ACCEPT with spy on createClientPeer.joinByCode
    const joinCalls = [];
    const origCreateClientPeer = p2pApi.createClientPeer;
    p2pApi.createClientPeer = (opts) => {
      const listeners = new Set();
      return {
        subscribe(fn) {
          listeners.add(fn);
          fn({
            role: 'client',
            selfId: 'p2',
            connected: false,
            spectator: false,
            players: [],
            chat: [],
            room: { roomCode: '', status: 'lobby', round: 0, gameMode: 'vs', pieceSet: 'tetromino' }
          });
          return () => listeners.delete(fn);
        },
        getSnapshot() {
          return { role: 'client', selfId: 'p2', connected: false, spectator: false, players: [], chat: [], room: { roomCode: '', status: 'lobby' } };
        },
        async joinByCode(code) {
          joinCalls.push({ playerName: opts && opts.playerName, code });
          return { mode: 'relay', roomCode: code };
        },
        close() {}
      };
    };

    try {
      social.classList.add('open');
      const incomingInv2 = buildMqttPublishFrame(
        'twfoxtetrio/v1/invites/twfoxcrack',
        JSON.stringify({
          v: 1,
          type: 'room_invite',
          id: 'inv-orange-2',
          from: 'amigo_fox',
          roomCode: 'M9P3',
          gameMode: 'vs',
          pieceSet: 'pentomino',
          ts: Date.now()
        }),
        false
      );
      badgeSocket.onmessage({ data: incomingInv2.buffer });
      await new Promise((r) => setTimeout(r, 15));

      const toast2 = notifications.querySelector('.twfox-invite-notif');
      assert.ok(toast2);
      const acceptBtn = toast2.querySelectorAll('.notification_button')[1];
      acceptBtn.click();
      await new Promise((r) => setTimeout(r, 15));

      assert.equal(notifications.querySelector('.twfox-invite-notif'), null);
      assert.equal(socialClosedClicks, 1);
      assert.equal(social.classList.contains('open'), false);
      assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_multi');
      assert.deepEqual(joinCalls, [{ playerName: 'TWFOXCRACK', code: 'M9P3' }]);
    } finally {
      p2pApi.createClientPeer = origCreateClientPeer;
    }

    // Verify updated canvas visuals: frameless HOLD/NEXT wing hairline, shadowed stats, and mini board gridlines
    const strokeCalls = [];
    let shadowUsed = false;
    const mockCtx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      font: '',
      textAlign: '',
      save() {},
      restore() {},
      clearRect() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      fillRect() {},
      fill() {},
      strokeRect() {},
      drawImage() {},
      fillText() {
        if (this.shadowBlur > 0) shadowUsed = true;
      },
      stroke() {
        strokeCalls.push({ strokeStyle: this.strokeStyle, lineWidth: this.lineWidth });
      }
    };
    const fakeCanvas = { width: 640, height: 620, getContext: () => mockCtx };
    env.context.__TWFOX_INTERNAL__.foxmodCanvas.renderPlayfield(
      fakeCanvas,
      {
        mode: 'vs',
        width: 10,
        visibleHeight: 20,
        bufferHeight: 20,
        board: Array.from({ length: 40 }, () => Array(10).fill(null)),
        active: null,
        holdKey: null,
        canHold: true,
        nextKeys: [],
        incomingGarbage: 0,
        score: 0,
        pieces: 5,
        pps: 1.5,
        lines: 2,
        attackSent: 4,
        apm: 24,
        elapsedMs: 10000
      },
      { boardOpacity: 0.85, gridOpacity: 0.1, shadowOpacity: 0.35 }
    );
    assert.ok(strokeCalls.some((s) => s.strokeStyle === 'rgba(255, 255, 255, 0.16)' && s.lineWidth === 1.25));
    assert.equal(shadowUsed, true);

    strokeCalls.length = 0;
    const miniFake = { width: 220, height: 440, getContext: () => mockCtx };
    env.context.__TWFOX_INTERNAL__.foxmodCanvas.renderMiniBoard(
      miniFake,
      Array.from({ length: 20 }, () => Array(10).fill(null)),
      true,
      null
    );
    assert.ok(strokeCalls.some((s) => s.strokeStyle === 'rgba(255, 255, 255, 0.06)'));
  } finally {
    if (env.context.__TWFOX_INTERNAL__.foxPawBadge) {
      env.context.__TWFOX_INTERNAL__.foxPawBadge.destroy();
    }
  }
});

test('foxmod_multi handles host_closed kick, host_migrate_self UI promotion, and beforeunload room flush', async () => {
  const winListeners = new Map();
  const rtcMap = new Map();
  let rtcSeq = 1;
  class LocalRtc {
    constructor() {
      this._id = 'uirtc-' + rtcSeq++;
      this.iceGatheringState = 'complete';
      this.localDescription = null;
      this.remoteDescription = null;
      this.ondatachannel = null;
      this._pending = null;
      rtcMap.set(this._id, this);
    }
    createDataChannel(label) {
      const ch = { label, readyState: 'connecting', onopen: null, onmessage: null, onclose: null };
      this._pending = ch;
      return ch;
    }
    async createOffer() {
      return { type: 'offer', sdp: 'v=0\r\nfrom=' + this._id };
    }
    async createAnswer() {
      return { type: 'answer', sdp: 'v=0\r\nfrom=' + this._id };
    }
    async setLocalDescription(d) {
      this.localDescription = d;
    }
    async setRemoteDescription(d) {
      this.remoteDescription = d;
      if (d && d.type === 'answer') {
        const rem = rtcMap.get(String(d.sdp || '').split('from=')[1]);
        const a = { label: 'foxmod-room', readyState: 'open', onopen: null, onmessage: null, onclose: null };
        const b = { label: 'foxmod-room', readyState: 'open', onopen: null, onmessage: null, onclose: null };
        a.send = (data) => b.onmessage && queueMicrotask(() => b.onmessage({ data }));
        b.send = (data) => a.onmessage && queueMicrotask(() => a.onmessage({ data }));
        a.close = () => {
          a.readyState = 'closed';
          b.readyState = 'closed';
          if (a.onclose) a.onclose();
          if (b.onclose) b.onclose();
        };
        b.close = a.close;
        if (this._pending) {
          a.onopen = this._pending.onopen;
          a.onmessage = this._pending.onmessage;
          a.onclose = this._pending.onclose;
          this._pending.send = a.send;
          this._pending.close = a.close;
          Object.defineProperty(this._pending, 'readyState', { get: () => a.readyState });
        }
        if (rem && rem.ondatachannel) rem.ondatachannel({ channel: b });
        if (a.onopen) a.onopen();
        if (b.onopen) b.onopen();
      }
    }
    close() {}
  }

  const env = createFakeDomEnvironment('https:', {
    RTCPeerConnection: LocalRtc,
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    }
  });
  const doc = env.context.document;
  const FakeEl = env.elements.get('me_username').constructor;
  env.elements.get('me_username').textContent = 'GuestFox';
  const notifications = new FakeEl('div', 'notifications', '');
  doc.body.appendChild(notifications);

  env.triggerDOMContentLoaded();
  await new Promise((r) => setTimeout(r, 15));

  const p2pApi = env.context.__TWFOX_INTERNAL__.p2pRoom;

  // 1. Manual host exits -> guest UI kicks back to foxmod & displays orange FOXMOD ROOM CLOSED notification
  const manualHost = p2pApi.createHostServer({ hostName: 'HostBoss', rtcFactory: () => new LocalRtc(), autoSignaling: false });
  const manInv = await manualHost.createInvite('GuestFox');

  env.elements.get('twfoxtetrio-home-foxmod').click();
  env.elements.get('twfoxtetrio-card-multi').click();
  env.elements.get('twfoxtetrio-join-room-btn').click();
  env.elements.get('twfoxtetrio-join-offer-input').value = manInv.code;
  env.elements.get('twfoxtetrio-join-generate-btn').click();
  await new Promise((r) => setTimeout(r, 25));

  const replyCode = env.elements.get('twfoxtetrio-join-answer-output').value;
  await manualHost.acceptAnswer(manInv.peerId, replyCode);
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_multi');

  manualHost.close();
  await new Promise((r) => setTimeout(r, 25));

  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod');
  assert.equal(doc.body.classList.contains('twfox-in-multi-room'), false);
  const closedToast = notifications.querySelectorAll('.twfox-invite-notif').find(
    (n) => n.getAttribute('data-fox-notice') === 'FOXMOD ROOM CLOSED'
  );
  assert.ok(closedToast, 'Client should receive orange FOXMOD ROOM CLOSED toast on host leave');
  closedToast.querySelector('.notification_button').click();

  // 2. Host rotates to GuestFox cleanly when host_migrate_self fires
  const hostLobbySnap = p2pApi.createHostServer({ hostName: 'PrevHost', roomCode: 'R8K2', rtcFactory: () => new LocalRtc(), autoSignaling: false });
  const rotInv = await hostLobbySnap.createInvite('GuestFox');
  env.elements.get('twfoxtetrio-card-multi').click();
  env.elements.get('twfoxtetrio-join-room-btn').click();
  env.elements.get('twfoxtetrio-join-offer-input').value = rotInv.code;
  env.elements.get('twfoxtetrio-join-generate-btn').click();
  await new Promise((r) => setTimeout(r, 25));
  const rotReply = env.elements.get('twfoxtetrio-join-answer-output').value;
  await hostLobbySnap.acceptAnswer(rotInv.peerId, rotReply);
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_multi');

  // Inject mock auto-signaling host_closing packet over open client channel (bypassing manual autoSignaling=false)
  // Using fetch-based auto room to test real host_migrate_self end-to-end
  hostLobbySnap.close();
  await new Promise((r) => setTimeout(r, 20));

  const topics = new Map();
  let seq = 1;
  async function mockFetch(url, init) {
    const m = String(url).match(/\/(twfoxtetrio-v1-[A-Z0-9]+)/);
    const topic = m ? m[1] : 'u';
    if (!topics.has(topic)) topics.set(topic, []);
    const list = topics.get(topic);
    if (init && init.method === 'POST') {
      list.push(JSON.stringify({ id: 'x' + seq++, event: 'message', topic, message: String(init.body || '') }));
      return { ok: true, status: 200, text: async () => '' };
    }
    return { ok: true, status: 200, text: async () => list.join('\n') };
  }
  const origWs = env.context.WebSocket;
  const origFetch = env.context.fetch;
  const origCreateClient = p2pApi.createClientPeer;
  p2pApi.createClientPeer = (o) => origCreateClient({ ...(o || {}), fetchFn: mockFetch, pollIntervalMs: 20, joinTimeoutMs: 2000 });

  try {
    const autoHost = p2pApi.createHostServer({ hostName: 'PrevAuto', roomCode: 'W4N7', rtcFactory: () => new LocalRtc(), fetchFn: mockFetch, pollIntervalMs: 20 });
    env.elements.get('twfoxtetrio-card-multi').click();
    env.elements.get('twfoxtetrio-join-room-btn').click();
    env.elements.get('twfoxtetrio-join-offer-input').value = 'W4N7';
    env.elements.get('twfoxtetrio-join-generate-btn').click();
    await new Promise((r) => setTimeout(r, 80));

    assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_multi');
    assert.equal(env.elements.get('twfoxtetrio-lobby-invite-code').textContent, '#W4N7');
    assert.equal(env.elements.get('twfoxtetrio-host-start-btn').classList.contains('hidden'), true);

    // Original Host closes -> GuestFox automatically rotates to HOST preserving #W4N7!
    autoHost.close();
    await new Promise((r) => setTimeout(r, 40));

    assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_multi');
    assert.equal(env.elements.get('twfoxtetrio-lobby-invite-code').textContent, '#W4N7');
    assert.equal(env.elements.get('twfoxtetrio-host-start-btn').classList.contains('hidden'), false);
    const rotToast = notifications.querySelectorAll('.twfox-invite-notif').find(
      (n) => n.getAttribute('data-fox-notice') === 'FOXMOD HOST ROTATED'
    );
    assert.ok(rotToast, 'Promoted player should see orange FOXMOD HOST ROTATED notification');

    // 3. Window beforeunload closes active room session cleanly
    for (const fn of winListeners.get('beforeunload') || []) fn();
    assert.equal(doc.body.classList.contains('twfox-in-multi-room'), false);
  } finally {
    p2pApi.createClientPeer = origCreateClient;
    env.context.WebSocket = origWs;
    env.context.fetch = origFetch;
  }
});

test('update notifier shows orange notification with repo download link and global i18n switches EN <-> ES cleanly', async () => {
  const ipcCalls = [];
  const mockIpc = {
    async invoke(channel, arg) {
      ipcCalls.push({ channel, arg });
      if (channel === 'twfoxtetrio-fetch') {
        if (String(arg).endsWith('/package.json')) {
          return {
            ok: true,
            status: 200,
            contentType: 'application/json',
            base64: Buffer.from(JSON.stringify({ name: 'twfoxtetrio', version: '9.8.0' }), 'utf8').toString('base64')
          };
        }
        return { ok: false, status: 404, contentType: 'text/plain', base64: '' };
      }
      throw new Error('Unhandled IPC: ' + channel);
    }
  };

  const env = createFakeDomEnvironment('https:', {
    IPC: mockIpc,
    __TWFOX_UPDATE_CHECK_DELAY_MS__: 5
  });
  const doc = env.context.document;
  const FakeEl = env.elements.get('me_username').constructor;
  const notifications = new FakeEl('div', 'notifications', '');
  doc.body.appendChild(notifications);

  // Native TETR.IO home cards & social relationship fixture to verify global translation
  const multiTitle = new FakeEl('h1', '', '');
  multiTitle.textContent = 'MULTIPLAYER';
  const multiDesc = new FakeEl('p', '', '');
  multiDesc.textContent = 'play online with friends and foes';
  const multiCard = new FakeEl('div', 'sig_multi', 'scroller_item scroller_item_giant');
  multiCard.appendChild(multiTitle);
  multiCard.appendChild(multiDesc);

  const soloTitle = new FakeEl('h1', '', '');
  soloTitle.textContent = 'SOLO';
  const soloCard = new FakeEl('div', 'sig_solo', 'scroller_item scroller_item_giant');
  soloCard.appendChild(soloTitle);

  const configTitle = new FakeEl('h1', '', '');
  configTitle.textContent = 'CONFIG';
  const configDesc = new FakeEl('p', '', '');
  const configCheeky = new FakeEl('span', '', 'cheeky');
  configCheeky.textContent = 'TETRIO';
  configDesc.appendChild(configCheeky);
  // Real TETR.IO HTML wraps <span class="cheeky">TETRIO</span> inside <p>; emulate collapsed phrasing check
  Object.defineProperty(configDesc, 'textContent', {
    get() {
      return this._customText !== undefined && this._customText !== ''
        ? this._customText
        : 'tweak your ' + configCheeky.textContent + ' experience';
    },
    set(v) {
      this._customText = String(v);
      this.children = [];
    }
  });
  Object.defineProperty(configDesc, 'innerHTML', {
    get() {
      return this._customText
        ? this._customText
        : 'tweak your <span class="cheeky">TETRIO</span> experience';
    },
    set() {
      this._customText = '';
      this.children = [configCheeky];
    }
  });
  env.sigConfig.appendChild(configTitle);
  env.sigConfig.appendChild(configDesc);

  env.homeMenu.appendChild(multiCard);
  env.homeMenu.appendChild(soloCard);

  const friendCard = new FakeEl('div', '', 'social_relationship');
  const friendName = new FakeEl('h1', '', '');
  friendName.textContent = 'PLAYERONE';
  const friendStatus = new FakeEl('p', '', '');
  friendStatus.textContent = 'Playing QUICK PLAY';
  friendCard.appendChild(friendName);
  friendCard.appendChild(friendStatus);
  doc.body.appendChild(friendCard);

  // Critical TETR.IO dynamic ID-bound spans inside headings (used by QP room.join & Tetra League counts)
  const roomPlayersH1 = new FakeEl('h1', '', '');
  const spanPlayersPrefix = { nodeType: 3, nodeValue: 'PLAYERS (', parentNode: roomPlayersH1 };
  const spanPlayerCount = new FakeEl('span', 'playercount', '');
  spanPlayerCount.setAttribute('id', 'playercount');
  spanPlayerCount.textContent = '0';
  const spanPlayersSuffix = { nodeType: 3, nodeValue: ')', parentNode: roomPlayersH1 };
  roomPlayersH1.children = [spanPlayerCount];
  roomPlayersH1.childNodes = [spanPlayersPrefix, spanPlayerCount, spanPlayersSuffix];
  spanPlayerCount.parentNode = roomPlayersH1;
  doc.body.appendChild(roomPlayersH1);

  const mmPlayerCountH1 = new FakeEl('h1', 'mm_playercount', 'ns');
  mmPlayerCountH1.setAttribute('id', 'mm_playercount');
  const mmQueueSpan = new FakeEl('span', 'mm_queuecount_count', '');
  mmQueueSpan.setAttribute('id', 'mm_queuecount_count');
  mmQueueSpan.textContent = '0';
  const mmMidText = { nodeType: 3, nodeValue: '\u00a0IN QUEUE -\u00a0', parentNode: mmPlayerCountH1 };
  const mmPlaySpan = new FakeEl('span', 'mm_playercount_count', '');
  mmPlaySpan.setAttribute('id', 'mm_playercount_count');
  mmPlaySpan.textContent = '0';
  const mmEndText = { nodeType: 3, nodeValue: '\u00a0IN GAME', parentNode: mmPlayerCountH1 };
  mmPlayerCountH1.children = [mmQueueSpan, mmPlaySpan];
  mmPlayerCountH1.childNodes = [mmQueueSpan, mmMidText, mmPlaySpan, mmEndText];
  mmQueueSpan.parentNode = mmPlayerCountH1;
  mmPlaySpan.parentNode = mmPlayerCountH1;
  doc.body.appendChild(mmPlayerCountH1);

  env.meUsername.textContent = 'TWFOXCRACK';
  doc.body.appendChild(env.meUsername);
  doc.body.appendChild(env.pbBlitz);

  const modUpdater = env.context.__TWFOX_INTERNAL__.modUpdater;
  const i18nGlobal = env.context.__TWFOX_INTERNAL__.i18nGlobal;

  try {
    env.triggerDOMContentLoaded();
    let toast = null;
    for (let i = 0; i < 25 && !toast; i++) {
      await new Promise((r) => setTimeout(r, 12));
      toast = doc.getElementById('twfoxtetrio-update-toast');
    }

    // Startup update check displays orange notification toast with clickable repo download link
    assert.ok(
      toast,
      'Orange FOXMOD UPDATE AVAILABLE notification should appear when remote version is newer (state=' +
        JSON.stringify(modUpdater.getState()) +
        ')'
    );
    assert.equal(toast.classList.contains('twfox-invite-notif'), true);
    assert.ok(toast.querySelector('h1').textContent.includes('FOXMOD UPDATE AVAILABLE'));
    assert.ok(toast.querySelector('p').textContent.includes('v9.8.0'));
    const toastRepoLink = doc.getElementById('twfoxtetrio-toast-repo-link');
    assert.ok(toastRepoLink);
    assert.equal(toastRepoLink.textContent, 'https://github.com/Foxcrack/twfoxtetrio');
    assert.equal(doc.getElementById('twfoxtetrio-toast-update-btn').textContent, 'DOWNLOAD');

    // Open FOXMOD -> verify canonical English labels before switching to Spanish
    env.elements.get('twfoxtetrio-home-foxmod').click();
    assert.equal(doc.getElementById('twfoxtetrio-card-practice').querySelector('h1').textContent, 'PRACTICE');
    assert.equal(doc.getElementById('twfoxtetrio-card-multi').querySelector('h1').textContent, 'MULTIPLAYER');

    // Open FOXMOD -> CONFIG and verify toggle count invariant + language & repo link widgets
    env.elements.get('twfoxtetrio-card-config').click();
    const configPane = env.elements.get('twfoxtetrio-pane-config');
    assert.equal(configPane.querySelectorAll('.twfox-toggle-input').length, 11);
    assert.equal(doc.getElementById('twfoxtetrio-assets-tab-explore').textContent, 'EXPLORE (TETR.IO+)');

    const enBtn = doc.getElementById('twfoxtetrio-lang-en-btn');
    const esBtn = doc.getElementById('twfoxtetrio-lang-es-btn');
    const openRepoBtn = doc.getElementById('twfoxtetrio-open-repo-btn');
    const updaterRepoLink = doc.getElementById('twfoxtetrio-updater-repo-link');
    assert.ok(enBtn && esBtn && openRepoBtn && updaterRepoLink);
    assert.equal(doc.getElementById('twfoxtetrio-apply-update-btn'), null);
    assert.equal(doc.getElementById('twfoxtetrio-updater-cmd'), null);
    assert.equal(enBtn.classList.contains('is-active'), true);
    assert.equal(openRepoBtn.classList.contains('is-pri'), true);
    assert.equal(updaterRepoLink.textContent, 'https://github.com/Foxcrack/twfoxtetrio');
    assert.ok(doc.getElementById('twfoxtetrio-i18n-style'), 'Font-face unicode-range stylesheet should be injected');

    // Switch language globally to Español
    esBtn.click();
    assert.equal(env.context.__TWFOX_TETRIO__.getConfig().language.locale, 'es');
    assert.equal(esBtn.classList.contains('is-active'), true);
    assert.equal(enBtn.classList.contains('is-active'), false);
    assert.equal(doc.body.getAttribute('data-twfox-lang'), 'es');

    // Both native TETR.IO UI (including inline <span class="cheeky">) and FOXMOD UI + CONFIG_SECTIONS + Assets Studio translate cleanly
    assert.equal(multiTitle.textContent, 'MULTIJUGADOR');
    assert.equal(multiDesc.textContent, 'juega en línea con amigos y rivales');
    assert.equal(soloTitle.textContent, 'SOLITARIO');
    assert.equal(configTitle.textContent, 'AJUSTES');
    assert.equal(configDesc.textContent, 'personaliza tu experiencia en TETR.IO');
    assert.equal(doc.getElementById('twfoxtetrio-card-practice').querySelector('h1').textContent, 'PRÁCTICA');
    assert.equal(doc.getElementById('twfoxtetrio-assets-tab-explore').textContent, 'EXPLORAR (TETR.IO+)');
    assert.equal(configPane.querySelector('.twfox-native-label').textContent, 'Idioma del juego (global)');
    assert.equal(friendStatus.textContent, 'Jugando PARTIDA RÁPIDA');
    assert.equal(toast.querySelector('h1').textContent, 'ACTUALIZACIÓN FOXMOD DISPONIBLE');
    assert.equal(doc.getElementById('twfoxtetrio-toast-update-btn').textContent, 'DESCARGAR');
    assert.equal(openRepoBtn.textContent, 'ABRIR REPO');

    // Dynamic native text updates while in Spanish also get translated automatically
    env.headerText.textContent = '40 LINES';
    assert.equal(env.headerText.textContent, '40 LÍNEAS');

    // Critical ID-bound child spans for QP (playercount) and TL (mm_queuecount_count / mm_playercount_count) MUST stay in DOM!
    assert.equal(doc.getElementById('playercount'), spanPlayerCount, 'QP #playercount span must not be wiped');
    assert.equal(spanPlayersPrefix.nodeValue, 'JUGADORES (');
    doc.getElementById('playercount').textContent = '42';
    assert.equal(doc.getElementById('playercount').textContent, '42');

    assert.equal(doc.getElementById('mm_queuecount_count'), mmQueueSpan, 'TL #mm_queuecount_count span must not be wiped');
    assert.equal(doc.getElementById('mm_playercount_count'), mmPlaySpan, 'TL #mm_playercount_count span must not be wiped');
    assert.equal(mmMidText.nodeValue, '\u00a0EN COLA -\u00a0');
    assert.equal(mmEndText.nodeValue, '\u00a0EN PARTIDA');
    doc.getElementById('mm_queuecount_count').textContent = '19';
    doc.getElementById('mm_playercount_count').textContent = '184';
    assert.equal(mmQueueSpan.textContent, '19');
    assert.equal(mmPlaySpan.textContent, '184');

    // Usernames, PB digits, and GitHub repo URL remain untouched
    assert.equal(env.meUsername.textContent, 'TWFOXCRACK');
    assert.equal(friendName.textContent, 'PLAYERONE');
    assert.equal(env.pbBlitz.textContent, '100,000');
    assert.equal(toastRepoLink.textContent, 'https://github.com/Foxcrack/twfoxtetrio');
    assert.equal(updaterRepoLink.textContent, 'https://github.com/Foxcrack/twfoxtetrio');

    // Clicking download button, repo link, or CONFIG Open Repo opens the GitHub repo externally without any self-update IPC
    const extCountBefore = env.openedExternalUrls.length;
    doc.getElementById('twfoxtetrio-toast-update-btn').click();
    toastRepoLink.click();
    openRepoBtn.click();
    assert.deepEqual(env.openedExternalUrls.slice(extCountBefore), [
      'https://github.com/Foxcrack/twfoxtetrio',
      'https://github.com/Foxcrack/twfoxtetrio',
      'https://github.com/Foxcrack/twfoxtetrio'
    ]);
    assert.equal(ipcCalls.some((c) => c.channel === 'twfoxtetrio-self-update-apply'), false);
    assert.equal(ipcCalls.some((c) => c.channel === 'twfoxtetrio-get-update-info'), false);

    // Dismissing toast removes notification
    doc.getElementById('twfoxtetrio-toast-later-btn').click();
    assert.equal(doc.getElementById('twfoxtetrio-update-toast'), null);

    // Switching back to English restores original TETR.IO (including <span class="cheeky">) & FOXMOD strings verbatim
    enBtn.click();
    assert.equal(env.context.__TWFOX_TETRIO__.getConfig().language.locale, 'en');
    assert.equal(multiTitle.textContent, 'MULTIPLAYER');
    assert.equal(multiDesc.textContent, 'play online with friends and foes');
    assert.equal(soloTitle.textContent, 'SOLO');
    assert.equal(configTitle.textContent, 'CONFIG');
    assert.equal(configDesc.innerHTML, 'tweak your <span class="cheeky">TETRIO</span> experience');
    assert.equal(doc.getElementById('twfoxtetrio-card-practice').querySelector('h1').textContent, 'PRACTICE');
    assert.equal(doc.getElementById('twfoxtetrio-assets-tab-explore').textContent, 'EXPLORE (TETR.IO+)');
    assert.equal(spanPlayersPrefix.nodeValue, 'PLAYERS (');
    assert.equal(mmMidText.nodeValue, '\u00a0IN QUEUE -\u00a0');
    assert.equal(mmEndText.nodeValue, '\u00a0IN GAME');
    assert.equal(friendStatus.textContent, 'Playing QUICK PLAY');
    assert.equal(env.headerText.textContent, '40 LINES');
  } finally {
    if (modUpdater) modUpdater.destroy();
    if (i18nGlobal) i18nGlobal.destroy();
  }
});

test('OPEN ASSETS FOLDER exports downloaded items, opens Electron folder, and imports user-dropped skin & SFX files', async () => {
  const customAssetsLogic = require('../src/features/custom-assets-logic');
  const savedFiles = new Map();
  const openedFolders = [];
  const deletedFiles = [];
  const fakePng = Buffer.alloc(24);
  fakePng[0] = 0x89; fakePng[1] = 0x50; fakePng[2] = 0x4e; fakePng[3] = 0x47;
  fakePng[4] = 0x0d; fakePng[5] = 0x0a; fakePng[6] = 0x1a; fakePng[7] = 0x0a;
  fakePng.writeUInt32BE(13, 8);
  fakePng.write('IHDR', 12, 'ascii');
  fakePng.writeUInt32BE(256, 16);
  fakePng.writeUInt32BE(256, 20);

  let diskItems = [
    {
      kind: 'file',
      subfolder: 'skins',
      relPath: 'skins/CustomDropSkin.png',
      fileName: 'CustomDropSkin.png',
      mtimeMs: 12345,
      size: fakePng.length,
      base64: fakePng.toString('base64')
    },
    {
      kind: 'dir',
      subfolder: 'sfx',
      relPath: 'sfx/MyVoiceSfx',
      dirName: 'MyVoiceSfx',
      mtimeMs: 67890,
      size: 16,
      files: [{ fileName: 'harddrop.ogg', base64: Buffer.from('OggS-test').toString('base64') }]
    }
  ];

  const env = createFakeDomEnvironment('https:', {
    IPC: {
      async invoke(channel, arg) {
        if (channel === 'twfoxtetrio-assets-save-file') {
          const relPath = arg.subfolder + '/' + arg.fileName;
          savedFiles.set(relPath, arg.base64);
          return { ok: true, relPath, rootPath: 'C:\\Users\\fox\\AppData\\Roaming\\tetrio-desktop\\foxmod-assets', mtimeMs: 100 };
        }
        if (channel === 'twfoxtetrio-assets-scan-folder') {
          return { ok: true, rootPath: 'C:\\Users\\fox\\AppData\\Roaming\\tetrio-desktop\\foxmod-assets', items: diskItems };
        }
        if (channel === 'twfoxtetrio-assets-open-folder') {
          openedFolders.push('C:\\Users\\fox\\AppData\\Roaming\\tetrio-desktop\\foxmod-assets');
          return { ok: true, path: 'C:\\Users\\fox\\AppData\\Roaming\\tetrio-desktop\\foxmod-assets', rootPath: 'C:\\Users\\fox\\AppData\\Roaming\\tetrio-desktop\\foxmod-assets' };
        }
        if (channel === 'twfoxtetrio-assets-delete-file') {
          deletedFiles.push(arg.relPath);
          savedFiles.delete(arg.relPath);
          diskItems = diskItems.filter((x) => x.relPath !== arg.relPath);
          return { ok: true };
        }
        return { ok: false, status: 404, base64: '' };
      }
    }
  });

  env.triggerDOMContentLoaded();
  await env.context.__TWFOX_INTERNAL__.customAssets.ready();
  env.elements.get('twfoxtetrio-home-foxmod').click();
  env.elements.get('twfoxtetrio-card-config').click();

  const openBtn = env.elements.get('twfoxtetrio-assets-open-folder-btn');
  const rescanBtn = env.elements.get('twfoxtetrio-assets-rescan-folder-btn');
  assert.ok(openBtn && rescanBtn, 'Assets Studio should render OPEN ASSETS FOLDER and RESCAN FOLDER buttons');

  openBtn.click();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(openedFolders.length, 1);

  rescanBtn.click();
  await new Promise((r) => setTimeout(r, 30));

  const assetsApi = env.context.__TWFOX_INTERNAL__.customAssets;
  const state = assetsApi.getState();
  assert.equal(state.folderPath, 'C:\\Users\\fox\\AppData\\Roaming\\tetrio-desktop\\foxmod-assets');
  const dropSkin = state.installed.find((a) => a.name === 'CustomDropSkin');
  const dropSfx = state.installed.find((a) => a.name === 'MyVoiceSfx');
  assert.ok(dropSkin && dropSkin.capabilities.skin, 'Dropped PNG in skins/ should import as skin');
  assert.ok(dropSfx && dropSfx.capabilities.sfx, 'Dropped folder in sfx/ should import as custom SFX pack');

  await assetsApi.activateAsset(dropSfx.id);
  const loadedSfx = customAssetsLogic.parseTpseObject({
    sfxFiles: { harddrop: 'data:audio/ogg;base64,' + Buffer.from('OggS-test').toString('base64') }
  });
  assert.equal(loadedSfx.capabilities.sfx, true);

  await assetsApi.uninstallAsset(dropSkin.id);
  assert.deepEqual(deletedFiles, ['skins/CustomDropSkin.png']);
});

test('DOWNLOADED tab filters saved skins and SFX via All / Skins / SFX pills cleanly', async () => {
  const fakePng = Buffer.alloc(24);
  fakePng[0] = 0x89; fakePng[1] = 0x50; fakePng[2] = 0x4e; fakePng[3] = 0x47;
  fakePng[4] = 0x0d; fakePng[5] = 0x0a; fakePng[6] = 0x1a; fakePng[7] = 0x0a;
  fakePng.writeUInt32BE(13, 8);
  fakePng.write('IHDR', 12, 'ascii');
  fakePng.writeUInt32BE(256, 16);
  fakePng.writeUInt32BE(256, 20);

  let diskItems = [
    {
      kind: 'file',
      subfolder: 'skins',
      relPath: 'skins/AlphaSkin.png',
      fileName: 'AlphaSkin.png',
      mtimeMs: 11111,
      size: fakePng.length,
      base64: fakePng.toString('base64')
    },
    {
      kind: 'file',
      subfolder: 'skins',
      relPath: 'skins/BetaSkin.png',
      fileName: 'BetaSkin.png',
      mtimeMs: 22222,
      size: fakePng.length,
      base64: fakePng.toString('base64')
    },
    {
      kind: 'dir',
      subfolder: 'sfx',
      relPath: 'sfx/RetroVoiceSfx',
      dirName: 'RetroVoiceSfx',
      mtimeMs: 33333,
      size: 16,
      files: [{ fileName: 'harddrop.ogg', base64: Buffer.from('OggS-test').toString('base64') }]
    }
  ];

  const env = createFakeDomEnvironment('https:', {
    IPC: {
      async invoke(channel, arg) {
        if (channel === 'twfoxtetrio-assets-scan-folder') {
          return { ok: true, rootPath: 'C:\\Users\\fox\\AppData\\Roaming\\tetrio-desktop\\foxmod-assets', items: diskItems };
        }
        if (channel === 'twfoxtetrio-assets-save-file') {
          return { ok: true, relPath: arg.subfolder + '/' + arg.fileName, mtimeMs: 100 };
        }
        if (channel === 'twfoxtetrio-assets-delete-file') {
          diskItems = diskItems.filter((x) => x.relPath !== arg.relPath);
          return { ok: true };
        }
        return { ok: false, status: 404, base64: '' };
      }
    }
  });

  env.triggerDOMContentLoaded();
  const assetsApi = env.context.__TWFOX_INTERNAL__.customAssets;
  await assetsApi.ready();
  await assetsApi.rescanAssetsFolder();

  env.elements.get('twfoxtetrio-home-foxmod').click();
  env.elements.get('twfoxtetrio-card-config').click();
  await assetsApi.rescanAssetsFolder();

  const tabInstalled = env.elements.get('twfoxtetrio-assets-tab-installed');
  const filterAll = env.elements.get('twfoxtetrio-assets-installed-cat-all');
  const filterSkins = env.elements.get('twfoxtetrio-assets-installed-cat-skins');
  const filterSfx = env.elements.get('twfoxtetrio-assets-installed-cat-sfx');
  const statusEl = env.elements.get('twfoxtetrio-assets-installed-status');
  const listEl = env.elements.get('twfoxtetrio-assets-installed-list');

  function collectText(node) {
    if (!node) return '';
    return [node.textContent || ''].concat((node.children || []).map(collectText)).join(' ');
  }

  assert.ok(filterAll && filterSkins && filterSfx, 'DOWNLOADED panel must expose All, Skins, and SFX filter buttons');
  tabInstalled.click();

  assert.equal(tabInstalled.textContent, 'DOWNLOADED (3)');
  assert.equal(filterAll.classList.contains('is-active'), true);
  assert.equal(listEl.children.length, 3);
  assert.equal(statusEl.textContent, '3 assets saved locally on your device.');

  // Filter to SFX only (and verify EXPLORE filter active state stays untouched)
  const exploreAll = env.elements.get('twfoxtetrio-assets-cat-all');
  filterSfx.click();
  assert.equal(exploreAll.classList.contains('is-active'), true);
  assert.equal(filterSfx.classList.contains('is-active'), true);
  assert.equal(filterAll.classList.contains('is-active'), false);
  assert.equal(tabInstalled.textContent, 'DOWNLOADED (3)');
  assert.equal(listEl.children.length, 1);
  assert.ok(collectText(listEl).includes('RetroVoiceSfx'));
  assert.ok(!collectText(listEl).includes('AlphaSkin'));
  assert.equal(statusEl.textContent, 'Showing 1 of 3 saved assets.');

  // Filter to Skins only
  filterSkins.click();
  assert.equal(filterSkins.classList.contains('is-active'), true);
  assert.equal(filterSfx.classList.contains('is-active'), false);
  assert.equal(tabInstalled.textContent, 'DOWNLOADED (3)');
  assert.equal(listEl.children.length, 2);
  const skinsText = collectText(listEl);
  assert.ok(skinsText.includes('AlphaSkin') && skinsText.includes('BetaSkin'));
  assert.ok(!skinsText.includes('RetroVoiceSfx'));
  assert.equal(statusEl.textContent, 'Showing 2 of 3 saved assets.');

  // Uninstall SFX item, then verify empty-filter message under SFX while All retains the 2 skins
  const sfxRec = assetsApi.getState().installed.find((r) => r.name === 'RetroVoiceSfx');
  await assetsApi.uninstallAsset(sfxRec.id);
  filterSfx.click();
  assert.equal(tabInstalled.textContent, 'DOWNLOADED (2)');
  assert.equal(listEl.children.length, 0);
  assert.equal(statusEl.textContent, 'No downloaded SFX assets found.');

  filterAll.click();
  assert.equal(listEl.children.length, 2);
  assert.equal(statusEl.textContent, '2 assets saved locally on your device.');
});

test('Accepting orange FOXMOD invite unhides #menus, connects via relay fallback if NAT blocks P2P, and guards active official rooms', async () => {
  let inviteSocket = null;
  const roomPeers = new Set();

  class MockInviteAndRelayWs {
    constructor() {
      this.readyState = 0;
      this.binaryType = 'arraybuffer';
      this._topics = new Set();
      setTimeout(() => {
        if (this.readyState !== 0) return;
        this.readyState = 1;
        if (this.onopen) this.onopen({});
      }, 3);
    }
    send(bytes) {
      const parsed = parseMqttClientFrame(bytes);
      if (parsed.type === 'CONNECT') {
        setTimeout(() => {
          if (this.readyState === 1 && this.onmessage) {
            this.onmessage({ data: buildMqttConnackFrame().buffer });
          }
        }, 3);
      } else if (parsed.type === 'SUBSCRIBE') {
        this._topics.add(parsed.topic);
        roomPeers.add(this);
        if (parsed.topic === 'twfoxtetrio/v1/invites/friendfox') {
          inviteSocket = this;
        }
        setTimeout(() => {
          if (this.readyState === 1 && this.onmessage) {
            this.onmessage({ data: Uint8Array.from([0x90, 0x03, 0x00, 0x01, 0x00]).buffer });
          }
        }, 2);
      } else if (parsed.type === 'PUBLISH') {
        const frame = buildMqttPublishFrame(parsed.topic, parsed.text, parsed.retain);
        for (const sub of roomPeers) {
          if (sub._topics && sub._topics.has(parsed.topic) && sub.readyState === 1 && sub.onmessage) {
            queueMicrotask(() => sub.onmessage({ data: frame.buffer }));
          }
        }
      }
    }
    close() {
      this.readyState = 3;
      roomPeers.delete(this);
      if (this.onclose) this.onclose({});
    }
  }

  // Simulated friend-side WebRTC that never connects directly (forcing automatic relay fallback)
  class BlockedNatRtc {
    constructor() {
      this.iceGatheringState = 'complete';
      this.localDescription = null;
      this.remoteDescription = null;
      this.connectionState = 'connecting';
      this.iceConnectionState = 'checking';
      this.ondatachannel = null;
    }
    createDataChannel(label) {
      return { label, readyState: 'connecting', onopen: null, onmessage: null, onclose: null, send() {}, close() {} };
    }
    async createOffer() { return { type: 'offer', sdp: 'v=0\r\nnat-blocked' }; }
    async createAnswer() { return { type: 'answer', sdp: 'v=0\r\nnat-blocked' }; }
    async setLocalDescription(d) { this.localDescription = d; }
    async setRemoteDescription(d) { this.remoteDescription = d; }
    close() {}
  }

  const env = createFakeDomEnvironment('https:', {
    WebSocket: MockInviteAndRelayWs,
    RTCPeerConnection: BlockedNatRtc
  });
  const doc = env.context.document;
  const FakeEl = env.elements.get('me_username').constructor;
  env.elements.get('me_username').textContent = 'FriendFox';
  const notifications = new FakeEl('div', 'notifications', '');
  doc.body.appendChild(notifications);

  env.triggerDOMContentLoaded();
  try {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.ok(inviteSocket, 'Friend should be subscribed to invite topic');

    const p2pApi = env.context.__TWFOX_INTERNAL__.p2pRoom;
    const origCreateClient = p2pApi.createClientPeer;
    p2pApi.createClientPeer = (o) => origCreateClient({ ...(o || {}), relayFallbackDelayMs: 220, joinTimeoutMs: 4000 });

    try {
      const host = p2pApi.createHostServer({
        hostName: 'TWFoxcrack',
        roomCode: 'Z7P9',
        rtcFactory: () => new BlockedNatRtc(),
        wsFactory: (url) => new MockInviteAndRelayWs(url),
        brokers: ['wss://mock-relay/mqtt']
      });
      await new Promise((r) => setTimeout(r, 25));

      const invPkt = buildMqttPublishFrame(
        'twfoxtetrio/v1/invites/friendfox',
        JSON.stringify({
          v: 1,
          type: 'room_invite',
          id: 'inv-nat-1',
          from: 'twfoxcrack',
          roomCode: 'Z7P9',
          gameMode: 'vs',
          pieceSet: 'pentomino',
          ts: Date.now()
        }),
        false
      );

      // 1. Guard when user is inside an official TETR.IO custom room (innormalmulti) -> clear orange notice instead of silent cancel
      doc.body.classList.add('innormalmulti');
      inviteSocket.onmessage({ data: invPkt.buffer });
      await new Promise((r) => setTimeout(r, 15));
      const toastBlocked = notifications.querySelector('.twfox-invite-notif');
      assert.ok(toastBlocked);
      toastBlocked.querySelectorAll('.notification_button')[1].click();
      await new Promise((r) => setTimeout(r, 15));
      const warnNotice = notifications.querySelectorAll('.twfox-invite-notif').find(
        (n) => n.getAttribute('data-fox-notice') === 'LEAVE OFFICIAL ROOM FIRST'
      );
      assert.ok(warnNotice, 'Should warn cleanly if user is still inside an official TETR.IO room');
      warnNotice.querySelector('.notification_button').click();
      doc.body.classList.remove('innormalmulti');

      // 2. Accept invite while #menus starts hidden -> unhides #menus and connects over WS relay automatically
      env.menus.classList.add('hidden');
      const invPkt2 = buildMqttPublishFrame(
        'twfoxtetrio/v1/invites/friendfox',
        JSON.stringify({
          v: 1,
          type: 'room_invite',
          id: 'inv-nat-2',
          from: 'twfoxcrack',
          roomCode: 'Z7P9',
          gameMode: 'vs',
          pieceSet: 'pentomino',
          ts: Date.now()
        }),
        false
      );
      inviteSocket.onmessage({ data: invPkt2.buffer });
      await new Promise((r) => setTimeout(r, 15));
      const toastOk = notifications.querySelectorAll('.twfox-invite-notif').find((n) => n.getAttribute('data-room-code') === 'Z7P9');
      assert.ok(toastOk);
      toastOk.querySelectorAll('.notification_button')[1].click();

      const deadline = Date.now() + 2000;
      while (Date.now() < deadline && host.getSnapshot().players.length < 2) {
        await new Promise((r) => setTimeout(r, 30));
      }

      assert.equal(env.menus.classList.contains('hidden'), false, 'Accepting invite must unhide #menus cleanly');
      assert.equal(env.menus.getAttribute('data-menu-type'), 'foxmod_multi');
      assert.equal(
        host.getSnapshot().players.map((p) => p.name).join(','),
        'TWFoxcrack,FRIENDFOX'
      );
      assert.equal(env.elements.get('twfoxtetrio-multi-winner').textContent, 'CONNECTED TO HOST SERVER');

      host.close();
      await new Promise((r) => setTimeout(r, 30));
    } finally {
      p2pApi.createClientPeer = origCreateClient;
    }
  } finally {
    if (env.context.__TWFOX_INTERNAL__.foxPawBadge) {
      env.context.__TWFOX_INTERNAL__.foxPawBadge.destroy();
    }
  }
});

test('Quick Play THE RACE tarot card coordinates 4-player ready launch, live visual boards, spectator switch, and Final Leaderboard NEXT', async () => {
  const relayPeers = new Set();
  function buildFrame(topic, text) {
    const t = Buffer.from(topic, 'utf8');
    const p = Buffer.from(text, 'utf8');
    const bl = 2 + t.length + p.length;
    const vh = [];
    let v = bl;
    do {
      let b = v % 128;
      v = Math.floor(v / 128);
      if (v > 0) b |= 128;
      vh.push(b);
    } while (v > 0);
    const out = new Uint8Array(1 + vh.length + bl);
    out[0] = 0x30;
    out.set(vh, 1);
    out[1 + vh.length] = (t.length >> 8) & 0xff;
    out[2 + vh.length] = t.length & 0xff;
    out.set(t, 3 + vh.length);
    out.set(p, 3 + vh.length + t.length);
    return out;
  }
  function parseFrame(bytes) {
    const u8 = new Uint8Array(bytes);
    const type = u8[0] & 0xf0;
    let i = 1;
    let mul = 1;
    let len = 0;
    let b;
    do {
      b = u8[i++];
      len += (b & 127) * mul;
      mul *= 128;
    } while ((b & 128) !== 0);
    if (type === 0x10) return { type: 'CONNECT' };
    if (type === 0x80) {
      const sl = (u8[i + 2] << 8) | u8[i + 3];
      return { type: 'SUBSCRIBE', topic: Buffer.from(u8.slice(i + 4, i + 4 + sl)).toString('utf8') };
    }
    if (type === 0x30) {
      const tl = (u8[i] << 8) | u8[i + 1];
      return {
        type: 'PUBLISH',
        topic: Buffer.from(u8.slice(i + 2, i + 2 + tl)).toString('utf8'),
        text: Buffer.from(u8.slice(i + 2 + tl, i + len)).toString('utf8')
      };
    }
    return { type: 'OTHER' };
  }
  const publishedFrames = [];
  class RaceWs {
    constructor() {
      this.readyState = 1;
      this.binaryType = 'arraybuffer';
      this._topics = new Set();
      queueMicrotask(() => {
        if (this.onopen) this.onopen();
      });
    }
    send(bytes) {
      const pkt = parseFrame(bytes);
      if (pkt.type === 'CONNECT') {
        queueMicrotask(() => {
          if (this.onmessage) this.onmessage({ data: Uint8Array.from([0x20, 0x02, 0x00, 0x00]).buffer });
        });
      } else if (pkt.type === 'SUBSCRIBE') {
        this._topics.add(pkt.topic);
        relayPeers.add(this);
        queueMicrotask(() => {
          if (this.onmessage) this.onmessage({ data: Uint8Array.from([0x90, 0x03, 0x00, 0x01, 0x00]).buffer });
        });
      } else if (pkt.type === 'PUBLISH') {
        publishedFrames.push(pkt);
        const frame = buildFrame(pkt.topic, pkt.text);
        for (const sub of relayPeers) {
          if (sub._topics.has(pkt.topic) && sub.readyState === 1 && sub.onmessage) {
            queueMicrotask(() => sub.onmessage({ data: frame.buffer }));
          }
        }
      }
    }
    close() {
      this.readyState = 3;
      relayPeers.delete(this);
    }
  }
  const rtcMap = new Map();
  let rtcSeq = 1;
  class RaceRtc {
    constructor() {
      this.id = 'r-' + rtcSeq++;
      rtcMap.set(this.id, this);
      this.iceGatheringState = 'complete';
      this.localDescription = null;
      this.remoteDescription = null;
      this.connectionState = 'connected';
      this.iceConnectionState = 'connected';
      this.ondatachannel = null;
    }
    createDataChannel(label) {
      const ch = { label, _placeholder: true, readyState: 'connecting', onopen: null, onmessage: null, onclose: null };
      this._pending = ch;
      return ch;
    }
    async createOffer() { return { type: 'offer', sdp: 'v=0\r\nfrom=' + this.id }; }
    async createAnswer() { return { type: 'answer', sdp: 'v=0\r\nfrom=' + this.id }; }
    async setLocalDescription(d) { this.localDescription = d; }
    async setRemoteDescription(d) {
      this.remoteDescription = d;
      if (d.type === 'answer') {
        const remote = rtcMap.get(d.sdp.split('from=')[1]);
        const chA = this._pending;
        const chB = { label: 'foxmod-room', readyState: 'open', onopen: null, onmessage: null, onclose: null };
        chA.readyState = 'open';
        chA.send = (data) => { if (chB.onmessage) queueMicrotask(() => chB.onmessage({ data })); };
        chB.send = (data) => { if (chA.onmessage) queueMicrotask(() => chA.onmessage({ data })); };
        chA.close = () => { chA.readyState = 'closed'; chB.readyState = 'closed'; if (chA.onclose) chA.onclose(); if (chB.onclose) chB.onclose(); };
        chB.close = chA.close;
        if (remote && remote.ondatachannel) remote.ondatachannel({ channel: chB });
        if (chA.onopen) queueMicrotask(() => chA.onopen());
        if (chB.onopen) queueMicrotask(() => chB.onopen());
      }
    }
    close() {}
  }

  const env = createFakeDomEnvironment('https:', {
    WebSocket: RaceWs,
    RTCPeerConnection: RaceRtc
  });
  const doc = env.context.document;
  const FakeEl = env.elements.get('me_username').constructor;
  env.elements.get('me_username').textContent = 'HostFox';

  // Seed a mutual friend (Runner2) in #social_relationships so Race party shows INVITE pill
  const socialRels = new FakeEl('div', 'social_relationships', '');
  const relRow = new FakeEl('div', '', 'social_relationship');
  const relH1 = new FakeEl('h1', '', '');
  const relNameSpan = new FakeEl('span', '', '');
  relNameSpan.textContent = 'Runner2';
  relH1.appendChild(relNameSpan);
  const relStatP = new FakeEl('p', '', '');
  relStatP.textContent = 'Online';
  const relInvBtn = new FakeEl('div', '', 'social_relationship_button_invite');
  relRow.appendChild(relH1);
  relRow.appendChild(relStatP);
  relRow.appendChild(relInvBtn);
  socialRels.appendChild(relRow);
  doc.body.appendChild(socialRels);

  const zMenu = env.elements.get('zenithmenu');
  const slides = new FakeEl('div', '', 'menuslide');
  const startZenith = new FakeEl('div', 'start_zenith', 'scroller_block');
  let startZenithClicks = 0;
  startZenith.addEventListener('click', () => {
    startZenithClicks += 1;
    env.body.classList.add('inzenith', 'ingame_phys');
    zMenu.classList.add('rolledup', 'hidden');
    zMenu.classList.remove('inresults');
  });
  const deckBlock = new FakeEl('div', 'zenith_deck_block', 'scroller_block');
  const deckCards = new FakeEl('div', 'zenith_deck_cards', '');
  const duoCard = new FakeEl('div', 'zenith-duo-card', 'zenith_card rg_zenith_card');
  duoCard.setAttribute('data-card', 'duo');
  duoCard.addEventListener('click', () => {
    const nextDuo = !duoCard.classList.contains('active');
    if (nextDuo) {
      duoCard.classList.add('active');
      zMenu.classList.add('duo');
    } else {
      duoCard.classList.remove('active');
      zMenu.classList.remove('duo');
    }
  });
  deckCards.appendChild(duoCard);
  const deckInfos = new FakeEl('div', 'zenith_deck_infos', '');
  slides.appendChild(startZenith);
  deckBlock.appendChild(deckCards);
  deckBlock.appendChild(deckInfos);
  slides.appendChild(deckBlock);
  zMenu.appendChild(slides);
  doc.body.appendChild(zMenu);

  env.triggerDOMContentLoaded();
  try {
    const zenRace = env.context.__TWFOX_INTERNAL__.zenRace;
    const raceLogic = env.context.__TWFOX_INTERNAL__.raceLogic;
    const p2pRoom = env.context.__TWFOX_INTERNAL__.p2pRoom;
    raceLogic.RACE_COUNTDOWN_MS = 45;
    zenRace.refresh();

    const raceCard = env.elements.get('twfoxtetrio-zenith-race-card');
    const raceInfo = env.elements.get('twfoxtetrio-zenith-race-info');
    assert.ok(raceCard, 'THE RACE tarot card should mount inside #zenith_deck_cards');
    assert.ok(raceInfo, 'data-for="race" info block should mount inside #zenith_deck_infos');

    // Activating THE LOVERS first and then clicking THE RACE automatically disables THE LOVERS,
    // plays the 250ms card spin + smooth party unfold, and never leaves both cards active at once
    const backSpecBtn = env.elements.get('twfoxtetrio-race-back-spec-btn');
    assert.equal(backSpecBtn.classList.contains('hidden'), true, 'Floating back-to-spectator button must stay hidden outside spectator peek');

    duoCard.click();
    assert.equal(duoCard.classList.contains('active'), true);
    assert.equal(zMenu.classList.contains('duo'), true);

    raceCard.click();
    assert.equal(duoCard.classList.contains('active'), false, 'Activating THE RACE must deactivate THE LOVERS');
    assert.equal(zMenu.classList.contains('duo'), false);
    assert.equal(raceCard.classList.contains('active'), false);
    assert.equal(raceCard.classList.contains('is-race-selected'), true);
    assert.equal(raceCard.classList.contains('spin'), true, 'THE RACE card must trigger native spin animation on activation');
    assert.equal(zMenu.classList.contains('twfox-race-open'), true);
    const partyEl = env.elements.get('twfoxtetrio-race-party');
    assert.equal(partyEl.classList.contains('hidden'), false);
    assert.equal(partyEl.classList.contains('is-opening'), true, 'Party panel must trigger smooth unfold transition on open');

    // Conversely, clicking THE LOVERS while THE RACE is active closes THE RACE cleanly
    duoCard.click();
    assert.equal(raceCard.classList.contains('is-race-selected'), false, 'Activating THE LOVERS must deactivate THE RACE');
    assert.equal(partyEl.classList.contains('hidden'), true);
    assert.equal(zMenu.classList.contains('twfox-race-open'), false);
    assert.equal(duoCard.classList.contains('active'), true);

    // Re-open THE RACE with body.inzenith active (simulating real Quick Play 80ms emitState polling),
    // broadcast Runner2 presence, and verify INVITE button stays stable in DOM & sends orange invite
    env.body.classList.add('inzenith');
    raceCard.click();
    assert.equal(duoCard.classList.contains('active'), false);
    assert.equal(zMenu.classList.contains('duo'), false);
    assert.equal(partyEl.classList.contains('hidden'), false);
    await new Promise((r) => setTimeout(r, 340));
    assert.equal(raceCard.classList.contains('spin'), false);
    assert.equal(partyEl.classList.contains('is-opening'), false);

    const foxBadge = env.context.__TWFOX_INTERNAL__.foxPawBadge;
    const foxPawLogic = env.context.__TWFOX_INTERNAL__.foxPawLogic;
    foxBadge.refreshMutualFriends(doc);
    // Simulate online presence packet from runner2 over MQTT relay
    const presTopic = foxPawLogic.buildPresenceTopic('runner2');
    const presFrame = buildFrame(
      presTopic,
      foxPawLogic.buildPresencePayload('runner2', '0.6.12', Date.now())
    );
    for (const sub of relayPeers) {
      if ((sub._topics.has(foxPawLogic.FOX_PAW_WILDCARD) || sub._topics.has(presTopic)) && sub.onmessage) {
        sub.onmessage({ data: presFrame.buffer });
      }
    }
    await new Promise((r) => setTimeout(r, 40));

    const findInviteBtn = () =>
      partyEl.querySelectorAll('.twfox-race-btn').find((b) => b.getAttribute('data-race-invite') === 'runner2');
    const invBtnBefore = findInviteBtn();
    assert.ok(invBtnBefore, 'Online mutual friend INVITE button must render inside #twfoxtetrio-race-party');
    assert.equal(invBtnBefore.disabled, false);

    // Wait across multiple 80ms Quick Play runtime emitState() ticks — button MUST remain the exact same DOM node!
    await new Promise((r) => setTimeout(r, 220));
    const invBtnAfter = findInviteBtn();
    assert.equal(invBtnAfter, invBtnBefore, 'Rapid Quick Play emitState ticks must not recreate INVITE button mid-click');

    invBtnBefore.click();
    assert.equal(invBtnBefore.disabled, true);
    assert.equal(invBtnBefore.textContent, 'WAIT 30S');
    assert.ok(
      env.elements.get('twfoxtetrio-race-invite-note').textContent.includes('RUNNER2'),
      'Invite confirmation note must be shown immediately'
    );
    const sentInvitePkt = publishedFrames.find((p) => p.topic === 'twfoxtetrio/v1/invites/runner2');
    assert.ok(sentInvitePkt, 'Clicking INVITE must publish MQTT invite packet to friend topic');
    const sentPayload = JSON.parse(sentInvitePkt.text);
    assert.equal(sentPayload.gameMode, 'race');

    const hostSnap = zenRace.getState().session;
    const roomCode = hostSnap.room.roomCode;
    assert.ok(roomCode);
    assert.equal(sentPayload.roomCode, roomCode);

    // First friend joins -> existing INVITE button switches in-place to IN ROOM; remaining 2 fill 4/4
    const f2 = p2pRoom.createClientPeer({ playerName: 'Runner2', rtcFactory: () => new RaceRtc(), wsFactory: () => new RaceWs(), brokers: ['wss://mock/mqtt'] });
    await f2.joinByCode(roomCode);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(invBtnBefore.textContent, 'IN ROOM');
    assert.equal(invBtnBefore.disabled, true);

    const f3 = p2pRoom.createClientPeer({ playerName: 'Runner3', rtcFactory: () => new RaceRtc(), wsFactory: () => new RaceWs(), brokers: ['wss://mock/mqtt'] });
    const f4 = p2pRoom.createClientPeer({ playerName: 'Runner4', rtcFactory: () => new RaceRtc(), wsFactory: () => new RaceWs(), brokers: ['wss://mock/mqtt'] });
    await f3.joinByCode(roomCode);
    await f4.joinByCode(roomCode);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(zenRace.getState().session.players.length, 4);

    // All 4 click READY -> countdown launches Quick Play simultaneously
    env.elements.get('twfoxtetrio-race-ready-btn').click();
    f2.setReady(true);
    f3.setReady(true);
    f4.setReady(true);
    const launchDeadline = Date.now() + 1000;
    while (Date.now() < launchDeadline && startZenithClicks === 0) {
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal(startZenithClicks, 1, 'All 4 ready should trigger synchronized #start_zenith click');

    // Simulate active Quick Play gameWrapper + rivals streaming boards & altitudes side by side
    const selfBoard = Array.from({ length: 20 }, () => new Array(10).fill(null));
    selfBoard[19][0] = 't';
    let selfAlive = true;
    let selfAlt = 145.6;
    const selfGame = {
      id: 'g-self',
      getOwner: () => 'HostFox',
      getFrame: () => 600,
      getZenithAltitude: () => selfAlt,
      isPlaying: () => selfAlive,
      state: {
        board: selfBoard,
        setoptions: { boardwidth: 10, boardheight: 20, boardbuffer: 0 },
        stats: { score: 8200, lines: 12, piecesplaced: 40, garbage: { attack: 4 }, zenith: { altitude: selfAlt, floor: 2 } },
        time: { frameoffset: 0, zero: false }
      }
    };
    vm.runInContext(
      `
        const raceGamesMap = new Map();
        raceGamesMap.self = raceSelfRef;
        raceGamesMap.set('g-self', raceSelfRef);
      `,
      Object.assign(env.context, { raceSelfRef: selfGame })
    );

    f2.updateSelfBoard({ compactBoard: selfBoard, altitude: 290.4, floor: 4, pps: 2.1, score: 21000 });
    f3.updateSelfBoard({ compactBoard: selfBoard, altitude: 210.0, floor: 3, pps: 1.8, score: 15000 });
    f4.updateSelfBoard({ compactBoard: selfBoard, altitude: 95.0, floor: 2, pps: 1.2, score: 6000 });
    await new Promise((r) => setTimeout(r, 140));

    const dockEl = env.elements.get('twfoxtetrio-race-dock');
    assert.equal(dockEl.classList.contains('is-visible'), true, 'Side-by-side Race boards dock should be visible while alive');
    assert.equal(dockEl.querySelectorAll('.twfox-race-board-card').length, 3, 'Should show the 3 rival boards side-by-side');

    // Local player dies while Runner2, Runner3, Runner4 keep climbing -> enters Spectator mode automatically
    selfAlive = false;
    env.body.classList.remove('ingame_phys');
    zMenu.classList.remove('rolledup', 'hidden');
    zMenu.classList.add('inresults');
    env.elements.get('zenith_result').textContent = '145.6';
    await new Promise((r) => setTimeout(r, 150));

    const specEl = env.elements.get('twfoxtetrio-race-spectator');
    const resultsEl = env.elements.get('twfoxtetrio-race-results');
    assert.equal(env.body.classList.contains('twfox-race-spectating'), true);
    assert.equal(specEl.classList.contains('hidden'), false);
    assert.equal(resultsEl.classList.contains('hidden'), true, 'Final leaderboard must stay hidden while other runners are alive');
    assert.ok(env.elements.get('twfoxtetrio-race-spectate-target').textContent.includes('RUNNER2'));

    // Switch spectator view to Runner3 by clicking Runner3 card directly in DOM
    const r3Id = f3.getSnapshot().selfId;
    assert.ok(r3Id, 'Client f3 must receive welcome selfId over WebRTC');
    const r3Row = specEl.querySelectorAll('.twfox-spec-runner').find((n) => n.getAttribute('data-spec-player-id') === r3Id);
    assert.ok(r3Row, 'Spectator list must render clickable row for Runner3');
    r3Row.click();
    assert.ok(env.elements.get('twfoxtetrio-race-spectate-target').textContent.includes('RUNNER3'));

    // Remaining runners finish -> once the LAST runner dies, Final Leaderboard opens with NEXT button
    f2.reportSelfKo({ altitude: 340.5, floor: 4, score: 29000 });
    f3.reportSelfKo({ altitude: 210.0, floor: 3, score: 15000 });
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(resultsEl.classList.contains('hidden'), true, 'Must still wait for Runner4 (the last survivor)');

    f4.reportSelfKo({ altitude: 110.0, floor: 2, score: 7000 });
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(env.body.classList.contains('twfox-race-spectating'), false);
    assert.equal(specEl.classList.contains('hidden'), true);
    assert.equal(resultsEl.classList.contains('hidden'), false, 'Final Leaderboard must appear once the last runner dies');
    const rows = resultsEl.querySelectorAll('.twfox-res-item');
    assert.equal(rows.length, 4);
    assert.ok(env.elements.get('twfoxtetrio-race-winner-name').textContent.includes('Runner2'));

    // Clicking NEXT closes Final Leaderboard cleanly and leaves party intact
    env.elements.get('twfoxtetrio-race-next-btn').click();
    assert.equal(resultsEl.classList.contains('hidden'), true);
    assert.equal(env.elements.get('twfoxtetrio-race-party').classList.contains('hidden'), false);

    f2.close();
    f3.close();
    f4.close();
    env.body.classList.remove('inzenith');
    env.elements.get('twfoxtetrio-race-leave-btn').click();
  } finally {
    if (env.context.__TWFOX_INTERNAL__.foxPawBadge) {
      env.context.__TWFOX_INTERNAL__.foxPawBadge.destroy();
    }
  }
});

test('THE RACE renders player avatars, blocks BUSY/IN-TL invites, cleans up on QP exit, and requires Quick Play open on invite accept', async () => {
  const fetchCalls = [];
  const publishedMqtt = [];

  class MockRaceFeaturesWs {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.binaryType = 'arraybuffer';
      setTimeout(() => {
        if (this.readyState !== 0) return;
        this.readyState = 1;
        if (this.onopen) this.onopen({});
      }, 2);
    }
    send(bytes) {
      const parsed = parseMqttClientFrame(bytes);
      if (parsed.type === 'CONNECT') {
        setTimeout(() => {
          if (this.readyState === 1 && this.onmessage) {
            this.onmessage({ data: buildMqttConnackFrame().buffer });
          }
        }, 2);
      } else if (parsed.type === 'SUBSCRIBE' && parsed.topic === 'twfoxtetrio/v1/foxers/+') {
        setTimeout(() => {
          if (this.readyState !== 1 || !this.onmessage) return;
          const now = Date.now();
          const frames = [
            buildMqttPublishFrame('twfoxtetrio/v1/foxers/maekrix', JSON.stringify({ u: 'maekrix', v: '0.6.13', ts: now }), true),
            buildMqttPublishFrame('twfoxtetrio/v1/foxers/busyfox', JSON.stringify({ u: 'busyfox', v: '0.6.13', ts: now, st: 'busy' }), true),
            buildMqttPublishFrame('twfoxtetrio/v1/foxers/tlchamp', JSON.stringify({ u: 'tlchamp', v: '0.6.13', ts: now, st: 'tl' }), true)
          ];
          for (const frame of frames) {
            this.onmessage({ data: frame.buffer });
          }
        }, 2);
      } else if (parsed.type === 'PUBLISH') {
        publishedMqtt.push({ topic: parsed.topic, text: parsed.text });
      }
    }
    close() {
      this.readyState = 3;
      if (this.onclose) this.onclose({});
    }
  }

  const env = createFakeDomEnvironment('https:', {
    WebSocket: MockRaceFeaturesWs,
    fetch: async (url) => {
      fetchCalls.push(String(url));
      return {
        ok: true,
        async json() {
          return {
            success: true,
            data: { user: { _id: '5f123abc', avatar_revision: 7 } }
          };
        }
      };
    }
  });
  const doc = env.context.document;

  const zMenu = env.elements.get('zenithmenu');
  const deckBlock = doc.createElement('div');
  deckBlock.setAttribute('id', 'zenith_deck_block');
  const deckCards = doc.createElement('div');
  deckCards.setAttribute('id', 'zenith_deck_cards');
  const duoCard = doc.createElement('div');
  duoCard.setAttribute('id', 'zenith-duo-card');
  duoCard.className = 'zenith_card';
  duoCard.setAttribute('data-card', 'duo');
  deckCards.appendChild(duoCard);
  deckBlock.appendChild(deckCards);
  zMenu.appendChild(deckBlock);

  const leaveZenithBtn = doc.createElement('button');
  leaveZenithBtn.setAttribute('id', 'leavezenith');
  zMenu.appendChild(leaveZenithBtn);

  const meAvatar = doc.createElement('img');
  meAvatar.setAttribute('id', 'me_avatar');
  env.body.appendChild(meAvatar);

  function addSocialFriend(username, statusText, statusHtml, avatarUrl, extraClass) {
    const row = doc.createElement('div');
    row.className = 'social_relationship' + (extraClass ? ' ' + extraClass : '');
    const h1 = doc.createElement('h1');
    const span = doc.createElement('span');
    span.textContent = username;
    h1.appendChild(span);
    const p = doc.createElement('p');
    p.textContent = statusText;
    p.innerHTML = statusHtml || statusText;
    const img = doc.createElement('img');
    img.className = 'social_relationship_img';
    img.src = avatarUrl;
    img.setAttribute('src', avatarUrl);
    const btn = doc.createElement('button');
    btn.className = 'social_relationship_button_invite';
    row.appendChild(h1);
    row.appendChild(p);
    row.appendChild(img);
    row.appendChild(btn);
    return row;
  }

  const socialRel = doc.createElement('div');
  socialRel.setAttribute('id', 'social_relationships');
  socialRel.appendChild(addSocialFriend('maekrix', 'Online', '', 'https://tetr.io/user-content/avatars/maek2.jpg?rv=9'));
  socialRel.appendChild(addSocialFriend('busyfox', 'Busy', '<img src="/res/status/busy.png"> Busy', 'https://tetr.io/user-content/avatars/busy1.jpg?rv=1', 'busy'));
  socialRel.appendChild(addSocialFriend('tlchamp', 'Playing TETRA LEAGUE', 'In a TETRA LEAGUE game', 'https://tetr.io/user-content/avatars/tl1.jpg?rv=3'));
  env.body.appendChild(socialRel);

  const leaveRoomBtn = doc.createElement('button');
  leaveRoomBtn.setAttribute('id', 'leaveroom');
  const exitReplayBtn = doc.createElement('button');
  exitReplayBtn.setAttribute('id', 'exit_replay');
  const exitSpectateBtn = doc.createElement('button');
  exitSpectateBtn.setAttribute('id', 'exit_spectate');
  const mmBtn = doc.createElement('button');
  mmBtn.setAttribute('id', 'enter_matchmaking');
  const multiQpBtn = doc.createElement('button');
  multiQpBtn.setAttribute('id', 'multi_quickplay');

  let leaveRoomClicked = false;
  let exitReplayClicked = false;
  let exitSpectateClicked = false;
  let mmClicked = false;
  let multiQpClicked = false;

  leaveRoomBtn.addEventListener('click', () => {
    leaveRoomClicked = true;
    env.body.classList.remove('innormalmulti');
    leaveRoomBtn.classList.add('hidden');
  });
  exitReplayBtn.addEventListener('click', () => {
    exitReplayClicked = true;
    exitReplayBtn.classList.add('hidden');
  });
  exitSpectateBtn.addEventListener('click', () => {
    exitSpectateClicked = true;
    exitSpectateBtn.classList.add('hidden');
  });
  mmBtn.addEventListener('click', () => {
    mmClicked = true;
    env.body.classList.remove('matchmaking');
  });
  multiQpBtn.addEventListener('click', () => {
    multiQpClicked = true;
    zMenu.classList.remove('hidden');
    env.body.classList.add('inzenith');
    env.menus.setAttribute('data-menu-type', 'zenith');
  });

  env.triggerDOMContentLoaded();
  env.meUsername.textContent = 'TWFOXCRACK';
  await new Promise((r) => setTimeout(r, 25));
  env.tickIntervals();

  const foxBadge = env.context.__TWFOX_INTERNAL__.foxPawBadge;
  const zenRace = env.context.__TWFOX_INTERNAL__.zenRace;
  assert.ok(foxBadge && zenRace);

  // Social DOM + MQTT presence should capture avatars and busy / in-TL status
  assert.equal(foxBadge.getAvatarUrl('maekrix'), 'https://tetr.io/user-content/avatars/maek2.jpg?rv=9');
  assert.deepEqual({ ...foxBadge.getFriendInviteStatus('maekrix') }, { invitable: true, reason: '', badge: '' });
  assert.deepEqual({ ...foxBadge.getFriendInviteStatus('busyfox') }, { invitable: false, reason: 'busy', badge: 'BUSY' });
  assert.deepEqual({ ...foxBadge.getFriendInviteStatus('tlchamp') }, { invitable: false, reason: 'league', badge: 'IN TL' });

  // Open THE RACE inside Quick Play with no DOM self avatar yet -> triggers ch.tetr.io/api/users fallback
  env.body.classList.add('inzenith');
  env.menus.setAttribute('data-menu-type', 'zenith');
  zenRace.refresh();
  const raceCard = env.elements.get('twfoxtetrio-zenith-race-card');
  assert.ok(raceCard);
  raceCard.click();
  await new Promise((r) => setTimeout(r, 25));
  env.tickIntervals();

  assert.equal(fetchCalls.includes('https://ch.tetr.io/api/users/twfoxcrack'), true);
  const partyEl = env.elements.get('twfoxtetrio-race-party');
  const avatarImgs = partyEl.querySelectorAll('.twfox-race-avatar');
  assert.equal(avatarImgs.length, 1);
  assert.equal(avatarImgs[0].attributes.src, 'https://tetr.io/user-content/avatars/5f123abc.jpg?rv=7');

  // If an avatar image fails to load, fallback badge is revealed and broken <img> removed/hidden
  avatarImgs[0].dispatchEvent('error');
  const remainingAvatars = partyEl.querySelectorAll('.twfox-race-avatar');
  assert.equal(
    remainingAvatars.length === 0 || remainingAvatars[0].classList.contains('hidden'),
    true,
    'Broken avatar image should be removed or hidden on error'
  );
  const fallbackBadge = partyEl.querySelector('.twfox-race-avatar-badge');
  assert.ok(fallbackBadge && !fallbackBadge.classList.contains('hidden'));

  // BUSY and IN TL friends render disabled buttons and cannot send invites
  const raceButtons = partyEl.querySelectorAll('.twfox-race-btn');
  const btnByUser = new Map();
  for (const b of raceButtons) {
    const u = b.getAttribute('data-race-invite');
    if (u) btnByUser.set(u, b);
  }
  assert.equal(btnByUser.get('maekrix').disabled, false);
  assert.equal(btnByUser.get('maekrix').textContent, 'INVITE');
  assert.equal(btnByUser.get('busyfox').disabled, true);
  assert.equal(btnByUser.get('busyfox').textContent, 'BUSY');
  assert.equal(btnByUser.get('tlchamp').disabled, true);
  assert.equal(btnByUser.get('tlchamp').textContent, 'IN TL');

  publishedMqtt.length = 0;
  btnByUser.get('busyfox').click();
  btnByUser.get('tlchamp').click();
  assert.equal(
    publishedMqtt.filter((p) => p.topic.indexOf('/invites/') !== -1).length,
    0,
    'Disabled BUSY / IN TL invite buttons must not publish MQTT invites'
  );
  btnByUser.get('maekrix').click();
  assert.equal(
    publishedMqtt.some((p) => p.topic === 'twfoxtetrio/v1/invites/maekrix'),
    true,
    'Invitable mutual friend must publish Race invite over MQTT'
  );

  // Exiting Quick Play via #leavezenith closes the Race session immediately
  assert.ok(zenRace.getState().session);
  leaveZenithBtn.click();
  assert.equal(zenRace.getState().session, null);
  assert.equal(zenRace.getState().cardSelected, false);

  // Also verify FOXMOD Multi / PEOPLE social buttons block BUSY / IN TL
  const createMultiRoomBtn = env.elements.get('twfoxtetrio-create-room-btn');
  if (createMultiRoomBtn) {
    createMultiRoomBtn.click();
    env.tickIntervals();
    const socialBtns = socialRel.querySelectorAll('.twfox-social-invite-btn');
    const busySocial = socialBtns.find((b) => /Busy/i.test(b.title || (b.attributes && b.attributes.title) || ''));
    const tlSocial = socialBtns.find((b) => /TETRA LEAGUE/i.test(b.title || (b.attributes && b.attributes.title) || ''));
    assert.ok(busySocial && busySocial.disabled === true, 'FOXMOD PEOPLE button must disable Busy friend');
    assert.ok(tlSocial && tlSocial.disabled === true, 'FOXMOD PEOPLE button must disable In-TL friend');
    if (env.context.__TWFOX_INTERNAL__.foxMenuHelpers) {
      env.context.__TWFOX_INTERNAL__.foxMenuHelpers.closeMultiSession();
    }
    env.body.classList.add('inzenith');
    env.menus.setAttribute('data-menu-type', 'zenith');
  }

  // Implicit Quick Play exit (#zenithmenu hidden + data-menu-type home) also cleans up Race session
  raceCard.click();
  env.tickIntervals();
  assert.ok(zenRace.getState().session);
  zMenu.classList.add('hidden');
  env.body.classList.remove('inzenith');
  env.menus.setAttribute('data-menu-type', 'home');
  env.tickIntervals();
  assert.equal(zenRace.getState().session, null);
  assert.equal(zenRace.getState().cardSelected, false);

  // Accepting a THE RACE invite while NOT in Quick Play (e.g. inside custom room / outside Zenith)
  // must NOT auto-leave/navigate in a loop and must prompt user to enter Quick Play first
  env.body.classList.add('innormalmulti');
  env.menus.setAttribute('data-menu-type', 'custom');
  leaveRoomBtn.classList.remove('hidden');

  await zenRace.joinByInviteCode('ABCD');
  assert.equal(leaveRoomClicked, false, 'Must NOT force-click #leaveroom when accepting Race invite');
  assert.equal(multiQpClicked, false, 'Must NOT auto-click #multi_quickplay');
  assert.equal(zMenu.classList.contains('hidden'), true, 'Quick Play menu stays untouched when rejected');
  assert.equal(zenRace.getState().session, null);

  const notices = env.body.querySelectorAll('.twfox-invite-notif');
  assert.equal(notices.some((n) => n.getAttribute('data-fox-notice') === 'ENTER QUICK PLAY FIRST'), true);

  // Once the user is inside Quick Play (even with TETR.IO's live background multiplexed + ingame + #leagueplayer_self flags),
  // self presence must NOT report 'tl' and accepting a THE RACE invite connects cleanly
  const leagueSelfEl = doc.createElement('div');
  leagueSelfEl.setAttribute('id', 'leagueplayer_self');
  env.body.appendChild(leagueSelfEl);
  publishedMqtt.length = 0;

  env.body.classList.remove('innormalmulti');
  zMenu.classList.remove('hidden');
  env.body.classList.add('inzenith');
  env.body.classList.add('multiplexed');
  env.body.classList.add('ingame');
  env.menus.setAttribute('data-menu-type', 'multi');
  env.tickIntervals();

  const qpPresence = publishedMqtt
    .filter((p) => p.topic === 'twfoxtetrio/v1/foxers/twfoxcrack')
    .map((p) => JSON.parse(p.text || '{}'));
  assert.equal(qpPresence.some((p) => p.st === 'tl'), false, 'Quick Play must never publish st=tl');

  const joinPromise = zenRace.joinByInviteCode('ABCD');
  assert.equal(zenRace.getState().cardSelected, true);
  assert.equal(zenRace.getState().session.role, 'client');

  if (zenRace.getState().session) {
    leaveZenithBtn.click();
  }
  await joinPromise.catch(() => {});
});

test('renderRacePlayfield draws HOLD and NEXT 5 wings for compact dock and spectator canvases', () => {
  const env = createFakeDomEnvironment('https:');
  env.triggerDOMContentLoaded();
  const foxmodCanvas = env.context.__TWFOX_INTERNAL__.foxmodCanvas;
  assert.ok(foxmodCanvas && typeof foxmodCanvas.renderRacePlayfield === 'function');

  const drawnTexts = [];
  let filledRects = 0;
  const fakeCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    globalAlpha: 1,
    save() {},
    restore() {},
    clearRect() {},
    fillRect() {
      filledRects += 1;
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    fillText(txt) {
      drawnTexts.push(String(txt));
    }
  };
  const fakeCanvas = {
    width: 264,
    height: 336,
    getContext: (type) => (type === '2d' ? fakeCtx : null)
  };

  foxmodCanvas.renderRacePlayfield(
    fakeCanvas,
    {
      board: Array.from({ length: 20 }, () => new Array(10).fill(null)),
      alive: true,
      hold: 't',
      canHold: true,
      next: ['i', 'o', 's', 'z', 'l']
    },
    { compact: false }
  );

  assert.equal(drawnTexts.includes('HOLD'), true, 'Spectator board canvas should render HOLD header');
  assert.equal(drawnTexts.includes('NEXT'), true, 'Spectator board canvas should render NEXT header');
  assert.equal(filledRects > 20, true, 'HOLD and NEXT minos plus board well should be painted');
});
