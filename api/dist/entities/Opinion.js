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
exports.Opinion = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const Market_1 = require("./Market");
let Opinion = class Opinion {
};
exports.Opinion = Opinion;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Opinion.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], Opinion.prototype, "market_id", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], Opinion.prototype, "staker_address", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint'),
    __metadata("design:type", Number)
], Opinion.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", Object)
], Opinion.prototype, "opinion_text", void 0);
__decorate([
    (0, typeorm_1.Column)('bytea'),
    __metadata("design:type", Buffer)
], Opinion.prototype, "text_hash", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", Object)
], Opinion.prototype, "ipfs_cid", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Opinion.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Market_1.Market, (market) => market.opinions, {
        onDelete: 'CASCADE',
        eager: false,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'market_id', referencedColumnName: 'id' }),
    __metadata("design:type", Market_1.Market)
], Opinion.prototype, "market", void 0);
exports.Opinion = Opinion = __decorate([
    (0, typeorm_1.Entity)('opinions'),
    (0, typeorm_1.Index)(['market_id', 'staker_address']),
    (0, typeorm_1.Index)(['market_id', 'created_at']),
    (0, typeorm_1.Index)(['staker_address']),
    (0, typeorm_1.Unique)(['market_id', 'staker_address'])
], Opinion);
//# sourceMappingURL=Opinion.js.map