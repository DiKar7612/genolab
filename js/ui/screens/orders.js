/* ГеноЛаб — js/ui/screens/orders.js — экран «Заказы» (заглушка фазы 0).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.ui.screens.orders.
 * Разметка — только из внутренних констант (SECURITY.md §4).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  g.ui = g.ui || {};
  g.ui.screens = g.ui.screens || {};

  var HTML =
    '<section class="screen" aria-labelledby="screen-title">' +
    '<h1 class="screen__title" id="screen-title">Заказы</h1>' +
    '<div class="screen__stub">' +
    '<p class="screen__hint">Список из 5 заказов появится в фазе 4</p>' +
    '</div>' +
    '</section>';

  var screen = {
    name: 'orders',
    render: function (container) {
      container.innerHTML = HTML;
    }
  };

  g.ui.screens.orders = screen;

  /* Экран сам регистрируется в роутере (роутер грузится раньше). */
  if (g.router && typeof g.router.register === 'function') {
    g.router.register('orders', screen.render);
  }
})(typeof window !== 'undefined' ? window : globalThis);
