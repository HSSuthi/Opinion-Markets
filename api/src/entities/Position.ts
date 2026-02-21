import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Market } from './Market';

@Entity('positions')
@Index(['wallet_address', 'settled_at'])
@Index(['wallet_address'])
@Index(['market_id'])
@Index(['settled_at'])
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar')
  wallet_address: string; // User's wallet

  @Column('varchar')
  market_id: string; // Foreign key to Market

  @Column('bigint')
  stake_amount: number; // Amount staked (micro-USDC)

  @Column('bigint', { nullable: true })
  prize_amount: number | null; // Prize won (if settled and won), null if lost/not settled

  @Column('varchar')
  market_state: string; // Snapshot of market state at stake time

  @CreateDateColumn()
  created_at: Date;

  @Column('timestamp', { nullable: true })
  settled_at: Date | null; // When market settled

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Market, (market) => market.positions, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'market_id', referencedColumnName: 'id' })
  market: Market;
}
