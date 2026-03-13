# 📝 Senior Engineer — Working Notes

---

## Git Branching Strategy — Personal Bot

**Model:** Simplified GitFlow (adapted for small multi-agent team)

### Branch Structure

```
main ─────────────────────────────────────────► (production-ready releases)
  │
  └── develop ────────────────────────────────► (integration branch, latest working state)
        │
        ├── feature/voice-pipeline ───────────► (Voice-AI Engineer)
        ├── feature/core-api ─────────────────► (Backend Engineer)
        ├── feature/mobile-ui ────────────────► (Frontend Engineer)
        ├── feature/ai-service ───────────────► (Logic-AI Designer)
        ├── feature/meeting-notes ────────────► (cross-cutting feature)
        ├── docs/architecture ────────────────► (Documentation Engineer)
        └── ...
```

### Branch Naming Convention

| Branch Type | Pattern                | Example                   |
| ----------- | ---------------------- | ------------------------- |
| **Main**    | `main`                 | `main`                    |
| **Develop** | `develop`              | `develop`                 |
| **Feature** | `feature/<short-desc>` | `feature/voice-pipeline`  |
| **Bugfix**  | `fix/<short-desc>`     | `fix/auth-token-refresh`  |
| **Hotfix**  | `hotfix/<short-desc>`  | `hotfix/crash-on-launch`  |
| **Release** | `release/v<semver>`    | `release/v0.1.0`          |
| **Docs**    | `docs/<short-desc>`    | `docs/api-contracts`      |
| **Chore**   | `chore/<short-desc>`   | `chore/ci-pipeline-setup` |

### Branching Rules

1. **`main`** — protected, only receives merges from `release/*` or `hotfix/*` branches, always tagged with a version
2. **`develop`** — integration branch, all feature branches merge here first via PR
3. **Feature branches** — created from `develop`, merged back into `develop` when complete
4. **Release branches** — created from `develop` when ready to cut a release, merged into both `main` and `develop`
5. **Hotfix branches** — created from `main` for urgent production fixes, merged into both `main` and `develop`

---

## Commit Message Convention

**Format:** [Conventional Commits](https://www.conventionalcommits.org/) v1.0.0

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

### Types

| Type       | Usage                                                 |
| ---------- | ----------------------------------------------------- |
| `feat`     | New feature                                           |
| `fix`      | Bug fix                                               |
| `docs`     | Documentation only                                    |
| `style`    | Formatting, no code logic change                      |
| `refactor` | Code change that neither fixes a bug nor adds feature |
| `test`     | Adding or updating tests                              |
| `chore`    | Build process, CI, tooling, dependencies              |
| `perf`     | Performance improvement                               |

### Scopes (aligned with architecture)

| Scope       | Component             |
| ----------- | --------------------- |
| `mobile`    | React Native client   |
| `api`       | Core API (Express)    |
| `voice`     | Voice Service / STT   |
| `ai`        | AI Service / LLM      |
| `db`        | Database / migrations |
| `auth`      | Authentication        |
| `templates` | Template system       |
| `meetings`  | Meeting notes feature |
| `ci`        | CI/CD pipeline        |
| `docs`      | Documentation         |

### Examples

```
feat(voice): implement real-time audio streaming to Deepgram
fix(api): handle null project_id in meeting notes creation
docs(architecture): add voice pipeline timing budget
chore(ci): configure GitHub Actions for Expo EAS Build
test(ai): add unit tests for intent parsing edge cases
```

---

## Semantic Versioning Strategy

**Format:** `vMAJOR.MINOR.PATCH` per [semver.org](https://semver.org/)

### Pre-v1.0 (MVP Development)

| Version    | Meaning                              |
| ---------- | ------------------------------------ |
| `v0.1.0`   | Initial project scaffold + CI setup  |
| `v0.2.0`   | Core API CRUD + database schema      |
| `v0.3.0`   | Voice pipeline integration           |
| `v0.4.0`   | AI intent parsing + action execution |
| `v0.5.0`   | Mobile UI + template views           |
| `v0.6.0`   | Meeting notes feature                |
| `v0.x.y`   | Bug fixes within minor versions      |
| **v1.0.0** | **MVP release — all core features**  |

### Post-v1.0

- **MAJOR** — breaking API/schema changes
- **MINOR** — new features (calendar integration, multi-user, etc.)
- **PATCH** — bug fixes, performance improvements

---

## Release Checklist

Before tagging any release:

- [ ] All feature branches merged to `develop`
- [ ] All tests passing on `develop`
- [ ] Create `release/vX.Y.Z` branch from `develop`
- [ ] Update version number in `package.json` / `app.json`
- [ ] Update `CHANGELOG.md` with what changed
- [ ] Final testing on release branch
- [ ] Merge release branch → `main`
- [ ] Tag `main` with `vX.Y.Z`
- [ ] Merge release branch → `develop` (back-merge)
- [ ] Push tag to GitHub
- [ ] Create GitHub Release with release notes

---

## PR / Code Review Requirements

1. **All merges to `develop` require a PR** — no direct pushes
2. **PR checklist:**
   - [ ] Code follows project conventions (naming, structure)
   - [ ] No hardcoded secrets or API keys
   - [ ] New features have corresponding tests
   - [ ] Documentation updated if API changed
   - [ ] No merge conflicts
3. **Review turnaround:** < 24 hours (hackathon pace)
4. **Minimum 1 approval** required (ideally from Senior Engineer or relevant domain agent)

---

## CI/CD Pipeline Plan (GitHub Actions)

```
push/PR to develop or main
      │
      ▼
┌─────────────┐
│ 1. LINT     │  ESLint + Prettier check
└──────┬──────┘
       ▼
┌─────────────┐
│ 2. TEST     │  Jest unit + integration tests
└──────┬──────┘
       ▼
┌─────────────┐
│ 3. BUILD    │  Expo EAS Build (on PR to main only)
└──────┬──────┘
       ▼
┌─────────────┐
│ 4. DEPLOY   │  Expo EAS Submit (on tag push only)
└─────────────┘
```

**Config files needed (when code begins):**

- `.github/workflows/ci.yml` — lint + test on PR
- `.github/workflows/release.yml` — build + deploy on tag
- `.eslintrc.js` — ESLint config (React Native + TypeScript)
- `.prettierrc` — Prettier config
- `jest.config.js` — Jest config

---

## Current Repo State Assessment (2026-03-07)

- **Repo:** `charlesyapai/personal_assistant_application` on GitHub
- **Commits:** 1 (initial agent structure)
- **Branches:** `main` only — no `develop` yet
- **Untracked work:** 17+ files/folders from PM, Architecture Designer, UX Designer, and all agent mailboxes
- **Immediate need:** Stage and commit current multi-agent planning documents, then create `develop` branch

### Recommended Immediate Git Actions

1. Stage and commit all current planning documents with proper message
2. Create `develop` branch from `main`
3. Push both to origin
4. Set up branch protection rules on GitHub (when ready)

---

_Last updated: 2026-03-07 4:15 PM_
