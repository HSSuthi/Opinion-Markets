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

  // ── Legacy settlement fields (kept for backward compatibility) ─────────────
  @Column('varchar', { nullable: true })
  winner: string | null;

  @Column('bigint', { nullable: true })
  winner_prize: number | null;

  // ── On-chain references ─────────────────────────────────────────────────────
  /// Solana transaction signature from the on-chain createMarket instruction
  @Column('varchar', { nullable: true })
  tx_signature: string | null;

  /// On-chain PDA address for this market account
  @Column('varchar', { nullable: true })
  market_pda: string | null;

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
