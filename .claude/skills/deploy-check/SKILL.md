---
name: deploy-check
description: Pre-deployment validation checklist. Runs build, tests, migration check, Docker build, environment config validation, and security checks before deploying. Use before pushing to production or staging.
argument-hint: [optional: project-path]
disable-model-invocation: false
allowed-tools: Read, Grep, Glob, Bash(dotnet *), Bash(npm *), Bash(docker *), Bash(git *)
---

# Pre-Deployment Check

Run comprehensive validation before deployment.

## Step 1: Git Status Check

```bash
git status
git log --oneline -5
```

- Verify on correct branch
- No uncommitted changes
- Latest changes committed

## Step 2: Backend Checks

### 2a. Build
```bash
dotnet build --configuration Release
```
Must succeed with zero errors. Warnings should be reviewed.

### 2b. Tests
```bash
dotnet test --configuration Release
```
All tests must pass. Report any failures.

### 2c. Pending Migrations
```bash
dotnet ef migrations has-pending-model-changes --project {path}
```
If pending changes exist - migration is needed before deploy.

### 2d. Environment Config
Check that all required environment variables are documented:
- Read `appsettings.json` for config sections
- Compare with `.env.example` or documentation
- Flag any secrets that might be hardcoded
- Verify connection strings use environment variables

## Step 3: Frontend Checks

### 3a. Type Check
```bash
npm run typecheck
# or: npx tsc --noEmit
```

### 3b. Lint
```bash
npm run lint
```

### 3c. Build
```bash
npm run build
```
Must succeed. Check bundle size for anomalies.

### 3d. Environment Variables
- Check all `VITE_*` or `REACT_APP_*` variables are documented
- Verify API URL is not hardcoded to localhost
- Check for console.log statements in production code

## Step 4: Docker Check

### 4a. Docker Build
```bash
docker-compose build
```

### 4b. Docker Compose Validation
```bash
docker-compose config
```
Verify compose file is valid.

## Step 5: Security Quick Scan

### 5a. Hardcoded Secrets
Search for potential secrets in code:
- API keys, tokens, passwords in source files
- `.env` files committed to git
- Credentials in Docker files

### 5b. CORS Configuration
- Verify CORS allows only expected origins
- No wildcard `*` in production

### 5c. Auth Configuration
- JWT secret is from environment, not hardcoded
- Token expiration is reasonable
- HTTPS enforcement in production

### 5d. Dependencies
Check for known vulnerabilities:
```bash
dotnet list package --vulnerable
npm audit
```

## Step 6: Generate Report

```
## Pre-Deploy Report

### Status: READY / NOT READY

### Backend
- [x] Build: OK
- [x] Tests: 42 passed, 0 failed
- [x] No pending migrations
- [x] Environment config: OK

### Frontend
- [x] TypeScript: No errors
- [x] Lint: Clean
- [x] Build: OK (bundle: 450KB)
- [ ] Warning: console.log found in 3 files

### Docker
- [x] Build: OK
- [x] Compose: Valid

### Security
- [x] No hardcoded secrets
- [x] CORS: OK
- [ ] Warning: npm audit found 2 moderate vulnerabilities

### Action Items (must fix before deploy)
1. ...

### Warnings (can deploy, fix later)
1. ...
```

## Arguments

Project path: $ARGUMENTS
