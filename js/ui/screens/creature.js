/* ГеноЛаб — js/ui/screens/creature.js — экран «Карточка существа» (фаза 2).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.ui.screens.creature.
 * В фазе 2 — демо-экземпляр: крупный SVG-рендер (render.creature),
 * кнопка «Секвенировать» (заглушка, стоимость и результат — фаза 3),
 * место под родословную (дерево предков — фаза 4).
 * Вольер с реальными существами — фаза 3 (state/store.js).
 * Разметка — только из внутренних констант (SECURITY.md §4).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  g.ui = g.ui || {};
  g.ui.screens = g.ui.screens || {};

  /* Демо-экземпляр: Aa Bb Cc Dd по признакам вида golo
   * (пары в порядке признаков species.json). */
  var DEMO_PAIRS = [['A', 'a'], ['B', 'b'], ['C', 'c'], ['D', 'd']];

  var screen = {
    name: 'creature',
    render: function (container) {
      var genome = g.core.genome;
      var creature = g.render.creature;
      var gm = genome.createGenome('golo', DEMO_PAIRS);
      var phen = genome.genomeToPhenotype(gm);

      container.innerHTML =
        '<section class="screen" aria-labelledby="screen-title">' +
        '<h1 class="screen__title" id="screen-title">Карточка существа</h1>' +
        '<div class="screen__hint">Демо-экземпляр (вольер с реальными существами — фаза 3).</div>' +
        '<div class="creature__body">' +
        '  <div class="creature__sprite">' + creature.renderCreature(phen, 240) + '</div>' +
        '  <div class="creature__info">' +
        '    <button class="btn btn--primary" id="seq-btn" type="button">Секвенировать</button>' +
        '    <p class="screen__hint" id="seq-result">Генотип скрыт. «Секвенировать» покажет его ' +
        '(стоимость в монетах — фаза 3).</p>' +
        '    <div class="creature__pedigree">' +
        '      <h2>Родословная</h2>' +
        '      <p class="screen__hint">Дерево предков (2 поколения) появится в фазе 4.</p>' +
        '    </div>' +
        '  </div>' +
        '</div>' +
        '</section>';

      /* «Секвенировать» — заглушка фазы 3 (экономика ещё не запущена). */
      var btn = container.querySelector('#seq-btn');
      btn.addEventListener('click', function () {
        var out = container.querySelector('#seq-result');
        out.textContent = 'Секвенирование появится в фазе 3 (стоимость — монеты из панели ресурсов).';
        btn.disabled = true;
      });
    }
  };

  g.ui.screens.creature = screen;

  /* Экран сам регистрируется в роутере (роутер грузится раньше). */
  if (g.router && typeof g.router.register === 'function') {
    g.router.register('creature', screen.render);
  }
})(typeof window !== 'undefined' ? window : globalThis);
