# Фаза 7a — Мутации

Работа в F:\genolab. Прочитай genolab_tz.md. Сохрани задание в Prompts/phase7a_mutations.md.

## 0. Исправь genolab_tz.md §9 7a

Мутации реализуются в НОВОМ модуле js/core/mutation.js; genome.js и breeder.js НЕ размораживаются (cross остаётся чистым менделизмом). Заменяй критерий «chance=1 — фенотипы потомков совпадают с моделью aa×aa» на правильный из пункта 3.

## 1. Конфиг

В config.json И в вшитом CONFIG в economy.js: mutation.enabled: true, chance: 0.03. T1 identity-тест (http://) остаётся PASS.

## 2. js/core/mutation.js (новый)

IIFE, GenoLab.core.mutation:

- flipGenome(genome, rng, {enabled, chance}) → новый геном. Каждый аллель
  флипается с вероятностью chance (A↔a, B↔b, C↔c, D↔d).
- Только rng из js/core/rng.js (создаёт экран/тест, передаёт в flipGenome).
- Результат проходит validateGenome.
- Регистрация в ОБЕИХ режимах загрузки: манифест main.js И цепочка index.html
  (ловушка фазы 4c). Обновить docs/api.md.

## 3. UI (js/ui/screens/breed.js)

- После cross() и ДО addCreature: если getMutation().enabled — flipGenome
  каждого потомка; бейдж «мутация» у потомков с ≥1 флипом.
- questEngine.onOffspring вызывается с фенотипом ПОСЛЕ флипа.

## 4. Счётчик

store.mutations {total} — +1 за каждого мутировавшего потомка;
save.js — мягкая деградация (нет поля = {total:0}); версия схемы
genolab_save_v1 не меняется.

## 5. tests/mutation_test.html (новый, classic scripts, file://)

- T1: chance=1, фиксированный seed → все 8 аллелей флипнуты.
- T2: chance=0 → геном идентичен, вход не мутируется.
- T3: 10 000 геномов × 8 аллелей, chance=0.03 → ~2400 флипов ±5%.
- T4: 10 000 сфлипнутых геномов → validateGenome ok у всех.
- T5: чистота cross: мутации вне cross, grid-RNG cross() не расходуется.

## 6. E2E (http:// и file://)

- Обычное скрещивание при chance=0.03 работает, счётчик растёт.
- Детерминированная проверка бейджа через Runtime.evaluate: временно
  chance=1 → скрещивание → у потомков бейдж → вернуть 0.03 → reload.
- Предсказатель не меняется (сравнивает с теорией pennettGrid, не с
  фактическими потомками).

## 7. Регрессия

5 тестовых страниц PASS по http:// (genome/breeder — код не менялся),
file:// смоук 6 маршрутов + скрещивание + персистентность,
node --check всех затронутых файлов.

## 8. LOG.md по протоколу, скриншоты с путями, коммит после приёмки

Не трогать: genome.js, breeder.js, render/*, save.js (кроме мягкой
деградации mutations).
