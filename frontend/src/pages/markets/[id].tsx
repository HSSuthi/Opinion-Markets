import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { Header } from '@/components/Layout/Header';
import { SentimentDial } from '@/components/SentimentDial';
import { formatUSDC, formatTimeRemaining, truncateAddress } from '@/lib/utils/formatting';
import { useMarketStore, type Market } from '@/store/marketStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Opinion {
  staker: string;
  amount: number;
  text: string;
  created_at: string;
}

interface MarketDetailsResponse extends Market {
  opinions: Opinion[];
}

export default function MarketDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const setSelectedMarket = useMarketStore((s) => s.setSelectedMarket);
  const [mounted, setMounted] = useState(false);

  const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch market');
    return res.json();
  };

  const { data: market, error, isLoading } = useSWR<MarketDetailsResponse>(
    id ? `${API_URL}/markets/${id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (market) {
      setSelectedMarket(market);
    }
  }, [market, setSelectedMarket]);

  if (!mounted) return null;
  if (isLoading) return <MarketDetailSkeleton />;
  if (error || !market)
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex justify-center items-center h-96">
          <p className="text-gray-400">Market not found</p>
        </div>
      </div>
    );

  const timeRemaining = formatTimeRemaining(market.closes_at);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex justify-between items-start gap-4 mb-4">
            <h1 className="text-4xl font-bold text-white flex-1">
              {market.statement}
            </h1>
            <div className="px-4 py-2 bg-green-500/20 text-green-300 border border-green-500/50 rounded-lg font-medium whitespace-nowrap">
              {market.state}
            </div>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-6 text-sm text-gray-400 mb-6">
            <div>
              <span className="text-gray-500">Created by</span>{' '}
              <span className="text-white">{truncateAddress(market.creator_address)}</span>
            </div>
            <div>
              <span className="text-gray-500">Closes in</span>{' '}
              <span className="text-white font-medium">{timeRemaining}</span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Sentiment + Stats */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              {/* Sentiment Dial */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 mb-6">
                <SentimentDial
                  score={market.sentiment_score || 0}
                  confidence={market.confidence}
                  size="sm"
                  className="w-full"
                />
              </div>

              {/* Stats */}
              <div className="space-y-4">
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-1">Total Stake</div>
                  <div className="text-2xl font-bold text-white">
                    {formatUSDC(market.total_stake)}
                  </div>
                </div>

                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-1">Participants</div>
                  <div className="text-2xl font-bold text-white">
                    {market.staker_count}
                  </div>
                </div>

                {market.state === 'Active' && (
                  <button
                    onClick={() => router.push(`/markets/${market.id}/stake`)}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-200"
                  >
                    Stake Opinion
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Opinions */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-6">
                Opinions ({(market as any).opinions?.length || 0})
              </h2>

              {(market as any).opinions && (market as any).opinions.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {(market as any).opinions
                    .sort(
                      (a: Opinion, b: Opinion) => b.amount - a.amount
                    )
                    .map((opinion: Opinion, idx: number) => {
                      const weight =
                        ((opinion.amount / market.total_stake) * 100).toFixed(
                          1
                        );

                      return (
                        <div
                          key={idx}
                          className="bg-gray-700/30 border border-gray-600 rounded-lg p-4 hover:bg-gray-700/50 transition-colors"
                        >
                          <div className="flex justify-between items-start gap-4 mb-2">
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-white">
                                {truncateAddress(opinion.staker)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(opinion.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-purple-400">
                                {formatUSDC(opinion.amount)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {weight}% of pool
                              </div>
                            </div>
                          </div>

                          {opinion.text && (
                            <p className="text-sm text-gray-300 italic border-l-2 border-purple-500 pl-3">
                              "{opinion.text}"
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-8">
                  No opinions yet. Be the first to stake!
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MarketDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="h-8 bg-gray-800 rounded w-3/4 mb-8 animate-pulse" />
        <div className="grid grid-cols-3 gap-8">
          <div className="space-y-4">
            <div className="h-64 bg-gray-800 rounded animate-pulse" />
            <div className="h-12 bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="col-span-2 h-96 bg-gray-800 rounded animate-pulse" />
        </div>
      </main>
    </div>
  );
}
