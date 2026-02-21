import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_portfolio')
@Index(['updated_at'])
export class UserPortfolio {
  @PrimaryColumn('varchar')
  wallet_address: string;

  @Column('bigint', { default: 0 })
  total_staked: number; // Total USDC staked across all markets (micro-units)

  @Column('bigint', { default: 0 })
  total_prize_won: number; // Total USDC won (micro-units)

  @Column('int', { default: 0 })
  positions_count: number; // Total number of positions taken

  @Column('int', { default: 0 })
  win_count: number; // Number of winning positions

  @UpdateDateColumn()
  last_updated: Date;

  // Computed properties (calculated on demand)
  get win_rate(): number {
    return this.positions_count > 0 ? this.win_count / this.positions_count : 0;
  }

  get roi(): number {
    return this.total_staked > 0
      ? ((this.total_prize_won - this.total_staked) / this.total_staked) * 100
      : 0;
  }
}
