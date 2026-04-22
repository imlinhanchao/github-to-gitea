export type Repo = {
  id: number;
  fullName: string;
  branches: string[];
  defaultBranch: string;
  lastSyncedAt: string | null;
  enabled: boolean;
  webhookConfigured: boolean;
};

export type SyncTask = {
  id: number;
  repoFullName: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type ActiveTask = {
  id: number;
  repoFullName: string;
  status: 'pending' | 'running';
};

export type TaskSummary = {
  pending: number;
  running: number;
  done: number;
  failed: number;
};

export type TaskPage = {
  items: SyncTask[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  summary: TaskSummary;
  activeItems: ActiveTask[];
};

export type ConfigView = {
  githubToken: string;
  giteaToken: string;
  giteaBaseUrl: string;
  giteaAdminUsername: string;
  giteaAdminPassword: string;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbDatabase: string;
  webhookSecret: string;
};

export type AuthStatus = {
  configured: boolean;
  authenticated: boolean;
  username: string | null;
};

export type GithubStarredRepo = {
  full_name: string;
  stargazers_count: number;
  private: boolean;
  description: string | null;
};

export type StarredAccount = {
  id: number;
  account: string;
  ignoredRepos: string[];
  knownStarredRepos: string[];
  lastCheckedAt: string | null;
};
