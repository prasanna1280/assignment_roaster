# INITIAL.md - Assignment Roaster Product Definition

> AI code review for student assignments: submit a GitHub repo and get a friendly, honest roast in Tanglish, plus a score and concrete fixes.

---

## PRODUCT

### Name
Assignment Roaster

### Description
Assignment Roaster helps students improve their coding assignments. A student pastes a **public** GitHub repo link and can add the assignment brief. The backend fetches the code, filters out noise (dependencies, build output, binaries) and sends the relevant files to OpenAI. The model returns a review written as a friendly, honest roast in **Tanglish** (Tamil and English, written in Latin script).

Every roast includes:
- An **overall score** (0–10)
- **Category scores**: Code Quality, Structure, Readability, Documentation, Testing, Best Practices
- **What you did well** (strengths)
- **What to fix**: specific issues with file references and suggested fixes
- The **roast** itself: funny, never mean, always useful

The roast targets the code and never the student.

### Target User
Students in the community (college students, bootcamp learners and self-taught developers) who push their assignments and projects to GitHub and want quick, honest, relatable feedback before submitting or showcasing their work.

### Type
- [x] SaaS (Software as a Service)

---

## TECH STACK

### Backend
- [x] FastAPI + Python 3.11+

### Frontend
- [x] React + Vite + TypeScript

### Database
- [x] PostgreSQL + SQLAlchemy + Alembic

### Authentication
- [x] Email/Password sign up + login
- [x] Google OAuth sign up + login ("Continue with Google")
- [x] JWT access + refresh tokens

### UI Framework
- [x] Chakra UI + Framer Motion

### AI
- [x] OpenAI API (model set by `OPENAI_MODEL`, default `gpt-4o`) for generating roasts, using Structured Outputs (JSON schema)

### Payments
- [ ] None. Free for the student community.

---

## MODULES

### Module 1: Authentication (Required)

**Description:** User authentication and authorization.

**Models:**
- User: id, email, hashed_password (nullable for OAuth users), full_name, avatar_url, is_active, is_verified, is_admin, oauth_provider, created_at, updated_at
- RefreshToken: id, user_id (FK), token, expires_at, revoked, created_at

**API Endpoints:**
- POST /api/v1/auth/register - Create new account
- POST /api/v1/auth/login - Login with email/password
- POST /api/v1/auth/refresh - Refresh access token
- POST /api/v1/auth/logout - Revoke refresh token
- GET /api/v1/auth/me - Get current user profile
- PUT /api/v1/auth/me - Update profile
- GET /api/v1/auth/google - Start Google OAuth flow
- GET /api/v1/auth/google/callback - Google OAuth callback (verifies state)

**Frontend Pages:**
- /login - Login page (email/password + "Continue with Google")
- /register - Registration page
- /forgot-password - Forgot password page
- /profile - User profile page (protected)

---

### Module 2: Submissions & Roasts (Core)

**Description:** Students submit a GitHub repo and receive an AI-generated Tanglish roast. Processing runs asynchronously. Status goes `queued → fetching → analyzing → completed` (or `failed`), and the frontend polls for updates.

**Models:**
```
Submission:
  - id, user_id (FK)
  - repo_url: str                    # validated https://github.com/{owner}/{repo}
  - repo_owner: str
  - repo_name: str
  - branch: str | null               # default branch if null
  - commit_sha: str | null           # resolved at fetch time
  - assignment_title: str | null
  - assignment_description: text | null   # optional brief / requirements
  - primary_language: str | null
  - files_analyzed: int
  - status: enum(queued, fetching, analyzing, completed, failed)
  - error_message: str | null
  - created_at, updated_at, completed_at

Roast:
  - id, submission_id (FK)           # one submission may have many roasts (re-roast)
  - overall_score: decimal(3,1)      # 0.0 – 10.0
  - category_scores: JSONB           # {code_quality, structure, readability, documentation, testing, best_practices}
  - headline: str                    # one-line Tanglish punchline
  - roast_text: text                 # markdown, Tanglish
  - strengths: JSONB                 # list[str]
  - improvements: JSONB              # list[{file, line_hint, issue, suggestion, severity}]
  - model_used: str
  - input_tokens: int, output_tokens: int
  - created_at
```

**API Endpoints:**
```
POST   /api/v1/submissions                - Submit repo URL (+ optional branch, assignment title/brief); returns 202 + submission
GET    /api/v1/submissions                - List my submissions (paginated, newest first)
GET    /api/v1/submissions/{id}           - Get submission status + latest roast
POST   /api/v1/submissions/{id}/reroast   - Re-fetch the repo and roast again (after improvements)
DELETE /api/v1/submissions/{id}           - Delete submission and its roasts
GET    /api/v1/submissions/quota          - Roasts used today / daily limit
```

**Services:**
- `github_service` validates and parses URLs, resolves the default branch and commit SHA, and downloads the repo tarball through the GitHub API. Public repos only: private or missing repos fail with `repo_not_found_or_private`. An optional server-side `GITHUB_TOKEN` raises the rate limit.
- `repo_filter_service` skips `node_modules`, `venv`, `dist`, `build`, `.git`, lock files, binaries, images and minified files. It ranks the remaining files by relevance and caps the total at about 150 files and 200 KB of source.
- `roast_service` builds the prompt (tone rules, assignment brief, file tree, file contents), calls OpenAI, validates the structured JSON response with Pydantic and saves the Roast.
- Processing runs in FastAPI `BackgroundTasks` for the MVP and can move to a worker queue later.

**Frontend Pages:**
- /roast/new - Submit form: public GitHub URL, branch (optional), assignment title/brief
- /submissions/:id - Live status (animated "roasting..." states), then the roast result: score ring, category bars, headline, roast text, strengths and fix list
- /submissions - My roast history (list with score + status)
- /settings - Profile and account settings

---

### Module 3: Dashboard

**Description:** Landing area after login.

**Frontend Pages:**
- /dashboard - "Roast a repo" CTA, latest roasts, average score
- /settings - User settings, GitHub connection

---

### Module 4: Admin Panel

**Description:** Admin-only management interface (requires `is_admin`).

**API Endpoints:**
- GET /api/v1/admin/users - List all users (paginated, searchable)
- PUT /api/v1/admin/users/{id} - Activate/deactivate user, toggle admin
- GET /api/v1/admin/submissions - List all submissions (filter by status)
- GET /api/v1/admin/stats - Platform stats (users, roasts/day, failure rate, token usage, average score)

**Frontend Pages:**
- /admin - Admin dashboard with stats (protected, admin only)
- /admin/users - User management
- /admin/submissions - Submission monitor

---

## MVP SCOPE

### Must Have (MVP)
- [x] User registration and login (email/password + Google OAuth)
- [x] Submit a public GitHub repo URL with an optional assignment brief
- [x] Async processing with live status on the result page
- [x] Tanglish roast with overall score, category scores, strengths and actionable fixes
- [x] Daily roast limit per user (default 5/day) to control API cost

### Nice to Have (Post-MVP)
- [ ] Roast history page and dashboard stats
- [ ] Re-roast after improvements, with score comparison
- [ ] Admin panel
- [ ] Shareable public roast link
- [ ] Tone selector (gentle mentor / honest / savage)
- [ ] Community leaderboard and "most improved"
- [ ] Email notifications ("Your roast is ready")
- [ ] Zip upload as an alternative to GitHub

---

## ACCEPTANCE CRITERIA

### Authentication
- [ ] User can register with email/password
- [ ] User can log in with email/password
- [ ] User can sign up / log in with Google OAuth (state parameter verified)
- [ ] JWT tokens work correctly with refresh
- [ ] Protected routes redirect to login

### Submissions & Roasts
- [ ] Invalid or non-GitHub URLs are rejected with 400 and a clear message
- [ ] Public repo submission returns 202 and reaches `completed` with a roast
- [ ] A private or nonexistent repo fails with a friendly "make it public or check the URL" message
- [ ] Nonexistent or inaccessible repos end in `failed` with a friendly error message
- [ ] Oversized repos are trimmed to the file/size cap and still produce a roast
- [ ] Roast contains: overall score 0–10, all 6 category scores, headline, Tanglish roast text, at least 1 strength and at least 3 improvements
- [ ] The OpenAI response is schema-validated; malformed output is retried once, then marked `failed`
- [ ] The result page polls and updates status without a manual refresh
- [ ] Users can only see and delete their own submissions (404 for others)
- [ ] Daily limit is enforced (429 after the limit is reached)
- [ ] Student code is never executed. It is only read as text.

### Admin Panel (Post-MVP)
- [ ] Non-admins get 403 on all /admin endpoints
- [ ] Admin can deactivate a user; deactivated users cannot log in

### Quality
- [ ] All API endpoints documented in OpenAPI
- [ ] Backend test coverage 80%+ (GitHub and OpenAI calls mocked)
- [ ] Frontend TypeScript strict mode passes
- [ ] Docker builds and runs successfully

---

## SPECIAL REQUIREMENTS

### Security
- [x] Rate limiting on auth endpoints and the submission endpoint
- [x] Input validation on all endpoints (strict GitHub URL regex, length limits on the brief)
- [x] SQL injection prevention (ORM only)
- [x] XSS prevention (roast markdown rendered with sanitization)
- [x] CSRF protection via OAuth `state` for the Google flow
- [x] Prompt-injection hardening: repo contents are passed as clearly delimited data; instructions inside the code are ignored
- [x] Secrets found in student repos are masked before being sent to the AI and are never echoed in a roast (the roast may say "you committed an API key, machaan" without showing it)

### Tone Rules (Roast Content)
- Friendly and honest Tanglish, e.g. *"Machaan, oru function la 300 lines ah? Idhu function illa, full novel da! Split pannu."*
- Roast the code, never the person. No insults about intelligence, appearance, caste, religion, gender or background.
- No profanity
- Every joke must point to a real issue with a real fix
- Always include genuine strengths, so students stay motivated

### Integrations
- [ ] Email service for notifications (post-MVP)
- [ ] Payments (none)
- [ ] File upload service (post-MVP: zip upload)
- [x] GitHub REST API (public repo metadata + tarball download, no user OAuth)
- [x] OpenAI API (roast generation)

---

## AGENTS

> These 6 agents will build your product in parallel:

| Agent | Role | Works On |
|-------|------|----------|
| DATABASE-AGENT | Creates all models and migrations | User, RefreshToken, Submission, Roast |
| BACKEND-AGENT | Builds API endpoints and services | Auth, GitHub, Submissions, Roast pipeline, Admin |
| FRONTEND-AGENT | Creates UI pages and components | Auth pages, submit form, roast result, history, admin |
| DEVOPS-AGENT | Sets up Docker, CI/CD, environments | Infrastructure |
| TEST-AGENT | Writes unit and integration tests | All code (mocks for GitHub + OpenAI) |
| REVIEW-AGENT | Security and code quality audit | All code |

---

# READY?

```bash
/generate-prp INITIAL.md
```

Then:

```bash
/execute-prp PRPs/assignment-roaster-prp.md
```
