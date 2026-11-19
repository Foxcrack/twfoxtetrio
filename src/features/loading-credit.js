(function (root) {
  'use strict';

  const CREDIT_TEXT = 'Modded By: TWFoxcrack';
  const STYLE_ID = 'twfoxtetrio-loading-credit-style';
  const FILE_CREDIT_ID = 'twfoxtetrio-file-credit';
  const PRELOAD_CREDIT_ID = 'twfoxtetrio-preload-credit';
  const TRANSITION_CREDIT_ID = 'twfoxtetrio-transition-credit';

  const CSS = `
#${FILE_CREDIT_ID} {
  position: fixed;
  left: 0;
  right: 0;
  top: calc(50vh + 4vw + 2.5em);
  text-align: center;
  font-family: 'C', 'Segoe UI', sans-serif;
  font-weight: 900;
  font-size: 0.95em;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #8f9bb8;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  user-select: none;
  z-index: 5;
  transition: opacity 0.25s ease;
}
#${FILE_CREDIT_ID}.is-hiding {
  opacity: 0;
}
#${PRELOAD_CREDIT_ID} {
  position: fixed;
  left: 20px;
  top: 108px;
  font-family: 'HUN', 'C', 'Segoe UI', sans-serif;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #9eb4ff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
  pointer-events: none;
  user-select: none;
  z-index: 2;
}
#${TRANSITION_CREDIT_ID} {
  position: absolute;
  left: 50%;
  top: calc(50% + 4.4vw);
  transform: translateX(-50%);
  font-family: 'HUN', 'C', 'Segoe UI', sans-serif;
  font-weight: 700;
  font-size: clamp(12px, 1.15vw, 16px);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #9eb4ff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
  transition: opacity 0.3s ease;
}
#desktop_transition.hiding-direct #${TRANSITION_CREDIT_ID},
#desktop_transition.hiding-preload #${TRANSITION_CREDIT_ID},
#desktop_transition.hidden #${TRANSITION_CREDIT_ID} {
  opacity: 0;
}
`;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function mountCredit() {
    if (!document || !document.documentElement) return;
    ensureStyle();

    const loc = root.location;
    const isFileLoader = loc && loc.protocol === 'file:';

    if (isFileLoader) {
      const loaderEl = document.getElementById('loader');
      if (loaderEl && !document.getElementById(FILE_CREDIT_ID)) {
        const credit = document.createElement('div');
        credit.id = FILE_CREDIT_ID;
        credit.textContent = CREDIT_TEXT;
        (document.body || document.documentElement).appendChild(credit);

        const shadeEl = document.getElementById('shade');
        if (shadeEl && typeof root.MutationObserver === 'function') {
          const obs = new root.MutationObserver(() => {
            if (shadeEl.classList.contains('showing')) {
              credit.classList.add('is-hiding');
            }
          });
          obs.observe(shadeEl, { attributes: true, attributeFilter: ['class'] });
        }
      }
      return;
    }

    const preloadEl = document.getElementById('preload');
    if (preloadEl && !document.getElementById(PRELOAD_CREDIT_ID)) {
      const credit = document.createElement('div');
      credit.id = PRELOAD_CREDIT_ID;
      credit.textContent = CREDIT_TEXT;
      preloadEl.appendChild(credit);
    }

    const transitionEl = document.getElementById('desktop_transition');
    if (transitionEl && !document.getElementById(TRANSITION_CREDIT_ID)) {
      const transCredit = document.createElement('div');
      transCredit.id = TRANSITION_CREDIT_ID;
      transCredit.textContent = CREDIT_TEXT;
      transitionEl.appendChild(transCredit);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mountCredit, { once: true });
    } else {
      mountCredit();
    }
  }
}(typeof globalThis !== 'undefined' ? globalThis : window));
