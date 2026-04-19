export interface AppConfig {
  githubToken: string;
  giteaToken: string;
  giteaBaseUrl: string;
  giteaAdminUsername: string;
  giteaAdminPassword: string;
  dbPath: string;
}

export const defaultConfigPath = 'config.json';
