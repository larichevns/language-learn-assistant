---
tags: [spec, design, directions, phase-6, ui]
date: 2026-06-13
status: draft
source: 3 research briefs (competitors / trends+libs / learning-UX) + design/wireframes/{a,b,c}.html
stack: Next.js 15 · React 19 · Tailwind 3.4 · shadcn (new-york, slate, CSS-vars) · lucide · next-themes (dark+light) · PWA
audience: один взрослый - русскоязычный, учит немецкий, длинные сфокусированные сессии
---

# Phase 6 - Design Directions

Три **по-настоящему разных** дизайн-направления для LanguageLearnAssistant, плюс краткий разбор рынка, рекомендация и описание единого вайрфрейма для сравнения. Все три реализуемы в текущем стеке (Tailwind-токены через CSS-переменные shadcn, owned React-компоненты, lucide / опц. Phosphor, опц. Motion). Прототипы уже лежат в `design/wireframes/{a-studierzimmer,b-friendly,c-pro-dark}.html` - этот документ их формализует.

> Терминология: «концепт-токены» = значения, которые лягут в `app/globals.css` (`:root` + `.dark`) и `tailwind.config.ts`. Каждое направление = отдельный набор переменных при той же структуре токенов. Мы НЕ форкаем компоненты - мы меняем тему.

---

## 1. Краткий разбор рынка

### Что делают лидеры
- **Duolingo** - эталон «playful loud»: feather-green `#58CC02`, маскот-сова, 3D-кнопки с «нажимаемой» нижней кромкой, один концепт на экран, стрики + лиги + Energy. Оптимизирован под удержание и подростков/casual, **engagement-over-competence**.
- **Babbel** - ближайший к нашему позиционированию «adult/serious/minimalist»: тёплый коралл вместо зелёного (намеренный уход от Duolingo), объяснения от лингвистов в UI, прогресс-как-достижение, не лидерборды. Слабость - сток-Material, «Android 2018», без характера.
- **Busuu / Memrise** - сценарии из реальной жизни и ролевые AI-«buddies» (Grammar / Roleplay / Translation / Culture). Но AI прикручен сбоку вкладкой, а не как спина продукта.
- **Anki / FSRS** - лучший в классе SRS-движок (4 кнопки Again/Hard/Good/Easy, показ следующего интервала, реальная статистика), завёрнутый в худший в классе UI. Берём **движок**, выкидываем интерфейс.
- **Rosetta Stone** - спокойный, фото-вперёд, low-chrome, «взрослый» вид. Но догматичное «без объяснений» - стена для взрослого, которому нужна грамматика.
- **AI-тьюторы (Speak / Loora / Langua / ChatGPT Voice)** - другой язык дизайна: тихий, conversation-first, плотная обратная связь. Loora - лучший feedback-UX (granular + emotionally-safe «Tap to fix» + дебриф в конце). Langua - скаффолдинг для боящегося («say it more natively», inline-перевод, post-chat report). ChatGPT Voice - отличный голос, но **нулевая педагогика** (нет SRS, прогресса, структуры).

### Гэп, который должен закрыть наш продукт
**«Serious calm» + AI-native + честная педагогика.** Категория по умолчанию = playful loud (Duolingo). Новая волна = conversational warm (Loora/Langua). Почти никто не владеет лейном **взрослый / сфокусированный / premium-calm + AI как спина**. Babbel доказал, что взрослые платят за сдержанность; AI-тьюторы доказали, что разговор - это спина; Anki доказал, что SRS - это retention-движок без вины. Наша формула - соединить все три и добавить то, чего нет ни у кого: **разговор/коррекция → честный фидбэк → авто-карточки в FSRS-колоду → прогресс как CEFR-мастерство (A1→B1), а не XP-вина.** Под наш кейс (один взрослый, длинные сессии, немецкий) это означает: плотность по запросу, клавиатура как быстрый путь, der/die/das и заглавные существительные как типографический герой.

### Дизайн-ловушки, которых избегаем
- **Generic-AI look**: soft-rounded карточки + violet→indigo градиент + ghost-кнопки + Inter везде + дефолтный shadcn. Лечится дивергенцией на 3-4 осях: характерная типографика, подписанная OKLCH-палитра, сдержанный, но фирменный motion, owned-иконки/графика.
- **Kiddie-геймификация**: неоновый зелёный, маскот, конфетти, loss-aversion (стрик-тревога, Energy-paywall к 3-му уроку), guilt-нотификации, платная починка стрика. Всё это - сигнал «детская игра» для сфокусированного взрослого и/или dark pattern.
- **Chaotic anti-design / неодисциплинированный нео-брутализм** - 8-10% успеха задач на info-плотных экранах. На учебных экранах допустимы только **дисциплинированные брутал-акценты** (жёсткие границы, offset-тени, mono-микролейблы) на спокойной базе.
- **Анти-паттерны UX из брифов**: AI как bottom-right «support bubble» (читается как чатбот поддержки); нерегулируемый размер шрифта; лояльный (нечестный) скоринг произношения; латентность голоса; AI-as-bolt-on-tab.

---

## 2. Три направления

Все три держат единый каркас экранов (sidebar + topbar + dashboard + hero «к повторению» + Assistant Dock) и единый набор токенов. Различаются палитрой, типографикой, формой, глубиной, motion-характером, иконками и графикой - это **не перекраски**, а три разных характера продукта.

---

### A. «Studierzimmer» - calm editorial
**Vibe:** тихий кабинет учёного - бумага, чернила, serif-акценты, low-chrome. Респект и фокус, никакого шума.
**Для кого:** взрослый, который ценит длинную сфокусированную сессию и «взрослый» инструмент (наш базовый кейс). Прямой наследник Babbel/Rosetta «adult & restrained», но с собственным характером через типографику.
Прототип: `design/wireframes/a-studierzimmer.html`.

**Концепт-токены**
- Палитра (light): `--background` бумага `#FBF7EF` · `--card` `#FFFFFF` · `--foreground` чернила `#2C2A26` · `--primary` deep teal-green `#246B62` · `--accent`/gold `#B5832F` · `--success` `#3C7A50` · `--destructive` rose-brick `#B4503E` · **`--deutsch` `#246B62`** (немецкий = подчёркивание primary-цветом, 2px, offset).
- Палитра (dark): `--background` `#1B1A17` · `--card` `#232019` · `--foreground` `#ECE6DA` · `--primary` `#5AA89B` · акцент-gold `#D2A24E` · линии `#332F27`. Тёмная - тёплая, не сине-серая.
- Типографика: **display = Fraunces** (variable optical-size serif, Google Fonts, OFL) для h1-h3, чисел-метрик и брендовых моментов; **body/UI = Inter** (есть в стеке). German-контент - Inter с чистыми ä/ö/ü/ß; рассмотреть Source Serif для длинных немецких отрывков в грамматике.
- Радиусы: умеренные, `--radius: 0.75rem` (карточки 14-16px, кнопки 10px). Не пузырь.
- Глубина: бумажная - `box-shadow: 0 1px 2px rgba(40,35,25,.04)` + тонкий hairline-border `#E9E1D3`. Без glass, без градиентов.
- Motion: «редакторский» - медленные fades 200-260ms, без bounce. Прогресс-ring рисуется stroke-dashoffset-ом. Personality = типографика и whitespace, не движение.

**Иконки + графика:** lucide (оставляем, stroke 1.6-1.7 под тонкие hairlines) ИЛИ Phosphor `thin/light` для более «editorial» штриха. **Без маскота.** Графика: спот-иллюстрации в стиле гравюры/линогравюры (одноцветные, primary-чернила) для пустых состояний; CC0 база (unDraw перекрашенный) + 3-5 заказных/AI hero-спотов. Лицензии: Fraunces/Inter OFL, lucide/Phosphor MIT, unDraw open.

**Компонент/анимация-библиотеки:** shadcn/new-york app-shell (как есть) · `sonner` (тосты) · `vaul` drawer → bottom-sheet на мобиле · shadcn Charts (Recharts) для прогресса/heatmap · `tailwindcss-animate` (есть). Motion **опционально** и минимально (page/section fades).

**Signature UI moves:** (1) числа-метрики набраны Fraunces крупным кеглем - дашборд читается как печатная страница; (2) немецкое слово = типографический герой через primary-подчёркивание, русский глосс - muted, мельче; (3) «tell me why» - раскрываемая грамматика по запросу (анти-Rosetta); (4) heatmap активности как «record of competence», не sticker-chart.
**Риски:** (1) serif при мелком кегле/низком контрасте теряет читаемость - держать body 16px+, проверить контраст 4.5:1; (2) «бумажная» палитра рискует читаться как «старо/legacy» если перебрать с гудбэками - gold строго акцентно; (3) Fraunces variable - следить за весом бандла (один variable-файл через `next/font`).
**Лучший экран для показа:** Dashboard (метрики Fraunces + heatmap + «к повторению» hero) и Grammar (длинный немецкий текст + раскрываемые объяснения).

---

### B. «Friendly» - warm & motivating (grown-up Duolingo)
**Vibe:** тёплый, округлый, мотивирующий, со вкусной - но подчинённой - геймификацией и лёгкими иллюстрациями. Дружелюбно, но не по-детски.
**Для кого:** тот же взрослый в дни низкой мотивации; кому нужен мягкий «pull» возвращаться, но без стрик-вины и совы. Берёт у Duolingo loop и «нажимаемость», отбрасывает неон/маскот/extraction.
Прототип: `design/wireframes/b-friendly.html`.

**Концепт-токены**
- Палитра (light): `--background` `#FBF6FF` · `--card` `#FFFFFF` · `--foreground` `#211B33` · `--primary` violet `#6D5DF6` · `--accent` coral `#FF7A59` · `--success` green `#1FB877` · streak/amber `#FFB020` · `--destructive` `#E0566B` · **`--deutsch` `#6D5DF6`** (немецкий = violet-pill/бейдж). Намеренно НЕ зелёный как primary (escape Duolingo).
- Палитра (dark): `--background` `#17131F` · `--card` `#201A2E` · `--foreground` `#EFEAF7` · `--primary` `#8B7DFF` · coral `#FF8C6E` · green `#2BD08A` · линии `#2C2440`.
- Типографика: **display = Nunito** (rounded, дружелюбный, тёплый; Google OFL) для заголовков, метрик, кнопок; **body = Inter** или Nunito Sans для длинных текстов (Nunito 900 только для акцентов, не для абзацев). German-контент - тот же body со 100% foreground + violet-маркер.
- Радиусы: щедрые, но не пузырь-toy - `--radius: 1rem` (карточки 22-24px, кнопки 16px, pill для primary CTA). Заметно круглее A, но мягче Duolingo.
- Глубина: цветные мягкие тени под брендом - `0 10px 30px rgba(33,27,51,.05)`, у CTA - окрашенная `0 8px 16px rgba(31,184,119,.3)`. Лёгкие blob-градиенты за карточками (низкая opacity).
- Motion: пружинистый, но воспитанный - micro-interactions 200-300ms, лёгкий spring на hover кнопок и на «applied»-чек; анимированные счётчики (стрик/слова) на Magic UI. Под `prefers-reduced-motion` - заменять на opacity/color.

**Иконки + графика:** **Phosphor `duotone`** (дёшево-характерный, тёплый; MIT) как primary - лучше lucide передаёт «friendly». **Без маскота** (warmth идёт от иллюстраций и motion, не от животного). Графика: **Open Peeps / Humaaans (CC0)**, перекрашенные в violet/coral-палитру, для онбординга/пустых состояний; 6-10 owned бренд-иконок (streak-flame, mastered, lesson-complete) через SVGO→SVGR с `currentColor`. Лицензии: Nunito OFL, Phosphor MIT, Open Peeps/Humaaans CC0.

**Компонент/анимация-библиотеки:** shadcn app-shell · **Motion (`motion/react`)** для spring micro-interactions и shared-layout · **Magic UI** для анимированных счётчиков стрика/слов и shimmer на milestone · `sonner` · `vaul` · shadcn Charts. Magic UI - только полировка микро-взаимодействий, не весь шелл.

**Signature UI moves:** (1) «нажимаемая» pill-CTA с окрашенной тенью (заимствованный у Duolingo affordance на спокойной амплитуде); (2) этичный стрик - Streak Freeze + «earn back» усилием, авто-grace, **без платной починки и guilt-нотификаций**; самостоятельно заданная цель («15 мин/день»); (3) тёплые иллюстрации-люди в пустых состояниях; (4) milestone - тихий designed-момент с лёгким shimmer, не конфетти и не маскот.
**Риски:** (1) тончайшая грань - легко свалиться обратно в «детское»; держать геймификацию строго подчинённой, амплитуду motion низкой, не добавлять маскота «на чуть-чуть»; (2) Nunito 800-900 нечитаем в абзацах - только акценты; (3) цветные тени + blob-градиенты могут читаться как generic-AT/SaaS - спасает Phosphor-duotone и owned-иконки.
**Лучший экран для показа:** Dashboard (стрик-блок + анимированные счётчики + цветные stat-карточки) - направление продаёт себя именно мотивационным блоком.

---

### C. «Pro Dark» - sleek premium (Linear / Raycast vibe)
**Vibe:** тёмный по умолчанию, glass + аккуратный градиент, неоновый акцент, плотный, клавиатура-first. Инструмент профи, который уважает скорость.
**Для кого:** взрослый-«power user» в длинной сессии: горячие клавиши, `Cmd-K`, плотные обзоры/фидбэк-экраны, минимум хрома. Заимствует у Anki плотность статистики (в красивой обёртке) и у ChatGPT/Langua conversation-first surface.
Прототип: `design/wireframes/c-pro-dark.html`.

**Концепт-токены**
- Палитра (dark-first): `--background` `#080A0F` · `--bg2` `#0C0F16` · `--card`/glass `rgba(255,255,255,.035)` · линии `rgba(255,255,255,.09)` · `--foreground` `#E7E9F0` · `--muted` `#8990A1` · `--primary` violet `#7C6BFF` · `--accent`/neon-cyan `#34E0E6` · `--success` `#36E0A0` · `--destructive` `#FF5C6C` · **`--deutsch` `#34E0E6`** (немецкий = cyan-tag).
- Палитра (light - деривируем из dark): `--background` `#F7F8FB` · `--card` `#FFFFFF` · `--foreground` `#0C0F16` · primary `#6354FF` · cyan-accent `#0E9CA3` (затемнить неон для контраста на белом). Light - вторичен, dark проектируем первым.
- Типографика: **display = Space Grotesk** (грубоватый geometric grotesque, технологичный; Google OFL) для заголовков, метрик, `Cmd-K`; **body/UI = Inter** (есть). German-контент - Inter, cyan-маркер. Tight tracking на крупных заголовках.
- Радиусы: малые/острые - `--radius: 0.625rem` (карточки 14-16px, кнопки/kbd 6-10px). Pro-инструмент, не пузырь.
- Глубина: **glass** - translucent-слои `rgba(255,255,255,.035)` + тонкий border + `backdrop-filter: blur(6-10px)`; неоновое свечение строго на key-элементах (`box-shadow: 0 0 22px rgba(124,107,255,.5)` на лого/primary). OKLCH-градиент violet→cyan без серой середины. Дисциплинированные брутал-акценты: inset-кольцо `inset 0 0 0 1px rgba(124,107,255,.15)` на active-nav.
- Motion: точный и быстрый - 120-200ms, compositor-spring у Motion, glow-pulse на стриминге. Никакого bounce. «Motion is meaning».

**Иконки + графика:** lucide (stroke 1.5, идеально под тонкие неоновые линии) как primary - оставляем. **Без маскота, без иллюстраций-людей** - графика = data-viz, mesh-градиенты, beams. Magic UI «animated beams» между нодами/статами; mesh-фон слоёными radial-градиентами (OKLCH). Owned: 6-8 моно-иконок при необходимости. Лицензии: Space Grotesk OFL, lucide MIT, Magic UI (коммерч. ОК, перепродажа кода - нет).

**Компонент/анимация-библиотеки:** shadcn app-shell · **Motion (`motion/react`)** (OKLCH/color-анимация, scroll, shared-layout) · **Magic UI** (beams, shimmer, retro-grid - экономно) · **shadcn Charts / Tremor** для плотного аналитического дашборда · `sonner` · `vaul` (bottom-sheet на мобиле). Aceternity - только для лендинга, не для шелла.
- **Глубина в Tailwind:** добавить `--glass` токен (translucent bg + thin border) и слоёные low-opacity тени; gate всё под `motion-safe:`.

**Signature UI moves:** (1) `Cmd-K` командная палитра (Linear/Raycast) - вызвать тьютора, «explain this», «quiz me»; клавиатура - быстрый путь, мышь не нужна; (2) glass-sidebar с `backdrop-blur` и inset-кольцом на active; (3) неоновый акцент строго дозирован - свечение на 2-3 key-элементах, остальное спокойное; (4) плотный фидбэк/статистика-экран (Anki-grade stats), который в A/B был бы «по запросу».
**Риски:** (1) glass + неон легче всего скатывается в **generic-AI look** - спасает Space Grotesk (не Inter в заголовках) + дозирование неона + дисциплина брутал-акцентов; (2) контраст: неон-cyan/violet на near-black и особенно на light-деривате - проверять 4.5:1, не делать текст неоновым (только акценты/границы); (3) тёмное + плотное тяжело для долгого чтения немецкого - для Grammar/Homework давать спокойную «reading»-зону с увеличенным line-height (WCAG 1.4.12).
**Лучший экран для показа:** Dashboard с открытым `Cmd-K` overlay + glass Assistant Dock; либо плотный SRS/прогресс-stats экран - направление продаётся плотностью и клавиатурой.

---

### Сводка различий (чтобы было видно, что это не перекраски)

| Ось | A · Studierzimmer | B · Friendly | C · Pro Dark |
|---|---|---|---|
| Характер | тихий кабинет, editorial | тёплый, мотивирующий | sleek, power-tool |
| Primary / accent | teal-green `#246B62` / gold `#B5832F` | violet `#6D5DF6` / coral `#FF7A59` | violet `#7C6BFF` / neon-cyan `#34E0E6` |
| База | бумага, light-first | светлая лавандовая | near-black, dark-first |
| Display-шрифт | Fraunces (serif) | Nunito (rounded) | Space Grotesk (grotesque) |
| Радиусы | умеренные 0.75rem | щедрые 1rem | острые 0.625rem |
| Глубина | hairline + бумажная тень | цветные мягкие тени + blob | glass + blur + неон-glow |
| Motion | редакторские fades | воспитанный spring | точный, быстрый, glow |
| Иконки | lucide / Phosphor thin | Phosphor duotone | lucide (stroke 1.5) |
| Графика | гравюра-споты (CC0) | Open Peeps/Humaaans (CC0) | data-viz / beams / mesh |
| Маскот | нет | нет | нет |
| Геймификация | прогресс-как-мастерство | этичный стрик + Freeze | stats-плотность |
| Главная фишка | типографика-герой | «нажимаемая» CTA + стрик | `Cmd-K` + glass |

---

## 3. Рекомендация

**По умолчанию - A «Studierzimmer».** Это прямое попадание в гэп «serious calm + adult + AI-native» для нашего единственного пользователя (взрослый, длинные сфокусированные сессии, немецкий). Обоснование:

1. **Совпадает с позиционированием из брифа** - «be the serious-calm product», лейн, которым почти никто не владеет; Babbel доказал, что взрослые платят за сдержанность.
2. **Лучше всего держит длинную сессию** - low-chrome, бумажная база, типографическая иерархия снижают усталость; немецкий-как-герой через подчёркивание идеально ложится на наше правило «German content always rendered & visually marked».
3. **Дёшево де-генерик** - Fraunces + бумага дают характер без риска generic-AI look (в отличие от C) и без риска «детского» (в отличие от B), при наименьшем бюджете анимации.
4. **Реализуемо прямо сейчас** - только переменные `globals.css` + `next/font` Fraunces; не требует Motion/Magic UI на старте; совместимо с уже готовым shadcn-шеллом Phase 3.

**Дополнения к дефолту (взять лучшее из B и C, не меняя направление):**
- Из **C** - `Cmd-K` командная палитра и полная клавиатурная навигация SRS-обзора (Space=reveal→Good, 1-4=grades). Power-user-скорость не противоречит editorial-спокойствию.
- Из **B** - этичный стрик-блок (Streak Freeze + earn-back, самостоятельная цель, **без** платной починки и guilt-нотификаций) и heatmap активности - но в спокойной A-подаче, без амплитудного motion.
- **C как тема-опция:** так как тёмная тема - table stakes (`next-themes` уже стоит), тёмный вариант A может опционально получать чуть больше «pro»-плотности. Полноценный C держим как переключаемую тему для тех, кто хочет Linear-вайб.

Если владелец на ревью вайрфреймов выберет более мотивирующий тон - fallback **B** (но строго подчинённая геймификация). **C** рекомендуем как опциональную тёмную тему/режим, а не как дефолт: glass+неон+плотность хуже всего для долгого чтения немецкого и легче всего скатывается в generic-AI.

---

## 4. Что показать на вайрфрейме

Единый **композитный экран** для всех трёх направлений, чтобы они были сопоставимы один-в-один (уже сделан в `design/wireframes/{a,b,c}.html`, 1440×900):

**Dashboard «домашний экран дневной петли»**, состоящий из:
1. **Sidebar** (левый, ~248px): бренд-лого, навигация (Dashboard / Vocabulary / Grammar / Homework / Exercises / Notes / Admin) с lucide/Phosphor-иконками, активный пункт подсвечен по-разному в каждом направлении, footer-аккаунт + theme-toggle.
2. **Topbar**: приветствие (display-шрифт направления), `Cmd-K`-pill (показывает клавиатурный путь), иконки-кнопки (поиск/настройки/тема).
3. **Stat-row (4 метрики)**: streak · слов выучено (mastered) · время за неделю · CEFR-прогресс «A2→B1 64%». Числа набраны display-шрифтом - это главный демонстратор типографики направления. Один stat - «featured» (в A - заливка primary, в B - цветная карточка, в C - glow).
4. **«Due review» hero-карточка**: прогресс-ring + крупное число карточек к повторению + primary-CTA «Начать повторение» (показывает форму кнопки и глубину направления). Рядом - мини-список из 2-3 слов с **немецким-как-герой** (der/die/das, подчёркивание/бейдж в de-маркере) + русский глосс muted.
5. **Heatmap/активность** (вторая карточка нижнего ряда): GitHub-style календарь как «record of competence».
6. **Assistant Dock** (правый нижний угол, ~330px): заголовок «Ассистент» + scope-chip, одно bot-сообщение (markdown), поле ввода. Показывает conversation-first surface и как dock выглядит в теме (в C - glass + glow). НЕ bottom-right support-bubble - это именованный, помеченный dock.

Этот один экран показывает сразу: палитру (light+dark), display+body типографику, радиусы, глубину/тени/glass, форму CTA, немецкий-highlight-токен, иконки, и conversation-first dock - т.е. все «концепт-токены» каждого направления на сравнимой композиции. Для ревью - открыть три HTML рядом (по 1440×900).

---

## Связанное
- Прототипы: `design/wireframes/a-studierzimmer.html` · `b-friendly.html` · `c-pro-dark.html`
- [[mvp-scope-and-phases]] · [[Тема-UI-спокойная-индиго-бирюза]] (текущая тема - будет заменена выбранным направлением)
- Реализация токенов: `app/globals.css` (`:root` + `.dark`) · `tailwind.config.ts` · `next/font` для display-шрифта
