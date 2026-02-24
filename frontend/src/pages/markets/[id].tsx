import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Header } from '@/components/Layout/Header';
import { SentimentDial } from '@/components/SentimentDial';
import { formatUSDC, formatTimeRemaining, truncateAddress } from '@/lib/utils/formatting';
import { useMarketStore, type Market } from '@/store/marketStore';
import { useOpinionMarket, getExplorerTxUrl, OpinionMarketError } from '@/lib/anchor';
import { getUsdcFaucetUrl } from '@/lib/anchor/config';

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
  opinion_pda?: string;
  weight_score: number | null;
  consensus_score: number | null;
  ai_score: number | null;
  composite_score: number | null;
  payout_amount: number | null;
  paid?: boolean;
  reactions?: Reaction[];
}

interface MarketDetailsResponse extends Market {
  opinions: Opinion[];
  market_pda?: string;
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
      <span className="text-gray-300 w-8 text-right">{score !== null ? score : '--'}</span>
    </div>
  );
}

// ── React panel (real on-chain) ─────────────────────────────────────────────

function ReactPanel({
  opinionId,
  opinionPda,
  marketId,
  marketPda,
  walletAddress,
  onSuccess,
  onClose,
}: {
  opinionId: string;
  opinionPda: string | undefined;
  marketId: string;
  marketPda: string | undefined;
  walletAddress: string | null;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const { client, ready, getBalance, faucetUrl } = useOpinionMarket();
  const [reactionType, setReactionType] = useState<'back' | 'slash'>('back');
  const [amount, setAmount] = useState(1.0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!walletAddress || !client) {
      setError('Please connect your wallet first');
      return;
    }
    if (!marketPda || !opinionPda) {
      setError('Market or opinion address not available. The market may need to be indexed from on-chain.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const stakeAmount = Math.round(amount * 1_000_000);

      // Check balance
      const balance = await getBalance();
      if (balance < stakeAmount) {
        setError(
          `Insufficient USDC. You need $${amount.toFixed(2)} but have $${(balance / 1_000_000).toFixed(2)}.` +
          (faucetUrl ? ' Get devnet USDC from the faucet.' : '')
        );
        setIsSubmitting(false);
        return;
      }

      const result = await client.reactToOpinion(
        new PublicKey(marketPda),
        new PublicKey(opinionPda),
        reactionType,
        stakeAmount
      );

      setTxSignature(result.signature);

      // Record in API with real tx signature
      try {
        await fetch(`${API_URL}/markets/${marketId}/opinions/${opinionId}/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reactor: walletAddress,
            reaction_type: reactionType,
            amount: stakeAmount,
            signature: result.signature,
            reaction_pda: result.reactionPda.toBase58(),
          }),
        });
      } catch {
        // API is secondary
      }

      onSuccess();
    } catch (err: any) {
      const msg =
        err instanceof OpinionMarketError
          ? err.message
          : err.message || 'Failed to submit reaction';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (txSignature) {
    return (
      <div className="mt-3 p-4 bg-green-900/30 border border-green-600/50 rounded-lg">
        <p className="text-sm text-green-300 mb-2">Reaction submitted on-chain!</p>
        <a
          href={getExplorerTxUrl(txSignature)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 underline break-all"
        >
          View on Solana Explorer
        </a>
      </div>
    );
  }

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
          Back (Agree)
        </button>
        <button
          onClick={() => setReactionType('slash')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            reactionType === 'slash'
              ? 'bg-red-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          Slash (Disagree)
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
          disabled={isSubmitting || !ready}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50 ${
            reactionType === 'back'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {isSubmitting ? 'Submitting...' : `${reactionType === 'back' ? 'Back' : 'Slash'} $${amount} USDC`}
        </button>
      </div>
    </div>
  );
}

// ── Claim Payout button ─────────────────────────────────────────────────────

function ClaimPayoutButton({
  opinion,
  marketPda,
  totalCombinedScore,
}: {
  opinion: Opinion;
  marketPda: string | undefined;
  totalCombinedScore: number;
}) {
  const { client, ready } = useOpinionMarket();
  const { publicKey } = useWallet();
  const [isClaiming, setIsClaiming] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only show for the opinion owner who hasn't claimed yet
  if (!publicKey || opinion.staker_address !== publicKey.toBase58()) return null;
  if (opinion.paid) return null;
  if (!opinion.opinion_pda || !marketPda) return null;

  if (txSignature) {
    return (
      <div className="mt-2 p-3 bg-green-900/30 border border-green-600/50 rounded-lg">
        <p className="text-xs text-green-300">Payout claimed!</p>
        <a
          href={getExplorerTxUrl(txSignature)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          View on Explorer
        </a>
      </div>
    );
  }

  const handleClaim = async () => {
    if (!client || !marketPda || !opinion.opinion_pda) return;
    setIsClaiming(true);
    setError(null);
    try {
      const result = await client.claimPayout(
        new PublicKey(marketPda),
        new PublicKey(opinion.opinion_pda),
        totalCombinedScore
      );
      setTxSignature(result.signature);
    } catch (err: any) {
      setError(err instanceof OpinionMarketError ? err.message : err.message);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="mt-2">
      {error && <p className="text-xs text-red-400 mb-1">{error}</p>}
      <button
        onClick={handleClaim}
        disabled={isClaiming || !ready}
        className="w-full py-2 text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50"
      >
        {isClaiming ? 'Claiming...' : 'Claim Payout'}
      </button>
    </div>
  );
}

// ── Opinion card ──────────────────────────────────────────────────────────────

function OpinionCard({
  opinion,
  marketId,
  marketPda,
  marketState,
  totalStake,
  totalCombinedScore,
  walletAddress,
  onReactionSuccess,
}: {
  opinion: Opinion;
  marketId: string;
  marketPda: string | undefined;
  marketState: string;
  totalStake: number;
  totalCombinedScore: number;
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
      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-3">
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">
            {truncateAddress(opinion.staker_address)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {new Date(opinion.created_at).toLocaleDateString()}
            {opinion.prediction !== null && (
              <span className="ml-2 text-purple-400">
                prediction: <strong>{opinion.prediction}</strong>
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
          <span className="text-green-400">${(Number(opinion.backing_total) / 1_000_000).toFixed(2)} backed</span>
          <span>net: ${(netBacking / 1_000_000).toFixed(2)}</span>
          <span className="text-red-400">${(Number(opinion.slashing_total) / 1_000_000).toFixed(2)} slashed</span>
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
          <ScoreBar label="Peer Backing (W)" score={opinion.weight_score} color="#3b82f6" />
          <ScoreBar label="Consensus (C)" score={opinion.consensus_score} color="#8b5cf6" />
          <ScoreBar label="AI Quality (A)" score={opinion.ai_score} color="#f59e0b" />

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

          {/* Claim button */}
          <ClaimPayoutButton
            opinion={opinion}
            marketPda={marketPda}
            totalCombinedScore={totalCombinedScore}
          />
        </div>
      )}

      {/* Back/Slash button (active markets only) */}
      {isActive && !showReactPanel && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setShowReactPanel(true)}
            className="flex-1 py-1.5 text-xs bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all"
          >
            Back / Slash
          </button>
        </div>
      )}

      {/* React panel — real on-chain */}
      {isActive && showReactPanel && (
        <ReactPanel
          opinionId={opinion.id}
          opinionPda={opinion.opinion_pda}
          marketId={marketId}
          marketPda={marketPda}
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
    { revalidateOnFocus: false }
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

  // Compute total combined score for claim_payout
  const totalCombinedScore = opinions.reduce(
    (sum, op) => sum + (Number(op.composite_score) || 0),
    0
  );

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
                  score={market.sentiment_score || 0}
                  confidence={market.confidence}
                  size="sm"
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

                {!isSettled && (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-2">Payout Formula</div>
                    <div className="text-xs text-gray-300 space-y-1">
                      <div className="flex justify-between">
                        <span>Peer Backing (W)</span>
                        <span className="text-blue-400">50%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Prediction (C)</span>
                        <span className="text-purple-400">30%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>AI Quality (A)</span>
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
                  Sorted by composite score (W x 50% + C x 30% + A x 20%)
                </p>
              )}
              {!isSettled && opinions.length > 0 && (
                <p className="text-xs text-gray-400 mb-6">
                  Sorted by peer backing. Back or Slash opinions to affect their weight score.
                </p>
              )}

              {sortedOpinions.length > 0 ? (
                <div className="space-y-4 max-h-[680px] overflow-y-auto pr-1">
                  {sortedOpinions.map((opinion) => (
                    <OpinionCard
                      key={opinion.id}
                      opinion={opinion}
                      marketId={market.id}
                      marketPda={(market as any).market_pda}
                      marketState={market.state}
                      totalStake={Number(market.total_stake)}
                      totalCombinedScore={totalCombinedScore}
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
