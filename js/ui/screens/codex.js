/* ГеноЛаб — js/ui/screens/codex.js — экран «Кодекс» (заглушка фазы 0).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.ui.screens.codex.
 * Разметка — только из внутренних констант (SECURITY.md §4).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  g.ui = g.ui || {};
  g.ui.screens = g.ui.screens || {};

  var HTML =
    '<section class="screen" aria-labelledby="screen-title">' +
    '<h1 class="screen__title" id="screen-title">Кодекс</h1>' +
    '<div class="screen__stub">' +
    '<p class="screen__hint">Таблица фенотипов появится в фазе 4</p>' +
    '</div>' +
    '</section>';

  var screen = {
    name: 'codex',
    render: function (container) {
      container.innerHTML = HTML;
    }
  };

  g.ui.screens.codex = screen;

  /* Экран сам регистрируется в роутере (роутер грузится раньше). */
  if (g.router && typeof g.router.register === 'function') {
    g.router.register('codex', screen.render);
  }
})(typeof window !== 'undefined' ? window : globalThis);
