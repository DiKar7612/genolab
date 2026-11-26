/* ГеноЛаб — js/quests/tutorial.js — обучение нового игрока (заглушка).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.quests.tutorial.
 * Пошаговые подсказки (первое скрещивание, продажа, заказы)
 * не реализованы в MVP — прохождение квестов не блокируется.
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  g.quests = g.quests || {};

  var shownAt = null; // timestamp последнего показа

  /** Показать обучение. Заглушка: возвращает null. */
  function start() {
    return null;
  }

  g.quests.tutorial = {
    /* ===== Экспорты: window.GenoLab.quests.tutorial ===== */
    shownAt: shownAt,
    start: start,
  };
})(typeof window !== 'undefined' ? window : globalThis);
