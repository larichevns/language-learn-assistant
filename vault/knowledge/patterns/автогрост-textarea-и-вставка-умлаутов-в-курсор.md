---
tags: [patterns, frontend, ui, writing, i18n-de]
date: 2026-06-17
---

# Автогрост-textarea + вставка немецких умлаутов в курсор

Семейство «удобного письма» для заметок/домашек/практики. Заменило голые shadcn-textbox'ы
(фикс. высота, ручной resize, 14px). Живёт в `components/writing/` + апгрейд примитивов в
`components/ui/field.tsx`.

## Компоненты

- **`components/ui/field.tsx`** (`'use client'`): `Textarea` теперь **автогрост** (`autoSize` по умолчанию `true`), `text-base`/`leading-relaxed`, `min-h-[96px]`, `resize-none overflow-hidden`. `Input` — `h-11`, `text-base`. Любой `<Textarea>` в проекте растёт под текст без правок на месте.
- **`components/writing/use-insertable-field.ts`** — `useInsertableField(value, onChange)` → `{ ref, insert }`. Вставляет текст в позицию каретки контролируемого поля и восстанавливает каретку после ре-рендера. Generic: `<HTMLTextAreaElement>` (по умолч.) или `<HTMLInputElement>`.
- **`components/writing/german-char-bar.tsx`** — `GermanCharBar` (чипы `ä ö ü ß / Ä Ö Ü ẞ / „ "`), `handleGermanAltKey(e, insert)` (Alt+a/o/u/s, Shift→заглавные), `GERMAN_ALT_MAP`.
- **`components/writing/composer.tsx`** — `Composer`: рамка «одна поверхность» (заголовок + автогрост-тело + панель умлаутов + счётчик слов + ⌘↵-сабмит + слот `footerLeft` + `children`). Используется на Заметках и Домашках.

## Ключевые гочи (почему именно так)

1. **Вставка в курсор без потери фокуса** — чипы стреляют по **`onMouseDown` + `preventDefault()`** (НЕ `onClick`) и имеют `tabIndex={-1}`. Иначе клик по кнопке уводит фокус из textarea и сбрасывает `selectionStart` → символ улетает не туда. Проверено live: после 4 кликов по чипам `document.activeElement === TEXTAREA`.
2. **Каретка после ре-рендера** — поле контролируемое, значение меняется только на следующий рендер. Поэтому `insert` запоминает желаемую позицию в `useRef`, а `useLayoutEffect([value])` ставит `setSelectionRange` уже после коммита React.
3. **`mergeRefs` (в `lib/utils.ts`)** — `Textarea` держит **внутренний** ref (мерит себя для автороста) и **форвардит** ref наружу (для каретки). Оба указывают на один DOM-узел только через `mergeRefs(innerRef, ref)`.
4. **Автогрост без дрожания** — `el.style.height='auto'` (чтобы поле могло ужаться), затем `height = scrollHeight + (offsetHeight - clientHeight)`; поправка `offsetHeight - clientHeight` = вертикальные бордеры (под `box-border` `scrollHeight` их не включает). `min-height` в CSS — пол: перебивает inline `height`, если контента мало.
5. **16px (`text-base`) на полях** — на iOS 14px-инпут вызывает авто-зум при фокусе (это PWA). 16px убирает зум.
6. **Alt-хоткей и macOS dead-key** — Option+a на маке — мёртвая клавиша для умлаутов; наш `preventDefault` в `keydown` её гасит и сам вставляет `ä`. Проверено live: `Alt+a` → `ä`, фокус сохранён. `handleGermanAltKey` игнорирует AltGr (Ctrl+Alt на Windows), чтобы не ломать чужие раскладки.
7. **`'ß'.toUpperCase()` === `"SS"`**, не `ẞ` — заглавные берём из явной мапы `GERMAN_CAPS`, не из `.toUpperCase()`.

## Где подключено

Заметки/Домашки → `Composer` (у домашки кнопка «Фото» в `footerLeft`, превью в `children`).
Грамм-практика (`grammar/review`) → автогрост-`Textarea` + `GermanCharBar`. Ответы упражнений
(`exercises/[id]`) и vocab-recall (`vocabulary/review`) → `useInsertableField` + панель умлаутов
**по фокусу** (у vocab — только когда ответ немецкий, `view.answerDe`). i18n счётчика —
`common.words/chars` (ICU plural), aria — `common.insertChar`.

## Сознательно НЕ тронуто

**Assistant-док** (`components/assistant/assistant-dock.tsx`) — отдельно спроектированный
hero-композер (pill→bar→window, Enter-to-send). Не оборачивали в `Composer` и не вешали
панель умлаутов, чтобы не сломать его поведение/анимации. Идея «умлауты в ассистенте» — в
[[post-mvp-backlog]].

## Связано
- [[conventions]] (Frontend patterns)
- [[TTS-читал-по-английски-голоса-Web-Speech-грузятся-асинхронно]] — другой немецко-специфичный UX-гоч
