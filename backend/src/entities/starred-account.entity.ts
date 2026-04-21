import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'starred_account' })
export class StarredAccountEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  account!: string;

  @Column({ type: 'simple-json' })
  ignoredRepos: string[] = [];

  @Column({ type: 'simple-json' })
  knownStarredRepos: string[] = [];

  @Column({ type: 'datetime', nullable: true })
  lastCheckedAt!: string | null;
}
