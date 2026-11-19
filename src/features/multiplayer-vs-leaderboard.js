(function (root) {
  'use strict';

  const api = root.__TWFOX_TETRIO__;
  const logic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.multiplayerLogic;
  if (!api || !logic) {
    return;
  }

  const STYLE_ID = 'twfoxtetrio-multi-lb-style';
  const PANEL_ID = 'twfoxtetrio-multi-lb';

  const LB_CSS = `
#${PANEL_ID} {
  position: fixed;
  top: 12px;
  right: 10px;
  z-index: 999998;
  pointer-events: none;
  user-select: none;
  width: 214px;
  max-width: 24vw;
  padding: 8px 10px 9px;
  border-radius: 6px;
  background: rgba(11, 13, 20, 0.78);
  border: 1.5px solid rgba(130, 155, 225, 0.35);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  font-family: 'HUN', 'C', 'Segoe UI', sans-serif;
  color: #edf1ff;
  opacity: 0;
  transform: translateX(12px);
  transition: opacity 160ms ease, transform 160ms ease;
}
#${PANEL_ID}.is-visible {
  opacity: 1;
  transform: translateX(0);
}
#${PANEL_ID} .twfox-lb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 5px;
  margin-bottom: 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: rgba(206, 218, 255, 0.85);
}
#${PANEL_ID} .twfox-lb-count {
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(130, 155, 225, 0.22);
  color: #ffffff;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
#${PANEL_ID} .twfox-lb-rows {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
#${PANEL_ID} .twfox-lb-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  font-size: 12.5px;
  line-height: 1.25;
}
#${PANEL_ID} .twfox-lb-row.is-leader {
  background: rgba(255, 200, 70, 0.14);
  box-shadow: inset 2px 0 0 #ffc846;
}
#${PANEL_ID} .twfox-lb-row.is-self {
  background: rgba(72, 184, 255, 0.16);
  box-shadow: inset 2px 0 0 #48b8ff;
}
#${PANEL_ID} .twfox-lb-row.is-leader.is-self {
  background: linear-gradient(90deg, rgba(255, 200, 70, 0.18), rgba(72, 184, 255, 0.18));
  box-shadow: inset 2px 0 0 #ffc846;
}
#${PANEL_ID} .twfox-lb-row.is-ko {
  opacity: 0.52;
}
#${PANEL_ID} .twfox-lb-rank {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.55);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
#${PANEL_ID} .twfox-lb-row.is-leader .twfox-lb-rank {
  color: #ffd369;
}
#${PANEL_ID} .twfox-lb-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #f4f7ff;
}
#${PANEL_ID} .twfox-lb-row.is-self .twfox-lb-name {
  color: #82d4ff;
}
#${PANEL_ID} .twfox-lb-vs {
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  color: #ffffff;
  text-align: right;
}
#${PANEL_ID} .twfox-lb-row.is-leader .twfox-lb-vs {
  color: #ffd369;
}
#${PANEL_ID} .twfox-lb-sep {
  margin: 2px 0;
  border-top: 1px dashed rgba(255, 255, 255, 0.18);
}
`;

  function ensurePanelMounted() {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = LB_CSS;
      (document.head || document.documentElement).appendChild(style);
    }

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.setAttribute('aria-hidden', 'true');

      const header = document.createElement('div');
      header.className = 'twfox-lb-header';

      const title = document.createElement('span');
      title.textContent = 'VS LEADERBOARD';

      const count = document.createElement('span');
      count.className = 'twfox-lb-count';
      count.textContent = '0';

      header.appendChild(title);
      header.appendChild(count);

      const rows = document.createElement('div');
      rows.className = 'twfox-lb-rows';

      panel.appendChild(header);
      panel.appendChild(rows);
      (document.body || document.documentElement).appendChild(panel);
    }

    return {
      panel,
      countEl: panel.querySelector('.twfox-lb-count'),
      rowsEl: panel.querySelector('.twfox-lb-rows')
    };
  }

  function createRowElement(entry, rankIndex) {
    const row = document.createElement('div');
    const classes = ['twfox-lb-row'];
    if (rankIndex === 1) classes.push('is-leader');
    if (entry.isSelf) classes.push('is-self');
    if (!entry.alive) classes.push('is-ko');
    row.className = classes.join(' ');

    const rankEl = document.createElement('span');
    rankEl.className = 'twfox-lb-rank';
    rankEl.textContent = '#' + rankIndex;

    const nameEl = document.createElement('span');
    nameEl.className = 'twfox-lb-name';
    nameEl.textContent = entry.username.toUpperCase() + (entry.alive ? '' : ' [KO]');

    const vsEl = document.createElement('span');
    vsEl.className = 'twfox-lb-vs';
    vsEl.textContent = logic.formatVs(entry.vs);

    row.appendChild(rankEl);
    row.appendChild(nameEl);
    row.appendChild(vsEl);
    return row;
  }

  api.registerFeature('multiplayer-vs-leaderboard', function () {
    const { panel, countEl, rowsEl } = ensurePanelMounted();
    let lastSignature = '';

    api.subscribe(function (state, config) {
      const cfg = (config && config.multiplayerLeaderboard) || {
        enabled: true,
        maxRows: 12,
        includeQuickPlay: false
      };

      const entries = Array.isArray(state.leaderboard) ? state.leaderboard : [];
      const shouldShow = Boolean(
        cfg.enabled &&
        state.inMultiplayer &&
        (!state.inZenith || cfg.includeQuickPlay) &&
        entries.length > 0
      );

      if (!shouldShow) {
        if (panel.classList.contains('is-visible')) {
          panel.classList.remove('is-visible');
        }
        if (lastSignature !== '') {
          lastSignature = '';
          rowsEl.innerHTML = '';
          countEl.textContent = '0';
        }
        return;
      }

      const maxRows = Math.max(2, Math.min(30, Number(cfg.maxRows) || 12));
      const visible = entries.slice(0, maxRows);
      const selfIdx = entries.findIndex(function (e) { return e.isSelf; });
      const appendSelf = selfIdx >= maxRows ? entries[selfIdx] : null;

      const sigParts = [String(entries.length)];
      for (let i = 0; i < visible.length; i++) {
        const e = visible[i];
        sigParts.push(e.id + ':' + e.username + ':' + logic.formatVs(e.vs) + ':' + (e.alive ? 1 : 0) + ':' + (e.isSelf ? 1 : 0));
      }
      if (appendSelf) {
        sigParts.push('S' + (selfIdx + 1) + ':' + appendSelf.id + ':' + logic.formatVs(appendSelf.vs) + ':' + (appendSelf.alive ? 1 : 0));
      }
      const nextSignature = sigParts.join('|');

      panel.classList.add('is-visible');

      if (nextSignature === lastSignature) {
        return;
      }
      lastSignature = nextSignature;

      countEl.textContent = String(entries.length);
      rowsEl.innerHTML = '';

      for (let i = 0; i < visible.length; i++) {
        rowsEl.appendChild(createRowElement(visible[i], i + 1));
      }

      if (appendSelf) {
        const sep = document.createElement('div');
        sep.className = 'twfox-lb-sep';
        rowsEl.appendChild(sep);
        rowsEl.appendChild(createRowElement(appendSelf, selfIdx + 1));
      }
    });
  });
}(typeof globalThis !== 'undefined' ? globalThis : window));
