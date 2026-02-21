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
  id: string; // Solana PDA address

  @Column('uuid', { unique: true })
  uuid: string;

  @Column('varchar')
  creator_address: string; // Wallet address of market creator

  @Column('text')
  statement: string; // Market statement/question

  @CreateDateColumn()
  created_at: Date;

  @Column('timestamp')
  closes_at: Date; // When staking ends

  @Column('varchar', { enum: MarketState, default: MarketState.ACTIVE })
  state: MarketState;

  @Column('bigint', { default: 0 })
  total_stake: number; // Total USDC staked (in micro-units)

  @Column('int', { default: 0 })
  staker_count: number; // Number of unique stakers

  @Column('smallint', { nullable: true })
  sentiment_score: number | null; // 0-100 after LLM scoring

  @Column('smallint', { nullable: true })
  sentiment_confidence: number | null; // 0: low, 1: medium, 2: high

  @Column('bytea', { nullable: true })
  summary_hash: Buffer | null; // SHA-256 of LLM summary

  @Column('varchar', { nullable: true })
  winner: string | null; // Winner's wallet address (if settled)

  @Column('bigint', { nullable: true })
  winner_prize: number | null; // Prize amount for winner (in micro-USDC)

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
