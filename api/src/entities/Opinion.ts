import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
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
  market_id: string; // Foreign key to Market

  @Column('varchar')
  staker_address: string; // Wallet address of the opinion staker

  @Column('bigint')
  amount: number; // USDC staked (in micro-units)

  @Column('text', { nullable: true })
  opinion_text: string | null; // Cached opinion text (up to 280 chars)

  @Column('bytea')
  text_hash: Buffer; // SHA-256 hash of opinion text

  @Column('varchar', { nullable: true })
  ipfs_cid: string | null; // IPFS hash for full text storage (future)

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => Market, (market) => market.opinions, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'market_id', referencedColumnName: 'id' })
  market: Market;
}
