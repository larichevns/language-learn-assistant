---
name: i18n-audit
description: Audit internationalization coverage across React projects. Finds missing translation keys, hardcoded strings, unused keys, and inconsistencies between language files (EN/RU/TH/JA). Use when checking localization completeness or before release.
argument-hint: [optional: path-to-frontend]
context: fork
allowed-tools: Read, Grep, Glob, Bash(npx *)
---

# i18n Audit Skill

Perform a comprehensive internationalization audit of the React frontend.

## Step 1: Detect i18n Setup

1. Find the i18n config file (usually `i18n.ts` or `i18n.js`)
2. Identify translation namespaces and supported languages
3. Locate translation files (typically `/src/locales/{lang}/{namespace}.json`)

## Step 2: Find All Translation Key Usages

Search for patterns in source code:
```
t('key')
t("key")
t(`key`)
t('namespace:key')
useTranslation('namespace')
i18next.t('key')
```

Use Grep to find all usages and extract the keys.

## Step 3: Load All Translation Files

Read all JSON translation files for each language. Build a complete map:
- Language -> Namespace -> Keys

## Step 4: Cross-Reference Analysis

### 4a. Missing Keys
For each key used in code, check if it exists in ALL language files.
Report: `KEY | Missing in: RU, TH | Used in: src/pages/Dashboard.tsx:42`

### 4b. Hardcoded Strings
Search for common patterns of hardcoded text in JSX/TSX:
- String literals in JSX: `<h1>Some text</h1>`, `<button>Click me</button>`
- Placeholder attributes: `placeholder="Enter email"`
- Title attributes: `title="Home"`
- Alt text: `alt="Logo"`
- Error messages: `toast.error("Something went wrong")`

Exclude:
- CSS class names
- Component names
- URLs and paths
- Console logs
- Test files
- Comments

### 4c. Unused Keys
Keys in translation files that are not referenced in any source file.

### 4d. Inconsistent Values
Keys that exist in all languages but have suspicious values:
- Same value across languages (likely untranslated)
- Empty string values
- Placeholder text (TODO, FIXME, ...)

## Step 5: Generate Report

Output a structured report:

```
## i18n Audit Report

### Summary
- Total keys used in code: X
- Languages: EN, RU, TH
- Missing translations: X
- Hardcoded strings: X
- Unused keys: X
- Suspicious (untranslated): X

### Missing Translations (by priority)
| Key | Missing In | Used In |
|-----|-----------|---------|
| ... | RU, TH    | file:line |

### Hardcoded Strings (needs i18n)
| File:Line | Text | Suggested Key |
|-----------|------|--------------|
| ...       | ...  | ...          |

### Unused Keys (can be removed)
| Key | Exists In |
|-----|-----------|
| ... | EN, RU    |

### Suspicious Values
| Key | Issue |
|-----|-------|
| ... | Same value in EN and RU |
```

## Arguments

Frontend path: $ARGUMENTS
