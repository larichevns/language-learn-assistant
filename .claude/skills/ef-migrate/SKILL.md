---
name: ef-migrate
description: Safely create and apply Entity Framework Core migrations with validation. Checks for pending model changes, generates migration, reviews SQL, validates rollback capability, and applies to database. Use when adding/modifying database entities.
argument-hint: [MigrationName] [optional: project-path]
disable-model-invocation: false
allowed-tools: Read, Grep, Glob, Bash(dotnet *)
---

# Safe EF Core Migration

Create and apply Entity Framework Core migrations with safety checks.

## Step 1: Pre-flight Checks

1. Verify the .NET project builds:
   ```bash
   dotnet build $1
   ```
   If build fails - stop and fix first.

2. Check for pending model changes:
   ```bash
   dotnet ef migrations has-pending-model-changes --project $1
   ```

3. List existing migrations to understand current state:
   ```bash
   dotnet ef migrations list --project $1
   ```

## Step 2: Review Model Changes

Before creating the migration:
1. Read the entity files that changed (use git diff if available)
2. Read the `AppDbContext` / `ApplicationDbContext` for new DbSets or configuration changes
3. Identify what the migration should do:
   - New tables
   - New columns
   - Changed column types
   - New indexes
   - New foreign keys
   - Dropped columns/tables

## Step 3: Create Migration

```bash
dotnet ef migrations add $0 --project $1
```

## Step 4: Review Generated Migration

1. Read the generated migration file in `Migrations/` directory
2. Check both `Up()` and `Down()` methods
3. Verify:
   - [ ] Correct table/column names
   - [ ] Correct data types and nullable settings
   - [ ] Indexes are appropriate
   - [ ] Foreign keys have correct cascade behavior
   - [ ] `Down()` properly reverses all changes
   - [ ] No data loss operations without explicit confirmation

## Step 5: Generate SQL Script (for review)

```bash
dotnet ef migrations script --idempotent --project $1
```

Review the SQL to ensure it's safe.

## Step 6: Dangerous Operation Check

Flag and ask for confirmation if the migration:
- Drops a table (`migrationBuilder.DropTable`)
- Drops a column (`migrationBuilder.DropColumn`)
- Changes column type (potential data loss)
- Renames a table/column (needs data preservation)
- Removes an index on a large table (performance impact)

## Step 7: Apply Migration

```bash
dotnet ef database update --project $1
```

## Step 8: Verify

1. Confirm migration applied successfully
2. Check that the app still builds:
   ```bash
   dotnet build $1
   ```
3. Run tests to catch any breaking changes:
   ```bash
   dotnet test
   ```

## Rollback (if needed)

To rollback to the previous migration:
```bash
dotnet ef database update {PreviousMigrationName} --project $1
dotnet ef migrations remove --project $1
```

## Arguments

Migration name: $ARGUMENTS[0]
Project path: $ARGUMENTS[1]
