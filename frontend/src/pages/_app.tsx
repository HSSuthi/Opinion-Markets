import React, { useMemo } from 'react';
import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import { ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';
import { initializeApiClient } from '@/lib/api/client';
import '@/styles/globals.css';

// Dynamically import heavy wallet UI — no SSR, keeps initial bundle small
const WalletProviderSetup = dynamic(() => import('@/components/WalletProviderSetup'), {
  ssr: false,
});

// Initialize API client on app load
initializeApiClient();

function resolveNetwork(): WalletAdapterNetwork {
  const env = process.env.NEXT_PUBLIC_NETWORK;
  if (env === 'mainnet-beta') return WalletAdapterNetwork.Mainnet;
  if (env === 'testnet') return WalletAdapterNetwork.Testnet;
  return WalletAdapterNetwork.Devnet;
}

export default function App({ Component, pageProps }: AppProps) {
  const network = resolveNetwork();

  const endpoint = useMemo(() => {
    // Prefer an explicit RPC URL (e.g. a paid Helius/Quicknode endpoint)
    const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (rpc && rpc !== 'https://api.devnet.solana.com') return rpc;
    return clusterApiUrl(network);
  }, [network]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProviderSetup>
        <Component {...pageProps} />
      </WalletProviderSetup>
    </ConnectionProvider>
  );
}
