import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Market } from './Market';

@Entity('opinions')
@Index(['market_id', 'staker_address'])
@Index(['market_id', 'created_at'])
@Index(['staker_address'])
@Unique(['market_id', 'staker_address'])
export class Opinion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar')
  market_id: string;

  @Column('varchar')
  staker_address: string;

  @Column('bigint')
  amount: number; // USDC staked (micro-units)

  @Column('text', { nullable: true })
  opinion_text: string | null;

  @Column('bytea')
  text_hash: Buffer;

  @Column('varchar', { nullable: true })
  ipfs_cid: string | null;

  @CreateDateColumn()
  created_at: Date;

  // ── User Agreement Score ──────────────────────────────────────────────────
  @Column('smallint')
  opinion_score: number; // 0–100, how much user agrees with statement

  // ── Market Prediction ─────────────────────────────────────────────────────
  @Column('smallint')
  market_prediction: number; // 0–100, user's bet on where crowd will land

  // ── Layer 1: Peer Backing ──────────────────────────────────────────────────
  @Column('bigint', { default: 0 })
  backing_total: number; // Total USDC backing this opinion (micro-units)

  @Column('bigint', { default: 0 })
  slashing_total: number; // Total USDC slashing this opinion (micro-units)

  // ── Triple-Check Scores (set by oracle at settlement) ─────────────────────
  @Column('float', { nullable: true })
  weight_score: number | null; // Layer 1: normalized net backing (0–100)

  @Column('smallint', { nullable: true })
  ai_score: number | null; // Layer 3: AI text quality rating (0–100)

  @Column('float', { nullable: true })
  prediction_score: number | null; // Layer 2: closeness to crowd_score (0–100)

  @Column('float', { nullable: true })
  composite_score: number | null; // Final S = W*50 + C*30 + A*20 (stored 0–100)

  // ── Dual Pool Payouts ─────────────────────────────────────────────────────
  @Column('bigint', { nullable: true })
  opinion_payout: number | null; // Payout from opinion pool (70%)

  @Column('bigint', { nullable: true })
  prediction_payout: number | null; // Payout from prediction pool (24%)

  @Column('boolean', { default: false })
  jackpot_eligible: boolean; // In top 20% predictors

  @Column('boolean', { default: false })
  jackpot_winner: boolean; // Selected as jackpot recipient

  // ── Total Payout ──────────────────────────────────────────────────────────
  @Column('bigint', { nullable: true })
  payout_amount: number | null; // opinion_payout + prediction_payout

  // Relations
  @ManyToOne(() => Market, (market) => market.opinions, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'market_id', referencedColumnName: 'id' })
  market: Market;

  @OneToMany('OpinionReaction', (reaction: any) => reaction.opinion, {
    cascade: true,
  })
  reactions: any[];
}
