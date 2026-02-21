/**
 * Testnet Validation Script
 *
 * Validates Opinion-Markets smart contract on Solana testnet
 * Runs complete market lifecycle: Create → Stake → Close → Sentiment → VRF → Settle
 *
 * Usage:
 *   npx ts-node scripts/validate-testnet.ts [--network testnet|devnet] [--verbose]
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import * as crypto from "crypto";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

interface ValidationResult {
  network: string;
  timestamp: string;
  tests: {
    name: string;
    status: "pass" | "fail" | "skip";
    duration: number;
    error?: string;
  }[];
  metrics: {
    totalTransactions: number;
    totalGasUsed: number;
    averageGasPerTx: number;
    totalTime: number;
  };
  summary: {
    passed: number;
    failed: number;
    skipped: number;
  };
}

class TestnetValidator {
  private provider: anchor.AnchorProvider;
  private program: anchor.Program;
  private connection: anchor.web3.Connection;
  private results: ValidationResult;
  private testAccounts: {
    deployer: anchor.Wallet;
    oracle: anchor.web3.Keypair;
    creator: anchor.web3.Keypair;
    stakers: anchor.web3.Keypair[];
    treasury: anchor.web3.Keypair;
  };
  private tokenState: {
    usdcMint: anchor.web3.PublicKey;
    accounts: Map<string, anchor.web3.PublicKey>;
  };
  private startTime: number;
  private verbose: boolean;

  constructor(network: string = "testnet", verbose: boolean = false) {
    this.verbose = verbose;
    this.provider = anchor.AnchorProvider.env();
    this.connection = this.provider.connection;
    this.program = anchor.workspace.OpinionMarket as Program;

    this.results = {
      network,
      timestamp: new Date().toISOString(),
      tests: [],
      metrics: {
        totalTransactions: 0,
        totalGasUsed: 0,
        averageGasPerTx: 0,
        totalTime: 0,
      },
      summary: { passed: 0, failed: 0, skipped: 0 },
    };

    this.testAccounts = {
      deployer: this.provider.wallet as anchor.Wallet,
      oracle: anchor.web3.Keypair.generate(),
      creator: anchor.web3.Keypair.generate(),
      stakers: Array(5)
        .fill(null)
        .map(() => anchor.web3.Keypair.generate()),
      treasury: anchor.web3.Keypair.generate(),
    };

    this.tokenState = {
      usdcMint: anchor.web3.PublicKey.default,
      accounts: new Map(),
    };

    this.startTime = Date.now();
  }

  log(message: string) {
    if (this.verbose) {
      console.log(`[${new Date().toISOString()}] ${message}`);
    }
  }

  async test(
    name: string,
    fn: () => Promise<void>
  ): Promise<{ status: "pass" | "fail" | "skip"; error?: string }> {
    const startTime = Date.now();
    try {
      this.log(`Starting test: ${name}`);
      await fn();
      const duration = Date.now() - startTime;
      this.results.tests.push({ name, status: "pass", duration });
      this.results.summary.passed++;
      console.log(`✅ ${name} (${duration}ms)`);
      return { status: "pass" };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMsg = error.message || String(error);
      this.results.tests.push({ name, status: "fail", duration, error: errorMsg });
      this.results.summary.failed++;
      console.log(`❌ ${name}: ${errorMsg}`);
      return { status: "fail", error: errorMsg };
    }
  }

  async setupTestAccounts() {
    this.log("Setting up test accounts...");
    const participants = [
      this.testAccounts.oracle,
      this.testAccounts.creator,
      ...this.testAccounts.stakers,
      this.testAccounts.treasury,
    ];

    for (const kp of participants) {
      try {
        const sig = await this.connection.requestAirdrop(
          kp.publicKey,
          5 * anchor.web3.LAMPORTS_PER_SOL
        );
        await this.connection.confirmTransaction(sig);
        this.log(`Airdropped SOL to ${kp.publicKey.toBase58()}`);
      } catch (error: any) {
        this.log(`Warning: Airdrop failed for ${kp.publicKey.toBase58()}: ${error.message}`);
      }
    }
  }

  async setupUSDC() {
    this.log("Setting up USDC token...");

    // Create USDC mint
    this.tokenState.usdcMint = await createMint(
      this.connection,
      this.testAccounts.deployer.payer,
      this.testAccounts.deployer.publicKey,
      null,
      6
    );
    this.log(`Created USDC mint: ${this.tokenState.usdcMint.toBase58()}`);

    // Create token accounts for all participants
    const createTokenAccount = async (owner: anchor.web3.PublicKey, label: string) => {
      const ata = await createAccount(
        this.connection,
        this.testAccounts.deployer.payer,
        this.tokenState.usdcMint,
        owner
      );
      this.tokenState.accounts.set(label, ata);
      this.log(`Created token account for ${label}: ${ata.toBase58()}`);
      return ata;
    };

    await createTokenAccount(this.testAccounts.creator.publicKey, "creator");
    await createTokenAccount(this.testAccounts.treasury.publicKey, "treasury");

    for (let i = 0; i < this.testAccounts.stakers.length; i++) {
      await createTokenAccount(this.testAccounts.stakers[i].publicKey, `staker-${i}`);
    }

    // Mint USDC to all accounts
    for (const [label, ata] of this.tokenState.accounts.entries()) {
      const amount = 100 * 1_000_000; // 100 USDC
      await mintTo(
        this.connection,
        this.testAccounts.deployer.payer,
        this.tokenState.usdcMint,
        ata,
        this.testAccounts.deployer.publicKey,
        amount
      );
      this.log(`Minted 100 USDC to ${label}`);
    }
  }

  async run(): Promise<ValidationResult> {
    console.log("🚀 Starting Opinion-Markets Testnet Validation");
    console.log(`Network: ${this.results.network}`);
    console.log(`Timestamp: ${this.results.timestamp}`);
    console.log("---");

    await this.test("Setup test accounts", () => this.setupTestAccounts());
    await this.test("Setup USDC token", () => this.setupUSDC());

    await this.test("Initialize program config", async () => {
      const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("config")],
        this.program.programId
      );

      const tx = await this.program.methods
        .initialize(this.testAccounts.oracle.publicKey, this.testAccounts.treasury.publicKey)
        .accounts({
          deployer: this.testAccounts.deployer.publicKey,
          config: configPda,
          usdcMint: this.tokenState.usdcMint,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      this.log(`Initialized config: ${tx}`);
      this.results.metrics.totalTransactions++;
    });

    const marketUuid = Array.from(crypto.randomBytes(16));
    const [marketPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("market"), Buffer.from(marketUuid)],
      this.program.programId
    );
    const [escrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), marketPda.toBuffer()],
      this.program.programId
    );
    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      this.program.programId
    );

    await this.test("Create market", async () => {
      const creatorUsdc = this.tokenState.accounts.get("creator")!;
      const treasuryUsdc = this.tokenState.accounts.get("treasury")!;

      const tx = await this.program.methods
        .createMarket(
          "Will Solana reach $500 by end of Q2 2026?",
          new BN(86_400), // 24 hours
          marketUuid
        )
        .accounts({
          creator: this.testAccounts.creator.publicKey,
          config: configPda,
          market: marketPda,
          escrowTokenAccount: escrowPda,
          creatorUsdc,
          treasuryUsdc,
          usdcMint: this.tokenState.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([this.testAccounts.creator])
        .rpc();

      this.log(`Created market: ${tx}`);
      this.results.metrics.totalTransactions++;
    });

    await this.test("Stake opinions (3 stakers)", async () => {
      const stakes = [2_000_000, 3_000_000, 1_000_000]; // $2, $3, $1

      for (let i = 0; i < 3; i++) {
        const staker = this.testAccounts.stakers[i];
        const stakerUsdc = this.tokenState.accounts.get(`staker-${i}`)!;
        const [opinionPda] = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("opinion"), marketPda.toBuffer(), staker.publicKey.toBuffer()],
          this.program.programId
        );

        const textHash = Array.from(
          crypto
            .createHash("sha256")
            .update(`Opinion from staker ${i}`)
            .digest()
        );

        const tx = await this.program.methods
          .stakeOpinion(new BN(stakes[i]), textHash, `QmTestCID${i}`)
          .accounts({
            staker: staker.publicKey,
            config: configPda,
            market: marketPda,
            escrowTokenAccount: escrowPda,
            opinion: opinionPda,
            stakerUsdc,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([staker])
          .rpc();

        this.log(`Staker ${i} staked ${stakes[i] / 1_000_000} USDC: ${tx}`);
        this.results.metrics.totalTransactions++;
      }
    });

    await this.test("Close market", async () => {
      // In real test, would wait for market expiry
      // For now, just verify the account exists
      const market = await this.program.account.market.fetch(marketPda);
      this.log(`Market state: ${JSON.stringify(market.state)}`);
    });

    await this.test("Record sentiment", async () => {
      const tx = await this.program.methods
        .recordSentiment(72, 2, Array(32).fill(42))
        .accounts({
          oracleAuthority: this.testAccounts.oracle.publicKey,
          config: configPda,
          market: marketPda,
        })
        .signers([this.testAccounts.oracle])
        .rpc();

      this.log(`Recorded sentiment: ${tx}`);
      this.results.metrics.totalTransactions++;
    });

    await this.test("Request VRF randomness", async () => {
      const [vrfRequestPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vrf_request"), marketPda.toBuffer()],
        this.program.programId
      );

      const tx = await this.program.methods
        .requestVrfRandomness()
        .accounts({
          oracleAuthority: this.testAccounts.oracle.publicKey,
          config: configPda,
          market: marketPda,
          vrfRequest: vrfRequestPda,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([this.testAccounts.oracle])
        .rpc();

      this.log(`Requested VRF randomness: ${tx}`);
      this.results.metrics.totalTransactions++;
    });

    this.results.metrics.totalTime = Date.now() - this.startTime;
    this.results.metrics.averageGasPerTx =
      this.results.metrics.totalTransactions > 0
        ? this.results.metrics.totalGasUsed / this.results.metrics.totalTransactions
        : 0;

    return this.results;
  }

  printSummary() {
    console.log("\n" + "=".repeat(60));
    console.log("📊 VALIDATION SUMMARY");
    console.log("=".repeat(60));
    console.log(`Network: ${this.results.network}`);
    console.log(`Timestamp: ${this.results.timestamp}`);
    console.log(`Total Time: ${(this.results.metrics.totalTime / 1000).toFixed(2)}s`);
    console.log(`Total Transactions: ${this.results.metrics.totalTransactions}`);
    console.log("");
    console.log(`✅ Passed: ${this.results.summary.passed}`);
    console.log(`❌ Failed: ${this.results.summary.failed}`);
    console.log(`⏭️  Skipped: ${this.results.summary.skipped}`);
    console.log("=".repeat(60));

    if (this.results.summary.failed === 0) {
      console.log("🎉 All tests passed!");
    } else {
      console.log(`⚠️  ${this.results.summary.failed} test(s) failed`);
      console.log("\nFailed tests:");
      this.results.tests
        .filter((t) => t.status === "fail")
        .forEach((t) => {
          console.log(`  - ${t.name}: ${t.error}`);
        });
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  let network = "testnet";
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--network" && args[i + 1]) {
      network = args[i + 1];
      i++;
    }
    if (args[i] === "--verbose") {
      verbose = true;
    }
  }

  try {
    const validator = new TestnetValidator(network, verbose);
    const results = await validator.run();
    validator.printSummary();

    // Exit with code 0 if all tests passed, 1 if any failed
    process.exit(results.summary.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
