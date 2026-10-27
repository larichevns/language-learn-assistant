---
name: design-audit
description: Audit React frontend for UI consistency issues. Checks Tailwind CSS class patterns, component reuse, spacing/color consistency, responsive design, and design system adherence. Use when the UI looks inconsistent or before a major release.
argument-hint: [optional: path-to-frontend or feature-name]
context: fork
agent: Explore
allowed-tools: Read, Grep, Glob
---

# UI Design Consistency Audit

Analyze the React frontend for design inconsistencies and propose fixes.

## Step 1: Understand the Design System

1. Check for design system files:
   - `theme.js` / `theme.ts` - design tokens
   - `tailwind.config.*` - custom theme extensions
   - `globals.css` / `index.css` - base styles
   - UI component library (`components/ui/`)

2. Extract design tokens:
   - Color palette (primary, secondary, error, etc.)
   - Spacing scale
   - Typography scale (font sizes, weights)
   - Border radius values
   - Shadow values
   - Breakpoints

## Step 2: Audit Color Usage

Search for color-related Tailwind classes across all components:

### Check for:
- **Hardcoded colors** instead of theme tokens: `text-[#ff0000]` vs `text-red-500`
- **Inconsistent color shades**: Same semantic purpose using different shades (`bg-blue-500` vs `bg-blue-600` for primary buttons)
- **Color purpose mismatch**: Error messages not using error color, success not using green, etc.
- **Dark mode**: If supported, check all components handle dark variant

## Step 3: Audit Spacing

Search for spacing/padding/margin patterns:

### Check for:
- **Magic numbers**: `p-[13px]` instead of scale values
- **Inconsistent section spacing**: Different pages using different spacing for similar sections
- **Gap inconsistencies**: Card grids using different gap values
- **Padding patterns**: Similar components with different internal padding

## Step 4: Audit Typography

### Check for:
- **Font size consistency**: Headings at same level using different sizes
- **Font weight patterns**: Inconsistent bold/semibold usage
- **Line height**: Missing or inconsistent
- **Text color**: Body text not using a consistent color

## Step 5: Audit Components

### Check for:
- **Duplicate components**: Similar buttons/cards/modals created instead of reusing shared ones
- **Button variants**: Different button styles across pages for similar actions
- **Form inputs**: Different input styles, different error display patterns
- **Modals/Dialogs**: Different modal patterns across features
- **Tables**: Different table styles for similar data
- **Loading states**: Inconsistent loading indicators
- **Empty states**: Different patterns for "no data" views
- **Error states**: Different error display patterns

## Step 6: Audit Responsive Design

### Check for:
- **Missing breakpoints**: Components without responsive classes
- **Inconsistent breakpoints**: Some using `md:` while others use `lg:` for similar layouts
- **Mobile-first violations**: Desktop styles without mobile alternatives
- **Overflow issues**: Content that might overflow on small screens

## Step 7: Generate Report

```
## Design Audit Report

### Summary
- Components analyzed: X
- Issues found: X (Critical: X, Warning: X, Info: X)

### Critical Issues (fix now)
| File | Issue | Current | Should Be |
|------|-------|---------|-----------|
| ... | Hardcoded color | text-[#333] | text-gray-800 |

### Warnings (fix soon)
| File | Issue | Details |
|------|-------|---------|
| ... | Inconsistent button style | Uses custom vs shared Button component |

### Recommendations
1. Create shared components for: ...
2. Standardize spacing tokens: ...
3. Fix color palette usage: ...

### Component Reuse Opportunities
| Pattern | Files Using Custom | Suggested Shared Component |
|---------|-------------------|---------------------------|
| Confirmation modal | 5 files | ConfirmDialog component |
```

## Arguments

Frontend path or feature: $ARGUMENTS
