(function (root) {
  'use strict';

  const api = root.__TWFOX_TETRIO__;
  const logic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.zenQpLogic;
  if (!api || !logic) {
    return;
  }

  const STYLE_ID = 'twfoxtetrio-zen-qp-style';
  const SECTION_ID = 'twfoxtetrio-zen-qp-section';

  const ZEN_QP_CSS = `
#${SECTION_ID} {
  margin-top: 1.15em;
  padding-top: 0.7em;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
}
#${SECTION_ID} .twfox-zen-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
#${SECTION_ID} .twfox-zen-hdr h1 {
  margin: 0 !important;
}
#${SECTION_ID} .twfox-zen-reset-btn {
  font-family: HUN, sans-serif;
  font-size: 0.88em;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 0.2em 0.55em;
  border-radius: 3px;
  cursor: pointer;
  color: #ffd3b3;
  background: rgba(255, 130, 52, 0.16);
  border: 1px solid rgba(255, 130, 52, 0.5);
  transition: filter 120ms ease, opacity 120ms ease;
}
#${SECTION_ID} .twfox-zen-reset-btn:hover {
  filter: brightness(1.25);
}
#${SECTION_ID} .twfox-zen-reset-btn.is-empty {
  opacity: 0.45;
  cursor: default;
}
#${SECTION_ID} .twfox-zen-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  margin-top: 0.5em;
}
#${SECTION_ID} .twfox-zen-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 5px 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  user-select: none;
  font-family: HUN, sans-serif;
  transition: background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
}
#${SECTION_ID} .twfox-zen-card:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}
#${SECTION_ID} .twfox-zen-card.is-normal {
  background: rgba(255, 145, 70, 0.22);
  border-color: var(--twfox-card-accent, #ff8c42);
  color: #ffffff;
  box-shadow: inset 2px 0 0 var(--twfox-card-accent, #ff8c42);
}
#${SECTION_ID} .twfox-zen-card.is-reversed {
  background: rgba(150, 72, 230, 0.30);
  border-color: #c87dff;
  color: #fff3ff;
  box-shadow: inset 2px 0 0 #d58aff, 0 0 10px rgba(182, 102, 255, 0.25);
}
#${SECTION_ID} .twfox-zen-card-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  pointer-events: none;
}
#${SECTION_ID} .twfox-zen-card-short {
  font-size: 0.74em;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: var(--twfox-card-accent, #ffbe8e);
}
#${SECTION_ID} .twfox-zen-card.is-reversed .twfox-zen-card-short {
  color: #e4b5ff;
}
#${SECTION_ID} .twfox-zen-card-name {
  font-size: 0.88em;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#${SECTION_ID} .twfox-zen-rev-btn {
  flex: 0 0 auto;
  font-family: HUN, sans-serif;
  font-size: 0.72em;
  font-weight: 900;
  padding: 2px 5px;
  border-radius: 3px;
  cursor: pointer;
  color: rgba(230, 210, 255, 0.72);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.16);
}
#${SECTION_ID} .twfox-zen-rev-btn:hover {
  background: rgba(182, 102, 255, 0.32);
  color: #ffffff;
}
#${SECTION_ID} .twfox-zen-card.is-reversed .twfox-zen-rev-btn {
  background: #b565ff;
  border-color: #eed1ff;
  color: #160926;
}
#${SECTION_ID} .twfox-zen-desc {
  margin-top: 0.45em;
  font-size: 0.84em;
  line-height: 1.25;
  color: rgba(255, 255, 255, 0.68);
}
#${SECTION_ID} .twfox-zen-hint {
  margin-top: 0.45em;
  padding: 5px 7px;
  border-radius: 3px;
  background: rgba(255, 166, 62, 0.14);
  border: 1px solid rgba(255, 166, 62, 0.42);
  color: #ffd7a6;
  font-size: 0.8em;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
#${SECTION_ID} .twfox-zen-hint.hidden {
  display: none;
}
#${SECTION_ID} .twfox-zen-hint-btn {
  flex: 0 0 auto;
  font-family: HUN, sans-serif;
  font-size: 0.85em;
  font-weight: 900;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  color: #1c1005;
  background: #ffb259;
  border: 0;
}
`;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const head = document.head || document.documentElement;
    if (!head) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = ZEN_QP_CSS;
    head.appendChild(style);
  }

  function buildEl(tag, opts, children) {
    const el = document.createElement(tag);
    if (opts) {
      if (opts.id) el.id = opts.id;
      if (opts.className) el.className = opts.className;
      if (opts.text !== undefined) el.textContent = opts.text;
      if (opts.style) el.setAttribute('style', opts.style);
      if (opts.type && tag === 'button') el.type = opts.type;
      if (opts.attrs) {
        for (const [k, v] of Object.entries(opts.attrs)) {
          el.setAttribute(k, v);
        }
      }
    }
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child) el.appendChild(child);
      }
    }
    return el;
  }

  function findPanelOption(panelContent, key, value) {
    if (!panelContent || typeof panelContent.querySelectorAll !== 'function') return null;
    const opts = panelContent.querySelectorAll('.panel_option');
    for (const opt of opts) {
      if (opt.getAttribute('data-key') === key && opt.getAttribute('data-value') === value) {
        return opt;
      }
    }
    return null;
  }

  function isZenGarbageOff(panelContent) {
    const offOpt = findPanelOption(panelContent, 'garbagemode', 'off');
    return Boolean(offOpt && offOpt.classList && offOpt.classList.contains('selected'));
  }

  api.registerFeature('zen-qp-mods', function () {
    ensureStyle();

    const cardUiMap = new Map();
    let mountedSection = null;
    let resetBtn = null;
    let descEl = null;
    let hintEl = null;
    let lastPreviewMod = null;

    function renderSelection(cfg) {
      if (!mountedSection) return;
      const selection = logic.normalizeZenModSelection(cfg && cfg.zenQuickPlayMods);
      const anyActive = logic.hasAnyActiveMods(selection);

      if (resetBtn) {
        if (anyActive) resetBtn.classList.remove('is-empty');
        else resetBtn.classList.add('is-empty');
      }

      const activeNames = [];
      for (const mod of logic.ZEN_QP_MODS) {
        const ui = cardUiMap.get(mod.id);
        if (!ui) continue;
        const st = selection[mod.id] || 'off';
        ui.card.classList.remove('is-normal', 'is-reversed');
        if (st === 'normal') {
          ui.card.classList.add('is-normal');
          activeNames.push(mod.name);
        } else if (st === 'reversed') {
          ui.card.classList.add('is-reversed');
          activeNames.push(`${mod.revName} (REV)`);
        }
        ui.card.setAttribute('data-mod-state', st);
        ui.shortEl.textContent = st === 'reversed' ? mod.revShort : mod.short;
        ui.nameEl.textContent = st === 'reversed' ? mod.revName : mod.name;
        ui.card.setAttribute('title', st === 'reversed' ? mod.revDesc : mod.desc);
      }

      if (descEl) {
        if (lastPreviewMod) {
          const st = selection[lastPreviewMod.id] || 'off';
          descEl.textContent = st === 'reversed'
            ? `${lastPreviewMod.revName}: ${lastPreviewMod.revDesc}`
            : `${lastPreviewMod.name}: ${lastPreviewMod.desc}`;
        } else {
          descEl.textContent = activeNames.length
            ? `Active: ${activeNames.join(' · ')}`
            : 'Click a card to toggle normal QP effect; click R to flip Reversed.';
        }
      }

      if (hintEl) {
        const panelContent = document.getElementById('zen_panel_content');
        const showHint = logic.hasGarbageDependentMods(selection) && isZenGarbageOff(panelContent);
        if (showHint) hintEl.classList.remove('hidden');
        else hintEl.classList.add('hidden');
      }
    }

    function updateMod(modId, targetMode) {
      const cfg = api.getConfig();
      const cur = logic.normalizeZenModSelection(cfg && cfg.zenQuickPlayMods);
      const nextVal = logic.toggleZenModState(cur[modId], targetMode);
      cur[modId] = nextVal;
      lastPreviewMod = logic.ZEN_QP_MODS.find((m) => m.id === modId) || null;
      api.updateConfig({ zenQuickPlayMods: cur });
    }

    function ensureSectionMounted() {
      const panelContent = document.getElementById('zen_panel_content');
      if (!panelContent) return false;
      if (document.getElementById(SECTION_ID)) {
        mountedSection = document.getElementById(SECTION_ID);
        return true;
      }

      resetBtn = buildEl('button', {
        id: 'twfoxtetrio-zen-qp-reset',
        className: 'twfox-zen-reset-btn is-empty',
        text: 'RESET',
        type: 'button',
        attrs: { 'data-hover': 'tap', 'data-hit': 'click' }
      });
      resetBtn.addEventListener('click', function (ev) {
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
        lastPreviewMod = null;
        api.updateConfig({ zenQuickPlayMods: logic.createEmptySelection() });
      });

      const grid = buildEl('div', { id: 'twfoxtetrio-zen-qp-grid', className: 'twfox-zen-grid' });
      for (const mod of logic.ZEN_QP_MODS) {
        const shortEl = buildEl('span', { className: 'twfox-zen-card-short', text: mod.short });
        const nameEl = buildEl('span', { className: 'twfox-zen-card-name', text: mod.name });
        const revBtn = buildEl('button', {
          id: `twfoxtetrio-zen-mod-${mod.id}-rev`,
          className: 'twfox-zen-rev-btn',
          text: 'R',
          type: 'button',
          attrs: {
            title: `Toggle Reversed (${mod.revName})`,
            'data-hover': 'tap',
            'data-hit': 'click'
          }
        });
        const card = buildEl(
          'div',
          {
            id: `twfoxtetrio-zen-mod-${mod.id}`,
            className: 'twfox-zen-card',
            style: `--twfox-card-accent:${mod.accent};`,
            attrs: {
              'data-mod-id': mod.id,
              'data-mod-state': 'off',
              'data-hover': 'tap',
              'data-hit': 'click',
              title: mod.desc
            }
          },
          [
            buildEl('div', { className: 'twfox-zen-card-main' }, [shortEl, nameEl]),
            revBtn
          ]
        );

        card.addEventListener('click', function (ev) {
          if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
          updateMod(mod.id, ev && ev.shiftKey ? 'reversed' : 'normal');
        });
        revBtn.addEventListener('click', function (ev) {
          if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
          updateMod(mod.id, 'reversed');
        });

        cardUiMap.set(mod.id, { card, shortEl, nameEl, revBtn });
        grid.appendChild(card);
      }

      descEl = buildEl('div', {
        id: 'twfoxtetrio-zen-qp-desc',
        className: 'twfox-zen-desc',
        text: 'Click a card to toggle normal QP effect; click R to flip Reversed.'
      });

      const backfireBtn = buildEl('button', {
        id: 'twfoxtetrio-zen-qp-enable-backfire',
        className: 'twfox-zen-hint-btn',
        text: 'BACKFIRE 1X',
        type: 'button'
      });
      backfireBtn.addEventListener('click', function (ev) {
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
        const opt = findPanelOption(panelContent, 'garbagemode', 'backfire_full');
        if (opt && typeof opt.click === 'function') {
          opt.click();
          renderSelection(api.getConfig());
        }
      });
      hintEl = buildEl('div', { id: 'twfoxtetrio-zen-qp-hint', className: 'twfox-zen-hint hidden' }, [
        buildEl('span', { text: 'Garbage is OFF — enable Backfire/Cheese to trigger garbage cards:' }),
        backfireBtn
      ]);

      mountedSection = buildEl('div', { id: SECTION_ID }, [
        buildEl('div', { className: 'twfox-zen-hdr' }, [
          buildEl('h1', { text: 'QUICK PLAY CARDS' }),
          resetBtn
        ]),
        grid,
        descEl,
        hintEl
      ]);

      panelContent.appendChild(mountedSection);

      if (typeof root.MutationObserver === 'function') {
        const panelObserver = new root.MutationObserver(function () {
          renderSelection(api.getConfig());
        });
        panelObserver.observe(panelContent, {
          subtree: true,
          attributes: true,
          attributeFilter: ['class']
        });
      }

      return true;
    }

    ensureSectionMounted();
    api.subscribe(function (_state, cfg) {
      ensureSectionMounted();
      renderSelection(cfg);
    });
  });
}(typeof globalThis !== 'undefined' ? globalThis : window));
