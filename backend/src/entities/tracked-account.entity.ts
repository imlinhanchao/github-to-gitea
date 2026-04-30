import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'tracked_account' })
export class TrackedAccountEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  account!: string;

  @Column({ type: 'simple-json' })
  knownRepos: string[] = [];

  @Column({ type: 'text', nullable: true })
  webhookUrl!: string | null;

  @Column({ type: 'datetime', nullable: true })
  lastCheckedAt!: string | null;
}
