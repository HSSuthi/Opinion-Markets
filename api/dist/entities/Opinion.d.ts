import "reflect-metadata";
import { Market } from './Market';
export declare class Opinion {
    id: string;
    market_id: string;
    staker_address: string;
    amount: number;
    opinion_text: string | null;
    text_hash: Buffer;
    ipfs_cid: string | null;
    created_at: Date;
    market: Market;
}
//# sourceMappingURL=Opinion.d.ts.map