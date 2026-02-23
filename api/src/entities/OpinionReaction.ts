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
import { Opinion } from './Opinion';

export type ReactionType = 'back' | 'slash';

@Entity('opinion_reactions')
@Unique(['opinion_id', 'reactor_address'])
@Index(['opinion_id'])
@Index(['reactor_address'])
export class OpinionReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar')
  opinion_id: string;

  @Column('varchar')
  market_id: string;

  @Column('varchar')
  reactor_address: string;

  @Column('varchar')
  reaction_type: ReactionType; // 'back' | 'slash'

  @Column('bigint')
  amount: number; // USDC in micro-units

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => Opinion, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'opinion_id', referencedColumnName: 'id' })
  opinion: Opinion;
}
