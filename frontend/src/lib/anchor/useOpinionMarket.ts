/**
 * React hook for the Opinion Markets Anchor client.
 *
 * Provides a ready-to-use client instance that automatically uses
 * the connected wallet and current RPC connection.
 */

import { useMemo } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { OpinionMarketClient, getUsdcBalance } from './client';
import { getUsdcMint, getUsdcFaucetUrl, getExplorerTxUrl } from './config';

export interface UseOpinionMarketResult {
  /** The client instance, or null if no wallet is connected */
  client: OpinionMarketClient | null;
  /** Whether a wallet is connected and the client is ready */
  ready: boolean;
  /** Get the user's USDC balance in micro-USDC */
  getBalance: () => Promise<number>;
  /** URL to the devnet USDC faucet, or null on mainnet */
  faucetUrl: string | null;
}

export function useOpinionMarket(): UseOpinionMarketResult {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const client = useMemo(() => {
    if (!wallet) return null;
    try {
      return new OpinionMarketClient(connection, wallet);
    } catch {
      return null;
    }
  }, [connection, wallet]);

  const getBalance = async (): Promise<number> => {
    if (!wallet) return 0;
    return getUsdcBalance(connection, wallet.publicKey);
  };

  return {
    client,
    ready: client !== null,
    getBalance,
    faucetUrl: getUsdcFaucetUrl(),
  };
}

// Re-export everything components need
export { getExplorerTxUrl } from './config';
export { OpinionMarketError } from './client';
export type {
  TransactionResult,
  CreateMarketResult,
  StakeOpinionResult,
  ReactToOpinionResult,
  ClaimPayoutResult,
} from './client';
