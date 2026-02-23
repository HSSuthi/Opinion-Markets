import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { Header } from '@/components/Layout/Header';
import { SentimentDial } from '@/components/SentimentDial';
import { formatUSDC, truncateAddress } from '@/lib/utils/formatting';
import {
  generateResultsCard,
  shareToTwitter,
  downloadCard,
} from '@/lib/share/cardGenerator';
import type { Market } from '@/store/marketStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Opinion {
  staker_address: string;
  amount: number;
  opinion_text: string | null;
  created_at: string;
}

interface ResultsResponse extends Market {
  opinions: Opinion[];
  user_prize?: number;
}

export default function ResultsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [mounted, setMounted] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);

  const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch market');
    return res.json();
  };

  const { data: market } = useSWR<ResultsResponse>(
    id ? `${API_URL}/markets/${id}` : null,
    fetcher
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleShareToTwitter = async () => {
    if (!market) return;

    setGeneratingCard(true);
    try {
      const cardUrl = await generateResultsCard(market, market.user_prize || null);
      shareToTwitter(market, cardUrl);
    } catch (error) {
      console.error('Failed to generate share card:', error);
    } finally {
      setGeneratingCard(false);
    }
  };

  const handleDownloadCard = async () => {
    if (!market) return;

    setGeneratingCard(true);
    try {
      const cardUrl = await generateResultsCard(market, market.user_prize || null);
      downloadCard(
        cardUrl,
        `opinion-markets-result-${market.id}.png`
      );
    } catch (error) {
      console.error('Failed to download card:', error);
    } finally {
      setGeneratingCard(false);
    }
  };

  if (!mounted) return null;

  if (!market) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex justify-center items-center h-96">
          <p className="text-gray-400">Market not found</p>
        </div>
      </div>
    );
  }

  const hasWon = market.user_prize && market.user_prize > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Statement */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            {market.statement}
          </h1>
          <p className="text-gray-400">Market Settled</p>
        </div>

        {/* Winner Section */}
        {hasWon && (
          <div className="mb-12 bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/50 rounded-lg p-8 sm:p-12 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-green-300 mb-4">
              You Won!
            </h2>
            <div className="text-5xl sm:text-6xl font-bold text-green-400 mb-2">
              {formatUSDC(market.user_prize)}
            </div>
            <p className="text-green-300 text-lg">Prize Earned</p>

            <div className="flex gap-4 mt-8 justify-center flex-wrap">
              <button
                onClick={handleShareToTwitter}
                disabled={generatingCard}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50"
              >
                {generatingCard ? '🔄 Generating...' : '𝕏 Share Victory'}
              </button>
              <button
                onClick={handleDownloadCard}
                disabled={generatingCard}
                className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50"
              >
                {generatingCard ? '🔄 Generating...' : '📥 Download Card'}
              </button>
            </div>
          </div>
        )}

        {/* Sentiment Dial */}
        <div className="mb-12 bg-gray-800/50 border border-gray-700 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Final Sentiment Score
          </h2>
          <div className="flex justify-center">
            <SentimentDial
              score={market.sentiment_score || 0}
              confidence={market.sentiment_confidence ?? undefined}
              size="lg"
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-12">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2">Total Stake</p>
            <p className="text-xl sm:text-2xl font-bold text-white">
              {formatUSDC(market.total_stake)}
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2">Participants</p>
            <p className="text-xl sm:text-2xl font-bold text-white">
              {market.staker_count}
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2">Confidence</p>
            <p className="text-xl sm:text-2xl font-bold text-purple-400">
              {market.sentiment_confidence === 2
                ? 'High'
                : market.sentiment_confidence === 1
                ? 'Medium'
                : 'Low'}
            </p>
          </div>
        </div>

        {/* All Opinions */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">
            All Opinions ({(market as any).opinions?.length || 0})
          </h2>

          {(market as any).opinions && (market as any).opinions.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {(market as any).opinions
                .sort(
                  (a: Opinion, b: Opinion) => b.amount - a.amount
                )
                .map((opinion: Opinion, idx: number) => {
                  const weight = (
                    (opinion.amount / market.total_stake) *
                    100
                  ).toFixed(1);

                  return (
                    <div
                      key={idx}
                      className="bg-gray-700/30 border border-gray-600 rounded-lg p-4 hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {truncateAddress(opinion.staker_address)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(
                              opinion.created_at
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-purple-400">
                            {formatUSDC(opinion.amount)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {weight}% weight
                          </p>
                        </div>
                      </div>

                      {opinion.opinion_text && (
                        <p className="text-sm text-gray-300 italic border-l-2 border-purple-500 pl-3">
                          "{opinion.opinion_text}"
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">
              No opinions recorded for this market.
            </p>
          )}
        </div>

        {/* Back Button */}
        <div className="text-center">
          <button
            onClick={() => router.push('/')}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
          >
            Back to Markets
          </button>
        </div>
      </main>
    </div>
  );
}
