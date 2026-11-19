(function (root) {
  'use strict';

  const api = root.__TWFOX_TETRIO__;
  const logic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.fortyLinesLogic;
  const topHud = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.topHud;
  if (!api || !logic || !topHud) {
    return;
  }

  api.registerFeature('forty-lines-pb-tracker', function () {
    api.subscribe(function (state, config) {
      const trackerCfg = (config && config.fortyLinesTracker) || {
        enabled: true,
        showSubtitle: true
      };

      const shouldShow = Boolean(trackerCfg.enabled && state.inGame && state.mode === '40l');
      if (!shouldShow) {
        topHud.update('40l', { visible: false });
        return;
      }

      const deltaInfo = logic.computeFortyLinesDelta(state.bestTimeMs, state.currentTimeMs);

      let subtitleText;
      if (deltaInfo.bestMs === 0) {
        subtitleText = '40L • NO PB';
      } else if (deltaInfo.over) {
        subtitleText = 'OVER PB • ' + deltaInfo.formattedBest;
      } else {
        subtitleText = '40L PB: ' + deltaInfo.formattedBest;
      }

      topHud.update('40l', {
        visible: true,
        state: deltaInfo.state,
        valueText: deltaInfo.formatted,
        subtitleText,
        showSubtitle: trackerCfg.showSubtitle !== false,
        flashOnTransitionTo: deltaInfo.bestMs > 0 ? 'behind' : null
      });
    });
  });
}(typeof globalThis !== 'undefined' ? globalThis : window));
