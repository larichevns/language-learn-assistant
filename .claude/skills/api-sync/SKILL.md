---
name: api-sync
description: Compare .NET backend DTOs with TypeScript frontend types/interfaces. Finds field mismatches, type inconsistencies, missing properties, and naming convention issues (PascalCase vs camelCase). Use when API contracts seem out of sync or after backend changes.
argument-hint: [optional: feature-name]
context: fork
allowed-tools: Read, Grep, Glob
---

# API Contract Sync Checker

Compare .NET backend DTOs with TypeScript frontend types to find mismatches.

## Step 1: Discover Backend DTOs

Search for DTO classes in the .NET project:
- Files matching `*Dto.cs`, `*Request.cs`, `*Response.cs`
- Classes with `Dto`, `Request`, `Response` suffix
- Record types used as DTOs

For each DTO, extract:
- Class/record name
- Properties with types
- Nullable annotations
- Validation attributes (`[Required]`, `[MaxLength]`, etc.)

## Step 2: Discover Frontend Types

Search for TypeScript interfaces/types in the frontend:
- Files in `types/`, `models/`, `interfaces/` directories
- Inline types in API service files
- Types in `.ts` and `.tsx` files matching DTO names

For each type, extract:
- Interface/type name
- Properties with types
- Optional markers (`?`)

## Step 3: Match DTOs to Frontend Types

Map .NET DTOs to TypeScript types by name:
- `UserDto` (C#) -> `User` or `UserDto` (TS)
- `CreateUserDto` (C#) -> `CreateUserRequest` or `CreateUserDto` (TS)

Also check API service methods for inline response types.

## Step 4: Compare Properties

For each matched pair, compare:

### 4a. Missing Properties
- Property exists in backend but not frontend (frontend won't receive data)
- Property exists in frontend but not backend (frontend will get undefined)

### 4b. Type Mismatches
Map .NET types to TypeScript equivalents:

| .NET | TypeScript |
|------|-----------|
| `string` | `string` |
| `int`, `long`, `decimal`, `double`, `float` | `number` |
| `bool` | `boolean` |
| `Guid` | `string` |
| `DateTime`, `DateTimeOffset` | `string` or `Date` |
| `List<T>`, `IEnumerable<T>` | `T[]` or `Array<T>` |
| `T?` (nullable) | `T \| null` or `T?` |
| `enum` | `string` or union type |

### 4c. Naming Convention Issues
- .NET uses PascalCase: `FirstName`
- TypeScript typically uses camelCase: `firstName`
- Check if axios/fetch interceptor handles conversion
- Flag mismatches if no auto-conversion is set up

### 4d. Nullable Mismatches
- .NET `string?` should map to optional or nullable in TS
- Required .NET properties should not be optional in TS

## Step 5: Check API Endpoints

Compare controller routes with frontend API service calls:
- HTTP methods match (GET, POST, PUT, DELETE)
- Route parameters match
- Query parameters match
- Request body shape matches

## Step 6: Generate Report

```
## API Sync Report

### Summary
- Backend DTOs analyzed: X
- Frontend types analyzed: X
- Matched pairs: X
- Mismatches found: X

### Field Mismatches
| DTO | Property | Backend | Frontend | Issue |
|-----|----------|---------|----------|-------|
| UserDto | middleName | string? | missing | Not in frontend type |

### Type Mismatches
| DTO | Property | Backend Type | Frontend Type |
|-----|----------|-------------|--------------|
| OrderDto | total | decimal | string |

### Endpoint Mismatches
| Endpoint | Backend | Frontend | Issue |
|----------|---------|----------|-------|
| GET /api/users | page, pageSize | page, limit | Different param names |

### Recommendations
- Add missing frontend types for: ...
- Fix type mappings for: ...
- Update API service calls for: ...
```

If a specific feature is provided, focus only on that feature's DTOs and types.

## Arguments

Feature to check: $ARGUMENTS
