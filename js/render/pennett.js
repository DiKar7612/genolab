/* ГеноЛаб — js/render/pennett.js — интерактивная решётка Пеннета
   (заглушка фазы 0).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.render.pennett.
 * Заполнение клеток, подсветка выпавшего потомка — фаза 2.
 * Разметка — только из внутренних констант (SECURITY.md §4).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  var render = g.render = g.render || {};

  /**
   * Разметка решётки (заглушка): одна клетка-плейсхолдер.
   * @param {Array} [cells] — клетки решётки (в фазе 0 игнорируются)
   */
  function renderGrid(cells) {
    return '<div class="pennett pennett--stub">Решётка Пеннета — фаза 2</div>';
  }

  render.pennett = {
    /* ===== Экспорты: window.GenoLab.render.pennett ===== */
    renderGrid: renderGrid,
  };
})(typeof window !== 'undefined' ? window : globalThis);
