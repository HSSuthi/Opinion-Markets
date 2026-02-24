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

  // ── Layer 2: Crowd Prediction ──────────────────────────────────────────────
  @Column('smallint', { nullable: true })
  prediction: number | null; // 0–100 agreement prediction submitted with stake

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
  consensus_score: number | null; // Layer 2: closeness to crowd_score (0–100)

  @Column('float', { nullable: true })
  composite_score: number | null; // Final S = W*50 + C*30 + A*20 (stored 0–100)

  // ── Payout ─────────────────────────────────────────────────────────────────
  @Column('bigint', { nullable: true })
  payout_amount: number | null; // Prize earned in micro-USDC

  @Column('boolean', { default: false })
  paid: boolean;

  // ── On-chain references ─────────────────────────────────────────────────────
  /// Solana transaction signature from the on-chain stakeOpinion instruction
  @Column('varchar', { nullable: true })
  tx_signature: string | null;

  /// On-chain PDA address for this opinion account
  @Column('varchar', { nullable: true })
  opinion_pda: string | null;

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
