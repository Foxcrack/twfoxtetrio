(function (root) {
  'use strict';

  const api = root.__TWFOX_TETRIO__;
  if (!api) return;

  const internals = (root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {});
  const logic = internals.i18nLogic || root.TWFOX_I18N_LOGIC;
  if (!logic) return;

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'SVG', 'CANVAS', 'CODE', 'PRE', 'TEXTAREA']);
  const SKIP_IDS = new Set([
    'me_username',
    'social_dm_username',
    'twfoxtetrio-lobby-invite-code',
    'twfoxtetrio-host-room-code',
    'pbdisplay_blitz_inner',
    'pbdisplay_40l_inner',
    'pbdisplay_zenith_inner',
    'pbdisplay_zenithex_inner',
    'zenith_result',
    'zenith_pb_result',
    'twfoxtetrio-updater-cmd'
  ]);
  const SKIP_CLASSES = [
    'scroller_player',
    'chat_tag',
    'chat_message',
    'record_owner',
    'leagueplayer_name',
    'room_config_spinner',
    'twfox-player-name',
    'twfox-paw-target',
    'twfox-lb-name',
    'twfox-res-name',
    'twfox-mutual-name',
    'twfox-code-value',
    'twfox-invite-id',
    'twfox-chat-msg',
    'twfox-asset-card-title',
    'twfox-asset-card-author'
  ];

  const origNodeText = new WeakMap();
  const appliedNodeText = new WeakMap();
  const origAttrMap = new WeakMap();
  const appliedAttrMap = new WeakMap();

  let currentLocale = 'en';
  let applyingDepth = 0;
  let observer = null;
  let unsubRuntime = null;

  function readConfiguredLocale() {
    try {
      const cfg = typeof api.getConfig === 'function' ? api.getConfig() : null;
      return logic.normalizeLocale(cfg && cfg.language && cfg.language.locale);
    } catch (_) {
      return 'en';
    }
  }

  function hasSkipClass(el) {
    if (!el) return false;
    if (el.classList && typeof el.classList.contains === 'function') {
      for (let i = 0; i < SKIP_CLASSES.length; i++) {
        if (el.classList.contains(SKIP_CLASSES[i])) return true;
      }
    }
    const cls = typeof el.className === 'string' ? el.className : '';
    if (cls) {
      for (let i = 0; i < SKIP_CLASSES.length; i++) {
        if (cls.includes(SKIP_CLASSES[i])) return true;
      }
    }
    return false;
  }

  function isSkippedElement(el) {
    if (!el || typeof el !== 'object') return true;
    const tag = String(el.tagName || '').toUpperCase();
    if (tag && SKIP_TAGS.has(tag)) return true;
    if (el.id && SKIP_IDS.has(el.id)) return true;
    if (typeof el.getAttribute === 'function') {
      if (el.getAttribute('data-twfox-no-i18n') === '1') return true;
      if (el.getAttribute('contenteditable') === 'true') return true;
    }
    if (hasSkipClass(el)) return true;

    // Preserve friend names inside social relationship cards (status <p> still translates)
    if (tag === 'H1' && el.parentNode && el.parentNode.classList) {
      if (
        el.parentNode.classList.contains('social_relationship') ||
        el.parentNode.classList.contains('social_notification')
      ) {
        return true;
      }
    }
    return false;
  }

  function shouldSkipAncestor(el) {
    let cur = el;
    let depth = 0;
    while (cur && depth < 24) {
      if (isSkippedElement(cur)) return true;
      cur = cur.parentNode || null;
      depth += 1;
    }
    return false;
  }

  function syncTextSlot(target, readValue, writeValue) {
    if (!target) return;
    const current = readValue();
    if (typeof current !== 'string' || !current) return;

    const applied = appliedNodeText.get(target);
    if (currentLocale === 'en') {
      if (applied !== undefined) {
        if (current === applied && origNodeText.has(target)) {
          const original = origNodeText.get(target);
          appliedNodeText.delete(target);
          if (original !== current) {
            applyingDepth += 1;
            try {
              writeValue(original);
            } finally {
              applyingDepth -= 1;
            }
          }
        } else {
          // Underlying app already replaced the text while in EN or transitioning
          origNodeText.set(target, current);
          appliedNodeText.delete(target);
        }
      }
      return;
    }

    // Target language === 'es'
    if (applied !== undefined && current === applied) {
      return;
    }

    // Fresh source text from app or UI update
    origNodeText.set(target, current);
    const translated = logic.translateText(current, currentLocale);
    if (translated && translated !== current) {
      appliedNodeText.set(target, translated);
      applyingDepth += 1;
      try {
        writeValue(translated);
      } finally {
        applyingDepth -= 1;
      }
    } else {
      appliedNodeText.delete(target);
    }
  }

  function syncElementAttributes(el) {
    if (!el || typeof el.getAttribute !== 'function' || typeof el.setAttribute !== 'function') return;
    const attrs = ['placeholder', 'title'];
    let origRec = origAttrMap.get(el);
    let appliedRec = appliedAttrMap.get(el);

    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      const curVal = el.getAttribute(attr);
      if (typeof curVal !== 'string' || !curVal) continue;

      if (currentLocale === 'en') {
        if (appliedRec && Object.prototype.hasOwnProperty.call(appliedRec, attr)) {
          if (curVal === appliedRec[attr] && origRec && Object.prototype.hasOwnProperty.call(origRec, attr)) {
            const origVal = origRec[attr];
            delete appliedRec[attr];
            if (origVal !== curVal) {
              applyingDepth += 1;
              try {
                el.setAttribute(attr, origVal);
              } finally {
                applyingDepth -= 1;
              }
            }
          } else {
            if (!origRec) {
              origRec = {};
              origAttrMap.set(el, origRec);
            }
            origRec[attr] = curVal;
            delete appliedRec[attr];
          }
        }
        continue;
      }

      if (appliedRec && appliedRec[attr] === curVal) continue;

      if (!origRec) {
        origRec = {};
        origAttrMap.set(el, origRec);
      }
      origRec[attr] = curVal;
      const nextVal = logic.translateText(curVal, currentLocale);
      if (nextVal && nextVal !== curVal) {
        if (!appliedRec) {
          appliedRec = {};
          appliedAttrMap.set(el, appliedRec);
        }
        appliedRec[attr] = nextVal;
        applyingDepth += 1;
        try {
          el.setAttribute(attr, nextVal);
        } finally {
          applyingDepth -= 1;
        }
      } else if (appliedRec) {
        delete appliedRec[attr];
      }
    }
  }

  function visitNode(node, depth) {
    if (!node || depth > 28) return;

    if (node.nodeType === 3) {
      if (node.parentNode && shouldSkipAncestor(node.parentNode)) return;
      syncTextSlot(
        node,
        function () {
          return node.nodeValue;
        },
        function (val) {
          node.nodeValue = val;
        }
      );
      return;
    }

    if (isSkippedElement(node)) return;

    syncElementAttributes(node);

    const hasChildNodes = node.childNodes && node.childNodes.length > 0;
    if (hasChildNodes) {
      for (let i = 0; i < node.childNodes.length; i++) {
        visitNode(node.childNodes[i], depth + 1);
      }
      return;
    }

    const childEls = Array.isArray(node.children) ? node.children : null;
    if (childEls && childEls.length > 0) {
      for (let i = 0; i < childEls.length; i++) {
        visitNode(childEls[i], depth + 1);
      }
      return;
    }

    // Leaf element (covers FakeElement in test harness and textContent-only nodes)
    if (typeof node.textContent === 'string' && node.textContent) {
      syncTextSlot(
        node,
        function () {
          return node.textContent;
        },
        function (val) {
          node.textContent = val;
        }
      );
    }
  }

  function isContainedIn(rootCandidate, el) {
    let cur = el;
    let guard = 0;
    while (cur && guard < 24) {
      if (cur === rootCandidate) return true;
      cur = cur.parentNode || null;
      guard += 1;
    }
    return false;
  }

  function getObserveRoots() {
    const doc = root.document;
    if (!doc) return [];
    const candidates = [doc.body, doc.getElementById('menus'), doc.getElementById('notifications')].filter(Boolean);
    const roots = [];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      let nested = false;
      for (let j = 0; j < candidates.length; j++) {
        if (i !== j && isContainedIn(candidates[j], c)) {
          nested = true;
          break;
        }
      }
      if (!nested && !roots.includes(c)) {
        roots.push(c);
      }
    }
    return roots;
  }

  function syncDomAttributeFlag() {
    const doc = root.document;
    if (!doc) return;
    if (doc.documentElement && typeof doc.documentElement.setAttribute === 'function') {
      doc.documentElement.setAttribute('data-twfox-lang', currentLocale);
    }
    if (doc.body && typeof doc.body.setAttribute === 'function') {
      doc.body.setAttribute('data-twfox-lang', currentLocale);
    }
  }

  function refresh() {
    syncDomAttributeFlag();
    const roots = getObserveRoots();
    for (let i = 0; i < roots.length; i++) {
      visitNode(roots[i], 0);
    }
  }

  function handleMutations(records) {
    if (applyingDepth > 0 || !Array.isArray(records)) return;
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (!rec) continue;
      if (rec.addedNodes && rec.addedNodes.length > 0) {
        for (let j = 0; j < rec.addedNodes.length; j++) {
          const added = rec.addedNodes[j];
          if (!shouldSkipAncestor(added.nodeType === 3 ? added.parentNode : added)) {
            visitNode(added, 0);
          }
        }
      }
      if (rec.target) {
        const tgt = rec.target;
        if (!shouldSkipAncestor(tgt.nodeType === 3 ? tgt.parentNode : tgt)) {
          visitNode(tgt, 0);
        }
      }
    }
  }

  function setLocale(nextLocale) {
    const norm = logic.normalizeLocale(nextLocale);
    if (norm === currentLocale) {
      refresh();
      return currentLocale;
    }
    currentLocale = norm;
    refresh();
    return currentLocale;
  }

  function attachObserver() {
    const MO = root.MutationObserver;
    if (typeof MO !== 'function' || observer) return;
    const roots = getObserveRoots();
    if (roots.length === 0) return;

    observer = new MO(handleMutations);
    for (let i = 0; i < roots.length; i++) {
      observer.observe(roots[i], {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['placeholder', 'title']
      });
    }
  }

  function initFeature() {
    currentLocale = readConfiguredLocale();
    attachObserver();
    refresh();

    unsubRuntime = api.subscribe(function () {
      const nextLoc = readConfiguredLocale();
      if (nextLoc !== currentLocale) {
        setLocale(nextLoc);
      }
    });
  }

  function destroy() {
    if (observer && typeof observer.disconnect === 'function') {
      observer.disconnect();
      observer = null;
    }
    if (unsubRuntime) {
      unsubRuntime();
      unsubRuntime = null;
    }
    if (currentLocale !== 'en') {
      setLocale('en');
    }
  }

  internals.i18nGlobal = {
    getLocale: function () {
      return currentLocale;
    },
    setLocale: function (loc) {
      const norm = logic.normalizeLocale(loc);
      if (typeof api.updateConfig === 'function') {
        api.updateConfig({ language: { locale: norm } });
      }
      return setLocale(norm);
    },
    translate: function (text) {
      return logic.translateText(text, currentLocale);
    },
    refresh,
    destroy
  };

  api.registerFeature('i18n-global', initFeature);
})(typeof globalThis !== 'undefined' ? globalThis : window);
