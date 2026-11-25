/* ГеноЛаб — js/render/creature.js — процедурный SVG-рендер существа
   (заглушка фазы 0).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.render.creature.
 * Модульная сборка (тело + уши + хвост + узор) из assets/parts/ — фаза 2.
 * HTML вставляется только из внутренних констант (SECURITY.md §4).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  var render = g.render = g.render || {};

  /**
   * Вернуть строку SVG-заглушки существа.
   * @param {object} [phenotype] — фенотип (в фазе 0 игнорируется)
   */
  function renderCreature(phenotype) {
    return (
      '<svg viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="существо (заглушка)">' +
      '<circle cx="50" cy="50" r="35" fill="none" stroke="#d4af37" stroke-width="2" stroke-dasharray="4 4"/>' +
      '<text x="50" y="54" text-anchor="middle" font-size="10" fill="#e8d5b0">заглушка</text>' +
      '</svg>'
    );
  }

  render.creature = {
    /* ===== Экспорты: window.GenoLab.render.creature ===== */
    renderCreature: renderCreature,
  };
})(typeof window !== 'undefined' ? window : globalThis);
