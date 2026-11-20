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
  }

  class FakeElement {
    constructor(tag, id, classes) {
      this.tagName = tag.toUpperCase();
      this.id = id || '';
      this.children = [];
      this.attributes = {};
      this._textContent = '';
      this.classList = new FakeClassList(this, classes);
      if (this.id) elements.set(this.id, this);
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
      this.children.push(child);
      if (child.id) elements.set(child.id, child);
      return child;
    }
    querySelector(sel) {
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        for (const child of this.children) {
          if (child.classList.contains(cls)) return child;
          const nested = child.querySelector(sel);
          if (nested) return nested;
        }
      }
      return null;
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
  const meUsername = new FakeElement('h1', 'me_username', '');
  meUsername.textContent = 'fox';
  const pbBlitz = new FakeElement('h1', 'pbdisplay_blitz_inner', '');
  pbBlitz.textContent = '100,000';
  const pb40l = new FakeElement('h1', 'pbdisplay_40l_inner', '');
  pb40l.textContent = '0:45.320';
  const resultHeader = new FakeElement('h1', 'result_header', '');
  const resultValue = new FakeElement('p', 'result_result', '');
  const loader = protocol === 'file:' ? new FakeElement('h1', 'loader', '') : null;
  const shade = protocol === 'file:' ? new FakeElement('div', 'shade', '') : null;
  const preload = protocol !== 'file:' ? new FakeElement('div', 'preload', '') : null;
  const desktopTransition = protocol !== 'file:' ? new FakeElement('div', 'desktop_transition', '') : null;

  const docListeners = new Map();
  const storage = new Map();
  const intervals = new Map();
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
    meUsername,
    pbBlitz,
    pb40l,
    resultHeader,
    resultValue,
    body,
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
