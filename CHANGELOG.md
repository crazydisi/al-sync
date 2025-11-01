# Changelog

All notable changes to this project will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/) and follows semantic versioning where possible.

## [Unreleased]

- Placeholder for upcoming changes.

## [1.0.1] - 2025-11-01

Improved quality of life.

- Added VSCode tasks to make it easier to run the programm.
- Added this CHANGELOG.md file to documentate changes
- Fixed .gitignore to exclude `al-sync.config.json` instead of `al-sync.config.js`

## [1.0.0] - 2025-11-01

Initial release.

- Project: al-sync — Watch a local file and upload to Adventure Land code slot via API on save.
- Features:
  - Add `al-sync.js` to watch files and upload on save.
  - Added `npm start` and `npm run once` scripts.
- Dependencies: chokidar, dotenv, minimist, p-retry, undici.

Maintainers: keep this file updated for users and for release notes automation.
