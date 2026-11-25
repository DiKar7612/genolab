/* ГеноЛаб — js/ui/screens/enclosure.js — экран «Вольер» (заглушка фазы 0).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.ui.screens.enclosure.
 * Разметка — только из внутренних констант (SECURITY.md §4).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  g.ui = g.ui || {};
  g.ui.screens = g.ui.screens || {};

  var HTML =
    '<section class="screen" aria-labelledby="screen-title">' +
    '<h1 class="screen__title" id="screen-title">Вольер</h1>' +
    '<div class="screen__stub">' +
    '<span class="screen__hint">Вольер: 12 слотов. Занято: 0 / 12 (фаза 1)</span>' +
    '</div>' +
    '</section>';

  var screen = {
    name: 'enclosure',
    render: function (container) {
      container.innerHTML = HTML;
    }
  };

  g.ui.screens.enclosure = screen;

  /* Экран сам регистрируется в роутере (роутер грузится раньше). */
  if (g.router && typeof g.router.register === 'function') {
    g.router.register('enclosure', screen.render);
  }
})(typeof window !== 'undefined' ? window : globalThis);
