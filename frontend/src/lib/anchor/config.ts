/**
 * Network configuration — reads all values from environment variables.
 *
 * Switch networks by changing NEXT_PUBLIC_NETWORK (localnet | devnet | mainnet-beta).
 * Every network-specific value is read from env, never hardcoded.
 *
 * Required env vars for each network:
 *   NEXT_PUBLIC_NETWORK          — "localnet" | "devnet" | "mainnet-beta"
 *   NEXT_PUBLIC_SOLANA_RPC_URL   — RPC endpoint
 *   NEXT_PUBLIC_PROGRAM_ID       — Deployed Opinion Markets program ID
 *   NEXT_PUBLIC_USDC_MINT        — USDC mint address for the target network
 *   NEXT_PUBLIC_TREASURY_ADDRESS — Protocol treasury wallet (USDC ATA owner)
 */

import { PublicKey, clusterApiUrl } from '@solana/web3.js';

export type NetworkName = 'localnet' | 'devnet' | 'mainnet-beta';

export interface NetworkConfig {
  network: NetworkName;
  rpcUrl: string;
  programId: string;
  usdcMint: string;
  treasuryAddress: string;
  explorerBaseUrl: string;
}

// Default USDC mint addresses per network (used only if env var not set)
const USDC_MINTS: Record<NetworkName, string> = {
  localnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // use devnet mint for local testing
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

const RPC_DEFAULTS: Record<NetworkName, string> = {
  localnet: 'http://127.0.0.1:8899',
  devnet: clusterApiUrl('devnet'),
  'mainnet-beta': clusterApiUrl('mainnet-beta'),
};

function resolveNetwork(): NetworkName {
  const env = process.env.NEXT_PUBLIC_NETWORK;
  if (env === 'mainnet-beta') return 'mainnet-beta';
  if (env === 'localnet') return 'localnet';
  return 'devnet';
}

let _cachedConfig: NetworkConfig | null = null;

export function getNetworkConfig(): NetworkConfig {
  if (_cachedConfig) return _cachedConfig;

  const network = resolveNetwork();

  const programId = process.env.NEXT_PUBLIC_PROGRAM_ID;
  if (!programId) {
    throw new Error(
      'NEXT_PUBLIC_PROGRAM_ID is not set. Cannot initialize Anchor client without a program ID.'
    );
  }

  const treasuryAddress = process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
  if (!treasuryAddress) {
    throw new Error(
      'NEXT_PUBLIC_TREASURY_ADDRESS is not set. This is the wallet that receives protocol fees. ' +
      'Set it in your .env file.'
    );
  }

  const config: NetworkConfig = {
    network,
    rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || RPC_DEFAULTS[network],
    programId,
    usdcMint: process.env.NEXT_PUBLIC_USDC_MINT || USDC_MINTS[network],
    treasuryAddress,
    explorerBaseUrl: getExplorerBase(network),
  };

  _cachedConfig = config;
  return config;
}

function getExplorerBase(network: NetworkName): string {
  if (network === 'mainnet-beta') return 'https://explorer.solana.com';
  if (network === 'devnet') return 'https://explorer.solana.com';
  return 'https://explorer.solana.com';
}

/**
 * Build a Solana Explorer URL for a transaction signature.
 */
export function getExplorerTxUrl(signature: string): string {
  const config = getNetworkConfig();
  const cluster = config.network === 'mainnet-beta' ? '' : `?cluster=${config.network}`;
  return `${config.explorerBaseUrl}/tx/${signature}${cluster}`;
}

/**
 * Build a Solana Explorer URL for an account address.
 */
export function getExplorerAddressUrl(address: string): string {
  const config = getNetworkConfig();
  const cluster = config.network === 'mainnet-beta' ? '' : `?cluster=${config.network}`;
  return `${config.explorerBaseUrl}/address/${address}${cluster}`;
}

/**
 * Get the USDC mint as a PublicKey.
 */
export function getUsdcMint(): PublicKey {
  return new PublicKey(getNetworkConfig().usdcMint);
}

/**
 * Get the treasury address as a PublicKey.
 */
export function getTreasuryAddress(): PublicKey {
  return new PublicKey(getNetworkConfig().treasuryAddress);
}

/**
 * Get the devnet USDC faucet URL (for user-facing error messages).
 */
export function getUsdcFaucetUrl(): string | null {
  const config = getNetworkConfig();
  if (config.network === 'devnet') {
    return 'https://spl-token-faucet.com/?token-name=USDC';
  }
  return null;
}
