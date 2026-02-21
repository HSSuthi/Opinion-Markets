import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

/**
 * Wallet Connection Button
 * Supports: Phantom, Solflare, Brave Wallet, etc.
 */
export default function WalletButton() {
  const { wallet, connected } = useWallet();

  return (
    <div className="wallet-adapter-button-group">
      <WalletMultiButton className="!bg-gradient-to-r !from-blue-500 !to-purple-500 !text-white !hover:shadow-lg !transition" />
      {connected && wallet && (
        <div className="text-sm text-gray-300 mt-1">
          {wallet.adapter.name} connected
        </div>
      )}
    </div>
  );
}
