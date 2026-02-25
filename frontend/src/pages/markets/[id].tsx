import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { useWallet } from '@solana/wallet-adapter-react';
import { Header } from '@/components/Layout/Header';
import { SentimentDial } from '@/components/SentimentDial';
import { formatUSDC, formatTimeRemaining, truncateAddress } from '@/lib/utils/formatting';
import { useMarketStore, type Market } from '@/store/marketStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Reaction {
  id: string;
  reactor_address: string;
  reaction_type: 'back' | 'slash';
  amount: number;
}

interface Opinion {
  id: string;
  staker_address: string;
  amount: number;
  opinion_text: string | null;
  prediction: number | null;
  backing_total: number;
  slashing_total: number;
  created_at: string;
  // Scores (set after settlement)
  weight_score: number | null;
  consensus_score: number | null;
  ai_score: number | null;
  composite_score: number | null;
  payout_amount: number | null;
  reactions?: Reaction[];
}

interface MarketDetailsResponse extends Market {
  opinions: Opinion[];
}

// ── Score bar component ───────────────────────────────────────────────────────

function ScoreBar({
  label,
  score,
  color,
}: {
  label: string;
  score: number | null;
  color: string;
}) {
  const pct = score !== null ? score : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-400 w-32 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-gray-300 w-8 text-right">{score !== null ? score : '—'}</span>
    </div>
  );
}

// ── React panel ──────────────────────────────────────────────────────────────

function ReactPanel({
  opinionId,
  marketId,
  walletAddress,
  onSuccess,
  onClose,
}: {
  opinionId: string;
  marketId: string;
  walletAddress: string | null;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [reactionType, setReactionType] = useState<'back' | 'slash'>('back');
  const [amount, setAmount] = useState(1.0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/markets/${marketId}/opinions/${opinionId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reactor: walletAddress,
          reaction_type: reactionType,
          amount: Math.round(amount * 1_000_000),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit reaction');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-3 p-4 bg-gray-900/80 border border-gray-600 rounded-lg">
      {/* Type selector */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setReactionType('back')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            reactionType === 'back'
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          ↑ Back (Agree)
        </button>
        <button
          onClick={() => setReactionType('slash')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            reactionType === 'slash'
              ? 'bg-red-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          ↓ Slash (Disagree)
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        {reactionType === 'back'
          ? "Your stake boosts this opinion's Weight Score — helping it earn a larger share."
          : "Your stake reduces this opinion's Weight Score — protecting the pool from weak opinions."}
      </p>

      {/* Amount presets */}
      <div className="flex gap-1 mb-3">
        {[0.5, 1, 2, 5].map((a) => (
          <button
            key={a}
            onClick={() => setAmount(a)}
            className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-all ${
              amount === a ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            ${a}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-2 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50 ${
            reactionType === 'back'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {isSubmitting ? '...' : `${reactionType === 'back' ? '↑ Back' : '↓ Slash'} $${amount}`}
        </button>
      </div>
    </div>
  );
}

// ── Opinion card ──────────────────────────────────────────────────────────────

function OpinionCard({
  opinion,
  marketId,
  marketState,
  totalStake,
  walletAddress,
  onReactionSuccess,
}: {
  opinion: Opinion;
  marketId: string;
  marketState: string;
  totalStake: number;
  walletAddress: string | null;
  onReactionSuccess: () => void;
}) {
  const [showReactPanel, setShowReactPanel] = useState(false);

  const isSettled = marketState === 'Settled';
  const isActive = marketState === 'Active';
  const netBacking = Number(opinion.backing_total) - Number(opinion.slashing_total);
  const totalReactions = Number(opinion.backing_total) + Number(opinion.slashing_total);
  const backingPct = totalReactions > 0 ? (Number(opinion.backing_total) / totalReactions) * 100 : 50;
  const poolPct = totalStake > 0 ? ((Number(opinion.amount) / totalStake) * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-4 hover:bg-gray-700/40 transition-colors">
      {/* Header: staker + stake info */}
      <div className="flex justify-between items-start gap-4 mb-3">
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">
            {truncateAddress(opinion.staker_address)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {new Date(opinion.created_at).toLocaleDateString()}
            {opinion.prediction !== null && (
              <span className="ml-2 text-purple-400">
                · prediction: <strong>{opinion.prediction}</strong>
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-purple-400">{formatUSDC(opinion.amount)}</div>
          <div className="text-xs text-gray-500">{poolPct}% of pool</div>
        </div>
      </div>

      {/* Opinion text */}
      {opinion.opinion_text && (
        <p className="text-sm text-gray-300 italic border-l-2 border-purple-500 pl-3 mb-3">
          "{opinion.opinion_text}"
        </p>
      )}

      {/* Layer 1: Backing bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span className="text-green-400">↑ ${(Number(opinion.backing_total) / 1_000_000).toFixed(2)} backed</span>
          <span>net: ${(netBacking / 1_000_000).toFixed(2)}</span>
          <span className="text-red-400">↓ ${(Number(opinion.slashing_total) / 1_000_000).toFixed(2)} slashed</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all"
            style={{ width: `${backingPct}%` }}
          />
        </div>
      </div>

      {/* Triple-Check Scores (settled markets only) */}
      {isSettled && opinion.composite_score !== null && (
        <div className="mt-3 pt-3 border-t border-gray-600 space-y-2">
          <p className="text-xs font-semibold text-gray-300 mb-2">Triple-Check Scores</p>
          <ScoreBar label="⚖ Peer Backing (W)" score={opinion.weight_score} color="#3b82f6" />
          <ScoreBar label="🎯 Consensus (C)" score={opinion.consensus_score} color="#8b5cf6" />
          <ScoreBar label="🤖 AI Quality (A)" score={opinion.ai_score} color="#f59e0b" />

          <div className="flex justify-between items-center pt-2 border-t border-gray-600/50">
            <span className="text-xs text-gray-400">Combined Score (S)</span>
            <span className="text-sm font-bold text-white">{opinion.composite_score?.toFixed(1)}</span>
          </div>

          {opinion.payout_amount !== null && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Payout Earned</span>
              <span className="text-sm font-bold text-green-400">
                {formatUSDC(opinion.payout_amount)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Back/Slash button (active markets only) */}
      {isActive && !showReactPanel && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setShowReactPanel(true)}
            className="flex-1 py-1.5 text-xs bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all"
          >
            ↑ Back / ↓ Slash
          </button>
        </div>
      )}

      {/* React panel */}
      {isActive && showReactPanel && (
        <ReactPanel
          opinionId={opinion.id}
          marketId={marketId}
          walletAddress={walletAddress}
          onSuccess={() => {
            setShowReactPanel(false);
            onReactionSuccess();
          }}
          onClose={() => setShowReactPanel(false)}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MarketDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const setSelectedMarket = useMarketStore((s) => s.setSelectedMarket);
  const [mounted, setMounted] = useState(false);

  const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch market');
    return res.json();
  };

  const { data: response, error, isLoading, mutate } = useSWR<{ data: MarketDetailsResponse }>(
    id ? `${API_URL}/markets/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      // Auto-refresh every 30s while market is active (live sentiment updates)
      refreshInterval: (data) => {
        const market = (data as any)?.data ?? data;
        return market?.state === 'Active' ? 30000 : 0;
      },
    }
  );

  const market: MarketDetailsResponse | null = (response as any)?.data ?? (response as any) ?? null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (market) setSelectedMarket(market as any);
  }, [market, setSelectedMarket]);

  if (!mounted) return null;
  if (isLoading) return <MarketDetailSkeleton />;
  if (error || !market) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex justify-center items-center h-96">
          <p className="text-gray-400">Market not found</p>
        </div>
      </div>
    );
  }

  const timeRemaining = formatTimeRemaining(market.closes_at);
  const opinions: Opinion[] = (market as any).opinions || [];
  const isSettled = market.state === 'Settled';

  // Sort by backing_total desc for active, composite_score desc for settled
  const sortedOpinions = [...opinions].sort((a, b) => {
    if (isSettled) {
      return (Number(b.composite_score) || 0) - (Number(a.composite_score) || 0);
    }
    return Number(b.backing_total) - Number(a.backing_total);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start gap-4 mb-4">
            <h1 className="text-4xl font-bold text-white flex-1">{market.statement}</h1>
            <div className="px-4 py-2 bg-green-500/20 text-green-300 border border-green-500/50 rounded-lg font-medium whitespace-nowrap">
              {market.state}
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-gray-400 mb-6">
            <div>
              <span className="text-gray-500">Created by</span>{' '}
              <span className="text-white">{truncateAddress(market.creator_address)}</span>
            </div>
            <div>
              <span className="text-gray-500">Closes in</span>{' '}
              <span className="text-white font-medium">{timeRemaining}</span>
            </div>
            {market.crowd_score !== null && market.crowd_score !== undefined && (
              <div>
                <span className="text-gray-500">Crowd Score</span>{' '}
                <span className="text-purple-400 font-medium">
                  {Number(market.crowd_score).toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Sentiment + Stats */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              {/* Sentiment Dial */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 mb-6">
                <SentimentDial
                  score={market.state === 'Active' ? (market.live_sentiment_score || 0) : (market.sentiment_score || 0)}
                  confidence={market.state === 'Active' ? market.live_sentiment_confidence : market.confidence}
                  size="sm"
                  isLive={market.state === 'Active'}
                  className="w-full"
                />
              </div>

              {/* Stats */}
              <div className="space-y-4">
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-1">Total Pool</div>
                  <div className="text-2xl font-bold text-white">{formatUSDC(market.total_stake)}</div>
                </div>

                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-1">Participants</div>
                  <div className="text-2xl font-bold text-white">{market.staker_count}</div>
                </div>

                {/* Triple-Check formula reminder */}
                {!isSettled && (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-2">Payout Formula</div>
                    <div className="text-xs text-gray-300 space-y-1">
                      <div className="flex justify-between">
                        <span>⚖ Peer Backing (W)</span>
                        <span className="text-blue-400">50%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>🎯 Prediction (C)</span>
                        <span className="text-purple-400">30%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>🤖 AI Quality (A)</span>
                        <span className="text-amber-400">20%</span>
                      </div>
                    </div>
                  </div>
                )}

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

          {/* Right: Opinions */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                Opinions ({opinions.length})
              </h2>
              {isSettled && (
                <p className="text-xs text-gray-400 mb-6">
                  Sorted by composite score (W×50% + C×30% + A×20%)
                </p>
              )}
              {!isSettled && opinions.length > 0 && (
                <p className="text-xs text-gray-400 mb-6">
                  Sorted by peer backing · Back or Slash opinions to affect their weight score
                </p>
              )}

              {sortedOpinions.length > 0 ? (
                <div className="space-y-4 max-h-[680px] overflow-y-auto pr-1">
                  {sortedOpinions.map((opinion) => (
                    <OpinionCard
                      key={opinion.id}
                      opinion={opinion}
                      marketId={market.id}
                      marketState={market.state}
                      totalStake={Number(market.total_stake)}
                      walletAddress={walletAddress}
                      onReactionSuccess={() => mutate()}
                    />
                  ))}
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
