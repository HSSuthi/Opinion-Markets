import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import useSWR from 'swr';
import { Header } from '@/components/Layout/Header';
import { formatUSDC, truncateAddress, formatPercent } from '@/lib/utils/formatting';
import { useUserStore } from '@/store/userStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Portfolio {
  wallet_address: string;
  total_staked: number;
  total_prize_won: number;
  positions_count: number;
  win_count: number;
  win_rate: number;
  roi: number;
}

interface Position {
  id: string;
  market_id: string;
  stake_amount: number;
  prize_amount: number | null;
  market_state: string;
  created_at: string;
  settled_at: string | null;
}

export default function ProfilePage() {
  const { wallet } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'positions' | 'activity'>(
    'stats'
  );

  const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  };

  const { data: portfolioData } = useSWR<{ success: boolean; data: Portfolio }>(
    wallet ? `${API_URL}/user/${wallet.publicKey.toString()}` : null,
    fetcher
  );

  const { data: positionsData } = useSWR<{
    success: boolean;
    data: Position[];
  }>(
    wallet
      ? `${API_URL}/user/${wallet.publicKey.toString()}/positions?limit=50`
      : null,
    fetcher
  );

  const portfolio = portfolioData?.data;
  const positions = positionsData?.data || [];

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!wallet) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex justify-center items-center h-96">
          <p className="text-gray-400">
            Please connect your wallet to view your profile
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Profile Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-3xl">👤</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                {truncateAddress(wallet.publicKey.toString())}
              </h1>
              <p className="text-gray-400">Your Portfolio</p>
            </div>
          </div>

          {/* Quick Stats */}
          {portfolio && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Total Staked</p>
                <p className="text-2xl font-bold text-white">
                  {formatUSDC(portfolio.total_staked)}
                </p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Total Won</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatUSDC(portfolio.total_prize_won)}
                </p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Win Rate</p>
                <p className="text-2xl font-bold text-white">
                  {formatPercent(portfolio.win_rate * 100, 1)}
                </p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">ROI</p>
                <p
                  className={`text-2xl font-bold ${
                    portfolio.roi >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {formatPercent(portfolio.roi, 1)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-700">
          <div className="flex gap-8">
            {(['stats', 'positions', 'activity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-purple-400 border-b-2 border-purple-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}

        {/* Stats Tab */}
        {activeTab === 'stats' && portfolio && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Portfolio Stats</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-gray-700">
                  <span className="text-gray-400">Total Positions</span>
                  <span className="text-2xl font-bold text-white">
                    {portfolio.positions_count}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b border-gray-700">
                  <span className="text-gray-400">Winning Positions</span>
                  <span className="text-2xl font-bold text-green-400">
                    {portfolio.win_count}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b border-gray-700">
                  <span className="text-gray-400">Win Rate</span>
                  <span className="text-2xl font-bold text-white">
                    {formatPercent(portfolio.win_rate * 100, 1)}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-gray-700">
                  <span className="text-gray-400">Total Staked</span>
                  <span className="text-2xl font-bold text-white">
                    {formatUSDC(portfolio.total_staked)}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b border-gray-700">
                  <span className="text-gray-400">Total Won</span>
                  <span className="text-2xl font-bold text-green-400">
                    {formatUSDC(portfolio.total_prize_won)}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b border-gray-700">
                  <span className="text-gray-400">Return on Investment</span>
                  <span
                    className={`text-2xl font-bold ${
                      portfolio.roi >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {formatPercent(portfolio.roi, 2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Positions Tab */}
        {activeTab === 'positions' && (
          <div className="space-y-4">
            {positions.length > 0 ? (
              positions.map((position) => (
                <div
                  key={position.id}
                  className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 hover:bg-gray-800/70 transition-colors"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="font-semibold text-white mb-1">
                        Market: {truncateAddress(position.market_id)}
                      </p>
                      <p className="text-sm text-gray-400">
                        {new Date(position.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-purple-400">
                        {formatUSDC(position.stake_amount)}
                      </p>
                      {position.prize_amount && position.prize_amount > 0 && (
                        <p className="text-lg font-bold text-green-400">
                          Won: {formatUSDC(position.prize_amount)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        position.market_state === 'Active'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-purple-500/20 text-purple-300'
                      }`}
                    >
                      {position.market_state}
                    </span>
                    {position.settled_at && (
                      <span className="px-3 py-1 bg-gray-700/50 text-gray-300 rounded-full text-xs">
                        Settled: {new Date(position.settled_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-400">
                You haven't taken any positions yet
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="text-center py-12 text-gray-400">
            Activity feed coming soon
          </div>
        )}
      </main>
    </div>
  );
}
