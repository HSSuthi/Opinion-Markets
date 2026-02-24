/**
 * Typed Anchor client for Opinion Markets.
 *
 * All account derivation (PDAs, ATAs) is handled internally.
 * Calling components never construct accounts manually.
 */

import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Connection,
  TransactionSignature,
} from '@solana/web3.js';
import {
  Program,
  AnchorProvider,
  BN,
  type Idl,
} from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import type { AnchorWallet } from '@solana/wallet-adapter-react';

import { IDL, PROGRAM_ERROR_MESSAGES, getProgramId } from './program';
import { getNetworkConfig, getUsdcMint, getTreasuryAddress, getExplorerTxUrl } from './config';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TransactionResult {
  signature: TransactionSignature;
  explorerUrl: string;
}

export interface CreateMarketResult extends TransactionResult {
  marketPda: PublicKey;
  escrowPda: PublicKey;
  uuid: Uint8Array;
}

export interface StakeOpinionResult extends TransactionResult {
  opinionPda: PublicKey;
}

export interface ReactToOpinionResult extends TransactionResult {
  reactionPda: PublicKey;
}

export interface ClaimPayoutResult extends TransactionResult {
  payoutAmount: number;
}

// ── Error handling ─────────────────────────────────────────────────────────

export class OpinionMarketError extends Error {
  public code: number | null;
  public programError: string | null;

  constructor(message: string, code: number | null = null) {
    super(message);
    this.name = 'OpinionMarketError';
    this.code = code;
    this.programError = code !== null ? (PROGRAM_ERROR_MESSAGES[code] ?? null) : null;
  }
}

function parseAnchorError(err: unknown): OpinionMarketError {
  // Anchor errors have an `error` object with `errorCode`
  const e = err as any;

  // Anchor v0.30+ style
  if (e?.error?.errorCode?.number) {
    const code = e.error.errorCode.number;
    const msg = PROGRAM_ERROR_MESSAGES[code] ?? e.error.errorMessage ?? 'Unknown program error';
    return new OpinionMarketError(msg, code);
  }

  // Anchor ProgramError style
  if (e?.code !== undefined && typeof e.code === 'number') {
    const msg = PROGRAM_ERROR_MESSAGES[e.code] ?? e.msg ?? 'Unknown program error';
    return new OpinionMarketError(msg, e.code);
  }

  // Transaction simulation failure
  if (e?.message?.includes('custom program error:')) {
    const match = e.message.match(/custom program error: 0x([0-9a-fA-F]+)/);
    if (match) {
      const code = parseInt(match[1], 16);
      const msg = PROGRAM_ERROR_MESSAGES[code] ?? `Program error ${code}`;
      return new OpinionMarketError(msg, code);
    }
  }

  // Wallet rejection
  if (e?.message?.includes('User rejected')) {
    return new OpinionMarketError('Transaction was rejected by your wallet');
  }

  // Insufficient funds
  if (e?.message?.includes('insufficient funds') || e?.message?.includes('Insufficient')) {
    return new OpinionMarketError(
      'Insufficient USDC balance. Make sure you have enough USDC in your wallet.'
    );
  }

  // Generic fallback
  const message = e?.message || String(err);
  return new OpinionMarketError(message);
}

// ── PDA derivation ─────────────────────────────────────────────────────────

function deriveConfigPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('config')], programId);
}

function deriveMarketPda(uuid: Uint8Array, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('market'), Buffer.from(uuid)], programId);
}

function deriveEscrowPda(marketKey: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), marketKey.toBuffer()],
    programId
  );
}

function deriveOpinionPda(
  marketKey: PublicKey,
  stakerKey: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('opinion'), marketKey.toBuffer(), stakerKey.toBuffer()],
    programId
  );
}

function deriveReactionPda(
  opinionKey: PublicKey,
  reactorKey: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('reaction'), opinionKey.toBuffer(), reactorKey.toBuffer()],
    programId
  );
}

// ── ATA helpers ────────────────────────────────────────────────────────────

/**
 * Get or create the user's USDC associated token account.
 * Returns the ATA address and any instructions needed to create it.
 */
async function getOrCreateAta(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  payer: PublicKey
): Promise<{ ata: PublicKey; createIx: ReturnType<typeof createAssociatedTokenAccountInstruction> | null }> {
  const ata = await getAssociatedTokenAddress(mint, owner);

  try {
    await getAccount(connection, ata);
    return { ata, createIx: null };
  } catch {
    // Account doesn't exist — need to create it
    const createIx = createAssociatedTokenAccountInstruction(payer, ata, owner, mint);
    return { ata, createIx };
  }
}

/**
 * Check the user's USDC balance. Returns micro-USDC amount.
 * Throws a descriptive error if the account doesn't exist.
 */
export async function getUsdcBalance(
  connection: Connection,
  owner: PublicKey
): Promise<number> {
  const usdcMint = getUsdcMint();
  const ata = await getAssociatedTokenAddress(usdcMint, owner);

  try {
    const account = await getAccount(connection, ata);
    return Number(account.amount);
  } catch {
    return 0;
  }
}

// ── Generate UUID ──────────────────────────────────────────────────────────

function generateUuid(): Uint8Array {
  const uuid = new Uint8Array(16);
  crypto.getRandomValues(uuid);
  // Set version 4 (random) bits
  uuid[6] = (uuid[6] & 0x0f) | 0x40;
  uuid[8] = (uuid[8] & 0x3f) | 0x80;
  return uuid;
}

// ── Client class ───────────────────────────────────────────────────────────

export class OpinionMarketClient {
  private program: Program;
  private connection: Connection;
  private wallet: AnchorWallet;
  private programId: PublicKey;
  private usdcMint: PublicKey;
  private treasuryAddress: PublicKey;
  private configPda: PublicKey;

  constructor(connection: Connection, wallet: AnchorWallet) {
    this.connection = connection;
    this.wallet = wallet;
    this.programId = getProgramId();
    this.usdcMint = getUsdcMint();
    this.treasuryAddress = getTreasuryAddress();

    const [configPda] = deriveConfigPda(this.programId);
    this.configPda = configPda;

    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    });

    this.program = new Program(IDL as Idl, provider);
  }

  // ── create_market ──────────────────────────────────────────────────────

  async createMarket(
    statement: string,
    durationSecs: number
  ): Promise<CreateMarketResult> {
    try {
      const uuid = generateUuid();
      const [marketPda] = deriveMarketPda(uuid, this.programId);
      const [escrowPda] = deriveEscrowPda(marketPda, this.programId);

      // Derive ATAs
      const creatorUsdc = await getAssociatedTokenAddress(
        this.usdcMint,
        this.wallet.publicKey
      );
      const treasuryUsdc = await getAssociatedTokenAddress(
        this.usdcMint,
        this.treasuryAddress
      );

      // Verify creator has USDC account
      try {
        await getAccount(this.connection, creatorUsdc);
      } catch {
        throw new OpinionMarketError(
          'You do not have a USDC token account. Please get some USDC first.'
        );
      }

      // Check balance
      const balance = await getUsdcBalance(this.connection, this.wallet.publicKey);
      if (balance < 5_000_000) {
        throw new OpinionMarketError(
          `Insufficient USDC balance. Creating a market costs $5.00 USDC. ` +
          `Your balance: $${(balance / 1_000_000).toFixed(2)}`
        );
      }

      const signature = await this.program.methods
        .createMarket(statement, new BN(durationSecs), Array.from(uuid))
        .accounts({
          creator: this.wallet.publicKey,
          config: this.configPda,
          market: marketPda,
          escrowTokenAccount: escrowPda,
          creatorUsdc,
          treasuryUsdc,
          usdcMint: this.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      return {
        signature,
        explorerUrl: getExplorerTxUrl(signature),
        marketPda,
        escrowPda,
        uuid,
      };
    } catch (err) {
      if (err instanceof OpinionMarketError) throw err;
      throw parseAnchorError(err);
    }
  }

  // ── stake_opinion ──────────────────────────────────────────────────────

  async stakeOpinion(
    marketPda: PublicKey,
    marketUuid: Uint8Array,
    stakeAmount: number,
    opinionText: string,
    prediction: number,
    ipfsCid: string = ''
  ): Promise<StakeOpinionResult> {
    try {
      // Compute text hash
      const encoder = new TextEncoder();
      const textBytes = encoder.encode(opinionText);
      const hashBuffer = await crypto.subtle.digest('SHA-256', textBytes);
      const textHash = Array.from(new Uint8Array(hashBuffer));

      const [opinionPda] = deriveOpinionPda(
        marketPda,
        this.wallet.publicKey,
        this.programId
      );
      const [escrowPda] = deriveEscrowPda(marketPda, this.programId);

      const stakerUsdc = await getAssociatedTokenAddress(
        this.usdcMint,
        this.wallet.publicKey
      );

      // Verify USDC account exists
      try {
        await getAccount(this.connection, stakerUsdc);
      } catch {
        throw new OpinionMarketError(
          'You do not have a USDC token account. Please get some USDC first.'
        );
      }

      // Check balance
      const balance = await getUsdcBalance(this.connection, this.wallet.publicKey);
      if (balance < stakeAmount) {
        throw new OpinionMarketError(
          `Insufficient USDC balance. You need $${(stakeAmount / 1_000_000).toFixed(2)} but have $${(balance / 1_000_000).toFixed(2)}`
        );
      }

      const signature = await this.program.methods
        .stakeOpinion(
          new BN(stakeAmount),
          textHash,
          ipfsCid || '',
          prediction
        )
        .accounts({
          staker: this.wallet.publicKey,
          config: this.configPda,
          market: marketPda,
          escrowTokenAccount: escrowPda,
          opinion: opinionPda,
          stakerUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return {
        signature,
        explorerUrl: getExplorerTxUrl(signature),
        opinionPda,
      };
    } catch (err) {
      if (err instanceof OpinionMarketError) throw err;
      throw parseAnchorError(err);
    }
  }

  // ── react_to_opinion ───────────────────────────────────────────────────

  async reactToOpinion(
    marketPda: PublicKey,
    opinionPda: PublicKey,
    reactionType: 'back' | 'slash',
    stakeAmount: number
  ): Promise<ReactToOpinionResult> {
    try {
      const [reactionPda] = deriveReactionPda(
        opinionPda,
        this.wallet.publicKey,
        this.programId
      );
      const [escrowPda] = deriveEscrowPda(marketPda, this.programId);

      const reactorUsdc = await getAssociatedTokenAddress(
        this.usdcMint,
        this.wallet.publicKey
      );

      // Check balance
      const balance = await getUsdcBalance(this.connection, this.wallet.publicKey);
      if (balance < stakeAmount) {
        throw new OpinionMarketError(
          `Insufficient USDC balance. You need $${(stakeAmount / 1_000_000).toFixed(2)} but have $${(balance / 1_000_000).toFixed(2)}`
        );
      }

      const anchorReactionType = reactionType === 'back' ? { back: {} } : { slash: {} };

      const signature = await this.program.methods
        .reactToOpinion(anchorReactionType, new BN(stakeAmount))
        .accounts({
          reactor: this.wallet.publicKey,
          config: this.configPda,
          market: marketPda,
          opinion: opinionPda,
          reaction: reactionPda,
          escrowTokenAccount: escrowPda,
          reactorUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return {
        signature,
        explorerUrl: getExplorerTxUrl(signature),
        reactionPda,
      };
    } catch (err) {
      if (err instanceof OpinionMarketError) throw err;
      throw parseAnchorError(err);
    }
  }

  // ── close_market ───────────────────────────────────────────────────────

  async closeMarket(marketPda: PublicKey): Promise<TransactionResult> {
    try {
      const signature = await this.program.methods
        .closeMarket()
        .accounts({
          caller: this.wallet.publicKey,
          market: marketPda,
        })
        .rpc();

      return {
        signature,
        explorerUrl: getExplorerTxUrl(signature),
      };
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  // ── claim_payout ───────────────────────────────────────────────────────

  async claimPayout(
    marketPda: PublicKey,
    opinionPda: PublicKey,
    totalCombinedScore: number
  ): Promise<ClaimPayoutResult> {
    try {
      const [escrowPda] = deriveEscrowPda(marketPda, this.programId);

      const { ata: stakerUsdc, createIx } = await getOrCreateAta(
        this.connection,
        this.usdcMint,
        this.wallet.publicKey,
        this.wallet.publicKey
      );

      const builder = this.program.methods
        .claimPayout(new BN(totalCombinedScore))
        .accounts({
          staker: this.wallet.publicKey,
          config: this.configPda,
          market: marketPda,
          escrowTokenAccount: escrowPda,
          opinion: opinionPda,
          stakerUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
        });

      // If ATA doesn't exist, prepend the create instruction
      if (createIx) {
        builder.preInstructions([createIx]);
      }

      const signature = await builder.rpc();

      return {
        signature,
        explorerUrl: getExplorerTxUrl(signature),
        payoutAmount: 0, // actual amount comes from on-chain event
      };
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  // ── recover_stake ──────────────────────────────────────────────────────

  async recoverStake(marketPda: PublicKey): Promise<TransactionResult> {
    try {
      const [opinionPda] = deriveOpinionPda(
        marketPda,
        this.wallet.publicKey,
        this.programId
      );
      const [escrowPda] = deriveEscrowPda(marketPda, this.programId);

      const { ata: stakerUsdc, createIx } = await getOrCreateAta(
        this.connection,
        this.usdcMint,
        this.wallet.publicKey,
        this.wallet.publicKey
      );

      const builder = this.program.methods
        .recoverStake()
        .accounts({
          staker: this.wallet.publicKey,
          config: this.configPda,
          market: marketPda,
          escrowTokenAccount: escrowPda,
          opinion: opinionPda,
          stakerUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
        });

      if (createIx) {
        builder.preInstructions([createIx]);
      }

      const signature = await builder.rpc();

      return {
        signature,
        explorerUrl: getExplorerTxUrl(signature),
      };
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  // ── Fetch helpers ──────────────────────────────────────────────────────

  /**
   * Fetch a Market account from on-chain.
   */
  async fetchMarket(marketPda: PublicKey) {
    return this.program.account.market.fetch(marketPda);
  }

  /**
   * Fetch an Opinion account from on-chain.
   */
  async fetchOpinion(opinionPda: PublicKey) {
    return this.program.account.opinion.fetch(opinionPda);
  }

  /**
   * Derive a market PDA from a UUID (hex string or Uint8Array).
   */
  deriveMarketPda(uuid: Uint8Array | string): PublicKey {
    const uuidBytes =
      typeof uuid === 'string'
        ? Uint8Array.from(Buffer.from(uuid.replace(/-/g, ''), 'hex'))
        : uuid;
    const [pda] = deriveMarketPda(uuidBytes, this.programId);
    return pda;
  }

  /**
   * Derive an opinion PDA from market key and staker key.
   */
  deriveOpinionPda(marketKey: PublicKey, stakerKey: PublicKey): PublicKey {
    const [pda] = deriveOpinionPda(marketKey, stakerKey, this.programId);
    return pda;
  }
}
