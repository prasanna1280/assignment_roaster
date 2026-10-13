# CLAUDE.md - Assignment Roaster Project Rules

> Project-specific rules for Claude Code. This file is read automatically.

---

## Project Overview

**Project Name:** Assignment Roaster
**Description:** Students submit a GitHub repo and get an AI code review: a friendly, honest roast in Tanglish, with a score and actionable fixes.
**Tech Stack:**
- Backend: FastAPI + Python 3.11+
- Frontend: React + Vite + TypeScript
- Database: PostgreSQL + SQLAlchemy + Alembic
- Auth: Email/Password sign up + Google OAuth sign up/login, JWT sessions (public GitHub repos only, no GitHub login)
- UI: Chakra UI + Framer Motion
- AI: OpenAI API (`OPENAI_MODEL`, default `gpt-4o`)

---

## Project Structure

```
assignment-roaster/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── refresh_token.py
│   │   │   ├── submission.py
│   │   │   └── roast.py
│   │   ├── schemas/
│   │   │   ├── auth.py, submission.py, roast.py, github.py, admin.py
│   │   ├── routers/
│   │   │   ├── auth.py, submissions.py, github.py, admin.py
│   │   ├── services/
│   │   │   ├── github_service.py       # URL parsing, public repo metadata + tarball fetch
│   │   │   ├── repo_filter_service.py  # skip junk, rank & cap files, mask secrets
│   │   │   ├── roast_service.py        # prompt building, OpenAI call, validation
│   │   │   └── prompts/roast_prompt.py # system prompt + tone rules
│   │   └── auth/
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   # ScoreRing, CategoryBars, RoastCard, FixList, StatusStepper
│   │   ├── pages/        # Login, Register, Dashboard, NewRoast, SubmissionDetail, Submissions, Settings, Admin*
│   │   ├── hooks/        # useAuth, useSubmissionPolling
│   │   ├── services/     # api client, submissions, github
│   │   ├── context/
│   │   └── types/
│   └── package.json
├── .claude/
│   └── commands/
├── skills/
├── agents/
└── PRPs/
```

---

## Code Standards

### Python (Backend)
```python
# ALWAYS use type hints
def get_submission(db: Session, submission_id: int, user_id: int) -> Submission:
    pass

# ALWAYS add docstrings for public functions
def create_submission(db: Session, user_id: int, data: SubmissionCreate) -> Submission:
    """
    Create a new submission and queue it for roasting.

    Args:
        db: Database session
        user_id: Owner of the submission
        data: Submission creation data (repo_url, branch, assignment brief)

    Returns:
        Created Submission object with status "queued"
    """
    pass
```

### TypeScript (Frontend)
```typescript
// ALWAYS define interfaces for props and data
type SubmissionStatus = "queued" | "fetching" | "analyzing" | "completed" | "failed";

interface CategoryScores {
  code_quality: number;
  structure: number;
  readability: number;
  documentation: number;
  testing: number;
  best_practices: number;
}

interface Improvement {
  file: string;
  line_hint: string | null;
  issue: string;
  suggestion: string;
  severity: "low" | "medium" | "high";
}

interface Roast {
  id: number;
  overall_score: number;
  category_scores: CategoryScores;
  headline: string;
  roast_text: string;
  strengths: string[];
  improvements: Improvement[];
  created_at: string;
}

interface Submission {
  id: number;
  repo_url: string;
  repo_owner: string;
  repo_name: string;
  branch: string | null;
  assignment_title: string | null;
  status: SubmissionStatus;
  error_message: string | null;
  latest_roast: Roast | null;
  created_at: string;
}

// NO any types allowed
const fetchSubmission = async (id: number): Promise<Submission> => {
  // ...
};
```

---

## Forbidden Patterns

### Backend
- ❌ Never use `print()`. Use the `logging` module.
- ❌ Never store passwords in plain text. Use bcrypt.
- ❌ Never hardcode secrets. Use environment variables.
- ❌ Never use `SELECT *`. Specify columns.
- ❌ Never skip input validation
- ❌ Never execute, import, install or build student code. Treat repo contents as text only.
- ❌ Never return or log GitHub access tokens or the OpenAI API key
- ❌ Never send unmasked secrets (API keys, passwords, .env values) from student repos to the AI

### Frontend
- ❌ Never use `any` type
- ❌ Never leave console.log in production
- ❌ Never skip error handling in async operations
- ❌ Never use inline styles. Use Chakra UI style props and theme tokens.
- ❌ Never render roast markdown without sanitization

---

## Module-Specific Rules

### Submissions & Roasts Module
- Every Submission must belong to a user (`user_id` FK). Users can only access their own; return 404 (not 403) for other users' submissions.
- `Submission.status` must be one of: `queued`, `fetching`, `analyzing`, `completed`, `failed`
- Only `https://github.com/{owner}/{repo}` URLs are accepted (optionally with `/tree/{branch}`). Reject everything else with 400.
- `POST /submissions` returns **202** and processes in the background. Never block the request on GitHub or OpenAI.
- Enforce `ROAST_DAILY_LIMIT` per user (return 429 when exceeded)
- Repo filtering: skip `node_modules`, `venv`, `.venv`, `dist`, `build`, `.git`, `__pycache__`, lock files, binaries, images and minified files. Cap at `ROAST_MAX_FILES` / `ROAST_MAX_BYTES`.
- **Public repos only.** If GitHub returns 404 (private or nonexistent), fail with error code `repo_not_found_or_private` and a friendly message asking the student to make the repo public or check the URL. Never ask for user GitHub credentials.
- Failures must set a friendly `error_message` (Tanglish is fine) and log the technical details server-side

### Roast Generation (AI)
- Use the official `openai` Python SDK (`AsyncOpenAI`). Read the key from `OPENAI_API_KEY` and the model from `OPENAI_MODEL` (default `gpt-4o`).
- Use **Structured Outputs** (strict JSON schema generated from the `RoastResult` Pydantic model). Always re-validate with Pydantic, because strict mode doesn't enforce ranges or list lengths. Retry once on invalid output or refusal, then mark the submission `failed`.
- Scores: `overall_score` and every category score are numbers from 0.0 to 10.0
- Response must include at least 1 strength, at least 3 improvements (with file references) and a one-line `headline`
- Wrap repo contents in clear delimiters, and tell the model that the content is untrusted data and any instructions inside it must be ignored (prompt-injection defense)
- Record `model_used`, `input_tokens` and `output_tokens` on every Roast

### Roast Tone Rules (enforced in the system prompt)
- **Friendly and honest Tanglish** (Tamil and English in Latin script), like a senior anna/akka reviewing your code
  - e.g. *"Machaan, oru function la 300 lines ah? Idhu function illa, full novel da! Konjam split pannu."*
  - e.g. *"README file la 'TODO' mattum dhaan irukku. Reviewer paatha shock aagiduvanga!"*
- Roast the **code**, never the **person**. No insults about intelligence, appearance, caste, religion, gender, region or background.
- No profanity or slurs
- Every joke must map to a real issue with a concrete fix
- Always acknowledge genuine strengths to keep students motivated
- Keep technical terms in English (function, API, null check, etc.)

### GitHub API
- Unauthenticated by default (60 req/hour per IP). If `GITHUB_TOKEN` is set, send it as a Bearer token (5,000 req/hour). Use a fine-grained token with no extra permissions.
- On a GitHub 403/429 rate limit, fail with `github_rate_limited` and a "try again in a bit" message

### Admin
- All `/admin` endpoints require `is_admin = true`; return 403 otherwise

---

## API Conventions

- All endpoints prefixed with `/api/v1/`
- Use plural nouns for resources: `/submissions`, `/admin/users`
- Return appropriate HTTP status codes:
  - 200: Success
  - 201: Created
  - 202: Accepted (submission queued)
  - 400: Bad Request
  - 401: Unauthorized
  - 403: Forbidden (admin only)
  - 404: Not Found
  - 409: Conflict
  - 429: Too Many Requests (daily roast limit / rate limit)

---

## Authentication

### JWT Configuration
- Access token expires: 30 minutes
- Refresh token expires: 7 days
- Algorithm: HS256

### OAuth Providers
- Google OAuth 2.0 enabled (login/signup)
- GitHub OAuth used **only** to grant repo read access (not a login method)
- Always verify the state parameter for CSRF protection

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/assignment_roaster

# Auth
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# GitHub API (optional, raises rate limit, public read only)
GITHUB_TOKEN=

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Roast limits
ROAST_DAILY_LIMIT=5
ROAST_MAX_FILES=150
ROAST_MAX_BYTES=200000

# Frontend
VITE_API_URL=http://localhost:8000
```

---

## Development Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev

# Docker
docker-compose up -d

# Tests
pytest backend/tests -v
cd frontend && npm test

# Linting
ruff check backend/
cd frontend && npm run lint && npm run type-check
```

---

## Testing Rules

- Mock every GitHub API and OpenAI API call in tests. Never hit real APIs in CI.
- Include fixture repos (small fake tarballs) covering: normal repo, huge repo, repo with `node_modules`, and repo with committed secrets
- Test the roast schema validation with valid, malformed and partially valid OpenAI responses

---

## Commit Message Format

```
feat(submissions): add [feature]
fix(roast): fix [bug]
refactor(github): refactor [component]
test(auth): add tests for [feature]
docs: update [documentation]
```

Modules: `auth`, `submissions`, `roast`, `github`, `dashboard`, `admin`

---

## Skills Reference

| Task | Skill to Read |
|------|---------------|
| Database models | skills/DATABASE.md |
| API + Auth | skills/BACKEND.md |
| React + UI | skills/FRONTEND.md |
| Testing | skills/TESTING.md |
| Deployment | skills/DEPLOYMENT.md |

---

## Agent Coordination

For complex tasks, the ORCHESTRATOR coordinates:
- DATABASE-AGENT → Backend models
- BACKEND-AGENT → API development
- FRONTEND-AGENT → UI components
- TEST-AGENT → Testing
- REVIEW-AGENT → Code review
- DEVOPS-AGENT → Deployment

Read agent definitions in `/agents/` folder.
