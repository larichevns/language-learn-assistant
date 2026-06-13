---
tags: [spec]
date: {YYYY-MM-DD}
status: draft
---

# Spec: {FEATURE_NAME}

## Description
{What it does, for whom, why it's needed}

## User Stories
- As a {role}, I want {action}, so that {result}
- As a {role}, I want {action}, so that {result}
- As a {role}, I want {action}, so that {result}

## Data Model

### {table_name}
| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |

**Indexes:** {list indexes with rationale}
**FK:** {list foreign keys with cascade behavior}
**RLS:** {row-level security policies if applicable}

## API

| Method | Path | Body | Response | Codes |
|--------|------|------|----------|-------|
| POST | /api/{resource} | CreateDto | FullDto | 201, 400, 409 |
| GET | /api/{resource} | - | ListResponse | 200 |
| GET | /api/{resource}/{id} | - | FullDto | 200, 404 |
| PUT | /api/{resource}/{id} | UpdateDto | FullDto | 200, 400, 404 |
| DELETE | /api/{resource}/{id} | - | - | 204, 404, 409 |

## Screens

### {Page Name}
- **Route**: /path
- **Components**: {list components}
- **States**: loading, error, empty, data
- **Actions**: {user interactions}

## Business Logic
- {validation rules}
- {state transitions}
- {constraints and formulas}

## Edge Cases
- {What if no data?}
- {What if API is down?}
- {What if concurrent edits?}
- {What if max limits reached?}

## Priority / Dependencies
- **Priority**: {P0/P1/P2}
- **Depends on**: [[other-spec-or-note]]
- **Blocks**: [[downstream-feature]]
