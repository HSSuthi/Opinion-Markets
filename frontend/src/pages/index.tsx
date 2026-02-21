import React, { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import useSWRInfinite from 'swr/infinite';
import { Header } from '@/components/Layout/Header';
import { MarketCard } from '@/components/MarketCard';
import { useMarketStore, type Market } from '@/store/marketStore';
import WalletButton from '@/components/WalletButton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FeedResponse {
  data: Market[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export default function FeedPage() {
  const { connected } = useWallet();
  const markets = useMarketStore((s) => s.markets);
  const filters = useMarketStore((s) => s.filters);
  const setMarkets = useMarketStore((s) => s.setMarkets);
  const addMarkets = useMarketStore((s) => s.addMarkets);
  const setFilters = useMarketStore((s) => s.setFilters);
  const setFetching = useMarketStore((s) => s.setFetching);

  const [mounted, setMounted] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'Active' | 'All'>(
    'Active'
  );
  const [sortBy, setSortBy] = useState<'closesAt' | 'createdAt' | 'totalStake'>(
    'closesAt'
  );

  // SWR infinite scroll
  const getKey = (pageIndex: number) => {
    const state = selectedFilter === 'Active' ? 'Active' : '';
    return `${API_URL}/markets?limit=20&offset=${pageIndex * 20}&state=${state}&sortBy=${sortBy}`;
  };

  const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch markets');
    return res.json() as Promise<FeedResponse>;
  };

  const { data, error, isLoading, isValidating, size, setSize } =
    useSWRInfinite<FeedResponse>(getKey, fetcher, {
      revalidateFirstPage: false,
      dedupingInterval: 60000,
    });

  // Update store when data changes
  useEffect(() => {
    setMounted(true);
    if (!data) return;

    const allMarkets = data.reduce(
      (acc, page) => [...acc, ...page.data],
      [] as Market[]
    );
    setMarkets(allMarkets);
    setFetching(false);
  }, [data, setMarkets, setFetching]);

  const hasMore = data && data[data.length - 1]?.pagination?.total > markets.length;

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (isValidating || !hasMore) return;

    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    const windowHeight = window.innerHeight;

    if (docHeight - (scrollTop + windowHeight) < 500) {
      setFetching(true);
      setSize((s) => s + 1);
    }
  }, [isValidating, hasMore, setSize, setFetching]);

  // Attach scroll listener
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {!connected ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-center max-w-md">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Welcome to Opinion Markets
              </h2>
              <p className="text-gray-300 mb-8">
                Connect your wallet to start participating in prediction markets powered by LLM
                sentiment analysis.
              </p>
              <WalletButton />
            </div>
          </div>
        ) : (
          <>
            {/* Header section */}
            <div className="mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                Active Markets
              </h1>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex gap-2">
                  {(['Active', 'All'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => {
                        setSelectedFilter(filter);
                        setMarkets([]);
                        setSize(1);
                      }}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        selectedFilter === filter
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 ml-auto">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    Sort:
                    <select
                      value={sortBy}
                      onChange={(e) => {
                        setSortBy(e.target.value as any);
                        setMarkets([]);
                        setSize(1);
                      }}
                      className="bg-gray-800 text-white px-3 py-1 rounded-lg border border-gray-700 hover:border-purple-500 focus:outline-none focus:border-purple-500"
                    >
                      <option value="closesAt">Closes Soon</option>
                      <option value="createdAt">Recently Created</option>
                      <option value="totalStake">Highest Volume</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            {/* Markets Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-gray-800 rounded-lg p-6 animate-pulse"
                  >
                    <div className="h-6 bg-gray-700 rounded w-3/4 mb-4" />
                    <div className="h-4 bg-gray-700 rounded w-full mb-4" />
                    <div className="grid grid-cols-3 gap-4">
                      {[...Array(3)].map((_, j) => (
                        <div
                          key={j}
                          className="h-6 bg-gray-700 rounded"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : markets.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 text-lg">
                  No markets available. Create one to get started!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {markets.map((market) => (
                  <MarketCard key={market.id} market={market} />
                ))}
              </div>
            )}

            {/* Loading indicator at bottom */}
            {isValidating && (
              <div className="flex justify-center py-8">
                <div className="flex gap-2">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {!hasMore && markets.length > 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">
                  No more markets to load
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
