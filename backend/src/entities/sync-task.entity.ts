import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type SyncTaskStatus = 'pending' | 'running' | 'done' | 'failed';

@Entity({ name: 'sync_task' })
export class SyncTaskEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  repoFullName!: string;

  @Column({ default: 'pending' })
  status!: SyncTaskStatus;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'datetime' })
  createdAt!: string;

  @Column({ type: 'datetime', nullable: true })
  startedAt!: string | null;

  @Column({ type: 'datetime', nullable: true })
  finishedAt!: string | null;
}
