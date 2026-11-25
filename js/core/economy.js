/* ГеноЛаб — js/core/economy.js — экономика (заглушка фазы 0,
   минимально рабочая).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.core.economy.
 * Цены на действия, продажа — фаза 4.
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  var core = g.core = g.core || {};

  var state = { coins: 0, reputation: 0 };

  function addCoins(n) { state.coins += n; return state.coins; }
  function addReputation(n) { state.reputation += n; return state.reputation; }
  function snapshot() { return { coins: state.coins, reputation: state.reputation }; }

  core.economy = {
    /* ===== Экспорты: window.GenoLab.core.economy ===== */
    addCoins: addCoins,
    addReputation: addReputation,
    snapshot: snapshot,
  };
})(typeof window !== 'undefined' ? window : globalThis);
