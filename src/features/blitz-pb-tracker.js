(function (root) {
  'use strict';

  const api = root.__TWFOX_TETRIO__;
  const logic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.blitzLogic;
  const topHud = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.topHud;
  if (!api || !logic || !topHud) {
    return;
  }

  api.registerFeature('blitz-pb-tracker', function () {
    api.subscribe(function (state, config) {
      const trackerCfg = (config && config.blitzTracker) || {
        enabled: true,
        showSubtitle: true,
        signedBehind: false
      };

      const shouldShow = Boolean(trackerCfg.enabled && state.inGame && state.mode === 'blitz');
      if (!shouldShow) {
        topHud.update('blitz', { visible: false });
        return;
      }

      const deltaInfo = logic.computeBlitzDelta(state.bestScore, state.currentScore, {
        signedBehind: trackerCfg.signedBehind
      });

      const subtitleText = deltaInfo.surpassed
        ? (deltaInfo.best > 0 ? 'NEW PB • ' + deltaInfo.formattedBest : 'NEW PB!')
        : 'PB: ' + deltaInfo.formattedBest;

      topHud.update('blitz', {
        visible: true,
        state: deltaInfo.state,
        valueText: deltaInfo.formatted,
        subtitleText,
        showSubtitle: trackerCfg.showSubtitle !== false,
        flashOnTransitionTo: state.currentScore > 0 ? 'ahead' : null
      });
    });
  });
}(typeof globalThis !== 'undefined' ? globalThis : window));
