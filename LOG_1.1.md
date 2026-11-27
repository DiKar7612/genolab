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
