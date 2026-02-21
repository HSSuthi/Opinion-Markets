"use strict";
/**
 * Opinion Markets - Automated Testing Suite
 * Run all tests and generate comprehensive report
 *
 * Usage:
 * npm install axios
 * npx ts-node src/testing/runTests.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const testUtils_1 = require("./testUtils");
const API_URL = process.env.API_URL || 'http://localhost:3001';
const VERBOSE = process.env.VERBOSE === 'true';
// ─────────────────────────────────────────────────────────────────────────────
// TEST RUNNER
// ─────────────────────────────────────────────────────────────────────────────
async function runAllTests() {
    console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║          Opinion Markets - Automated Testing Suite                         ║
║                      Devnet Testing (Phase 3)                              ║
╚════════════════════════════════════════════════════════════════════════════╝
  `);
    const testUtils = (0, testUtils_1.createTestUtils)(API_URL);
    const results = {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        errors: [],
    };
    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1: HEALTH CHECK
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n📡 SECTION 1: CONNECTIVITY & HEALTH CHECK');
    console.log('═══════════════════════════════════════════════════════════════════════\n');
    try {
        console.log('🔍 Checking API health...');
        const isHealthy = await testUtils.checkHealth();
        results.totalTests++;
        if (isHealthy) {
            console.log('✅ API is healthy and reachable');
            results.passedTests++;
        }
        else {
            console.log('❌ API health check failed');
            results.failedTests++;
            results.errors.push('API health check failed - is API running?');
        }
        const version = await testUtils.getVersion();
        console.log(`📦 API Version: ${version.version}`);
        console.log(`🔗 API URL: ${API_URL}`);
    }
    catch (error) {
        results.failedTests++;
        results.totalTests++;
        const msg = `Connection error: ${error instanceof Error ? error.message : String(error)}`;
        console.log(`❌ ${msg}`);
        results.errors.push(msg);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: MARKET OPERATIONS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n\n📊 SECTION 2: MARKET OPERATIONS');
    console.log('═══════════════════════════════════════════════════════════════════════\n');
    let testMarketId = null;
    try {
        console.log('🔍 Test 2.1: Create market...');
        const market = await testUtils.createMarket('Will Bitcoin reach $100k by end of 2026?', 604800 // 7 days
        );
        testMarketId = market.id;
        results.totalTests++;
        results.passedTests++;
        console.log(`✅ Market created: ${market.id.slice(0, 20)}...`);
        console.log(`   Statement: ${market.statement.slice(0, 50)}...`);
        console.log(`   Created: ${new Date(market.created_at).toLocaleString()}`);
    }
    catch (error) {
        results.totalTests++;
        results.failedTests++;
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`❌ Failed to create market: ${msg}`);
        results.errors.push(`Create market failed: ${msg}`);
    }
    if (testMarketId) {
        try {
            console.log('\n🔍 Test 2.2: Fetch market details...');
            const market = await testUtils.getMarket(testMarketId);
            results.totalTests++;
            results.passedTests++;
            console.log(`✅ Market fetched successfully`);
            console.log(`   State: ${market.state}`);
            console.log(`   Total Stake: ${(0, testUtils_1.formatUSDC)(market.total_stake)}`);
            console.log(`   Staker Count: ${market.staker_count}`);
        }
        catch (error) {
            results.totalTests++;
            results.failedTests++;
            const msg = error instanceof Error ? error.message : String(error);
            console.log(`❌ Failed to fetch market: ${msg}`);
            results.errors.push(`Fetch market failed: ${msg}`);
        }
        try {
            console.log('\n🔍 Test 2.3: List markets with pagination...');
            const { markets, pagination } = await testUtils.getMarkets({
                state: 'Active',
                limit: 10,
            });
            results.totalTests++;
            results.passedTests++;
            console.log(`✅ Markets fetched`);
            console.log(`   Total Markets: ${pagination.total}`);
            console.log(`   Returned: ${markets.length} (of ${pagination.limit})`);
            console.log(`   Has More: ${pagination.hasMore}`);
        }
        catch (error) {
            results.totalTests++;
            results.failedTests++;
            const msg = error instanceof Error ? error.message : String(error);
            console.log(`❌ Failed to list markets: ${msg}`);
            results.errors.push(`List markets failed: ${msg}`);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: OPINION STAKING
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n\n💰 SECTION 3: OPINION STAKING');
    console.log('═══════════════════════════════════════════════════════════════════════\n');
    const testStakers = ['user_alice', 'user_bob', 'user_charlie'];
    if (testMarketId) {
        for (const staker of testStakers) {
            try {
                console.log(`🔍 Test 3.${testStakers.indexOf(staker) + 1}: Stake from ${staker}...`);
                const opinion = await testUtils.stakeOpinion(testMarketId, 5_000_000, // $5
                `Bullish on Bitcoin, staker ${staker.slice(0, 10)}`, staker);
                results.totalTests++;
                results.passedTests++;
                console.log(`✅ Opinion staked by ${staker}`);
                console.log(`   Amount: ${(0, testUtils_1.formatUSDC)(opinion.amount)}`);
                console.log(`   Opinion Text: ${opinion.opinion_text?.slice(0, 40)}...`);
            }
            catch (error) {
                results.totalTests++;
                results.failedTests++;
                const msg = error instanceof Error ? error.message : String(error);
                console.log(`❌ Failed to stake: ${msg}`);
                results.errors.push(`Stake opinion failed (${staker}): ${msg}`);
            }
        }
        // Test duplicate stake prevention
        try {
            console.log(`\n🔍 Test 3.4: Prevent duplicate stakes (should fail)...`);
            await testUtils.stakeOpinion(testMarketId, 3_000_000, 'duplicate', testStakers[0]);
            results.totalTests++;
            results.failedTests++;
            console.log(`❌ Should have prevented duplicate stake but didn't!`);
            results.errors.push('Duplicate stake prevention not working');
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('already staked')) {
                results.totalTests++;
                results.passedTests++;
                console.log(`✅ Duplicate stake correctly prevented`);
            }
            else {
                results.totalTests++;
                results.failedTests++;
                console.log(`❌ Unexpected error: ${error}`);
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: USER PORTFOLIO
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n\n👤 SECTION 4: USER PORTFOLIO & POSITIONS');
    console.log('═══════════════════════════════════════════════════════════════════════\n');
    for (const staker of testStakers) {
        try {
            console.log(`🔍 Test 4.${testStakers.indexOf(staker) + 1}: Fetch portfolio for ${staker}...`);
            const portfolio = await testUtils.getUserPortfolio(staker);
            results.totalTests++;
            results.passedTests++;
            console.log(`✅ Portfolio fetched`);
            console.log(`   Total Staked: ${(0, testUtils_1.formatUSDC)(portfolio.total_staked)}`);
            console.log(`   Total Won: ${(0, testUtils_1.formatUSDC)(portfolio.total_prize_won)}`);
            console.log(`   Win Rate: ${(portfolio.win_rate * 100).toFixed(1)}%`);
            console.log(`   ROI: ${portfolio.roi.toFixed(2)}%`);
            console.log(`   Positions: ${portfolio.positions_count}`);
        }
        catch (error) {
            results.totalTests++;
            results.failedTests++;
            const msg = error instanceof Error ? error.message : String(error);
            console.log(`❌ Failed to fetch portfolio: ${msg}`);
            results.errors.push(`Portfolio fetch failed (${staker}): ${msg}`);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: VALIDATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n\n✔️  SECTION 5: INPUT VALIDATION');
    console.log('═══════════════════════════════════════════════════════════════════════\n');
    // Test statement validation
    console.log('🔍 Test 5.1: Statement length validation...');
    const statementValidation = testUtils.validateStatement('a'.repeat(281));
    results.totalTests++;
    if (!statementValidation.valid) {
        results.passedTests++;
        console.log(`✅ Validation correctly rejects long statement: ${statementValidation.error}`);
    }
    else {
        results.failedTests++;
        console.log(`❌ Validation should reject statement > 280 chars`);
    }
    // Test stake validation
    console.log('\n🔍 Test 5.2: Stake amount validation...');
    const stakeValidation = testUtils.validateStakeAmount(100_000);
    results.totalTests++;
    if (!stakeValidation.valid) {
        results.passedTests++;
        console.log(`✅ Validation correctly rejects low stake: ${stakeValidation.error}`);
    }
    else {
        results.failedTests++;
        console.log(`❌ Validation should reject stake < $0.50`);
    }
    // Test wallet validation
    console.log('\n🔍 Test 5.3: Wallet address validation...');
    const walletValidation = testUtils.validateWallet('invalid');
    results.totalTests++;
    if (!walletValidation.valid) {
        results.passedTests++;
        console.log(`✅ Validation correctly rejects invalid wallet: ${walletValidation.error}`);
    }
    else {
        results.failedTests++;
        console.log(`❌ Validation should reject invalid wallet`);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // FINAL REPORT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n\n');
    console.log('╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║                         TEST RESULTS SUMMARY                           ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝\n');
    const passPercentage = ((results.passedTests / results.totalTests) * 100).toFixed(1);
    console.log(`Total Tests: ${results.totalTests}`);
    console.log(`✅ Passed: ${results.passedTests}`);
    console.log(`❌ Failed: ${results.failedTests}`);
    console.log(`📊 Success Rate: ${passPercentage}%\n`);
    if (results.errors.length > 0) {
        console.log('Errors Found:');
        results.errors.forEach((error, i) => {
            console.log(`  ${i + 1}. ❌ ${error}`);
        });
    }
    else {
        console.log('🎉 No errors found! All tests passed!');
    }
    console.log('\n' + '═'.repeat(75) + '\n');
    // ─────────────────────────────────────────────────────────────────────────
    // RECOMMENDATIONS
    // ─────────────────────────────────────────────────────────────────────────
    if (results.failedTests === 0) {
        console.log('✅ READY FOR DEPLOYMENT\n');
        console.log('Recommendations:');
        console.log('  1. ✅ All core API functionality working');
        console.log('  2. ✅ Validation and error handling working');
        console.log('  3. ✅ Pagination and filtering working');
        console.log('  4. Next: Deploy to staging for integration testing');
        console.log('  5. Next: Run security audit before production\n');
    }
    else {
        console.log('⚠️  ISSUES FOUND - DO NOT DEPLOY\n');
        console.log('Next Steps:');
        console.log('  1. Review errors above');
        console.log('  2. Check logs for more details');
        console.log('  3. Fix issues in code');
        console.log('  4. Re-run tests to verify fixes\n');
    }
    return results;
}
// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
runAllTests()
    .then((results) => {
    process.exit(results.failedTests === 0 ? 0 : 1);
})
    .catch((error) => {
    console.error('Test suite crashed:', error);
    process.exit(1);
});
//# sourceMappingURL=runTests.js.map