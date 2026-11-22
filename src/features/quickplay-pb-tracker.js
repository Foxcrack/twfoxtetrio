(function (root) {
  'use strict';

  const api = root.__TWFOX_TETRIO__;
  const logic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.quickPlayLogic;
  if (!api || !logic) {
    return;
  }

  const STYLE_ID = 'twfoxtetrio-zenith-hud-style';
  const HUD_ID = 'twfoxtetrio-zenith-hud';

  const HUD_CSS = `
#${HUD_ID} {
  position: fixed;
  left: 8px;
  top: 10px;
  z-index: 999998;
  pointer-events: none;
  user-select: none;
  font-family: 'HUN', 'C', 'Segoe UI', sans-serif;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  opacity: 0;
  transform: translateX(-16px);
  transition: opacity 160ms ease, transform 160ms ease;
}
#${HUD_ID}.is-visible {
  opacity: 1;
  transform: translateX(0);
}
#${HUD_ID} .twfox-z-digits {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: clamp(128px, 12vw, 170px);
  padding: 6px 12px 7px;
  border-radius: 7px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 2px solid rgba(255, 71, 87, 0.82);
  background: rgba(24, 9, 13, 0.82);
  box-shadow: 0 5px 16px rgba(255, 45, 65, 0.26);
  transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
}
#${HUD_ID}[data-state="ahead"] .twfox-z-digits {
  border-color: rgba(46, 213, 115, 0.88);
  background: rgba(8, 28, 16, 0.86);
  box-shadow: 0 5px 20px rgba(46, 213, 115, 0.34);
}
#${HUD_ID}.is-flash-ahead .twfox-z-digits {
  animation: twfoxZenithFlashAhead 520ms cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes twfoxZenithFlashAhead {
  0% { transform: scale(1); }
  35% { transform: scale(1.09); box-shadow: 0 0 32px rgba(46, 213, 115, 0.72); }
  100% { transform: scale(1); }
}
#${HUD_ID} .twfox-z-value {
  font-size: clamp(21px, 2.2vw, 30px);
  font-weight: 900;
  line-height: 1.04;
  letter-spacing: 0.03em;
  font-variant-numeric: tabular-nums;
  color: #ff4d5e;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
}
#${HUD_ID}[data-state="ahead"] .twfox-z-value {
  color: #3ae374;
}
#${HUD_ID} .twfox-z-sub {
  margin-top: 2px;
  font-size: clamp(9.5px, 0.85vw, 11.5px);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 194, 200, 0.92);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.85);
}
#${HUD_ID}[data-state="ahead"] .twfox-z-sub {
  color: rgba(176, 250, 203, 0.95);
}
#${HUD_ID} .twfox-z-sub.is-hidden {
  display: none;
}
#${HUD_ID} .twfox-z-bar-wrap {
  position: relative;
  margin-left: 2px;
  width: clamp(20px, 2vw, 28px);
  height: clamp(170px, 34vh, 260px);
  border-radius: 6px;
  padding: 3px;
  box-sizing: border-box;
  border: 2px solid rgba(255, 71, 87, 0.82);
  background: rgba(24, 9, 13, 0.80);
  box-shadow: 0 5px 14px rgba(0, 0, 0, 0.50);
  overflow: hidden;
  transform-origin: top center;
  transition: opacity 220ms ease, height 240ms ease, padding 220ms ease, border-width 220ms ease, transform 220ms ease;
}
#${HUD_ID} .twfox-z-bar-wrap.is-collapsed {
  opacity: 0;
  height: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-top-width: 0;
  border-bottom-width: 0;
  transform: scaleY(0);
}
#${HUD_ID} .twfox-z-bar-track {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.07);
  overflow: hidden;
}
#${HUD_ID} .twfox-z-bar-ticks {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}
#${HUD_ID} .twfox-z-bar-tick {
  position: absolute;
  left: 0;
  right: 0;
  height: 1.5px;
  background: rgba(255, 255, 255, 0.56);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
}
#${HUD_ID} .twfox-z-bar-tick.is-reached {
  background: rgba(255, 255, 255, 0.94);
}
#${HUD_ID} .twfox-z-bar-fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 0%;
  border-radius: 4px;
  background: linear-gradient(to top, #ff4d5e 0%, #ff8c42 100%);
  box-shadow: 0 0 12px rgba(255, 92, 92, 0.55);
  transition: height 90ms linear;
}
`;

  function ensureHudMounted() {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = HUD_CSS;
      (document.head || document.documentElement).appendChild(style);
    }

    let rootEl = document.getElementById(HUD_ID);
    if (!rootEl) {
      rootEl = document.createElement('div');
      rootEl.id = HUD_ID;
      rootEl.setAttribute('data-state', 'behind');
      rootEl.setAttribute('aria-hidden', 'true');

      const digits = document.createElement('div');
      digits.className = 'twfox-z-digits';

      const valueEl = document.createElement('div');
      valueEl.className = 'twfox-z-value';
      valueEl.textContent = '0.0 M';

      const subEl = document.createElement('div');
      subEl.className = 'twfox-z-sub';

      digits.appendChild(valueEl);
      digits.appendChild(subEl);

      const barWrap = document.createElement('div');
      barWrap.id = 'twfoxtetrio-zenith-bar-wrap';
      barWrap.className = 'twfox-z-bar-wrap';

      const track = document.createElement('div');
      track.className = 'twfox-z-bar-track';

      const fillEl = document.createElement('div');
      fillEl.id = 'twfoxtetrio-zenith-bar-fill';
      fillEl.className = 'twfox-z-bar-fill';

      const ticksEl = document.createElement('div');
      ticksEl.className = 'twfox-z-bar-ticks';

      track.appendChild(fillEl);
      track.appendChild(ticksEl);
      barWrap.appendChild(track);
      rootEl.appendChild(digits);
      rootEl.appendChild(barWrap);
      (document.body || document.documentElement).appendChild(rootEl);
    }

    return {
      rootEl,
      valueEl: rootEl.querySelector('.twfox-z-value'),
      subEl: rootEl.querySelector('.twfox-z-sub'),
      barWrap: rootEl.querySelector('.twfox-z-bar-wrap'),
      fillEl: rootEl.querySelector('.twfox-z-bar-fill'),
      ticksEl: rootEl.querySelector('.twfox-z-bar-ticks')
    };
  }

  api.registerFeature('quickplay-pb-tracker', function () {
    const { rootEl, valueEl, subEl, barWrap, fillEl, ticksEl } = ensureHudMounted();
    let lastVisible = false;
    let lastState = null;
    let renderedTickBest = null;
    let tickEntries = [];

    function syncFloorTicks(bestAltitude, currentAltitude) {
      if (!ticksEl) return;
      if (renderedTickBest !== bestAltitude) {
        renderedTickBest = bestAltitude;
        ticksEl.innerHTML = '';
        tickEntries = [];
        const ticks = logic.computeFloorTicks(bestAltitude);
        for (const item of ticks) {
          const tick = document.createElement('div');
          tick.className = 'twfox-z-bar-tick';
          tick.setAttribute('data-floor', String(item.floor));
          tick.setAttribute('data-altitude', String(item.altitude));
          if (tick.style) {
            tick.style.bottom = (item.ratio * 100).toFixed(3) + '%';
          }
          ticksEl.appendChild(tick);
          tickEntries.push({ el: tick, altitude: item.altitude });
        }
      }
      for (const entry of tickEntries) {
        if (currentAltitude >= entry.altitude) {
          entry.el.classList.add('is-reached');
        } else {
          entry.el.classList.remove('is-reached');
        }
      }
    }

    api.subscribe(function (state, config) {
      const cfg = (config && config.quickPlayTracker) || {
        enabled: true,
        showSubtitle: true,
        signedBehind: false
      };

      const shouldShow = Boolean(cfg.enabled && state.inZenith && state.zenithActive);
      if (!shouldShow) {
        if (lastVisible) {
          rootEl.classList.remove('is-visible', 'is-flash-ahead');
          lastVisible = false;
          lastState = null;
        }
        return;
      }

      const targetPb = state.zenithExpert ? state.bestZenithExAltitude : state.bestZenithAltitude;
      const deltaInfo = logic.computeQuickPlayDelta(targetPb, state.currentAltitude, {
        signedBehind: cfg.signedBehind
      });

      const prevState = lastState;
      lastVisible = true;
      lastState = deltaInfo.state;

      rootEl.setAttribute('data-state', deltaInfo.state);
      valueEl.textContent = deltaInfo.formatted;

      if (cfg.showSubtitle !== false) {
        subEl.classList.remove('is-hidden');
        subEl.textContent = deltaInfo.surpassed
          ? (deltaInfo.best > 0 ? 'NEW WEEKLY PB · ' + deltaInfo.formattedBest : 'NEW WEEKLY PB!')
          : 'WEEKLY PB: ' + deltaInfo.formattedBest;
      } else {
        subEl.classList.add('is-hidden');
      }

      if (deltaInfo.showBar) {
        barWrap.classList.remove('is-collapsed');
        const pct = (deltaInfo.progressRatio * 100).toFixed(2) + '%';
        if (fillEl.style) fillEl.style.height = pct;
        fillEl.setAttribute('data-progress', pct);
        syncFloorTicks(deltaInfo.best, deltaInfo.current);
      } else {
        barWrap.classList.add('is-collapsed');
        if (fillEl.style) fillEl.style.height = '100%';
        fillEl.setAttribute('data-progress', '100.00%');
      }

      if (!rootEl.classList.contains('is-visible')) {
        rootEl.classList.add('is-visible');
      }

      if (prevState === 'behind' && deltaInfo.state === 'ahead' && state.currentAltitude > 0) {
        rootEl.classList.remove('is-flash-ahead');
        if (typeof rootEl.offsetWidth === 'number') {
          void rootEl.offsetWidth;
        }
        rootEl.classList.add('is-flash-ahead');
      }
    });
  });
}(typeof globalThis !== 'undefined' ? globalThis : window));
