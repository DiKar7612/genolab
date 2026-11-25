/* ГеноЛаб — js/state/store.js — состояние игры в памяти (заглушка фазы 0).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.state.store.
 * Синхронизация с сейвом (js/state/save.js) — фаза 3.
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  var state = g.state = g.state || {};

  var initialState = {
    version: 1,
    enclosure: [],          // геномы существ, лимит 12 слотов (фаза 1+)
    resources: { coins: 0, reputation: 0 },
    codex: {},              // найденные фенотипы (фаза 4)
  };

  var current = JSON.parse(JSON.stringify(initialState));

  function getState() { return current; }

  /** Применить shallow-обновление по полям верхнего уровня. */
  function set(partial) {
    var keys = Object.keys(partial || {});
    for (var i = 0; i < keys.length; i++) current[keys[i]] = partial[keys[i]];
    return current;
  }

  function reset() {
    current = JSON.parse(JSON.stringify(initialState));
    return current;
  }

  state.store = {
    /* ===== Экспорты: window.GenoLab.state.store ===== */
    getState: getState,
    set: set,
    reset: reset,
  };
})(typeof window !== 'undefined' ? window : globalThis);
