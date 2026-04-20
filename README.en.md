<p align="center">
  <img src="./frontend/public/logo.svg" alt="github-to-gitea logo" width="88" />
</p>

<h1 align="center">github-to-gitea</h1>

<p align="center">A web-based tool for synchronizing GitHub repositories to Gitea.</p>

<p align="center">
  <a href="./README.md">中文</a> | English
</p>

Built with a Vue 3 frontend and a NestJS backend, this project provides a web UI for initial setup, administrator sign-in, repository import, branch synchronization, and GitHub webhook handling. It is suitable for personal migrations, team mirrors, private backups, and self-hosted Gitea environments.

## Overview

`github-to-gitea` helps you mirror repositories from GitHub to Gitea through a simple management interface. It supports the following workflow:

- Initial system setup through the browser
- Sign-in with the configured Gitea administrator account
- Bulk import by GitHub account
- Single repository sync by `owner/repo`
- Per-repository branch configuration
- Automatic GitHub webhook creation or repair
- Scheduled update checks and automatic sync execution

The backend listens on `3001` by default. Static assets are served from the backend root path, and all APIs are exposed under `/api`.

## Key Features

- Sync repositories in bulk by GitHub account or one by one by repository name
- Support both private and public repositories as long as the token has access
- Automatically create matching users and repositories in Gitea based on the GitHub repository owner
- Configure multiple sync branches per repository, with the default branch used initially
- Queue management, failed task retry, history cleanup, and manual immediate sync
- Incremental sync triggered by GitHub `push` webhooks
- Require Gitea administrator login after setup, with API authentication enforced as well
- Support separate frontend/backend development and unified `dist` deployment output

## Prerequisites

Prepare the following before running the project:

- Node.js 20 or later
- npm 10 or later
- Git CLI available on the server
- MySQL 8.x or a compatible version
- A reachable Gitea instance
- Access to the GitHub API

Recommended checks before deployment:

- Create the target MySQL database, for example `github_to_gitea`
- Prepare a Gitea administrator account
- Ensure the host can reach GitHub, Gitea, and MySQL
- If using public webhooks, prepare a public URL reachable by GitHub

## How To Get Tokens

### GitHub Token

Use a GitHub Personal Access Token. The project currently reads repositories and manages repository webhooks, so the token should be able to:

- Read target repositories
- Read private repositories if you want to sync them
- Read and create repository webhooks

Typical steps:

1. Sign in to GitHub.
2. Open `Settings`.
3. Go to `Developer settings`.
4. Open `Personal access tokens`.
5. Create either a Classic Token or a Fine-grained Token.

Recommended permissions:

- Classic Token: at least `repo` and `admin:repo_hook`
- Fine-grained Token: repository contents read access plus webhook read/write access

If you only sync public repositories and do not want automatic webhook setup, you can reduce permissions, but this project attempts to configure webhooks by default.

### Gitea Token

Create the access token with a Gitea administrator account, because the project uses administrator APIs to create users and repositories.

Typical steps:

1. Sign in to Gitea with an administrator account.
2. Open `Settings`.
3. Go to `Applications`.
4. Create a new token under `Access Tokens`.

Recommended capabilities:

- Administrator-level API access
- Permission to create users
- Permission to create repositories
- Permission to push code to target repositories

If your Gitea version supports fine-grained scopes, make sure the token can manage users, manage repositories, and write repository contents.

## Development

### Start the Backend

```bash
cd backend
npm install
npm run dev
```

Default backend address: `http://localhost:3001`

### Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Default frontend development address: `http://localhost:5174`

In development mode, frontend `/api` requests are proxied to `http://localhost:3001`.

## Deployment

### Option 1: Unified Build Output

The project outputs both backend and frontend artifacts into the root `dist` directory:

- Backend build output goes to `dist`
- Frontend build output goes to `dist/public`

Build command:

```bash
npm run build
```

Expected structure after build:

```text
dist/
  main.js
  app.module.js
  modules/
  public/
  package.json
  package-lock.json
```

Production run:

```bash
cd dist
npm install --omit=dev
node main.js
```

Deployment notes:

- The runtime directory is `dist`, so the app reads or creates `dist/config.json`
- The web UI is served from `/`
- Backend APIs are available under `/api/*`
- If you use a reverse proxy, route both `/api` and static assets to the same Node.js service

### Option 2: Separate Development Services

Useful for local development:

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

Open the frontend at `http://localhost:5174`.

## Usage

### 1. First Visit

On the first startup, if no configuration file exists, the application opens the initial setup page. Fill in:

- GitHub token
- Gitea token
- Gitea base URL
- Gitea administrator username
- Gitea administrator password
- MySQL connection information
- Optional GitHub webhook secret

After saving, the backend writes the configuration to `config.json`.

Notes:

- In development mode, the config file is `backend/config.json`
- In unified deployment mode, the config file is `dist/config.json`
- Restart the backend if you change MySQL connection settings
- Before the system is configured, the backend falls back to in-memory SQLite so the setup page remains accessible

### 2. Sign In

After setup, administrator login protection is enabled.

- The web UI requires login
- `/api/*` endpoints also require authentication
- The login credentials are the configured `giteaAdminUsername` and `giteaAdminPassword`

Currently public endpoints are kept open for setup and webhook handling:

- `GET /api/auth/status`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/config/status`
- `POST /api/sync/webhook/github`

### 3. Add Sync Sources

After signing in, you can import repositories in two ways:

- Enter a GitHub username to import all accessible repositories under that account
- Enter `owner/repo` to sync a single repository

### 4. Manage Synced Repositories

After import, you can:

- Edit branch lists
- Enable or disable sync for a repository
- Trigger an immediate sync
- Configure or repair the GitHub webhook

### 5. Review Task Queue

The task page lets you inspect:

- Pending tasks
- Running tasks
- Failed tasks
- Retry actions for failed tasks
- Task history cleanup

## Configuration Fields

The current configuration file contains the following fields:

```json
{
  "githubToken": "",
  "giteaToken": "",
  "giteaBaseUrl": "http://localhost:3000",
  "giteaAdminUsername": "gitea_admin",
  "giteaAdminPassword": "",
  "dbHost": "localhost",
  "dbPort": 3306,
  "dbUser": "root",
  "dbPassword": "",
  "dbDatabase": "github_to_gitea",
  "webhookSecret": ""
}
```

Notes:

- `giteaBaseUrl` should be the Gitea site root, without manually appending `/api/v1`
- `webhookSecret` is optional; if empty, webhook signatures are not validated
- `config.json` contains sensitive information and should be protected with restricted file permissions

## Common Commands

```bash
# Build everything from the repository root
npm run build

# Backend development
cd backend
npm run dev
npm run test
npm run build

# Frontend development
cd frontend
npm run dev
npm run build
```