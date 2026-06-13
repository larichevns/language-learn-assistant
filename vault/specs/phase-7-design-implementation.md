---
tags: [spec, phase-7, design, implementation, ui]
date: 2026-06-13
status: implemented
decision: Direction B (Friendly) — GENTLY muted; centered Google-style assistant (ToonyGamy pattern); verified by ui-tester
prototype: design/wireframes/b-friendly-final.html
---

# Phase 7 — Design Implementation («Friendly, gently muted» + centered assistant)

> Владелец выбрал **направление B (Friendly)** из [[phase-6-design-directions]], с двумя правками: **(1)** приглушить палитру — но мягко (≈ −25% насыщенности, не «вымыто»); **(2)** перенести чат в **центр, по гугл-стилю**, как в ToonyGamy. Плюс по завершении — **прогон ui-тестера**: «чтобы всё было удобно и всё работало». Эталон прототипа — `design/wireframes/b-friendly-final.html` (отскриншочен, утверждён).
>
> Это фаза **внедрения темы в реальное приложение** (не мокап): меняем токены/шрифты/форму + переписываем Assistant Dock на центрированный паттерн, не форкая логику. Тема = смена CSS-переменных + компонентов оболочки.

---

## 1. Решение по визуалу

**Direction B · Friendly, gently muted.** Тёплый, скруглённый, мотивирующий, но взрослый — не кислотный Duolingo и не вымытый серый. Геймификация этичная (стрик без штрафов/вины).

### 1.1 Концепт-токены (финал — из `b-friendly-final.html`)
Лягут в `app/globals.css` (`:root` + `.dark`) и `tailwind.config.ts` (та же структура токенов, что сейчас).

| Токен | Light | Назначение |
|---|---|---|
| `--background` | `#F7F4F0` | тёплый нейтральный фон (не фиолетовый, не серый) |
| `--surface`/`--card` | `#FFFFFF` | карточки |
| `--foreground` | `#262430` | текст |
| `--muted-foreground` | `#867F92` | вторичный |
| `--border` | `#EDE9E3` | линии |
| `--primary` | `#6C5FC9` | приглушённый фиолетовый (было `#6D5DF6`) |
| `--accent` (coral) | `#EA805F` | тёплый коралл (приглушён) |
| `--success` | `#34A981` | спокойный зелёный |
| `--amber` | `#E5A93F` | мягкая охра (стрик) |
| `--deutsch` | `#6C5FC9` | подчёркивание немецкого |
| soft-фоны | violet `#ECE9F7`, coral `#F8E8E0`, green `#E4F1EB`, amber `#F6EDDA` | цветные стат-карточки |

Dark-режим: тёмно-фиолетово-нейтральный фон (`#1C1A24`/`#15131C`), те же hue, поднятая светлота primary/accent. (C-Pro-Dark из Phase 6 можно позже подключить как альтернативную тёмную тему — P2.)

### 1.2 Типографика
- **Nunito** (Google, OFL) — и display (800/900), и body (600/700). Округлая, тёплая, читаемая. Через `next/font/google` → `--font-sans`/`--font-display`.
- Немецкий контент — `.de` маркер: вес 800 + подчёркивание `--deutsch`. Заглавные существительные сохраняем.

### 1.3 Форма / глубина / движение
- Радиусы крупнее: `--radius: 1rem`; карточки `rounded-3xl` (24px), кнопки/инпут `rounded-2xl`/`rounded-full`.
- Тень — мягкая, цветная по контексту (`shadow` с лёгким оттенком primary), без жёстких боксов.
- Движение: вкатить **Motion** (`motion`/Framer Motion) — мягкие spring-переходы (bar→window, hover-lift карточек, появление Proposal-карточки). 150–220ms, спокойно.

### 1.4 Иконки и графика
- **lucide-react** (уже есть) — основной набор, stroke 2.2 для «дружелюбной» жирности. Опц. **Phosphor duotone** для акцентных мест (лицензия MIT).
- Графика — свои coded-SVG (логотип-«книга», стрик-огонёк, прогресс-кольцо — уже в прототипе) + опц. лёгкие иллюстрации **Open Peeps / unDraw (CC0)** для пустых состояний. Без маскота.

---

## 2. Центрированный ассистент «по гугл-стилю» (паттерн ToonyGamy)

Сейчас в LLA док — в правом нижнем углу (`components/assistant/assistant-dock.tsx`). Переносим в **центр снизу**, повторяя ToonyGamy (`toonygamy-web/.../aict/assistant/AssistantDock|AssistantBar|AssistantWindow.tsx`):

**Машина состояний:** `collapsed (пилюля по центру снизу) → (focus/hover/⌘K) → bar (центр, ~560–660px: spark + input + ИИ-агент + mic + send) → (ввод/клик) → window (раскрывается вверх по центру: шапка scope-chip, лента сообщений, Proposal-карточки, тот же bar внизу)`. Свернуть — backdrop-клик / Esc.

- **Позиция:** `fixed; left:50%; translate-x:-50%; bottom: ~28px`; window — поверх затемнённого scrim (`rgba + blur`), контент дашборда тускнеет (как в прототипе и в ToonyGamy).
- **Открытие:** топбар-кнопка «Ассистент», плавающая пилюля, и **⌘K** (заимствуем из C-Pro-Dark).
- **Сохраняем всё, что уже работает:** SSE-стрим, `streamChat`, Proposal-карточки (Apply/Refine/Discard), `useDock` store (добавить `state: collapsed|bar|window` вместо `open`), reload истории из `/api/threads/resolve`, scope-chip + виджет расширения scope.
- **Ширина:** bar 560–660px, window до ~720px / 70vh, по центру. На мобиле — bottom-sheet на всю ширину (vaul/Drawer).

Файлы: переписать `assistant-dock.tsx` → `AssistantDock` + `AssistantBar` + `AssistantWindow`; расширить `lib/stores/dock.ts` (state-машина + ⌘K listener); топбар-кнопка переключает `bar`.

---

## 3. Инвентарь внедрения (по файлам)

| Область | Файл(ы) | Изменение |
|---|---|---|
| Токены | `app/globals.css` | новые `:root`/`.dark` значения (§1.1) |
| Tailwind | `tailwind.config.ts` | `--radius` 1rem; шрифты sans/display = Nunito; (теплее тени) |
| Шрифты | `app/layout.tsx` | `next/font` Nunito → `--font-sans`+`--font-display` (убрать Inter/Jakarta) |
| Кнопки | `components/ui/button.tsx` | радиус `rounded-2xl`/`full`, вес 800, мягкая тень |
| Карточки | `components/ui/card.tsx` | `rounded-3xl`, мягкая тень |
| Badge/feedback | `components/ui/feedback.tsx` | веса/цвета под палитру |
| Сайдбар | `components/shell/sidebar.tsx` | блок «стрик» внизу (огонёк + дни), активный пункт violet-soft |
| Топбар | `components/shell/topbar.tsx` | кнопка «Ассистент» → открывает центр-бар; ⌘K-хинт |
| Дашборд | `app/(app)/dashboard/page.tsx` | 4 цветные стат-карточки (violet/coral/green/amber), прогресс-кольцо |
| Ассистент | `components/assistant/*` + `lib/stores/dock.ts` | §2 переписать на центр |
| Движение | `package.json` | добавить `motion` |
| Графика | `public/` | обновить иконку/манифест-цвета под новую палитру |

Принцип: **меняем тему и оболочку, не трогаем бизнес-логику** (роуты, SRS, propose/Apply, i18n остаются).

---

## 4. UI-тест (агент `ui-tester`) — «удобно и всё работает»

После внедрения — прогон агента `ui-tester` (browser-based) по живому приложению (`npm run dev`, логин `admin@lla.local`). Чек-лист (каждый пункт: *работает* + *удобно*):

1. **Auth:** регистрация/логин (creds), редирект на дашборд, выход.
2. **Навигация:** все пункты меню открываются; активное состояние; мобильный drawer (≤768px).
3. **Дашборд:** статы из БД; «Начать повторение» ведёт в ревью.
4. **Словарь:** добавить слово формой → появляется; озвучка 🔊; пусто-состояние.
5. **SRS-ревью:** показать ответ → 4 оценки → следующая карта → финальный экран; клавиатура (Space/1-4).
6. **ДЗ:** вставить текст / загрузить фото → «Проверить» → Proposal-карточки → Apply → исправления видны.
7. **Ассистент (центр):** открыть (кнопка/⌘K) → центр-бар → ввод «добавь слово…» → стрим → Proposal → Apply → инвалидция словаря; Esc/backdrop закрывает; история подгружается.
8. **Грамматика/Упражнения/Заметки:** списки, генерация упражнений, прохождение+грейд.
9. **Админка:** доступна админу; usage/провайдеры/юзеры/промпты/playground.
10. **Тема/язык:** dark/light тоггл; ru/en переключатель меняет интерфейс.
11. **A11y/отклик:** фокус-видимость, контраст AA, таб-навигация, поведение на 1280/768/390px.

Агент отдаёт: таблицу pass/fail + список «неудобно/сломано» с приоритетами. Баги чиним, спорный UX — в backlog. (Также: Playwright E2E из Phase 4 должен оставаться зелёным — селекторы по тексту устойчивы к смене темы.)

---

## 5. Acceptance
- Приложение визуально = `b-friendly-final.html` (gently-muted B), light+dark.
- Ассистент открывается **по центру снизу** (bar→window, scrim, Esc/⌘K), вся прежняя логика (стрим, propose/Apply, история, scope) работает.
- `tsc` чисто, `next build` зелёный, Playwright E2E зелёный.
- Прогон `ui-tester`: все 11 групп — *работает*; список UX-замечаний заведён (критичные — закрыты).
- Мобайл: ассистент = bottom-sheet, сайдбар = drawer.

## 6. Порядок работ
1. Токены + шрифты + tailwind (globals/layout/config) → визуальная база.
2. ui-примитивы (button/card/feedback) + дашборд стат-карточки + сайдбар-стрик.
3. Ассистент → центр (store state-машина + Bar/Window + ⌘K + scrim).
4. `motion`-переходы.
5. `tsc` + `build` + Playwright.
6. **Прогон `ui-tester`** → фиксы.
7. Мобильная адаптация (drawer/bottom-sheet) — если не успели в 2/3.

## 7. Результат внедрения + ui-тест (2026-06-13)
**Внедрено и проверено в браузере + `next build` зелёный (43 страницы), `tsc` чисто.** Тема «Friendly, gently muted» (Nunito, цветные стат-карточки, стрик из реальных дней, light+dark) + **центрированный гугл-стайл ассистент** (постоянная композер-строка снизу по центру → центр-окно над затемнённым scrim, ⌘K/Esc, история подгружается, стрим + Proposal Apply работают).

**Прогон агента `ui-tester` — вердикт PASS** (10/10 областей работают; 0 ошибок в консоли). Исправлено сразу:
- Текст-подсказка на дашборде «справа внизу» → «снизу по центру / ⌘K».
- Артикль больше не пропадал в карточке/ревью, если у слова нет gender.
- Мобильный drawer поднят над композером (`z-[60]`) + затемнение/blur.
- Удалён тестовый артефакт словаря (`Prüfling…` из e2e).

**Добито потом (вся спека закрыта):** полная **машина состояний** `collapsed (пилюля по центру с ⌘K) → hover → bar → window` (hover-intent 150/220ms); **Motion** (`motion@11`) — spring-анимации окна/scrim/пилюли; **⌘K-хинт** на пилюле; **цвета манифеста+иконки** под новую палитру (`#6C5FC9`/коралл); **Badge** — вес под Nunito; **мобильный bottom-sheet** ассистента (адаптив: full-width снизу, `rounded-t-3xl`); **перепрогон Playwright E2E — 5/5 зелёные**. `tsc` чисто, `next build` зелёный (43 страницы). Проверено в браузере: пилюля → клик → окно с motion-переходом, история подгружается.

**Осталось только опц. полировка (→ [[post-mvp-backlog]]):** слайд-анимация мобильного NAV-drawer (shadcn Sheet); обогащение ручной формы добавления слова через propose/Apply; чуть поднять контраст текста сайдбара в dark; PNG/maskable PWA-иконки. Вертикально-центрированный режим окна сознательно НЕ делаем — окно растёт вверх от центр-строки по эталону ToonyGamy.

## Related
- [[phase-6-design-directions]] · прототип `design/wireframes/b-friendly-final.html`
- ToonyGamy: `toonygamy-web/src/components/pages/aict/assistant/{AssistantDock,AssistantBar,AssistantWindow}.tsx`
