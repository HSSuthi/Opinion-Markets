import { Market } from './Market';
export declare class Position {
    id: string;
    wallet_address: string;
    market_id: string;
    stake_amount: number;
    prize_amount: number | null;
    market_state: string;
    created_at: Date;
    settled_at: Date | null;
    updated_at: Date;
    market: Market;
}
//# sourceMappingURL=Position.d.ts.map