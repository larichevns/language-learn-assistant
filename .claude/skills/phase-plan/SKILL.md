---
name: phase-plan
description: Generate a phased implementation plan for new projects or major modules. Breaks work into sequential phases (Infrastructure, Auth, Core Features, Advanced, Polish) with detailed subtasks, dependencies, and estimates. Use when starting a new project or planning a major feature.
argument-hint: [project-or-module-name] [optional: brief description]
disable-model-invocation: false
---

# Phased Implementation Planning

Generate a structured, phased plan for implementing a project or major module.

## Before Planning

1. Gather requirements from the user:
   - What is being built?
   - Who are the users/roles?
   - What are the core features?
   - Any existing code or infrastructure?
   - External integrations needed?
   - Timeline constraints?

2. If this is for an existing project, read `CLAUDE.md` to understand:
   - Current architecture
   - Existing patterns to follow
   - Tech stack constraints

## Phase Structure

### Phase 0: Foundation & Infrastructure
**Goal:** Project skeleton, development environment, CI/CD

Typical tasks:
- Project scaffolding (.NET solution + React app)
- Database setup (PostgreSQL + EF Core)
- Docker configuration
- Environment variables setup
- CI/CD pipeline (GitHub Actions)
- CLAUDE.md initial documentation

### Phase 1: Authentication & User Management
**Goal:** Users can register, login, and manage profiles

Typical tasks:
- User entity and migrations
- Registration endpoint
- Login with JWT (access + refresh tokens)
- Password hashing (BCrypt)
- Auth middleware
- Frontend auth flow (login/register pages)
- Protected routes
- Profile CRUD

### Phase 2: Core Features (1-3 features)
**Goal:** Primary business value delivered

Identify the 1-3 features that define the product. Break each into:
- Entity models + migrations
- Service layer with business logic
- Controller endpoints
- Frontend pages and components
- Unit tests for services

### Phase 3: Advanced Features
**Goal:** Enhanced functionality, integrations

Typical tasks:
- Payment integration
- Real-time features (SignalR)
- File uploads
- Email/SMS notifications
- Background jobs
- Search and filtering
- Reports and analytics

### Phase 4: Polish & Production
**Goal:** Production-ready application

Typical tasks:
- Error handling and logging
- Performance optimization
- Security audit (CORS, rate limiting, input validation)
- Responsive design review
- Internationalization (if needed)
- Documentation update
- Load testing
- Deployment to production

## Output Format

Generate the plan as a markdown document:

```markdown
# Implementation Plan: {Project Name}

## Overview
Brief description of the project and its goals.

## Tech Stack
- Backend: .NET 9, EF Core, PostgreSQL
- Frontend: React 19, TypeScript, Vite, Tailwind CSS
- Real-time: SignalR
- Deployment: Docker, GitHub Actions

## Phases

### Phase 0: Foundation
| # | Task | Description | Dependencies |
|---|------|-------------|-------------|
| 0.1 | ... | ... | - |

### Phase 1: Authentication
| # | Task | Description | Dependencies |
|---|------|-------------|-------------|
| 1.1 | ... | ... | 0.x |

(repeat for all phases)

## Risk Assessment
- Key technical risks and mitigation strategies

## Notes
- Assumptions made
- Open questions to resolve
```

## Guidelines

- Each phase should be independently deployable
- Backend before frontend within each phase
- Tests alongside implementation, not after
- Phases 2-3 can have parallel tracks for backend/frontend
- Keep each task small enough to complete in one session
- Flag tasks that need user decisions

## Arguments

Project/module: $ARGUMENTS
