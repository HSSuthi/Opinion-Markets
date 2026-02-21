import { Opinion } from './Opinion';
import { Position } from './Position';
export declare enum MarketState {
    ACTIVE = "Active",
    CLOSED = "Closed",
    SCORED = "Scored",
    AWAITING_RANDOMNESS = "AwaitingRandomness",
    SETTLED = "Settled"
}
export declare class Market {
    id: string;
    uuid: string;
    creator_address: string;
    statement: string;
    created_at: Date;
    closes_at: Date;
    state: MarketState;
    total_stake: number;
    staker_count: number;
    sentiment_score: number | null;
    sentiment_confidence: number | null;
    summary_hash: Buffer | null;
    winner: string | null;
    winner_prize: number | null;
    updated_at: Date;
    opinions: Opinion[];
    positions: Position[];
}
//# sourceMappingURL=Market.d.ts.map