# LOG_1.1.md — журнал версии 1.1 (активный)

Ведётся по протоколу LOGGING.md. Выжимка MVP (фазы 0–6) — LOG_1.md
(только чтение). Полный журнал MVP до разделения — git-история
файла LOG.md (удалён из репозитория, история в git).
Записи добавляются в конец, редактирование запрещено.


## [Фаза 7a] 2026-11-27 15:26 — Мутации (ТЗ §9 7a)
- Суть: мутации ВНЕ cross() — новый модуль js/core/mutation.js;
  js/core/genome.js и js/core/breeder.js НЕ размораживались (чистый
  менделизм сохраняется, разморозка — в фазе 7b).
- Файлы:
  - js/core/mutation.js (новый): flipGenome(genome, rng, {enabled, chance})
    → {genome, flipped}; каждый из 8 аллелей независимо флипается (A↔a и т.д.)
    с вероятностью chance на переданном ГСЧ; вход не мутируется (deepCopy),
    id/species сохраняются; chance=0 / enabled=false → идентичность и ГСЧ
    не расходуется; бросает Error на мусоре (не-объект, нет rng.next,
    chance вне 0..1)
  - js/data/config.json + вшитая CONFIG в js/core/economy.js (оба места):
    mutation.enabled: false → true (chance 0.03); T1 identity — зелёный
  - js/core/economy.js: новый экспорт getMutation() → {enabled, chance}
  - js/main.js (модульный режим) + index.html __genolabManifest (классический,
    теперь 21 файл): регистрация js/core/mutation.js после economy.js
  - js/state/store.js: initialState.mutations = {total: 0}; applyState —
    мягкая деградация (мусорная форма = {total: 0}); новый экспорт
    recordMutations(n) — целое >= 0, иначе Error
  - js/state/save.js: load()/importFile() — нет поля mutations в сейвах
    до фазы 7a → {total: 0}; validate() — при наличии mutations проверяет
    {total: целое >= 0}; версия схемы genolab_save_v1 НЕ менялась
  - js/ui/screens/breed.js: после cross() — flipGenome на каждого потомка
    (отдельный ГСЧ createRng(Date.now()), ГСЧ скрещивания не расходуется);
    questEngine.onOffspring получает фенотип ПОСЛЕ флипа; store.recordMutations
    за каждого мутировавшего; бейдж «мутация» в ленте потомков; строка
    статистики «Шанс мутации: N%» (из getMutation) + «Мутаций: K»
  - tests/mutation_test.html (новый, классический, file://): T1 chance=1 →
    все 8 аллелей инвертированы (Aa→aA, aa→AA); T2 chance=0/enabled=false →
    идентичность + вход не мутируется; T3 10 000 геномов × 8 аллелей,
    chance=0.03 → ~2400 флипов ±5%; T4 чистота (cross с тем же seed одинаков
    до/после флипа на отдельном ГСЧ; chance=0 не расходует ГСЧ);
    T5 validateGenome(результат) + id/species + 3 ошибки на мусоре
  - docs/api.md: раздел js/core/mutation.js, строки getMutation/recordMutations/
    recordPrediction, описание мягкой деградации в save.js
- Запуск и проверка (chrome-devtools MCP, http://127.0.0.1:8321, python http.server):
  - node --check — все изменённые js-файлы — синтаксис OK; node-смоук
    flipGenome: chance=1 → flipped=8, chance=0 → идентичность, 80 000
    испытаний chance=0.03 → 2412 флипов (отклонение 0.50%)
  - mutation_test.html (file://): PASS (5/5)
  - Регрессия: config_test (http://) PASS (5/5, T1 identity после смены
    конфига), genome PASS (8 PASS, 1 SKIP), breeder PASS (9/9),
    render_grid PASS (11/11), quests_test PASS (6 PASS, 1 SKIP) — 0 FAIL
  - E2E бейджа (http://, #/breed): override getMutation → chance=1, c1×c3 →
    1 потомок с бейджем «мутация», счётчик Мутаций 0 → 1, строка «Шанс
    мутации: 100%»; скриншот docs/screenshots/phase7a_breed_badge.png;
    скриншот теста docs/screenshots/phase7a_mutation_test.png
  - Смоук file:// (index.html, классический режим): GenoLab.core.mutation
    существует (manifest 21 файл), state.mutations = {total: 0}, экран
    отрендерен — PASS
  - Консоль http://: 0 сообщений
- Что НЕ сделано / НЕ проверено:
  - Реальная частота бейджей при chance=0.03 в долгих сессиях (в E2E
    проверялся детерминированный случай chance=1)
  - Предсказатель (pennett) не менялся и сравнивается с теоретической
    решёткой — мутации на него не влияют по построению (проверка T4 —
    только на уровне чистоты ГСЧ)
- Файлы вне задания: js/core/genome.js, js/core/breeder.js (заморожены —
  не трогал), js/render/*, tests/* (кроме нового mutation_test.html)
- Коммит: выполнен (явное разрешение пользователя), см. строку ниже

## [Фаза 7a / приёмка] 2026-11-27 15:28 — Коммит
- Коммит 2325677 «Фаза 7a: мутации — js/core/mutation.js (flipGenome вне
  cross), UI-бейдж и счётчик, мягкая деградация сейва,
  tests/mutation_test.html 5/5» (14 файлов, +212/−24, новые:
  js/core/mutation.js, tests/mutation_test.html, docs/screenshots/×2,
  Prompts/phase7a_mutations.md)

## [Фаза 7a / доводки] 2026-11-27 15:39 — правка ТЗ §9, разделение журнала, E2E предсказателя, регрессия по http://
- Что сделано:
  - genolab_tz.md §9: преамбула — «мутации реализуются отдельным модулем
    js/core/mutation.js; genome.js и breeder.js остаются заморожены;
    разморозка потребуется только в 7b (неполное доминирование)»;
    критерий 7a «chance=1 → фенотипы Aa×Aa совпадают с рецессивной
    моделью» уже исправлен в прошлой итерации (a3a441a): chance=1 → все
    аллели перевёрнуты (aa→AA, Aa→aA, фенотип гетерозиготы сохраняется),
    chance=0 → геном идентичен исходному
  - Разделение журнала: LOG_1.md (выжимка MVP, текст пользователя,
    восстановлен дословно и добавлен), LOG_1.1.md (активный — записи 7a
    перенесены копированием из LOG.md, LOG.md не редактировался),
    LOGGING.md — раздел «Версионирование журнала» (таблица файлов,
    правило создания LOG_<версия>.md, правило выжимки), LOG.md — git rm
    (полная история в git: git show <коммит>:LOG.md)
  - E2E предсказателя при включённых мутациях (http://, chance=0.03
    включён): c1 (AaBbCcDd) × c3 (aabbccdd), цель — коричневый/полосатый/
    крупный/острые, прогноз 6,25% → факт (теоретическая pennettGrid)
    6,25% — ПоПАДАНИЕ; разбор: 2/4 = 50% по каждому признаку,
    50%×50%×50%×50% = 6,25%; «Проверено по решётке Пеннета»; счётчик
    точности 2/2 → 3/3; независимая проверка pennettGrid по признакам
    (2/4 для color/pattern/size/ears) — совпадает. Мутации на факт не
    влияют по построению (сверка с теорией, не с потомками)
  - Регрессия ВСЕХ 6 тестовых страниц по http:// (python http.server
    127.0.0.1:8321): config_test PASS (5/5), genome PASS (9 PASS —
    identity T1 PASS, не SKIP), breeder PASS (9/9), mutation_test
    PASS (5/5), render_grid PASS (11/11), quests_test PASS (7 PASS —
    identity T1 PASS, не SKIP) — ИТОГ: 6/6 страниц, 0 FAIL
- Запуск и проверка: chrome-devtools MCP, http://127.0.0.1:8321,
  вердикты — фактический текст страниц (см. выше); консоль приложения:
  0 ошибок (только известная a11y-подсказка DevTools про id/name
  полей форм)
- Что НЕ сделано / НЕ проверено: скриншот E2E предсказателя на диск
  не сохранялся (MCP отдал inline-изображение; в журнале — точные
  числа); реальные (не теоретические) потомки с мутациями в
  сравнении с предсказателем — по построению не сравниваются
  (TZ: предсказатель сверяется с pennettGrid)
- Файлы вне задания: не трогал
- Блокеры: нет

## [Фаза 7b] 2026-11-27 16:10 — разведка (п. 0), до правок кода
- 0а) cross(): фенотипы не использует (только аллели) — разморозка не
  нужна. pennettGrid(): ХАРдкод полного доминирования на ключ фенотипа
  клетки — `(a === t.dominant || b === t.dominant) ? values[dom]
  : values[rec]` (js/core/breeder.js, ~строка 105). genomeToPhenotype
  в breeder.js нигде не вызывается. → breeder.js РАЗМораживается
  минимально: ключ фенотипа клетки — с учётом model признака.
- 0б) Места, где «коричневый» ожидается от гетерозиготы:
  - js/quests/questEngine.js (вшитая QUESTS_DATA) + js/data/quests.json:
    q1 (2 коричневых потомка), q2 (секвенировать 1 коричневого),
    o1 (заказ «детёныш с коричневым окрасом»); ТЕКСТЫ q1/q2 после 7b
    становятся фактологически неверными («коричневый доминантный:
    проявляется, если хотя бы один A»; «гетерозигота выглядит как AA»)
    — менять тексты без разрешения не буду, докладываю
  - tests/breeder.test.html: T1/T2 (классификация A_ у окраса), T7
    (pennettGrid Aa×Aa → коричневый 0.75), T8 (Aa×Aa 4×4 окрас×узор
    → 9:3:3:1 с коричневым 9/16)
  - tests/genome.test.html: T6/T7 (расщепление по окрасу 3:1, 1:1),
    T8 (9:3:3:1 окрас×узор)
  - js/state/store.js: только комментарий о стартере («классическое
    расщепление 3:1»); сам стартер c1/c2 (Aa) после 7b будет
    РИСОВАТЬСЯ палевым (визуальное изменение стартового вольера)
  - matchPhenotype (questEngine) — строчное сравнение, модель-агностичен
    — не трогать
  - js/ui/screens/predictor.js: селекторы целей окраса хардкодят только
    values[dom]/values[rec] → «палевый» недоступен как цель —
    минимальная правка: добавить опцию гетерозиготы для incomplete
  - pennett.js (render) — только комментарий, без хардкода фенотипов
- 0в) Достижимость при новой модели (статика, стартер c1/c2 = AaBbCcDd,
  c3 = aabbccdd; коричневый теперь = только AA):
  - q1 (2 коричневых): P(AA) = 1/4 на потомка от c1×c2 (было 3/4) —
    достижимо, но ~3 раза реже
  - q2 (1 коричневый, секвенирование): то же 1/4 — достижимо, реже
  - q3 (1 белый): aa = 1/4 — без изменений
  - q4 (3 круглых уха): dd = 1/4 — без изменений (уши — полное домин.)
  - q5 (1 заказ любой): см. заказы
  - o1 (коричневый): 1/4 (было 3/4) — реже; o2 (полосатый): 3/4 —
    без изменений; o4 (крупный+острые): 9/16 — без изменений;
    o3 (мелкий+белый): 1/16 — без изменений; o5 (мелкий+белый+круглые):
    1/64 — без изменений
  - ИТОГ: ни один квест/заказ не становится недостижимым; q1/q2/o1
    стали ~3 раза реже — ДОКЛАДЫВАЮ пользователю, решение за ним
    (тексты квестов не меняю)
- Имя гетерозиготы: оставляю согласованное «палевый» (устоявшийся
  термин окраса у животных, точнее «золотистый» для контекста).
  Палитра: из тёплого ряда ART_STYLE §5 есть подходящий hex —
  #c98a5b (тёплый золотисто-бежевый, между коричневым #b06a3f и белым
  #d9c2a3) → предлагаю: тело #c98a5b, животик #e8cfae (светлая стадия
  §5), контур #8f5a3c (тёплый ряд), узор #7a4a2b (ряд узоров §5),
  хвост #b06a3f (тёплый ряд). Запасной вариант: тело #c98a5b,
  животик #e0b184, остальное то же. Беру основной, оба в докладе.

## [Фаза 7b] 2026-11-27 16:27 — Неполное доминирование окраса: реализация (p.1–p.6)

- Что сделано (по шагам Prompts/phase7b_incomplete.md):
  - p.1 Конфиг в обоих местах: js/data/species.json и вшитый SPECIES в
    js/core/genome.js — признак color: model "complete-dominance" →
    "incomplete", values + "Aa": "палевый" (гетерозиготный фенотип).
    Остальные 3 признака — без изменений (полное доминирование).
  - p.2 js/core/genome.js (разморожен для 7b): genomeToPhenotype — для
    incomplete-признака гетерозигота → values[dom+rec] («палевый»),
    гомозиготы — как раньше; isSpeciesConfig — для incomplete обязателен
    строковый values[dom+rec]; заметка о разморозке в шапке.
  - p.3 js/core/breeder.js (разморожен для 7b): phenoKeys в pennettGrid —
    для incomplete гетерозиготная клетка → values[dom+rec]; заметка в шапке.
    cross()/gametes() не тронуты (Мендель — на уровне аллелей).
  - p.4 js/render/creature.js: PALETTES + «палевый» (тело #c98a5b,
    животик #e0b184, контур #8f5a3c, узор #7a4a2b, хвост #b06a3f —
    запасной вариант из разведки p.0, hex только из рядов §5 ART_STYLE).
    describePhenotypeRender — data-driven, правка не требовалась.
  - p.4 js/ui/screens/predictor.js: для incomplete-признака в селекторе
    целей — третья опция (гетерозиготный фенотип), для полных признаков
    интерфейс не изменился.
  - p.4 tests/render_grid.html: переписан под 24 комбинации (3 окраса ×
    2 узора × 2 размера × 2 ушей); сетка 6×4 (мобильная 3×8); проверки
    12 шт. (24 уникальных SVG, 24 уникальных описателя, совпадение
    модулей/заливки #c98a5b/масштаба, viewBox/clamp, стадии, mixToGrey,
    T10 — палевый Aa рендерится между AA и aa).
  - p.5 tests/breeder.test.html: переписан, 12 тестов. T1–T3 — полное
    доминирование сохранено (Bb×Bb узор 3:1, Bb×bb узор 1:1,
    BbCc×BbCc узор×размер 9:3:3:1); T4–T6 — структура/аллели/seed;
    T7–T9 — окрас неполное (Aa×Aa 1:2:1, Aa×aa 1:1 палевый:белый,
    AA×Aa 1:1 коричневый:палевый); T10–T12 — pennettGrid точные доли
    (1:2:1, 9:3:3:1) и чистота (не расходует ГСЧ).
  - p.5 tests/genome.test.html: T1 — проверка model=incomplete у окраса
    и стринговости values['Aa']; T4 — 24 случая (3 полных признака × 4
    генотипа = 12 + окрас × 4 генотипа × 3 фона = 12); T6 — Aa×Aa 1:2:1;
    T7 — Aa×aa 1:1 палевый:белый; T8 — 9:3:3:1 перецеплен на узор×размер
    (BbCc×BbCc), т.к. у дигибрида с окрасом расщепление 9:3:3:1 не
    ожидается.
  - p.5 tests/quests_test.html: T6 — o1 (коричневый) в стартовом вольере
    больше не совпадает с c1 (Aa теперь палевый): ожидается match=null;
    комментарий про стартер обновлён.
  - p.6 Достаточность квестов/заказов: см. разведку p.0в выше — все 5
    квестов и 5 заказов достижимы (q1/q2/o1 ~3 раза реже: AA = 1/4).
    Тексты квестов не менял — на согласовании у пользователя.
- Запуск и проверка (python http.server, порт 8321, Chrome DevTools MCP,
  страница http://localhost:8321/tests/…):
  - breeder.test.html: ОБЩИЙ ВЕРДИКТ: PASS (12/12). Фактические доли
    (10 000 скрещиваний, seeds из теста): T7 Aa×Aa — коричневый 24.63% /
    палевый 50.47% / белый 24.90% (ожидалось 25/50/25, отклонение ≤0.5 п.п.);
    T8 Aa×aa — палевый 50.51% / белый 49.49% (ожидалось 50/50);
    T9 AA×Aa — коричневый 50.27% / палевый 49.73%. T10 pennettGrid Aa×Aa
    (окрас) — точные 0.25 / 0.5 / 0.25.
  - genome.test.html: ОБЩИЙ ВЕРДИКТ: PASS (9 PASS).
  - config_test.html: PASS (5/5) — вшитый конфиг == config.json.
  - mutation_test.html: PASS (5/5) — регрессия 7a.
  - render_grid.html: PASS (12/12); проверено и на узкой ширине (485px,
    мобильная сетка 3 колонки) — PASS (12/12), горизонтального скролла нет.
  - quests_test.html: PASS (7 PASS) — включая T6 с новым ожиданием o1.
  - ИТОГ регрессии: 6/6 страниц, 0 FAIL.
  - node --check: js/core/genome.js, js/core/breeder.js, js/render/creature.js,
    js/ui/screens/predictor.js — синтаксис валиден.
- Что НЕ сделано / НЕ проверено:
  - Визуальный осмотр рендера «палевым» через скриншот не делал (проверено
    DOM-проверками render_grid: уникальность SVG, hex залипки, getBBox).
  - Полный UI-прогон index.html (скрещивание в интерфейсе, предсказатель
    с целью «палевый») вручную не кликал — логика покрыта модульными
    тестами (breeder 12/12, render_grid 12/12).
- Файлы вне задания: не трогал.
- Блокеры: нет. Ожидаю приёмки; коммит — после приёмки.

## [Фаза 7d] 2026-11-27 17:15 — Разведка (п. 0), до правок кода
- Что сделано: только чтение файлов (см. ниже); правки кода не вносились.
  Решения пользователя (Prompts/phase7d_species.md, блок [ЗАПОЛНИТЬ]):
  вид — «Нокт» (id noct), облик — круглый, большие уши, короткий хвост;
  один новый признак — свечение E/e, полное доминирование, E — светящееся
  (тёплый мёд #e8c76f, feGaussianBlur); только заказы нового вида
  (без новых квестов).
- а) Перечень жёстко прописанных ссылок на 'golo' и данных вида:
  1. js/data/species.json — единственный вид golo (4 признака, lifeStages).
  2. js/core/genome.js — встроенная копия SPECIES (1 вид, ~строки 31–66);
     шапка «один вид»; getSpecies/getSpeciesConfig/isSpeciesConfig/
     validateGenome/createGenome — уже динамичны по speciesId и числу
     признаков, менять не нужно.
  3. js/state/store.js строки 34–36 — starterCreatures: c1, c2 (AaBbCcDd),
     c3 (aabbccdd), все golo. Нокта игрок получить не может (скрещивание —
     только из вольера). Решение: добавить стартеров c4, c5 (noct Ee × Ee —
     расщепление 3:1 в E2E).
  4. js/render/creature.js — renderCreature(phen, px, stage) и
     describePhenotypeRender(phen, stage) БЕЗ вида; весь сбор — golo
     (хвост→уши→корпус→полосы→морда); stageFor() — getSpecies('golo')
     (строка ~104); PALETTES — по окрасу golo.
  5. js/ui/screens/enclosure.js:43 — renderCreature(phen, 96) без вида;
     sp.name в заголовке карточки уже динамичен (getSpecies(c.species));
     фильтра по виду нет — добавить.
  6. js/ui/screens/creature.js:37 — optionsHTML: getSpecies('golo')
     (подписи по признакам golo для всех существ); :91 renderCreature без
     вида.
  7. js/ui/screens/breed.js — slotOptions: все существа вольера без
     фильтра по виду (нет UI-гарда); :106,:136 renderCreature(phen, 96)
     без вида.
  8. js/ui/screens/predictor.js:44 — species() = getSpecies('golo')
     (цели по признакам golo); селекторы родителей — все существа.
  9. js/ui/screens/orders.js:39 — species() = getSpecies('golo')
     (phenLabel и filterOptionsHTML — только признаки golo).
  10. js/quests/questEngine.js — QUESTS_DATA (встроенная копия
     quests.json): у заказов нет поля вида; listOrders (строки 352–367) —
     matchPhenotype по подмножеству ключей spec, вида не проверяет.
     Разные id признаков ('glow' у noct) дают естественную изоляцию, но
     добавим явное поле species у заказов + проверку в listOrders
     (обратная совместимость: нет species в данных → любой вид).
  11. js/state/save.js:58 — validateGenome (genome.js) требует известного
     вида — менять не нужно.
  12. js/render/pennett.js:100 — renderCreature(ph, sizePx) без вида
     (спрайты клеток); renderGrid получает родителей — вид можно передать.
  13. index.html / js/main.js — списка видов нет, новых модулей не
     появляется — менять не нужно.
  14. Тесты: tests/render_grid.html (только golo, 24 комбо),
     tests/breeder.test.html, tests/genome.test.html (T? — тождество
     species.json и вшитой копии — автоматически проверит и noct),
     tests/quests_test.html — регрессия, должны остаться зелёными.
- б) ТЗ §9 7d: «Скрещивание между видами запрещено (breeder возвращает
  ошибку)» — уже реализовано в js/core/breeder.js (checkBoth бросает
  Error при разных видах). ТЗ §4 (интерфейс) видов не упоминает.
  Промт п. 3: UI-гард в breed.js (второй селектор показывает только вид
  выбранного первого родителя) + ошибка при обходе (движковый checkBoth).
- Решения по рендеру: renderCreature(phen, px, stage, speciesId) и
  describePhenotypeRender(phen, stage, speciesId) — 4-й/3-й опциональные
  аргументы, дефолт 'golo' (обратная совместимость всех вызовов).
  Части noct: tail (короткий), ears (большие), body (круглый), glow
  (свечение, feGaussianBlur) — файлы assets/parts/noct-*.svg + вшитая
  копия (по образцу golo, assets/parts/README.md).
- Запуск и проверка: только чтение (cat/grep/sed); команды запуска
  не требовались. node --check на изменённых файлах — после правок.
- Что НЕ сделано / НЕ проверено: весь код фазы 7d (следующие записи).
- Файлы вне задания: не трогал.
- Блокеры: нет.

---

## Фаза 7d — «Второй вид» (Нокт): реализация и приёмка — 2026-11-27
- Что сделано (шаги 1–7 Prompts/phase7d_species.md):
  1. Вид «noct» добавлен в js/data/species.json И вшитую копию SPECIES в
     js/core/genome.js (облик: круглый, большие уши, короткий хвост;
     признак glow E/e, полное доминирование, E — светящееся, тёплый мёд
     #e8c76f через feGaussianBlur; 3 lifeStages).
  2. Рендер: js/render/creature.js — ветка noct (buildPartsNoct: tail →
     ears → body → glow (только при «светящееся») → face; coatMix серым;
     aria-label «Нокт: …»), 4-й аргумент speciesId в renderCreature и
     describePhenotypeRender (дефолт 'golo', поле species в возвращаемом
     описании). Канонические SVG: assets/parts/noct-{tail,ears,body,
     glow}.svg + README. Все вызовы renderCreature в UI/pennett.js
     передают вид.
  3. Запрет межвидового: UI-гард в js/ui/screens/breed.js (второй
     селектор — только вид первого родителя; «Случайно» группирует по
     видам; startCross отклоняет разнородных) + движковый checkBoth
     (breeder.js) как второй рубеж.
  4. Фильтр «Вид» в вольере (js/ui/screens/enclosure.js + CSS
     .enclosure__filter); ярлык вида на карточках всех экранов.
  5. Заказы: o6 (светящийся Нокт, 80/2) и o7 (Нокт без свечения, 120/2)
     в js/data/quests.json + вшитая QUESTS_DATA (questEngine.js);
     listOrders фильтрует по species (нет поля — любой вид). Стартеры
     store.js: +c4, c5 (noct Ee).
  6. Предсказатель (js/ui/screens/predictor.js): динамический вид из
     родителя A, пересборка целевых признаков при смене вида, warning
     при разнородных родителях.
  7. Сейв: схема genolab_save_v1 не менялась — validate() принимает
     noct (проверено: 0 ошибок, 7 noct-существ в сейве после
     скрещивания).
- Запуск и проверка (python -m http.server 8321, Chrome DevTools MCP,
  cache-bust ignoreCache):
  - tests/genome.test.html — PASS (10/10), включая T9a (валидация и
    фенотип noct) и T1 (2 вида в species.json ≡ вшитой копии).
  - tests/breeder.test.html — PASS (14/14), включая T13 (межвидовый
    cross → Error) и T14 (noct Ee×Ee → 3:1).
  - tests/render_grid.html — PASS (14/14), включая T11 (glow-фильтр
    #e8c76f только у EE/Ee, 3 стадии различаются) и T12
    (describePhenotypeRender: species 'noct', glow #e8c76f / null).
  - tests/quests_test.html — PASS (7/7), T6: 7 заказов, o6→c4, o7→null.
  - tests/mutation_test.html — PASS (5/5).
  - tests/config_test.html — PASS (5/5).
  - Приложение (index.html, чистый старт): вольер 5/12 с фильтром видов
    (Нокт → только c4/c5), скрещивание c4×c5 → 3 потомка noct в вольере,
    заказы (7 шт., фильтры признаков с noct, ярлык «Вид: Нокт»),
    предсказатель (таргеты noct, Ee×ee прогноз 50% → «1 из 1 (100%)»),
    карточка c4 — SVG 240px с aria-label «Нокт: светящееся, стадия:
    adult». Консоль: 0 ошибок (кроме favicon 404 на тестовой странице).
  - Vision-проверка скриншота (VL): два Нокта — левый с тёплым
    желтоватым свечением в области морды, правый без свечения; большие
    уши, круглое тело, короткий хвост.
  - node --check: 14/14 модулей; JSON-валидация quests.json и
    species.json — OK.
- Файлы (14 изменённых + 5 новых): species.json, quests.json, genome.js,
  creature.js (render), pennett.js, questEngine.js, store.js,
  breed.js, enclosure.js, creature.js (screen), orders.js, predictor.js,
  components.css, render_grid.html, genome.test.html,
  breeder.test.html, quests_test.html; новые: assets/parts/noct-*.svg
  (4 шт.) + README.
- Файлы вне задания: не трогал (LOG_1.md, LOGGING.md, genolab_tz.md,
  ART_STYLE.md, SECURITY.md, docs/).
- Блокеры: нет. Коммит — после этой записи (см. хэш в следующей
  пометке).
- Коммит: 2a8a32d (main).

## [Фаза 7c / восстановление] Новая сессия, сверка по факту diff
- Рабочее дерево (git diff --stat, не по памяти предыдущей сессии):
  - js/ui/screens/codex.js +294/−18 — полная реализация экрана:
    таблица признаков вида (аллели/модель/фенотипы из
    core.genome.getSpeciesConfig), карточки всех достижимых фенотипов
    (декартов продукт DD/Dd/dd → genomeToPhenotype, мини-рендер
    renderCreature 64px, отметка «встречен» по store.codexSeen),
    4 формулы наследования (mono 3:1, тест-кросс 1:1, неполное
    1:2:1, дигибрид 9:3:3:1) — расщепления считаются pennettGrid
    на лету, история мутаций (store.mutations.total), сводка
    коллекции «X из Y». Экспорты window.GenoLab.ui.screens.codex,
    регистрация в роутере сохранена.
  - js/state/store.js +58/−2 — seenKey(genome) (ключ «вид|фенотипы»),
    recordSeen(), codexSeen: {} в initialState(), авто-отметка
    стартеров вольера, запись в addCreature(), восстановление
    codexSeen в load().
  - js/state/save.js +23 — валидация codexSeen (объект ключей,
    значения true), доподнимание {} в load() и importFile(); версия
    схемы genolab_save_v1 не менялась.
  - css/components.css +82 — стили .codex__* (секции, pheno-grid,
    pheno-карточки, --seen, формулы, grid-таблицы, total).
  - LOGGING.md +1 — правило: одна фаза Pi — одна сессия, фиксация
    состояния в LOG при заполнении контекста.
- node --check: js/state/save.js, js/state/store.js,
  js/ui/screens/codex.js — синтаксис OK.
- Cache-buster: grep «?v=7c» по js/main.js, index.html, css/,
  js/ui/screens/ — 0 совпадений (таких ссылок в дереве нет;
  индексные ссылки чистые, бастеры в проекте не используются).
- Untracked-файлов нет; тестовых страниц по 7c ещё нет.
- Коммита нет — дерево оставлено как есть.

## [Фаза 7c / завершение] Сессия проверки: E2E, регрессия, документы

- Step 2 (cache-buster): `?v=7c` по всему дереву — 0 совпадений;
  соглашения о бастерах в проекте нет (ни в одной фазе не вводилось) —
  пропускаем, как и в предыдущих фазах.
- Step 3 (node --check): js/state/save.js, js/state/store.js,
  js/ui/screens/codex.js — синтаксис OK.
- Step 4 (регрессия http://127.0.0.1:8321, Chrome DevTools MCP):
  - genome.test.html — ОБЩИЙ ВЕРДИКТ: PASS (10 PASS)
  - breeder.test.html — PASS (14/14)
  - config_test.html — PASS (5/5)
  - quests_test.html — PASS (7 PASS)
  - mutation_test.html — PASS (5/5)
  - render_grid.html — PASS (14/14)
  - Итого: 6/6 страниц, 0 FAIL.
  - Примечание: tests/species2_test.html в проекте отсутствует (упоминается
    в плане сессии, но фазой 7d не создан) — в регрессии не участвует.
- Step 5 (file:// smoke, 6 маршрутов): Вольер, Скрещивание,
  Существо, Предсказатель, Заказы, Кодекс — все отрисованы, заголовки
  верные, тело не пустое. Кодекс на file://: 26 карточек фенотипов
  (2 вида: Голо 24 + Нокт 2), 4 блока формул.
- Step 6 (E2E pennettGrid API vs DOM, http://):
  - mono_grid: API 3x2 — DOM 3x2 — match=true
  - dihybrid_grid: API 5x4 — DOM 5x4 — match=true
  - mono_split: API «полосатый=3, однотонный=1» — строка расщепления
    в DOM «3:1» — совпадает
  - incomplete_split: 1:2:1 (коричневый=1, палевый=2, белый=1)
    в API и в DOM — совпадает
  - Скрещивание «Скрещивание» (Bb x Bb, pattern+size): DOM 5x4,
    16 ячеек — совпадает с API.
- Step 6b (E2E codexSeen, http://, полный reload через query-бастер
  ?_=b1 — hash-навигация страницу не перезагружает):
  - Чистый старт: storeMut=2, fileMut=2, storeEnc=11, fileEnc=11,
    storeSeen=4, fileSeen=4 — стейт и файл согласованы.
  - addCreature({species:'golo', pairs:[A/A,B/B,C/C,D/D]}) -> id c12,
    ключ golo|коричневый|полосатый|крупный|острые: hasKey=true,
    seen 4->5, enclosure 11->12; автосейв: fileSeen=5, fileEnc=12.
  - Полный reload (?_=b1): seen=5, enclosure=12,
    .codex__pheno--seen в DOM = 5 — PASSED (переживает reload).
- Step 6c (E2E счётчик мутаций): store.mutations.total=2 ->
  recordMutations(2) -> 4; DOM не обновляется на лету (emit без
  ре-рендера экрана — по дизайну); после перехода
  orders->codex ре-рендер показывает «Всего мутировавших потомков: 4»
  (совпадает со стейтом) — «счётчик живой» по промпту 7c подтверждено.
- Примечание к E2E: dev-сейв 127.0.0.1:8321 (11 существ) в ходе
  проверки был сброшен до initialState (5 стартеров, mut 0, seen 3) —
  тестовый origin, не пользовательские данные; файл://-origin
  не тронут.
- Step 7 (документы):
  - docs/api.md обновлён: поле codexSeen в схеме genolab_save_v1,
    начальное состояние (5 стартеров, авто-пометки 3 уникальных
    фенотипов), строки addCreature/applyState/reset, валидация
    validate/load (мягкая деградация codexSeen, версия схемы 1).
    Исправлена устаревшая строка reset «3 стартовых существа»
    (актуально с 7d: 3 golo + 2 noct).
  - genolab_tz.md §9 7c сверен с фактом: таблица признаков ✓,
    формулы ✓, «история открытых мутаций» реализована как
    накопленный счётчик (по промпту фазы 7c: «счётчик мутаций живой»);
    данные — из core.genome (species.json, двойной режим) и config
    (CONFIG) без вшитых копий, только UI-обвязка ✓.
  - Промпту фазы (Prompts/phase7c_codex.md) соответствие полное:
    таблица признаков, ВСЕ достижимые фенотипы (вкл. incomplete),
    формулы, прогресс коллекции «X из Y», codexSeen в сейве с мягкой
    деградацией, оба вида, E2E-критерии.
- Скриншоты (docs/screenshots/, проверены vision):
  - phase7c_codex_top.png — заголовок, таблица 4 признаков Голо
    (окрас: неполное, коричневый AA / палевый Aa / белый aa),
    сетка фенотипов, зелёная отметка «встречен».
  - phase7c_codex_noct.png — секция Нокт (свечение E/e, 1 из 2),
    формулы 3:1 (75/25%) и 1:1 (50/50%), начало 1:2:1.
  - phase7c_codex_bottom.png — 1:2:1 (25/50/25%), дигибрид
    9:3:3:1 (56/19/19/6%), «История мутаций: Всего мутировавших
    потомков: 0», «Общая коллекция: 3 из 26 фенотипов всех видов».
- Финальный git status (без коммита, HEAD e5db947):
  M LOGGING.md, LOG_1.1.md, css/components.css, docs/api.md,
    js/state/save.js, js/state/store.js, js/ui/screens/codex.js
  ?? docs/screenshots/phase7c_codex_{top,noct,bottom}.png
- ВЕРДИКТ: фаза 7c готова — 0 FAIL, E2E PASSED, документы
  синхронизированы. Коммит — по решению пользователя (в этой сессии
  не делался).
