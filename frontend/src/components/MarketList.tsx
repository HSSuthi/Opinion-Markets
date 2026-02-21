import React from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Market {
  id: string;
  statement: string;
  state: string;
  closesAt: number;
  totalStake: string;
  stakerCount: number;
}

interface MarketListProps {
  markets: Market[];
}

/**
 * Market List Component
 * Displays active markets in grid/list format
 */
export default function MarketList({ markets }: MarketListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {markets.map((market) => (
        <Link key={market.id} href={`/markets/${market.id}`}>
          <div className="group bg-purple-900/30 border border-purple-500/20 rounded-lg p-6 hover:border-purple-500/50 transition cursor-pointer">
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  market.state === 'Active'
                    ? 'bg-green-500/20 text-green-300'
                    : market.state === 'Closed'
                    ? 'bg-yellow-500/20 text-yellow-300'
                    : market.state === 'Settled'
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-gray-500/20 text-gray-300'
                }`}
              >
                {market.state}
              </span>
              <div className="text-sm text-gray-400">
                {market.stakerCount} stakers
              </div>
            </div>

            {/* Statement */}
            <h3 className="text-lg font-semibold text-white mb-3 line-clamp-2 group-hover:text-purple-200 transition">
              {market.statement}
            </h3>

            {/* Footer */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Stake</span>
                <span className="text-white font-semibold">
                  ${(Number(market.totalStake) / 1_000_000).toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Closes In</span>
                <span className="text-white">
                  {formatDistanceToNow(new Date(market.closesAt))}
                </span>
              </div>
            </div>

            {/* Action */}
            <button className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded hover:shadow-lg transition opacity-0 group-hover:opacity-100">
              View Market
            </button>
          </div>
        </Link>
      ))}
    </div>
  );
}
