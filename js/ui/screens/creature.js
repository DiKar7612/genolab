/* ГеноЛаб — js/ui/screens/creature.js — экран «Карточка существа» (заглушка фазы 0).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.ui.screens.creature.
 * Разметка — только из внутренних констант (SECURITY.md §4).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  g.ui = g.ui || {};
  g.ui.screens = g.ui.screens || {};

  var HTML =
    '<section class="screen" aria-labelledby="screen-title">' +
    '<h1 class="screen__title" id="screen-title">Карточка существа</h1>' +
    '<div class="screen__stub">' +
    '<div class="creature__sprite">Существо — фаза 2 (SVG из assets/parts/)</div>' +
    '</div>' +
    '</section>';

  var screen = {
    name: 'creature',
    render: function (container) {
      container.innerHTML = HTML;
    }
  };

  g.ui.screens.creature = screen;

  /* Экран сам регистрируется в роутере (роутер грузится раньше). */
  if (g.router && typeof g.router.register === 'function') {
    g.router.register('creature', screen.render);
  }
})(typeof window !== 'undefined' ? window : globalThis);
