export interface AppConfig {
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
}

export const defaultConfigPath = 'config.json';
