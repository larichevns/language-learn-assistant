---
name: test-feature
description: Generate comprehensive xUnit tests for a .NET feature service or controller. Creates unit tests with Moq, FluentAssertions, and EF Core InMemory following Method_Scenario_ExpectedResult naming convention. Use when adding tests for new or existing features.
argument-hint: [ServiceName or FeatureName] [optional: project-path]
disable-model-invocation: false
allowed-tools: Read, Grep, Glob, Bash(dotnet *)
---

# Test Generation for .NET Features

Generate comprehensive unit tests following the project's testing conventions.

## Step 1: Analyze the Target

1. Read the service/controller file to understand:
   - All public methods
   - Dependencies (injected via constructor)
   - Return types
   - Business logic and edge cases
   - Exception types thrown

2. Read existing test files to match:
   - Test class structure
   - Setup/fixture patterns
   - Assertion style
   - Naming conventions

## Step 2: Test Structure

Follow the project's test organization:
```
tests/{ProjectName}.Tests/
├── Features/           # or Services/
│   └── {Feature}/
│       └── {Feature}ServiceTests.cs
```

### Test Class Template
```csharp
using FluentAssertions;
using Moq;
using Xunit;

public class {Service}Tests
{
    private readonly Mock<AppDbContext> _contextMock;
    private readonly Mock<ILogger<{Service}>> _loggerMock;
    private readonly {Service} _sut; // System Under Test

    public {Service}Tests()
    {
        // Setup mocks and create SUT
    }
}
```

## Step 3: Test Categories

Generate tests for each public method covering:

### Happy Path
- Standard successful execution
- With all optional parameters
- With minimum required parameters

### Validation / Edge Cases
- Null/empty input
- Invalid IDs (Guid.Empty, non-existent)
- Duplicate entries (if applicable)
- Boundary values (max length, min/max numbers)

### Error Cases
- Entity not found → expect NotFoundException or 404
- Validation failure → expect ValidationException or 400
- Unauthorized access → expect UnauthorizedException or 403
- Conflict (duplicate, in-use) → expect 409

### List/Pagination
- Empty list returns proper response
- Pagination parameters work correctly
- Filtering/sorting works

### Delete Operations
- Successful delete
- Delete non-existent entity
- Delete entity with dependencies (FK check)

## Step 4: Naming Convention

Always use: `Method_Scenario_ExpectedResult`

Examples:
```csharp
[Fact]
public async Task GetById_WithValidId_ReturnsFullDto()

[Fact]
public async Task GetById_WithNonExistentId_ThrowsNotFoundException()

[Fact]
public async Task Create_WithValidDto_ReturnsCreatedEntity()

[Fact]
public async Task Create_WithDuplicateName_ThrowsConflictException()

[Fact]
public async Task Delete_WhenEntityInUse_ThrowsConflictException()

[Theory]
[InlineData(0)]
[InlineData(-1)]
public async Task GetList_WithInvalidPage_ThrowsValidationException(int page)
```

## Step 5: EF Core InMemory Setup

For tests that need database:
```csharp
private AppDbContext CreateInMemoryContext()
{
    var options = new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
        .Options;
    return new AppDbContext(options);
}
```

## Step 6: Verify Tests

```bash
dotnet test {test-project-path} --filter "FullyQualifiedName~{ServiceName}Tests"
```

All tests must pass. Fix any failures before finishing.

## Step 7: Coverage Summary

Report what was covered:
- Total test methods created
- Methods tested vs total public methods
- Edge cases covered
- Any untestable methods (explain why)

## Arguments

Target service/feature: $ARGUMENTS[0]
Project path: $ARGUMENTS[1]
