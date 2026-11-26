/* ГеноЛаб — js/ui/screens/breed.js — экран «Скрещивание» (фаза 2).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.ui.screens.breed.
 * В фазе 2 — интерактивная решётка Пеннета (render.pennett) для двух
 * демо-родителей: 2×2 (1 признак) или 4×4 (2 признака), случайная
 * подсветка выпавшей клетки, клик по клетке. Выбор родителей из
 * вольера, анимация и потомки — фаза 4 (state/store.js).
 * Разметка — только из внутренних констант (SECURITY.md §4).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  g.ui = g.ui || {};
  g.ui.screens = g.ui.screens || {};

  /* Демо-родители (пары в порядке признаков вида golo). */
  var PARENT_A_PAIRS = [['A', 'a'], ['B', 'b'], ['C', 'C'], ['D', 'd']];
  var PARENT_B_PAIRS = [['A', 'A'], ['B', 'b'], ['C', 'c'], ['D', 'D']];

  var screen = {
    name: 'breed',
    render: function (container) {
      var genome = g.core.genome;
      var creature = g.render.creature;
      var pennett = g.render.pennett;
      var parentA = genome.createGenome('golo', PARENT_A_PAIRS);
      var parentB = genome.createGenome('golo', PARENT_B_PAIRS);
      var phenA = genome.genomeToPhenotype(parentA);
      var phenB = genome.genomeToPhenotype(parentB);
      var state = { traitIds: ['color', 'pattern'] };

      container.innerHTML =
        '<section class="screen" aria-labelledby="screen-title">' +
        '<h1 class="screen__title" id="screen-title">Скрещивание</h1>' +
        '<div class="screen__hint">Демо-родители (выбор из вольера — фаза 4).</div>' +
        '<div class="breed__parents">' +
        '  <div class="breed-slot">' +
        '    <div class="breed-slot__sprite">' + creature.renderCreature(phenA, 96) + '</div>' +
        '    <div class="breed-slot__label">Родитель A</div>' +
        '  </div>' +
        '  <div class="breed__plus">×</div>' +
        '  <div class="breed-slot">' +
        '    <div class="breed-slot__sprite">' + creature.renderCreature(phenB, 96) + '</div>' +
        '    <div class="breed-slot__label">Родитель B</div>' +
        '  </div>' +
        '</div>' +
        '<div class="breed__actions">' +
        '  <button class="btn" id="grid-1t" type="button">Решётка 2×2 (окрас)</button>' +
        '  <button class="btn" id="grid-2t" type="button">Решётка 4×4 (окрас × узор)</button>' +
        '  <button class="btn" id="grid-reroll" type="button">Переснять клетку</button>' +
        '</div>' +
        '<div class="breed__result" id="pennett-area"></div>' +
        '</section>';

      var area = container.querySelector('#pennett-area');

      function draw() {
        var grid = g.core.breeder.pennettGrid(parentA, parentB, state.traitIds);
        var picked = g.core.rng.randomInt(0, grid.cells.length - 1);
        var out = pennett.renderGrid(parentA, parentB, {
          traitIds: state.traitIds,
          pickedIndex: picked,
          sizePx: state.traitIds.length > 1 ? 72 : 96
        });
        area.innerHTML = out.html;
        out.bind(area);
      }

      container.querySelector('#grid-1t').addEventListener('click', function () {
        state.traitIds = ['color'];
        draw();
      });
      container.querySelector('#grid-2t').addEventListener('click', function () {
        state.traitIds = ['color', 'pattern'];
        draw();
      });
      container.querySelector('#grid-reroll').addEventListener('click', draw);

      draw();
    }
  };

  g.ui.screens.breed = screen;

  /* Экран сам регистрируется в роутере (роутер грузится раньше). */
  if (g.router && typeof g.router.register === 'function') {
    g.router.register('breed', screen.render);
  }
})(typeof window !== 'undefined' ? window : globalThis);
