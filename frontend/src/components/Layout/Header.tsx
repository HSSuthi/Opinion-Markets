import React from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletButton from '../WalletButton';

export function Header() {
  const { connected } = useWallet();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-900/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">Ω</span>
          </div>
          <span className="text-xl font-bold text-white hidden sm:inline">
            Opinion Markets
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {connected && (
            <Link
              href="/markets/create"
              className="hidden sm:inline-block px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-200 font-medium"
            >
              Create Market
            </Link>
          )}
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
