(function (root) {
  'use strict';

  const api = root.__TWFOX_TETRIO__;
  const logic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.blitzLogic;
  if (!api || !logic) {
    return;
  }

  const STYLE_ID = 'twfoxtetrio-blitz-pb-style';
  const HUD_ID = 'twfoxtetrio-blitz-pb-hud';

  const HUD_CSS = `
#${HUD_ID} {
  position: fixed;
  top: 10px;
  left: 50%;
  transform: translate(-50%, -10px);
  z-index: 999999;
  pointer-events: none;
  user-select: none;
  opacity: 0;
  transition: opacity 160ms ease, transform 160ms ease, border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
  font-family: 'HUN', 'C', 'Segoe UI', sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 148px;
  padding: 5px 18px 6px;
  border-radius: 6px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1.5px solid rgba(255, 71, 87, 0.72);
  background: rgba(24, 9, 13, 0.78);
  box-shadow: 0 4px 16px rgba(255, 45, 65, 0.24);
}
#${HUD_ID}.is-visible {
  opacity: 1;
  transform: translate(-50%, 0);
}
#${HUD_ID}[data-state="behind"] {
  border-color: rgba(255, 71, 87, 0.75);
  background: rgba(24, 9, 13, 0.80);
  box-shadow: 0 4px 16px rgba(255, 45, 65, 0.25);
}
#${HUD_ID}[data-state="ahead"] {
  border-color: rgba(46, 213, 115, 0.85);
  background: rgba(8, 28, 16, 0.82);
  box-shadow: 0 4px 20px rgba(46, 213, 115, 0.34);
}
#${HUD_ID}.is-surpassed-flash {
  animation: twfoxPbPulse 520ms cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes twfoxPbPulse {
  0% { transform: translate(-50%, 0) scale(1); }
  35% { transform: translate(-50%, 0) scale(1.10); box-shadow: 0 0 28px rgba(46, 213, 115, 0.65); }
  100% { transform: translate(-50%, 0) scale(1); }
}
#${HUD_ID} .twfox-delta-value {
  font-size: clamp(20px, 2.2vw, 30px);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: 0.03em;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85);
}
#${HUD_ID}[data-state="behind"] .twfox-delta-value {
  color: #ff4d5e;
}
#${HUD_ID}[data-state="ahead"] .twfox-delta-value {
  color: #3ae374;
}
#${HUD_ID} .twfox-delta-sub {
  margin-top: 2px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}
#${HUD_ID}[data-state="behind"] .twfox-delta-sub {
  color: rgba(255, 194, 200, 0.85);
}
#${HUD_ID}[data-state="ahead"] .twfox-delta-sub {
  color: rgba(176, 250, 203, 0.92);
}
#${HUD_ID} .twfox-delta-sub.is-hidden {
  display: none;
}
`;

  function ensureStyleInjected() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = HUD_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function createHudElement() {
    let container = document.getElementById(HUD_ID);
    if (container) return container;

    container = document.createElement('div');
    container.id = HUD_ID;
    container.setAttribute('data-state', 'behind');
    container.setAttribute('aria-hidden', 'true');

    const valueEl = document.createElement('div');
    valueEl.className = 'twfox-delta-value';
    valueEl.textContent = '0';

    const subEl = document.createElement('div');
    subEl.className = 'twfox-delta-sub';
    subEl.textContent = 'PB: 0';

    container.appendChild(valueEl);
    container.appendChild(subEl);

    (document.body || document.documentElement).appendChild(container);
    return container;
  }

  api.registerFeature('blitz-pb-tracker', function () {
    ensureStyleInjected();
    const hud = createHudElement();
    const valueEl = hud.querySelector('.twfox-delta-value');
    const subEl = hud.querySelector('.twfox-delta-sub');

    let wasVisible = false;
    let wasSurpassed = false;

    api.subscribe(function (state, config) {
      const trackerCfg = (config && config.blitzTracker) || {
        enabled: true,
        showSubtitle: true,
        signedBehind: false
      };

      const shouldShow = Boolean(trackerCfg.enabled && state.inGame && state.mode === 'blitz');

      if (!shouldShow) {
        if (wasVisible) {
          hud.classList.remove('is-visible', 'is-surpassed-flash');
          wasVisible = false;
        }
        wasSurpassed = false;
        return;
      }

      const deltaInfo = logic.computeBlitzDelta(state.bestScore, state.currentScore, {
        signedBehind: trackerCfg.signedBehind
      });

      hud.setAttribute('data-state', deltaInfo.state);
      valueEl.textContent = deltaInfo.formatted;

      if (trackerCfg.showSubtitle === false) {
        subEl.classList.add('is-hidden');
      } else {
        subEl.classList.remove('is-hidden');
        if (deltaInfo.surpassed) {
          subEl.textContent = deltaInfo.best > 0
            ? 'NEW PB • ' + deltaInfo.formattedBest
            : 'NEW PB!';
        } else {
          subEl.textContent = 'PB: ' + deltaInfo.formattedBest;
        }
      }

      if (!wasVisible) {
        hud.classList.add('is-visible');
        wasVisible = true;
      }

      if (deltaInfo.surpassed && !wasSurpassed && state.currentScore > 0) {
        hud.classList.remove('is-surpassed-flash');
        void hud.offsetWidth;
        hud.classList.add('is-surpassed-flash');
      }
      wasSurpassed = deltaInfo.surpassed;
    });
  });
}(typeof globalThis !== 'undefined' ? globalThis : window));
