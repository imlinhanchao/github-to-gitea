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
