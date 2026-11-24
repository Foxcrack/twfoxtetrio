(function (root) {
  'use strict';

  const api = root.__TWFOX_TETRIO__;
  if (!api) return;

  const internals = (root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {});
  const logic = internals.i18nLogic || root.TWFOX_I18N_LOGIC;
  if (!logic) return;

  const STYLE_ID = 'twfoxtetrio-i18n-style';
  const I18N_CSS = `
@font-face {
  font-family: 'HUN';
  src: url('/res/font/cr.ttf') format('truetype'), local('Segoe UI'), local('Arial');
  unicode-range: U+00A1, U+00AB, U+00B7, U+00BB, U+00BF, U+00C0-00D6, U+00D8-00F6, U+00F8-00FF;
}
@font-face {
  font-family: 'HUN-CHEEKY';
  src: url('/res/font/cr.ttf') format('truetype'), local('Segoe UI'), local('Arial');
  unicode-range: U+00A1, U+00AB, U+00B7, U+00BB, U+00BF, U+00C0-00D6, U+00D8-00F6, U+00F8-00FF;
}
html[data-twfox-lang='es'] #twfoxtetrio-pane-config,
html[data-twfox-lang='es'] #twfoxtetrio-pane-config h1,
html[data-twfox-lang='es'] #twfoxtetrio-pane-config p,
html[data-twfox-lang='es'] #twfoxtetrio-pane-config span,
html[data-twfox-lang='es'] #twfoxtetrio-pane-config button,
html[data-twfox-lang='es'] #twfoxtetrio-pane-config select,
html[data-twfox-lang='es'] #twfoxtetrio-pane-config input,
html[data-twfox-lang='es'] .twfox-native-scroller,
html[data-twfox-lang='es'] .twfox-native-scroller h1,
html[data-twfox-lang='es'] .twfox-native-scroller p,
html[data-twfox-lang='es'] .twfox-native-label,
html[data-twfox-lang='es'] .twfox-native-desc,
html[data-twfox-lang='es'] .twfox-btn,
html[data-twfox-lang='es'] .twfox-badge,
html[data-twfox-lang='es'] #menus #header_text,
html[data-twfox-lang='es'] #menus #footer_text,
html[data-twfox-lang='es'] .scroller_item > p,
html[data-twfox-lang='es'] .scroller_block > h1,
html[data-twfox-lang='es'] .notification_body,
html[data-twfox-lang='es'] .notification_button,
html[data-twfox-lang='es'] .scroller_item h1,
html[data-twfox-lang='es'] .config_item,
html[data-twfox-lang='es'] .social_relationship p,
html[data-twfox-lang='es'] .social_notification p,
body[data-twfox-lang='es'] #twfoxtetrio-update-toast,
body[data-twfox-lang='es'] .twfox-invite-notif {
  font-family: 'C', 'PFW', 'Segoe UI', sans-serif !important;
}
`;

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
    'footer_button',
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

  const INLINE_CONTAINER_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'LABEL', 'BUTTON', 'A', 'SPAN']);
  const ALLOWED_INLINE_CHILDREN = new Set(['SPAN', 'B', 'I', 'EM', 'STRONG', 'BR']);

  const origNodeText = new WeakMap();
  const appliedNodeText = new WeakMap();
  const origHtmlMap = new WeakMap();
  const appliedHtmlText = new WeakMap();
  const origAttrMap = new WeakMap();
  const appliedAttrMap = new WeakMap();

  let currentLocale = 'en';
  let applyingDepth = 0;
  let observer = null;
  let unsubRuntime = null;

  function ensureStyle() {
    const doc = root.document;
    if (!doc || doc.getElementById(STYLE_ID)) return;
    const head = doc.head || doc.documentElement;
    if (!head || typeof doc.createElement !== 'function') return;
    const st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent = I18N_CSS;
    head.appendChild(st);
  }

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

  function normalizeWhitespace(raw) {
    return String(raw || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function areOnlySafeInlineDescendants(el, depth) {
    if (!el || depth > 3) return false;
    const kids = Array.isArray(el.children) ? el.children : el.children ? Array.from(el.children) : [];
    if (kids.length > 5) return false;
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      const tag = String(k.tagName || '').toUpperCase();
      if (!ALLOWED_INLINE_CHILDREN.has(tag)) return false;
      if (isSkippedElement(k)) return false;
      if (typeof k.getAttribute === 'function' && k.getAttribute('role') === 'button') return false;
      const subKids = Array.isArray(k.children) ? k.children : k.children ? Array.from(k.children) : [];
      if (subKids.length > 0 && !areOnlySafeInlineDescendants(k, depth + 1)) return false;
    }
    return true;
  }

  function tryHandleInlineContainer(el) {
    if (!el || !el.tagName) return false;
    const tag = String(el.tagName).toUpperCase();
    const isFooterOrHeader = el.id === 'footer_text' || el.id === 'header_text';
    if (!isFooterOrHeader && !INLINE_CONTAINER_TAGS.has(tag)) return false;

    const childEls = Array.isArray(el.children) ? el.children : el.children ? Array.from(el.children) : [];
    if (childEls.length === 0 && !origHtmlMap.has(el)) return false;

    const currentNorm = normalizeWhitespace(el.textContent);
    const appliedNorm = appliedHtmlText.get(el);

    if (currentLocale === 'en') {
      if (appliedNorm !== undefined) {
        if (currentNorm === appliedNorm && origHtmlMap.has(el)) {
          const origHtml = origHtmlMap.get(el);
          appliedHtmlText.delete(el);
          origHtmlMap.delete(el);
          applyingDepth += 1;
          try {
            el.innerHTML = origHtml;
          } finally {
            applyingDepth -= 1;
          }
          return true;
        }
        appliedHtmlText.delete(el);
        origHtmlMap.delete(el);
      }
      return false;
    }

    if (appliedNorm !== undefined && currentNorm === appliedNorm) {
      return true;
    }

    if (childEls.length === 0) return false;
    if (!areOnlySafeInlineDescendants(el, 0)) return false;
    if (!currentNorm) return false;

    const translated = logic.translateText(currentNorm, currentLocale);
    if (!translated || translated === currentNorm) return false;

    if (typeof el.innerHTML === 'string') {
      origHtmlMap.set(el, el.innerHTML);
    }
    const translatedNorm = normalizeWhitespace(translated);
    appliedHtmlText.set(el, translatedNorm);
    applyingDepth += 1;
    try {
      el.textContent = translated;
    } finally {
      applyingDepth -= 1;
    }
    return true;
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
          origNodeText.set(target, current);
          appliedNodeText.delete(target);
        }
      }
      return;
    }

    if (applied !== undefined && current === applied) {
      return;
    }

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

    if (tryHandleInlineContainer(node)) {
      return;
    }

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
    ensureStyle();
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
          const holder = added.nodeType === 3 ? added.parentNode : added;
          if (!shouldSkipAncestor(holder)) {
            visitNode(holder && origHtmlMap.has(holder) ? holder : added, 0);
          }
        }
      }
      if (rec.target) {
        const tgt = rec.target;
        const holder = tgt.nodeType === 3 ? tgt.parentNode : tgt;
        if (!shouldSkipAncestor(holder)) {
          visitNode(holder && isInlinePhrasingContainerParent(holder) ? holder : tgt, 0);
        }
      }
    }
  }

  function isInlinePhrasingContainerParent(el) {
    if (!el || !el.tagName) return false;
    return el.id === 'footer_text' || el.id === 'header_text' || origHtmlMap.has(el) || appliedHtmlText.has(el);
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
    ensureStyle();
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
