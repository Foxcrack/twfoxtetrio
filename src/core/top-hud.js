(function (root) {
  'use strict';

  root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};

  const STYLE_ID = 'twfoxtetrio-top-hud-style';
  const HUD_ID = 'twfoxtetrio-top-hud';

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
  min-width: 156px;
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
  border-color: rgba(255, 71, 87, 0.78);
  background: rgba(24, 9, 13, 0.80);
  box-shadow: 0 4px 16px rgba(255, 45, 65, 0.25);
}
#${HUD_ID}[data-state="ahead"] {
  border-color: rgba(46, 213, 115, 0.85);
  background: rgba(8, 28, 16, 0.82);
  box-shadow: 0 4px 20px rgba(46, 213, 115, 0.34);
}
#${HUD_ID}.is-flash-ahead {
  animation: twfoxFlashAhead 520ms cubic-bezier(0.22, 1, 0.36, 1);
}
#${HUD_ID}.is-flash-behind {
  animation: twfoxFlashBehind 520ms cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes twfoxFlashAhead {
  0% { transform: translate(-50%, 0) scale(1); }
  35% { transform: translate(-50%, 0) scale(1.10); box-shadow: 0 0 28px rgba(46, 213, 115, 0.65); }
  100% { transform: translate(-50%, 0) scale(1); }
}
@keyframes twfoxFlashBehind {
  0% { transform: translate(-50%, 0) scale(1); }
  35% { transform: translate(-50%, 0) scale(1.10); box-shadow: 0 0 28px rgba(255, 71, 87, 0.65); }
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
  color: rgba(255, 194, 200, 0.88);
}
#${HUD_ID}[data-state="ahead"] .twfox-delta-sub {
  color: rgba(176, 250, 203, 0.92);
}
#${HUD_ID} .twfox-delta-sub.is-hidden {
  display: none;
}
`;

  function ensureHudMounted() {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = HUD_CSS;
      (document.head || document.documentElement).appendChild(style);
    }

    let container = document.getElementById(HUD_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = HUD_ID;
      container.setAttribute('data-state', 'behind');
      container.setAttribute('aria-hidden', 'true');

      const valueEl = document.createElement('div');
      valueEl.className = 'twfox-delta-value';
      valueEl.textContent = '0';

      const subEl = document.createElement('div');
      subEl.className = 'twfox-delta-sub';
      subEl.textContent = '';

      container.appendChild(valueEl);
      container.appendChild(subEl);
      (document.body || document.documentElement).appendChild(container);
    }

    return {
      container,
      valueEl: container.querySelector('.twfox-delta-value'),
      subEl: container.querySelector('.twfox-delta-sub')
    };
  }

  let activeOwner = null;
  let lastOwnerState = null;

  /**
   * Shared controller for the top-center HUD pill so multiple modes (Blitz, 40 Lines, etc.)
   * render uniformly without overlapping each other.
   */
  root.__TWFOX_INTERNAL__.topHud = {
    update(ownerId, payload) {
      const { container, valueEl, subEl } = ensureHudMounted();

      if (!payload || !payload.visible) {
        if (activeOwner === ownerId) {
          container.classList.remove('is-visible', 'is-flash-ahead', 'is-flash-behind');
          activeOwner = null;
          lastOwnerState = null;
        }
        return;
      }

      const prevOwner = activeOwner;
      const prevState = lastOwnerState;
      activeOwner = ownerId;
      lastOwnerState = payload.state;

      container.setAttribute('data-mode', ownerId);
      container.setAttribute('data-state', payload.state);
      valueEl.textContent = payload.valueText;

      if (payload.showSubtitle === false || !payload.subtitleText) {
        subEl.classList.add('is-hidden');
      } else {
        subEl.classList.remove('is-hidden');
        subEl.textContent = payload.subtitleText;
      }

      container.classList.add('is-visible');

      if (
        prevOwner === ownerId &&
        payload.flashOnTransitionTo &&
        payload.state === payload.flashOnTransitionTo &&
        prevState !== payload.flashOnTransitionTo
      ) {
        const flashClass = payload.flashOnTransitionTo === 'ahead' ? 'is-flash-ahead' : 'is-flash-behind';
        container.classList.remove('is-flash-ahead', 'is-flash-behind');
        void container.offsetWidth;
        container.classList.add(flashClass);
      } else if (prevOwner !== ownerId) {
        container.classList.remove('is-flash-ahead', 'is-flash-behind');
      }
    }
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));
