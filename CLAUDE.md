# Project rules

Claude Code reads this file automatically at the start of every session.
It applies to every project created from this template.

## Step 0 — Ask before building (mandatory)

At the very start of a new task, before writing any code, ask the user exactly one question:

> "Do you want me to challenge this idea first? (yes / no)"

- **no** → build the best version you can, quickly. Make reasonable decisions on your
  own, log them in `DECISIONS.md`, and don't ask further questions unless you are truly blocked.
- **yes** → call the `idea-challenger` agent, share its analysis with the user in a short,
  readable form, then discuss and refine the idea together before writing any code.
  Once the user is happy, summarize the agreed scope in `DECISIONS.md` and start building.

Shortcuts (skip the question):
- A prompt starting with `quick:` means **no**.
- A prompt starting with `challenge:` means **yes**.
- Follow-up tasks on an existing feature (bug fixes, small changes) don't need the question.

The user often writes or dictates in French. Reply to them in French,
but write all code, comments, commit messages and documentation in English.
The user is learning: explain technical choices in plain language when you report back.

## Philosophy

- **Simplest stack that does the job well.** For a frontend-only app, that means
  plain HTML, CSS and JavaScript (ES modules) with no build step.
- **Follow the established best practices of the chosen language and ecosystem**:
  its standard project layout, naming conventions, package manager, formatter and
  test tools. Don't invent unusual structures.
- **Readable code beats clever code.** Prefer boring, well-known solutions.

## Choosing the stack

- Frontend-only (games, tools, static sites): vanilla HTML/CSS/JS, no framework.
- If a project grows and genuinely needs a framework, a backend or a database,
  **propose it to the user and wait for approval** before introducing it
  (except in `quick:` mode, where you choose and document it).
- Defaults when a backend is approved, unless the user asks otherwise:
  - Runtime: Node.js (current LTS) with a minimal, widely used web framework.
  - Database: SQLite for small projects, PostgreSQL for larger or multi-user ones.
  - Hosted alternative when no server is wanted: Supabase or Cloudflare (Workers + D1).
- Record every stack decision and its reason in `DECISIONS.md`.

## Dependencies

- **Write simple things yourself.** Don't add a library for something that takes
  a few dozen lines (formatting a date, a small helper, a basic animation).
- **Use a well-known library for complex or sensitive things**: security,
  authentication, cryptography, 3D rendering, database access, date/time zones,
  parsing complex formats. Never hand-roll these.
- An acceptable library is: widely used, actively maintained, well documented,
  with a reasonable number of sub-dependencies. Avoid obscure or abandoned packages.
- **Never commit third-party code into the repository.**
  - Projects with a package manager: declare dependencies in the manifest
    (`package.json`, `requirements.txt`, etc.), pin exact versions,
    commit the lockfile, and keep installed packages (`node_modules/`, `.venv/`…)
    out of Git.
  - Frontend-only projects without a build step: load libraries from a CDN
    (jsDelivr or cdnjs) with an exact version and a Subresource Integrity
    (`integrity`) hash, ideally through an import map.
  - Only copy a library into the repo if the user explicitly wants the app to work
    offline; then use the minified build only, in `vendor/`, and document it.
- Separate runtime dependencies from development tools (test runners, linters, formatters).
- Every new dependency must be listed in `DECISIONS.md` and explained in the Pull Request.

## Code conventions

- Follow the official style guide of the language (e.g. modern JS with `const`
  by default and no `var`; PEP 8 for Python).
- Short functions, explicit names, comments only where they add value.
- No global state; split code into modules by responsibility.
- Frontend: CSS custom properties, mobile first, dark mode support,
  semantic HTML, `alt` text, keyboard navigation, sufficient contrast.

## Default structure (frontend-only)

```
index.html
css/style.css
js/main.js          # entry point
js/modules/…        # one file per responsibility
tests/…             # node --test
README.md           # what the app does and how to run it
DECISIONS.md        # stack, dependencies and product decisions, with reasons
```

For other stacks, use the conventional layout of that ecosystem.

## Security (non-negotiable)

- **No secrets in the repo**: no API keys, passwords or tokens. Use environment
  variables, a `.env` file listed in `.gitignore`, and a `.env.example` with placeholders.
- Never insert user-controlled data with `innerHTML`: use `textContent`
  or build elements with `createElement`.
- No `eval`, `new Function`, or `setTimeout` with a string.
- Validate every input (forms, URL parameters, request bodies, fetched data, `localStorage`).
- Add a strict Content-Security-Policy to web pages whenever possible.
- With a database:
  - Always use parameterized queries or a well-known query builder/ORM. Never
    build SQL by concatenating strings.
  - Manage schema changes with migrations kept in the repo.
  - Use separate databases and credentials for development and production.
  - Hash passwords with a proven algorithm (bcrypt or argon2) via a known library.
- With a backend: check authentication and authorization on every route, don't leak
  internal error details, and rate-limit public endpoints.

## Tests

- Use the standard test tool of the ecosystem (for plain JS: `node --test`, no dependency).
- Keep tests proportional to the project:
  - `quick:` projects: a few tests on the core logic only.
  - Larger projects: test all business logic; with a backend, also test the main routes.
- Never write tests just for coverage; test what could actually break.
- All tests must pass before the work is considered done.

## Workflow for every task

0. **Ask** the challenge question (see Step 0).
1. **Understand**: restate the request in a few lines.
2. **Plan**: list the files to create or change, and any dependency you intend to add.
3. **Build** in small steps, running tests along the way.
4. **Security review**: call the `security-reviewer` agent and fix every
   critical or high severity finding.
5. **Quality review**: call the `quality-reviewer` agent and apply the relevant fixes.
6. **Verify**: tests pass, the app runs with no errors.
7. **Deliver**: work on a branch (`feature/short-name`), write clear commits
   (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), then open a Pull Request
   to `main`. The PR description must include, in plain language:
   - what was done and how to try it;
   - decisions made;
   - **each dependency added, what it does and why it was needed**;
   - anything the user should check.
   **Never push directly to `main`.**

## Never

- Commit third-party library code, `node_modules`, virtual environments,
  build output or secrets.
- Add an obscure, unmaintained or unnecessary dependency.
- Introduce a backend, database or framework without the user's approval
  (outside `quick:` mode).
- Delete or disable tests to make them pass.
- Deploy to a server unless explicitly asked.
