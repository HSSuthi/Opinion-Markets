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
exports.Position = void 0;
const typeorm_1 = require("typeorm");
const Market_1 = require("./Market");
let Position = class Position {
};
exports.Position = Position;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Position.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], Position.prototype, "wallet_address", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], Position.prototype, "market_id", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint'),
    __metadata("design:type", Number)
], Position.prototype, "stake_amount", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint', { nullable: true }),
    __metadata("design:type", Object)
], Position.prototype, "prize_amount", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], Position.prototype, "market_state", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Position.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamp', { nullable: true }),
    __metadata("design:type", Object)
], Position.prototype, "settled_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Position.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Market_1.Market, (market) => market.positions, {
        onDelete: 'CASCADE',
        eager: false,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'market_id', referencedColumnName: 'id' }),
    __metadata("design:type", Market_1.Market)
], Position.prototype, "market", void 0);
exports.Position = Position = __decorate([
    (0, typeorm_1.Entity)('positions'),
    (0, typeorm_1.Index)(['wallet_address', 'settled_at']),
    (0, typeorm_1.Index)(['wallet_address']),
    (0, typeorm_1.Index)(['market_id']),
    (0, typeorm_1.Index)(['settled_at'])
], Position);
//# sourceMappingURL=Position.js.map