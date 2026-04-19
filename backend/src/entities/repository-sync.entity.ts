import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'repository_sync' })
export class RepositorySyncEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  fullName!: string;

  @Column()
  owner!: string;

  @Column()
  repo!: string;

  @Column({ default: false })
  isPrivate!: boolean;

  @Column({ default: 'main' })
  defaultBranch!: string;

  @Column({ type: 'simple-json' })
  branches: string[] = ['master'];

  @Column({ type: 'datetime', nullable: true })
  lastGithubPushedAt!: string | null;

  @Column({ type: 'datetime', nullable: true })
  lastSyncedAt!: string | null;
}
