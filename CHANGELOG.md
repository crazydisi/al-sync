# Changelog

All notable changes to this project are documented here.

Style: We use date-based entries (not semver releases) and Keep a Changelog categories. Add your notes under Unreleased, then periodically snapshot them under a dated heading.

## 2025-11-01

### Added

- Core script `al-sync.js` to watch files and upload on save.
- NPM scripts: `npm start` and `npm run once`.
- Dependencies: `chokidar`, `dotenv`, `minimist`, `p-retry`, `undici`.
- VSCode tasks to simplify running the program.
- This `CHANGELOG.md` file.
- Default auto-reload via `nodemon` with `.nodemon.json` watching `al-sync.js`, `al-sync.config.json`, `.env`, and `package.json`.

### Changed

- `.gitignore`: exclude `al-sync.config.json` (was `al-sync.config.js`).
- Dependabot config for npm and GitHub Actions to open scheduled update PRs.
- CI workflow (Node 24) running `npm ci`, optional tests, and `npm audit --audit-level=high` on PRs and pushes.
- Workflow to enable GitHub auto-merge for Dependabot minor, patch, and security updates once checks pass.
- Workflow to ensure the `dependencies` label exists so Dependabot can label its PRs.
- Dependabot auto-merge workflow: pass `pull-request-number` to fix missing input error and enable auto-merge when checks pass.
- `package.json` `start` now runs `nodemon` so the daemon restarts on code/config changes.
