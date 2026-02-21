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
exports.UserPortfolio = void 0;
const typeorm_1 = require("typeorm");
let UserPortfolio = class UserPortfolio {
    // Computed properties (calculated on demand)
    get win_rate() {
        return this.positions_count > 0 ? this.win_count / this.positions_count : 0;
    }
    get roi() {
        return this.total_staked > 0
            ? ((this.total_prize_won - this.total_staked) / this.total_staked) * 100
            : 0;
    }
};
exports.UserPortfolio = UserPortfolio;
__decorate([
    (0, typeorm_1.PrimaryColumn)('varchar'),
    __metadata("design:type", String)
], UserPortfolio.prototype, "wallet_address", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint', { default: 0 }),
    __metadata("design:type", Number)
], UserPortfolio.prototype, "total_staked", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint', { default: 0 }),
    __metadata("design:type", Number)
], UserPortfolio.prototype, "total_prize_won", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], UserPortfolio.prototype, "positions_count", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], UserPortfolio.prototype, "win_count", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], UserPortfolio.prototype, "last_updated", void 0);
exports.UserPortfolio = UserPortfolio = __decorate([
    (0, typeorm_1.Entity)('user_portfolio'),
    (0, typeorm_1.Index)(['last_updated'])
], UserPortfolio);
//# sourceMappingURL=UserPortfolio.js.map