# ГеноЛаб — сводка API (docs/api.md)

Сгенерировано по фазе 4а (Prompts/phase4a_api.md) строго по реальному коду
фаз 1–3; обновлено по фазе 4c (store.setQuests, js/quests/questEngine.js,
стартовые существа). Каждый модуль — классический скрипт (IIFE), экспорты на
namespace `window.GenoLab.*` (ESM-экспортов нет — решение фазы 0).

Дальше этот документ — источник интерфейсов для фаз 4в и 5:
изменять без правки кода запрещено.

Состояние (схема `genolab_save_v1`, валидация — `save.validate`):

```
{
  version: 1,
  enclosure: [ { id: string, species: string, pairs: [[string, string], ...] } ],
  resources: { coins: number >= 0, reputation: number >= 0 },
  quests: {},                    // {completed: [id], progress: {id: number}, ordersDone: [id]} — фаза 4c
  slotLimit: number, 1..24       // целое, предел — config.slots.max
}
```

Начальное состояние (`store.initialState`, фаза 4c): 3 стартовых существа
в вольере — `c1`/`c2` (Aa Bb Cc Dd, гетерозиготы) и `c3` (aa bb cc dd,
чистый рецессив); 0 монет и 0 репутации; `quests: {}`.

---

## js/core/rng.js — `window.GenoLab.core.rng`

| Экспорт | Сигнатура | Описание |
|---|---|---|
| `mulberry32` | `mulberry32(seed: number) => () => number` | Детерминированный ГСЧ с seed; возвращаемая функция выдаёт число из [0, 1) |
| `createRng` | `createRng(seed?: number) => { next, randomInt, pick, chance }` | Фабрика генератора; без seed — `Math.random` (недетерминировано), с seed — mulberry32 |
| `randomInt` | `randomInt(min: number, max: number) => number` | Совместимость с фазой 0: недетерминированное целое в [min, max] (включительно) |
| `pick` | `pick(arr: array) => *` | Совместимость с фазой 0: случайный элемент массива (равновероятно) |
| `chance` | `chance(p: number) => boolean` | Совместимость с фазой 0: true с вероятностью p (0..1) |

Методы объекта, возвращаемого `createRng` (тот же контракт, но на общем ГСЧ):
`next() => number` ([0,1)), `randomInt(min, max) => number`,
`pick(arr) => *`, `chance(p) => boolean`.

---

## js/core/genome.js — `window.GenoLab.core.genome`

| Экспорт | Сигнатура | Описание |
|---|---|---|
| `loadSpecies` | `loadSpecies(url: string) => Promise<{ok: boolean, reason?: string, speciesCount?: number}>` | Загрузка species.json по http:// (по file:// fetch блокируется CORS → `ok:false`, остаётся вшитый конфиг); форму валидирует |
| `getSpecies` | `getSpecies(speciesId: string) => object \| null` | Найти вид в актуальном конфиге (`{id, name, traits[], lifeStages}`) или null |
| `getSpeciesConfig` | `getSpeciesConfig() => object` | Глубокая копия актуального конфига видов (тесты, инспекция) |
| `createGenome` | `createGenome(speciesId: string, pairs: [string, string][]) => {id: string, species: string, pairs: [string, string][]}` | Создать геном; id — `'c' + счётчик` (счётчик сбрасывается при перезагрузке — конфликты разрешает store); бросает `Error` при неверном виде, числе пар или аллелях |
| `validateGenome` | `validateGenome(genome: object) => {ok: boolean, errors: string[]}` | Валидация генома (вид, число пар, аллели по признакам) |
| `genomeToPhenotype` | `genomeToPhenotype(genome: object) => { [traitId: string]: string }` | Фенотип по полному доминированию (хотя бы один доминантный аллель → доминантное значение); бросает `Error` при невалидном геноме |
| `genotypeString` | `genotypeString(genome: object) => string` | Строка генотипа вида `"AaBbCcDd"` (доминантный аллель первым в паре); бросает `Error` при невалидном геноме |

---

## js/core/breeder.js — `window.GenoLab.core.breeder`

| Экспорт | Сигнатура | Описание |
|---|---|---|
| `cross` | `cross(parentA: object, parentB: object, rng?: object) => object[]` | Скрещивание: 1–4 потомка (число — равновероятно из {1,2,3,4}); у каждого потомка по одному равновероятному аллелю от каждого родителя на каждый признак; rng — `{randomInt, pick, chance}` (по умолчанию — `core.rng`); бросает `Error` при невалидных/разновидовых родителях |
| `pennettGrid` | `pennettGrid(parentA: object, parentB: object, traitIds?: string[]) => {traitIds: string[], rows: number, cols: number, cells: Cell[], byGenotype: {[key]: number}, byPhenotype: {[key]: number}}` | Чистая детерминированная решётка (без RNG): 2×2 (1 признак, по умолчанию первый) или 4×4 (2 признака); бросает `Error` при 3+ признаках/неизвестном признаке/невалидных родителях |

Поле `Cell` (элементы `cells`): `{ gameteA: string[], gameteB: string[],
genotype: string, phenotype: string, fraction: number }`; ключи
`byGenotype`/`byPhenotype` — значения признаков через `"|"` (например
`"Aa|Bb"`).

---

## js/core/economy.js — `window.GenoLab.core.economy`

| Экспорт | Сигнатура | Описание |
|---|---|---|
| `CONFIG` | `CONFIG: object` (константа) | Вшитая точная копия `js/data/config.json` (только чтение); правка правил — в обоих местах, рассинхрон ловит T1 `tests/config_test.html` |
| `getConfig` | `getConfig() => object` | Глубокая копия актуального конфига (после возможного `loadConfig`) |
| `loadConfig` | `loadConfig(url: string) => Promise<{ok: boolean, reason?: string}>` | Загрузка config.json по http:// с валидацией формы (`isConfigShape`); по file:// — `{ok:false, reason:'не удалось загрузить: ...'}`, остаётся вшитый |
| `isConfigShape` | `isConfigShape(v: object) => boolean` | Проверка формы конфига: version=1, slots.base/max целые (max>=base), цены sellCreature/buySlot/sequence числа >=0, mutation.enabled булево, mutation.chance 0..1; лишние ключи допускаются |
| `getPrice` | `getPrice(name: string) => number` | Цена действия из актуального конфига; бросает `Error` на неизвестном ключе |

Структура `CONFIG`: `{ version: 1, slots: {base: 12, max: 24},
prices: {sellCreature: 20, buySlot: 100, sequence: 30},
mutation: {enabled: false, chance: 0.03} }`.

---

## js/state/store.js — `window.GenoLab.state.store`

Модуль не знает о DOM (только данные + pub/sub); localStorage — только
через `js/state/save.js`.

| Экспорт | Сигнатура | Описание |
|---|---|---|
| `getState` | `getState() => object` | Глубокая копия состояния (схема `genolab_save_v1`, см. начало файла) |
| `subscribe` | `subscribe(fn: () => void) => () => void` | Подписка на изменения; возвращаемая функция — отписка; бросает `Error` если fn не функция |
| `addCreature` | `addCreature(genome: object) => {ok: boolean, id?: string, reason?: string}` | Добавить в вольер: лимит слотов, `validateGenome`; пустой/конфликтующий id автоматически заменяется следующим свободным `cN` |
| `removeCreature` | `removeCreature(id: string) => {ok: boolean, reason?: string}` | Убрать существо по id |
| `sellCreature` | `sellCreature(id: string) => {ok: boolean, coins?: number, reason?: string}` | Продать: убрать из вольера + `prices.sellCreature` монет |
| `setQuests` | `setQuests(quests: object) => void` | Заменить прогресс квестов целиком (используется `js/quests/questEngine.js`); бросает `Error` на не-объекте |
| `buySlot` | `buySlot() => {ok: boolean, slotLimit?: number, reason?: string}` | Купить слот (цена `prices.buySlot`, предел `slots.max`); списывает монеты |
| `addCoins` | `addCoins(n: number) => number` | Прибавить монеты (может быть отрицательным); возвращает новый баланс; бросает `Error` на не-числе |
| `addReputation` | `addReputation(n: number) => number` | Прибавить репутацию; возвращает новый баланс; бросает `Error` на не-числе |
| `applyState` | `applyState(saved: object) => void` | Заменить состояние целиком (вызывается `save.js` после валидации) |
| `reset` | `reset() => object` | Сброс к начальному состоянию (3 стартовых существа, 0 ресурсов, slotLimit = config.slots.base); возвращает новое состояние |

---

## js/state/save.js — `window.GenoLab.state.save`

Единственный модуль с доступом к localStorage (ключ `genolab_save_v1`,
SECURITY.md §5). Импорт: лимит 1 МБ, только `JSON.parse` + валидация, без
eval (SECURITY.md §6).

| Экспорт | Сигнатура | Описание |
|---|---|---|
| `SAVE_KEY` | `'genolab_save_v1'` | Ключ localStorage (константа) |
| `FILE_NAME` | `'genolab_save_v1.json'` | Имя файла экспорта (константа) |
| `MAX_IMPORT_BYTES` | `1048576` | Лимит импорта — 1 МБ (константа) |
| `DEBOUNCE_MS` | `500` | Задержка автосохранения, мс (константа) |
| `validate` | `validate(obj: object) => {ok: boolean, errors: string[]}` | Валидация объекта сейва по схеме `genolab_save_v1` (version, enclosure — валидные геномы со строковым id, resources — числа >=0, quests — объект, slotLimit целое 1..slots.max) |
| `save` | `save() => boolean` | Записать текущее состояние в localStorage; false при ошибке записи |
| `load` | `load() => object \| null` | Прочитать и применить сейв из localStorage (applyState); повреждённый JSON/схема — null + причина в `errorMessage()`, состояние остаётся чистым; сейвы фазы 3 без поля `quests` принимаются (отсутствующее поле = `{}`) |
| `init` | `init() => void` | load() + подписка на store: автосохранение с debounce 500 мс на каждое изменение |
| `errorMessage` | `errorMessage() => string \| null` | Последняя ошибка сейва (человекочитаемая) или null |
| `exportFile` | `exportFile() => {ok: boolean, filename?: string, bytes?: number, reason?: string}` | Экспорт текущего состояния в JSON-файл (скачивание, 2-пробельный отступ) |
| `importFile` | `importFile(file: File) => Promise<{ok: boolean, reason?: string}>` | Импорт из файла: <=1 МБ, JSON.parse + validate, applyState + save; все ошибки — в `ok:false` с reason |

---

## js/render/creature.js — `window.GenoLab.render.creature`

| Экспорт | Сигнатура | Описание |
|---|---|---|
| `renderCreature` | `renderCreature(phenotype?: object, sizePx?: number, stage?: 'baby' \| 'adult' \| 'old') => string` | Готовый `<svg viewBox="0 0 100 100" role="img" aria-label="...">`: phenotype — `{color, pattern, size, ears}` (пропуски → доминантные), sizePx — 64..320 (клампится, умолчание 160), stage — умолчание 'adult' (параметры — lifeStages вида golo / ART_STYLE.md §6) |
| `describePhenotypeRender` | `describePhenotypeRender(phenotype?: object, stage?: string) => {phenotype: object, stage: string, eyeState: string, modules: string[], colors: {body, belly, outline, pattern, tail, eye}, scale: number}` | Описатель рендера для DOM-тестов: применённые модули, цвета, итоговый масштаб, стадия |
| `mixToGrey` | `mixToGrey(hex: string, t: number) => string` | Линейное смешение цвета с `AGE_GREY` (#cfc6b8) в доле t (0..1, клампится); t=0 — исходный hex |
| `LIMITS` | `{minPx: 64, maxPx: 320, defaultPx: 160}` | Границы размера, px (константа) |
| `SCALES` | `{'крупный': 1.0, 'мелкий': 0.66}` | Масштаб группы по размеру (константа) |
| `STAGES` | `{baby: {...}, adult: {...}, old: {...}}` | Копия параметров стадий по умолчанию (полей: scale, headScale, earTilt, patternOpacity, coatMix, tailDrop, eyeState); в рендере приоритет — `golo.lifeStages` из конфига вида (константа) |
| `EYE` | `{color: '#5f3a22', highlight: '#ffffff', proposed: true}` | Цвет глаз (предложен — §5 его не фиксирует) и блик (константа) |
| `AGE_GREY` | `'#cfc6b8'` | Серо-бежевый цвет старости для mixToGrey (константа) |

`modules` в описателе — подмножество `['tail', 'ears-sharp' \| 'ears-round',
'body-base', 'pattern-stripes', 'body-face']` (порядок сборки).

---

## js/render/pennett.js — `window.GenoLab.render.pennett`

| Экспорт | Сигнатура | Описание |
|---|---|---|
| `renderGrid` | `renderGrid(parentA: object, parentB: object, opts?: {traitIds?: string[], sizePx?: number, pickedIndex?: number}) => {html: string, bind: (container: HTMLElement) => void}` | Разметка решётки 2×2 / 4×4 (доли — через `breeder.pennettGrid`); в каждой ячейке мини-рендер (признаки решётки — по генотипу ячейки, остальные — по родителю A); `bind(container)` — клик по ячейке переносит подсветку и подпись |

`opts.sizePx` — умолчание: 96 для 2×2, 72 для 4×4; `opts.pickedIndex` —
индекс случайно выпавшей клетки (подсветка `is-picked` + подпись
«Выпавшая клетка: ...»).

---

## js/quests/questEngine.js — `window.GenoLab.quests.questEngine`

Движок квестов и заказов (фаза 4c). Данные — `js/data/quests.json`
(5 обучающих квестов + 5 заказов); в `questEngine.js` есть точная
вшитая копия (по `file://` JSON не читается), `loadQuests(url)` по
`http://` подменяет её файлом после валидации формы. Модуль не знает
о DOM: только данные и `state.store`. Прогресс — в `state.quests`
(запись через `store.setQuests`), награды — через `store.addCoins` /
`store.addReputation`.

| Экспорт | Сигнатура | Описание |
|---|---|---|
| `QUESTS_DATA` | `object (только чтение)` | Вшитая исходная копия `js/data/quests.json` (`{version, quests, orders}`) |
| `getQuests` | `getQuests() => {quests: [object], orders: [object]}` | Глубокая копия актуальных данных |
| `loadQuests` | `loadQuests(url: string) => Promise<{ok: boolean, reason?: string}>` | Загрузить данные из файла (`http://`); по `file://` — `{ok:false}`, остаётся вшитая копия |
| `isQuestsShape` | `isQuestsShape(v: object) => boolean` | Валидация формы файла квестов (безопасность) |
| `matchPhenotype` | `matchPhenotype(phen: object, spec: object) => boolean` | Все пары ключ-значение из `spec` равны в `phen` |
| `activeQuestId` | `activeQuestId(qs: object) => string \| null` | Идентификатор активного квеста (линейно: первый невыполненный) или `null` |
| `getProgress` | `getProgress(qs: object, questId: string) => {have: number, need: number, done: boolean}` | Счётчик цели квеста (`have` не превышает `need`) |
| `isOrderDone` | `isOrderDone(qs: object, orderId: string) => boolean` | Выполнен ли заказ |
| `getActive` | `getActive() => {quest: object \| null, progress: object \| null}` | Активный квест с прогрессом (читает `state.store`) |
| `listOrders` | `listOrders() => [{id, title, phen, reward, done, match: string \| null}]` | Заказы со статусом; `match` — id первого подходящего существа в вольере |
| `onOffspring` | `onOffspring(phen: object) => {changed: boolean, completed: object \| null, reason?: string}` | Событие: получен потомок; засчитывает цель `offspring`, выдаёт награду |
| `onSequenced` | `onSequenced(phen: object) => {changed: boolean, completed: object \| null, reason?: string}` | Событие: секвенировано существо; засчитывает цель `sequence` |
| `completeOrder` | `completeOrder(orderId: string) => {ok: boolean, reward?: object, questCompleted?: object \| null, reason?: string}` | Награда за заказ + отметка; если цель активного квеста — `order`, квест завершается (награда его тоже начисляется); передачу существа выполняет вызывающий экран |
