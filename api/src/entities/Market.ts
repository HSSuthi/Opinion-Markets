import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Opinion } from './Opinion';
import { Position } from './Position';

export enum MarketState {
  ACTIVE = 'Active',
  CLOSED = 'Closed',
  SCORED = 'Scored',
  AWAITING_RANDOMNESS = 'AwaitingRandomness',
  SETTLED = 'Settled',
}

@Entity('markets')
@Index(['state', 'closes_at'])
@Index(['state'])
@Index(['closes_at'])
@Index(['created_at', 'state'])
@Index(['total_stake', 'state'])
export class Market {
  @PrimaryColumn('varchar')
  id: string;

  @Column('uuid', { unique: true })
  uuid: string;

  @Column('varchar')
  creator_address: string;

  @Column('text')
  statement: string;

  @CreateDateColumn()
  created_at: Date;

  @Column('timestamp')
  closes_at: Date;

  @Column('varchar', { enum: MarketState, default: MarketState.ACTIVE })
  state: MarketState;

  @Column('bigint', { default: 0 })
  total_stake: number;

  @Column('int', { default: 0 })
  staker_count: number;

  @Column('smallint', { nullable: true })
  sentiment_score: number | null;

  @Column('smallint', { nullable: true })
  sentiment_confidence: number | null;

  @Column('bytea', { nullable: true })
  summary_hash: Buffer | null;

  // ── Triple-Check scoring fields ────────────────────────────────────────────
  /// Volume-weighted mean of all staker predictions (set at settlement)
  @Column('float', { nullable: true })
  crowd_score: number | null;

  // ── Live sentiment fields (updated continuously while market is Active) ─────
  /// Blended AI + crowd-prediction score computed by the oracle every ~2 min
  @Column('smallint', { nullable: true })
  live_sentiment_score: number | null;

  @Column('smallint', { nullable: true })
  live_sentiment_confidence: number | null;

  /// Timestamp of the last live scoring run (used to debounce oracle calls)
  @Column('timestamp', { nullable: true })
  live_scored_at: Date | null;

  // ── Dynamic stake cap (set by creator at market creation) ──────────────────
  /// Maximum stake per opinion/reaction in micro-USDC.
  /// Default $10 (10_000_000). Creator may raise to $500 (500_000_000).
  @Column('bigint', { default: 10_000_000 })
  max_stake: number;

  // ── Dual Pool Fields (set at finalize_settlement) ──────────────────────────
  @Column('bigint', { default: 0 })
  opinion_pool: number; // 70% of distributable pool

  @Column('bigint', { default: 0 })
  prediction_pool: number; // 24% of distributable pool

  @Column('bigint', { default: 0 })
  jackpot_amount: number; // 6% of distributable pool

  @Column('boolean', { default: false })
  jackpot_claimed: boolean;

  @Column('varchar', { nullable: true })
  jackpot_winner: string | null;

  // ── Legacy settlement fields (kept for backward compatibility) ─────────────
  @Column('varchar', { nullable: true })
  winner: string | null;

  @Column('bigint', { nullable: true })
  winner_prize: number | null;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToMany(() => Opinion, (opinion) => opinion.market, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  opinions: Opinion[];

  @OneToMany(() => Position, (position) => position.market, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  positions: Position[];
}
