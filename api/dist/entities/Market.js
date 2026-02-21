"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Market = exports.MarketState = void 0;
const typeorm_1 = require("typeorm");
const Opinion_1 = require("./Opinion");
const Position_1 = require("./Position");
var MarketState;
(function (MarketState) {
    MarketState["ACTIVE"] = "Active";
    MarketState["CLOSED"] = "Closed";
    MarketState["SCORED"] = "Scored";
    MarketState["AWAITING_RANDOMNESS"] = "AwaitingRandomness";
    MarketState["SETTLED"] = "Settled";
})(MarketState || (exports.MarketState = MarketState = {}));
let Market = class Market {
};
exports.Market = Market;
__decorate([
    (0, typeorm_1.PrimaryColumn)('varchar'),
    __metadata("design:type", String)
], Market.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { unique: true }),
    __metadata("design:type", String)
], Market.prototype, "uuid", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], Market.prototype, "creator_address", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], Market.prototype, "statement", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Market.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamp'),
    __metadata("design:type", Date)
], Market.prototype, "closes_at", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { enum: MarketState, default: MarketState.ACTIVE }),
    __metadata("design:type", String)
], Market.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint', { default: 0 }),
    __metadata("design:type", Number)
], Market.prototype, "total_stake", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], Market.prototype, "staker_count", void 0);
__decorate([
    (0, typeorm_1.Column)('smallint', { nullable: true }),
    __metadata("design:type", Object)
], Market.prototype, "sentiment_score", void 0);
__decorate([
    (0, typeorm_1.Column)('smallint', { nullable: true }),
    __metadata("design:type", Object)
], Market.prototype, "sentiment_confidence", void 0);
__decorate([
    (0, typeorm_1.Column)('bytea', { nullable: true }),
    __metadata("design:type", Object)
], Market.prototype, "summary_hash", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", Object)
], Market.prototype, "winner", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint', { nullable: true }),
    __metadata("design:type", Object)
], Market.prototype, "winner_prize", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Market.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Opinion_1.Opinion, (opinion) => opinion.market, {
        cascade: true,
        onDelete: 'CASCADE',
    }),
    __metadata("design:type", Array)
], Market.prototype, "opinions", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Position_1.Position, (position) => position.market, {
        cascade: true,
        onDelete: 'CASCADE',
    }),
    __metadata("design:type", Array)
], Market.prototype, "positions", void 0);
exports.Market = Market = __decorate([
    (0, typeorm_1.Entity)('markets'),
    (0, typeorm_1.Index)(['state', 'closes_at']),
    (0, typeorm_1.Index)(['state']),
    (0, typeorm_1.Index)(['closes_at']),
    (0, typeorm_1.Index)(['created_at', 'state']),
    (0, typeorm_1.Index)(['total_stake', 'state'])
], Market);
//# sourceMappingURL=Market.js.map