(function (root) {
  'use strict';

  const api = root.__TWFOX_TETRIO__;
  if (!api) {
    return;
  }

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
      detail: 'Displays "Modded By: TWFoxcrack" cleanly beneath the desktop loading screen.'
    },
    {
      name: 'FOXMOD Config & Credits Menu',
      detail: 'Native-style Home menu integration with live persisted settings.'
    }
  ];

  const FOXMOD_CSS = `
#${MENU_BTN_ID} {
  background-color: #382015;
  border-top: 3px solid #cf6427;
  border-left: 3px solid #914318;
  border-bottom: 3px solid #160c07;
}
#${MENU_BTN_ID} > h1 {
  color: #ffbe8e;
}
#${MENU_BTN_ID} > p {
  color: #e08d58;
}
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
#${MENU_BTN_ID} .twfox-home-icon > svg {
  height: 100%;
  width: auto;
  display: block;
}
#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  z-index: 9999998;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
  background: rgba(8, 10, 16, 0.86);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  font-family: 'HUN', 'C', 'Segoe UI', sans-serif;
  color: #eef2ff;
}
#${OVERLAY_ID}.is-open {
  display: flex;
}
#${PANEL_ID} {
  width: min(760px, 94vw);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  background: #141824;
  border-top: 3px solid #cf6427;
  border-left: 3px solid #2b344d;
  border-right: 3px solid #20273b;
  border-bottom: 3px solid #090b10;
  border-radius: 4px;
  box-shadow: 0 22px 64px rgba(0, 0, 0, 0.78);
  overflow: hidden;
  user-select: none;
}
.twfox-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  background: linear-gradient(90deg, #2d1b13 0%, #1b2030 65%);
  border-bottom: 2px solid #273047;
}
.twfox-modal-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.twfox-modal-logo {
  width: 44px;
  height: 28px;
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}
.twfox-modal-logo > svg {
  width: 100%;
  height: 100%;
  display: block;
}
.twfox-modal-title-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
}
.twfox-modal-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #ffbe8e;
}
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
.twfox-modal-btn:hover {
  filter: brightness(1.18);
}
.twfox-modal-btn:active {
  transform: translateY(1px);
}
.twfox-modal-tabs {
  display: flex;
  gap: 8px;
  padding: 10px 18px 0;
  background: #111520;
  border-bottom: 2px solid #242b40;
}
.twfox-tab-btn {
  font-family: inherit;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 9px 18px;
  border: 0;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: #8290b8;
  cursor: pointer;
  transition: color 140ms ease, background 140ms ease, border-color 140ms ease;
}
.twfox-tab-btn:hover {
  color: #e4ebff;
  background: rgba(255, 255, 255, 0.04);
}
.twfox-tab-btn.is-active {
  color: #ffbe8e;
  background: rgba(255, 138, 66, 0.1);
  border-bottom-color: #ff8c42;
}
.twfox-modal-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.twfox-pane.hidden {
  display: none;
}
.twfox-section {
  background: #181d2b;
  border: 1px solid rgba(130, 155, 225, 0.2);
  border-left: 4px solid var(--twfox-accent, #ff8c42);
  border-radius: 4px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.twfox-section:last-child {
  margin-bottom: 0;
}
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
.twfox-control-row:first-of-type {
  border-top: 0;
  padding-top: 2px;
}
.twfox-control-row:last-of-type {
  padding-bottom: 2px;
}
.twfox-control-text {
  min-width: 0;
  flex: 1 1 auto;
}
.twfox-control-label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #edf1ff;
}
.twfox-control-desc {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: #93a1c8;
  line-height: 1.35;
}
.twfox-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  flex: 0 0 auto;
}
.twfox-toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.twfox-toggle-track {
  width: 44px;
  height: 24px;
  border-radius: 3px;
  background: #0d1018;
  border: 2px solid #2b334b;
  position: relative;
  transition: background 140ms ease, border-color 140ms ease;
}
.twfox-toggle-track::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 2px;
  background: #67769e;
  transition: transform 140ms ease, background 140ms ease;
}
.twfox-toggle-input:checked + .twfox-toggle-track {
  background: #3a2115;
  border-color: #cf6427;
}
.twfox-toggle-input:checked + .twfox-toggle-track::after {
  transform: translateX(20px);
  background: #ff9c54;
}
.twfox-range-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}
.twfox-step-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  font-size: 14px;
  line-height: 1;
}
.twfox-range-input {
  width: 112px;
  accent-color: #ff8c42;
  cursor: pointer;
}
.twfox-range-val {
  min-width: 26px;
  text-align: right;
  font-size: 13px;
  font-weight: 800;
  color: #ffbe8e;
  font-variant-numeric: tabular-nums;
}
.twfox-credits-hero {
  background: linear-gradient(135deg, #2d1b13 0%, #1a2133 100%);
  border: 1px solid rgba(255, 140, 66, 0.35);
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.twfox-credits-author {
  margin: 4px 0 0;
  font-size: 15px;
  font-weight: 700;
  color: #ffb87a;
}
.twfox-credits-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.twfox-credits-item {
  background: #181d2b;
  border: 1px solid rgba(130, 155, 225, 0.16);
  border-radius: 4px;
  padding: 9px 12px;
}
.twfox-credits-item strong {
  display: block;
  font-size: 13px;
  color: #eef2ff;
}
.twfox-credits-item span {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: #93a1c8;
}
.twfox-credits-note {
  margin: 12px 0 0;
  font-size: 11px;
  color: #8290b8;
  line-height: 1.45;
}
.twfox-github-btn {
  display: inline-block;
  text-decoration: none;
  background: #3a2115;
  border-top: 2px solid #cf6427;
  border-left: 2px solid #914318;
  border-right: 2px solid #59290d;
  border-bottom: 2px solid #160c07;
  color: #ffbe8e;
}
.twfox-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 18px;
  background: #10131e;
  border-top: 2px solid #242b40;
}
.twfox-modal-footer.hidden {
  display: none;
}
.twfox-modal-status {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #8496c4;
}
`;

  function setClass(el, className, active) {
    if (!el || !el.classList) return;
    if (active) {
      el.classList.add(className);
    } else {
      el.classList.remove(className);
    }
  }

  function createEl(tag, options, children) {
    const node = document.createElement(tag);
    if (options) {
      if (options.id) node.id = options.id;
      if (options.className) node.className = options.className;
      if (options.text !== undefined) node.textContent = options.text;
      if (options.html !== undefined) node.innerHTML = options.html;
      if (options.style) node.setAttribute('style', options.style);
      if (options.type && tag === 'input') node.type = options.type;
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
    const style = createEl('style', { id: STYLE_ID, text: FOXMOD_CSS });
    head.appendChild(style);
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

  function initFoxmodMenu(runtimeApi) {
    ensureStyle();

    let isOpen = false;
    let activeTab = 'config';
    let overlayEl = null;
    let configPane = null;
    let creditsPane = null;
    let tabConfigBtn = null;
    let tabCreditsBtn = null;
    let footerEl = null;
    let statusEl = null;
    const toggleControls = [];
    const rangeControls = [];

    function setStatus(message) {
      if (statusEl) {
        statusEl.textContent = message;
      }
    }

    function syncControls(cfg) {
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

    function setActiveTab(tab) {
      activeTab = tab === 'credits' ? 'credits' : 'config';
      setClass(tabConfigBtn, 'is-active', activeTab === 'config');
      setClass(tabCreditsBtn, 'is-active', activeTab === 'credits');
      setClass(configPane, 'hidden', activeTab !== 'config');
      setClass(creditsPane, 'hidden', activeTab !== 'credits');
      setClass(footerEl, 'hidden', activeTab !== 'config');
    }

    function openPanel() {
      ensureOverlay();
      if (!overlayEl) return;
      syncControls(runtimeApi.getConfig());
      setActiveTab('config');
      setStatus('CHANGES SAVED AUTOMATICALLY');
      isOpen = true;
      overlayEl.classList.add('is-open');
    }

    function closePanel() {
      if (!overlayEl || !isOpen) return;
      isOpen = false;
      overlayEl.classList.remove('is-open');
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

        const labelWrap = createEl(
          'label',
          {
            className: 'twfox-toggle',
            attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
          },
          [input, createEl('span', { className: 'twfox-toggle-track' })]
        );

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
            labelWrap
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
          attrs: { type: 'button', 'data-hover': 'tap', 'data-hit': 'click' }
        });
        minusBtn.addEventListener('click', function () {
          commitRangeValue(Number(rangeInput.value) - r.step);
        });

        const plusBtn = createEl('button', {
          className: 'twfox-modal-btn twfox-step-btn',
          text: '+',
          attrs: { type: 'button', 'data-hover': 'tap', 'data-hit': 'click' }
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
            createEl('div', { className: 'twfox-range-wrap' }, [
              minusBtn,
              rangeInput,
              plusBtn,
              valueEl
            ])
          ])
        );
      }

      return createEl(
        'div',
        {
          className: 'twfox-section',
          style: `--twfox-accent: ${sectionSpec.accent}`
        },
        children
      );
    }

    function buildCreditsPane() {
      const githubLink = createEl('a', {
        id: 'twfoxtetrio-github-link',
        className: 'twfox-modal-btn twfox-github-btn',
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

      return createEl(
        'div',
        { id: 'twfoxtetrio-pane-credits', className: 'twfox-pane hidden' },
        [
          createEl('div', { className: 'twfox-credits-hero' }, [
            createEl('div', {}, [
              createEl('div', { className: 'twfox-modal-title-wrap' }, [
                createEl('h2', { className: 'twfox-modal-title', text: 'FOXMOD // TWFOXTETRIO' }),
                createEl('span', { className: 'twfox-modal-badge', text: 'v' + runtimeApi.version })
              ]),
              createEl('p', {
                className: 'twfox-credits-author',
                text: 'Modded By: TWFoxcrack'
              })
            ]),
            githubLink
          ]),
          createEl('ul', { className: 'twfox-credits-list' }, listItems),
          createEl('p', {
            className: 'twfox-credits-note',
            text:
              'Visual & HUD mod only. All trackers read local display state without altering gameplay physics, inputs, or network packets.'
          })
        ]
      );
    }

    function ensureOverlay() {
      if (overlayEl || document.getElementById(OVERLAY_ID)) {
        overlayEl = overlayEl || document.getElementById(OVERLAY_ID);
        return;
      }

      const closeBtn = createEl('button', {
        id: 'twfoxtetrio-foxmod-close',
        className: 'twfox-modal-btn',
        text: 'BACK [ESC]',
        attrs: { type: 'button', 'data-hover': 'tap', 'data-hit': 'click' }
      });
      closeBtn.addEventListener('click', closePanel);

      tabConfigBtn = createEl('button', {
        id: 'twfoxtetrio-tab-config',
        className: 'twfox-tab-btn is-active',
        text: 'CONFIG',
        attrs: { type: 'button', 'data-hover': 'tap', 'data-hit': 'click' }
      });
      tabConfigBtn.addEventListener('click', function () {
        setActiveTab('config');
      });

      tabCreditsBtn = createEl('button', {
        id: 'twfoxtetrio-tab-credits',
        className: 'twfox-tab-btn',
        text: 'CREDITS',
        attrs: { type: 'button', 'data-hover': 'tap', 'data-hit': 'click' }
      });
      tabCreditsBtn.addEventListener('click', function () {
        setActiveTab('credits');
      });

      configPane = createEl(
        'div',
        { id: 'twfoxtetrio-pane-config', className: 'twfox-pane' },
        CONFIG_SECTIONS.map(buildConfigSection)
      );
      creditsPane = buildCreditsPane();

      statusEl = createEl('span', {
        id: 'twfoxtetrio-config-status',
        className: 'twfox-modal-status',
        text: 'CHANGES SAVED AUTOMATICALLY'
      });

      const resetBtn = createEl('button', {
        id: 'twfoxtetrio-reset-defaults',
        className: 'twfox-modal-btn',
        text: 'RESET DEFAULTS',
        attrs: { type: 'button', 'data-hover': 'tap', 'data-hit': 'click' }
      });
      resetBtn.addEventListener('click', function () {
        const nextCfg = typeof runtimeApi.resetConfig === 'function'
          ? runtimeApi.resetConfig()
          : runtimeApi.getConfig();
        syncControls(nextCfg);
        setStatus('RESET TO DEFAULTS');
      });

      footerEl = createEl('div', { className: 'twfox-modal-footer' }, [statusEl, resetBtn]);

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
          closeBtn
        ]),
        createEl('div', { className: 'twfox-modal-tabs' }, [tabConfigBtn, tabCreditsBtn]),
        createEl('div', { className: 'twfox-modal-body' }, [configPane, creditsPane]),
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
          createEl('p', { text: 'configure twfoxtetrio & view credits' })
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
          closePanel();
        }
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
        syncControls(cfg);
      }
    });
  }

  api.registerFeature('foxmod-menu', initFoxmodMenu);
}(typeof globalThis !== 'undefined' ? globalThis : window));
