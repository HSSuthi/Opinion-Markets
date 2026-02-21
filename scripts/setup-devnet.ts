/**
 * One-time devnet setup script.
 *
 * Run with:
 *   cd anchor
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *   ANCHOR_WALLET=~/.config/solana/id.json \
 *   npx ts-node scripts/setup-devnet.ts
 *
 * What it does:
 *   1. Checks your SOL balance and requests an airdrop if low
 *   2. Creates a test USDC mint (6 decimals)
 *   3. Creates your USDC token account and mints you $500
 *   4. Generates an oracle keypair (or uses existing one)
 *   5. Calls `initialize` to create the ProgramConfig on-chain
 *   6. Prints all the values you need for your .env files
 */

import * as anchor from "@coral-xyz/anchor";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.OpinionMarket as anchor.Program;
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  console.log("\n==============================================");
  console.log(" Opinion Market — Devnet Setup");
  console.log("==============================================\n");
  console.log(`Your wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Program ID:  ${program.programId.toBase58()}\n`);

  // ── 1. Check SOL balance ──────────────────────────────────────────────────
  let balance = await connection.getBalance(wallet.publicKey);
  console.log(
    `SOL balance: ${(balance / anchor.web3.LAMPORTS_PER_SOL).toFixed(2)} SOL`
  );

  if (balance < 0.5 * anchor.web3.LAMPORTS_PER_SOL) {
    console.log("Balance low — requesting airdrop of 2 SOL...");
    const sig = await connection.requestAirdrop(
      wallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);
    balance = await connection.getBalance(wallet.publicKey);
    console.log(
      `New balance: ${(balance / anchor.web3.LAMPORTS_PER_SOL).toFixed(
        2
      )} SOL ✓`
    );
  } else {
    console.log("SOL balance OK ✓");
  }

  // ── 2. Oracle keypair ─────────────────────────────────────────────────────
  const oracleKeyPath = path.resolve(
    os.homedir(),
    ".config/solana/oracle.json"
  );

  let oracleKeypair: anchor.web3.Keypair;
  if (fs.existsSync(oracleKeyPath)) {
    const raw = JSON.parse(fs.readFileSync(oracleKeyPath, "utf-8")) as number[];
    oracleKeypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(raw));
    console.log(
      `\nOracle keypair found: ${oracleKeypair.publicKey.toBase58()} ✓`
    );
  } else {
    oracleKeypair = anchor.web3.Keypair.generate();
    fs.writeFileSync(
      oracleKeyPath,
      JSON.stringify(Array.from(oracleKeypair.secretKey))
    );
    console.log(
      `\nOracle keypair generated: ${oracleKeypair.publicKey.toBase58()}`
    );
    console.log(`Saved to: ${oracleKeyPath} ✓`);
  }

  // Fund oracle with a little SOL for transaction fees
  const oracleBal = await connection.getBalance(oracleKeypair.publicKey);
  if (oracleBal < 0.1 * anchor.web3.LAMPORTS_PER_SOL) {
    console.log("Funding oracle keypair...");
    const sig = await connection.requestAirdrop(
      oracleKeypair.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);
    console.log("Oracle funded ✓");
  }

  // ── 3. Create test USDC mint ──────────────────────────────────────────────
  console.log("\nCreating test USDC mint...");
  const usdcMint = await createMint(
    connection,
    wallet.payer,
    wallet.publicKey, // mint authority
    null,
    6 // 6 decimals, like real USDC
  );
  console.log(`USDC mint: ${usdcMint.toBase58()} ✓`);

  // ── 4. Create your USDC token account and mint $500 ───────────────────────
  console.log("Creating your USDC token account...");
  const yourUsdcAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet.payer,
    usdcMint,
    wallet.publicKey
  );

  await mintTo(
    connection,
    wallet.payer,
    usdcMint,
    yourUsdcAccount.address,
    wallet.publicKey,
    500 * 1_000_000 // $500 USDC
  );
  console.log(`Minted $500 test USDC to your wallet ✓`);

  // ── 5. Create treasury USDC account (also your wallet for now) ────────────
  const treasuryUsdcAccount = yourUsdcAccount; // same wallet = treasury for testing

  // ── 6. Check if ProgramConfig already exists ─────────────────────────────
  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  console.log(`\nConfig PDA: ${configPda.toBase58()}`);

  const existingConfig = await connection.getAccountInfo(configPda);
  if (existingConfig) {
    console.log("ProgramConfig already initialized ✓");
  } else {
    console.log("Calling initialize...");
    await program.methods
      .initialize(oracleKeypair.publicKey, wallet.publicKey)
      .accounts({
        deployer: wallet.publicKey,
        config: configPda,
        usdcMint,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("ProgramConfig initialized on-chain ✓");
  }

  // ── 7. Print .env values ──────────────────────────────────────────────────
  console.log("\n==============================================");
  console.log(" COPY THESE VALUES INTO YOUR .env FILES");
  console.log("==============================================\n");

  const envValues = `
# ── Paste into: api/.env  AND  oracle/.env ────────────────────────
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=${program.programId.toBase58()}
USDC_MINT=${usdcMint.toBase58()}
TREASURY_PUBKEY=${wallet.publicKey.toBase58()}
ORACLE_KEYPAIR_PATH=~/.config/solana/oracle.json
ORACLE_PUBKEY=${oracleKeypair.publicKey.toBase58()}
ANTHROPIC_API_KEY=         <-- fill this in

# ── Paste into: app/.env.local ────────────────────────────────────
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=${program.programId.toBase58()}
NEXT_PUBLIC_USDC_MINT=${usdcMint.toBase58()}
NEXT_PUBLIC_API_URL=http://localhost:3001
`;

  console.log(envValues);

  console.log("==============================================");
  console.log(" NEXT STEPS");
  console.log("==============================================");
  console.log("1. Copy the values above into api/.env and oracle/.env");
  console.log("2. Copy the NEXT_PUBLIC_ values into app/.env.local");
  console.log("3. Restart: app (npm run dev) and api (npm run dev)");
  console.log("4. In Phantom: go to Settings → Developer → choose Devnet");
  console.log(`5. Your wallet already has $500 test USDC ready to use`);
  console.log("==============================================\n");
}

main().catch((e) => {
  console.error("\n❌ Setup failed:", e.message);
  process.exit(1);
});
