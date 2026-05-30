# README Design Spec

**Date:** 2026-05-30  
**Status:** Approved

---

## Overview

A minimal README targeting developers who want to install and use the CLI locally. Only documents implemented features (auth commands). No badges, no contributing section, no placeholder sections for unbuilt features.

---

## Structure

### 1. Header + Description
- Title: `bitbucket-cli`
- One-liner description: "Bitbucket CLI tool for managing pull requests from the terminal."
- Node ≥ 22 requirement noted inline.

### 2. Prerequisites
- Node.js ≥ 22
- An Atlassian API token — link to `https://id.atlassian.com/manage-profile/security/api-tokens`

### 3. Installation
Local development install via clone → build → link:
```
git clone <repo>
cd bitbucket-cli
yarn install
yarn build
npm link
```

### 4. Authentication
Three subsections with real terminal output examples:
- `bitbucket auth login` — full interactive prompt with scopes guidance
- `bitbucket auth logout` — confirm prompt
- `bitbucket auth whoami` — output format

### 5. Configuration
- Config file: `~/.config/bitbucket-cli/config.json`
- Env var override for CI: `BITBUCKET_EMAIL`, `BITBUCKET_API_TOKEN`

---

## Decisions

- **No badges:** Project is pre-publish; badges would be dead links.
- **No planned features:** Avoids confusion about what's actually usable now.
- **Local install only:** npm package not yet published.
- **Terminal examples from auth spec:** Ensures accuracy — examples match real implementation.
