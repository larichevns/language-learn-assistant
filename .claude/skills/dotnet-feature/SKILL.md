---
name: dotnet-feature
description: Scaffold a complete .NET feature module with Controller, Service, Interface, DTOs, Entity, Migration, and Unit Tests following the project's feature-driven Clean Architecture pattern. Use when creating a new feature, endpoint, or module in any .NET project.
argument-hint: [FeatureName] [optional: project-path]
disable-model-invocation: false
---

# .NET Feature Scaffolding

Create a complete feature module following the project's established architecture patterns.

## Before Starting

1. Read the project's `CLAUDE.md` to understand the exact folder structure
2. Examine 1-2 existing features to match naming conventions and patterns
3. Ask the user for:
   - Feature name (e.g., `Invoices`, `Payments`)
   - Main entity fields and relationships
   - Required endpoints (CRUD or custom)
   - Any special business logic

## Architecture Detection

Detect which pattern the project uses:

**Pattern A - Feature-Driven (TOSS-style):**
```
src/ProjectName/Features/{Feature}/
├── {Feature}Controller.cs
├── {Feature}Service.cs
├── I{Feature}Service.cs
└── {Feature}Dto.cs
```

**Pattern B - Layered (ToonyGamy-style):**
```
ProjectName/
├── Controllers/{Feature}Controller.cs
├── Services/{Feature}Service.cs
├── Models/{Feature}.cs
├── Dtos/{Feature}Dto.cs
```

## Generation Steps

### 1. Entity Model
- Add to `Data/` or `Models/` depending on project structure
- Include standard fields: `Id` (Guid), `CreatedAt`, `UpdatedAt`
- Add EF Core configuration (fluent API) if project uses it
- Add `DbSet<T>` to the `AppDbContext`

### 2. DTOs
Follow the project's DTO conventions:
- `{Feature}ShortDto` - for list views (ID + key fields)
- `{Feature}FullDto` - for detail views (all fields + relations)
- `Create{Feature}Dto` - for creation (required fields, validation attributes)
- `Update{Feature}Dto` - for updates (optional fields)

### 3. Service Interface
```csharp
public interface I{Feature}Service
{
    Task<ListResponse<{Feature}ShortDto>> GetListAsync(int page, int pageSize);
    Task<{Feature}FullDto> GetByIdAsync(Guid id);
    Task<{Feature}FullDto> CreateAsync(Create{Feature}Dto dto);
    Task<{Feature}FullDto> UpdateAsync(Guid id, Update{Feature}Dto dto);
    Task DeleteAsync(Guid id);
}
```

### 4. Service Implementation
- Inject `AppDbContext` and `ILogger<T>`
- Use project's pagination pattern (`ListResponse<T>` or custom)
- Match existing error handling (throw specific exceptions or return Result types)
- Add entity mapping (manual or AutoMapper depending on project)

### 5. Controller
- Match project's route pattern (`[Route("api/[controller]")]` or minimal API)
- Add authorization attributes matching project's auth scheme
- Return consistent response format (check existing controllers)
- Add Swagger/OpenAPI attributes if project uses them

### 6. Register Services
- Add `builder.Services.AddScoped<I{Feature}Service, {Feature}Service>();` in `Program.cs`

### 7. EF Core Migration
```bash
dotnet ef migrations add Add{Feature} --project {project-path}
```

### 8. Unit Tests
Create in the test project following the pattern `{Feature}ServiceTests.cs`:
- Use xUnit `[Fact]` and `[Theory]`
- Mock dependencies with Moq
- Use FluentAssertions
- Naming: `Method_Scenario_ExpectedResult`
- Test at minimum: Create, GetById, GetList, Update, Delete
- Test edge cases: NotFound, ValidationError, DuplicateEntry

## Validation Checklist

After generating all files:
- [ ] Build succeeds: `dotnet build`
- [ ] Tests pass: `dotnet test`
- [ ] Migration applies: `dotnet ef database update`
- [ ] Swagger shows new endpoints
- [ ] Patterns match existing features exactly

## Arguments

Feature name: $ARGUMENTS[0]
Project path (optional): $ARGUMENTS[1]
