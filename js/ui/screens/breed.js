/* ГеноЛаб — js/ui/screens/breed.js — экран «Скрещивание» (заглушка фазы 0).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.ui.screens.breed.
 * Разметка — только из внутренних констант (SECURITY.md §4).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  g.ui = g.ui || {};
  g.ui.screens = g.ui.screens || {};

  var HTML =
    '<section class="screen" aria-labelledby="screen-title">' +
    '<h1 class="screen__title" id="screen-title">Скрещивание</h1>' +
    '<div class="screen__stub">' +
    '<div>Слоты родителей A / B появятся в фазе 1</div>' +
    '</div>' +
    '</section>';

  var screen = {
    name: 'breed',
    render: function (container) {
      container.innerHTML = HTML;
    }
  };

  g.ui.screens.breed = screen;

  /* Экран сам регистрируется в роутере (роутер грузится раньше). */
  if (g.router && typeof g.router.register === 'function') {
    g.router.register('breed', screen.render);
  }
})(typeof window !== 'undefined' ? window : globalThis);
