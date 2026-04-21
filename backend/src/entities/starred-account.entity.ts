import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'starred_account' })
export class StarredAccountEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  account!: string;

  @Column({ type: 'simple-json', default: '[]' })
  ignoredRepos: string[] = [];

  @Column({ type: 'simple-json', default: '[]' })
  knownStarredRepos: string[] = [];

  @Column({ type: 'datetime', nullable: true })
  lastCheckedAt!: string | null;
}
