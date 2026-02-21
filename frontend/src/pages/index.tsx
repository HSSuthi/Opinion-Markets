import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import MarketList from '../components/MarketList';
import WalletButton from '../components/WalletButton';

/**
 * Home Page - Market Dashboard
 *
 * Shows:
 * - Active markets
 * - Recent settlements
 * - User portfolio
 * - Create market button
 */
export default function Home() {
  const { connected } = useWallet();
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch markets from API
    const fetchMarkets = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/markets?limit=50`);
        const data = await response.json();
        setMarkets(data.data || []);
      } catch (error) {
        console.error('Failed to fetch markets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-black">
      {/* Header */}
      <header className="border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Opinion Markets</h1>
            <p className="text-purple-300">Decentralized Prediction Platform</p>
          </div>
          <div className="flex gap-4">
            {connected && (
              <Link
                href="/create"
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition"
              >
                Create Market
              </Link>
            )}
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {!connected ? (
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h2>
            <p className="text-gray-300 mb-8">
              Connect a Solana wallet to start participating in opinion markets
            </p>
            <WalletButton />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-purple-900/30 border border-purple-500/20 rounded-lg p-6">
                <div className="text-sm text-gray-400">Active Markets</div>
                <div className="text-3xl font-bold text-white mt-2">{markets.length}</div>
              </div>
              <div className="bg-purple-900/30 border border-purple-500/20 rounded-lg p-6">
                <div className="text-sm text-gray-400">Total Volume</div>
                <div className="text-3xl font-bold text-white mt-2">$0.00</div>
              </div>
              <div className="bg-purple-900/30 border border-purple-500/20 rounded-lg p-6">
                <div className="text-sm text-gray-400">Your Positions</div>
                <div className="text-3xl font-bold text-white mt-2">0</div>
              </div>
            </div>

            {/* Markets */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Active Markets</h2>
              {loading ? (
                <div className="text-center py-8 text-gray-400">Loading markets...</div>
              ) : markets.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No markets available. Create one to get started!
                </div>
              ) : (
                <MarketList markets={markets} />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
