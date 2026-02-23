import React from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Market } from '@/store/marketStore';
import { SentimentDial } from './SentimentDial';

interface MarketCardProps {
  market: Market;
}

export function MarketCard({ market }: MarketCardProps) {
  const timeRemaining = formatDistanceToNow(new Date(market.closes_at), {
    addSuffix: true,
  });

  const formatUSDC = (amount: number) => {
    return `$${(amount / 1_000_000).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'Active':
        return 'bg-green-500/20 text-green-300 border-green-500/50';
      case 'Closed':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
      case 'Settled':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/50';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/50';
    }
  };

  return (
    <Link href={`/markets/${market.id}`}>
      <div className="group relative bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg p-6 hover:border-purple-500/50 transition-all duration-200 cursor-pointer hover:shadow-lg hover:shadow-purple-500/20">
        {/* Header: Title + State Badge */}
        <div className="flex justify-between items-start gap-4 mb-4">
          <h3 className="text-lg font-semibold text-white line-clamp-2 flex-1 group-hover:text-purple-300 transition-colors">
            {market.statement}
          </h3>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${getStateColor(
              market.state
            )}`}
          >
            {market.state}
          </span>
        </div>

        {/* Sentiment Section */}
        {market.sentiment_score !== null ? (
          <div className="mb-6 py-4 border-t border-b border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Sentiment Score</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-purple-400">
                  {market.sentiment_score}
                </span>
                <span className="text-xs text-gray-500">/100</span>
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500"
                style={{
                  width: `${Math.max(2, market.sentiment_score)}%`,
                }}
              />
            </div>
            {market.crowd_score !== null && market.crowd_score !== undefined && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-500">Crowd Score</span>
                <span className="text-sm font-semibold text-purple-300">
                  {Number(market.crowd_score).toFixed(1)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6 py-4 border-t border-b border-gray-700">
            <span className="text-sm text-gray-400">Awaiting sentiment...</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Total Stake</div>
            <div className="text-lg font-semibold text-white">
              {formatUSDC(market.total_stake)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Stakers</div>
            <div className="text-lg font-semibold text-white">
              {market.staker_count}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Closes</div>
            <div className="text-xs font-semibold text-purple-300">
              {timeRemaining}
            </div>
          </div>
        </div>

        {/* Footer: Creator + Action */}
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>
            by {market.creator_address.slice(0, 6)}...
            {market.creator_address.slice(-4)}
          </span>
          {market.state === 'Active' && (
            <span className="text-purple-400 font-medium group-hover:text-purple-300">
              Stake Opinion →
            </span>
          )}
        </div>

        {/* Hover gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-purple-500/5 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>
    </Link>
  );
}
