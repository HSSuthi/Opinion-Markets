import React, { useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { useWallet } from '@solana/wallet-adapter-react';
import { Header } from '@/components/Layout/Header';
import { formatUSDC } from '@/lib/utils/formatting';
import { useUIStore } from '@/store/uiStore';
import type { Market } from '@/store/marketStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Step = 'amount' | 'opinion' | 'score' | 'prediction' | 'review' | 'confirm';

const STEPS: Step[] = ['amount', 'opinion', 'score', 'prediction', 'review', 'confirm'];

function getSliderColor(value: number): string {
  if (value < 33) return '#ef4444';  // red — bearish
  if (value < 66) return '#f59e0b';  // amber — neutral
  return '#22c55e';                  // green — bullish
}

function getPredictionLabel(value: number): string {
  if (value <= 15) return 'Strongly Disagree';
  if (value <= 35) return 'Disagree';
  if (value <= 45) return 'Slight Disagreement';
  if (value <= 55) return 'Neutral';
  if (value <= 65) return 'Slight Agreement';
  if (value <= 85) return 'Agree';
  return 'Strongly Agree';
}

export default function StakePage() {
  const router = useRouter();
  const { id } = router.query;
  const { wallet } = useWallet();
  const addToast = useUIStore((s) => s.addToast);

  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState(0.5);
  const [opinion, setOpinion] = useState('');
  const [opinionScore, setOpinionScore] = useState(50); // 0–100 how much user agrees
  const [marketPrediction, setMarketPrediction] = useState(50); // 0–100 bet on crowd
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch market');
    return res.json();
  };

  const { data: market, error } = useSWR<{ data: Market }>(
    id ? `${API_URL}/markets/${id}` : null,
    fetcher
  );

  const marketData = (market as any)?.data ?? market;

  const handleStake = async () => {
    if (!wallet || !marketData) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/markets/${id}/stake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staker: wallet.publicKey?.toBase58() || 'demo-wallet',
          amount: Math.round(amount * 1_000_000), // convert to micro-USDC
          opinion_text: opinion,
          opinion_score: opinionScore,
          market_prediction: marketPrediction,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to stake opinion');

      const mockTxHash = `${Math.random().toString(36).substring(7)}`;
      setTxHash(data.data?.id || mockTxHash);
      setStep('confirm');

      addToast({ type: 'success', message: 'Opinion staked successfully!', duration: 5000 });
    } catch (error) {
      addToast({
        type: 'error',
        message: (error as Error).message || 'Failed to stake opinion',
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!marketData && !error) return <StakePageSkeleton />;
  if (!marketData) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex justify-center items-center h-96">
          <p className="text-gray-400">Market not found</p>
        </div>
      </div>
    );
  }

  const currentStepIdx = STEPS.indexOf(step);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Step progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-4">
            {STEPS.map((s, idx) => (
              <div
                key={s}
                className={`flex-1 h-1 mx-1 rounded-full transition-all ${
                  currentStepIdx >= idx ? 'bg-purple-500' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-400 text-center">
            Step {currentStepIdx + 1} of {STEPS.length}
          </p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-8">{marketData.statement}</h2>

          {/* ── Step 1: Amount ── */}
          {step === 'amount' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  Stake Amount
                </label>

                {/* Show market cap */}
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                  <p className="text-xs text-blue-300">
                    💡 This market's cap: <strong>${((marketData?.max_stake || 10_000_000) / 1_000_000).toFixed(2)}</strong>
                  </p>
                </div>

                <div className="mb-6">
                  <input
                    type="range"
                    min="0.5"
                    max={(marketData?.max_stake || 10_000_000) / 1_000_000}
                    step="0.5"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>$0.50</span>
                    <span>${((marketData?.max_stake || 10_000_000) / 1_000_000).toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-6 text-center mb-6">
                  <div className="text-5xl font-bold text-purple-400 mb-2">
                    ${amount.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-400">{formatUSDC(amount * 1_000_000)}</div>
                </div>

                {/* Dynamic presets based on market cap */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    0.5,
                    Math.min(1, (marketData?.max_stake || 10_000_000) / 1_000_000),
                    Math.min(5, (marketData?.max_stake || 10_000_000) / 1_000_000),
                    (marketData?.max_stake || 10_000_000) / 1_000_000,
                  ]
                    .filter((val, idx, arr) => arr.indexOf(val) === idx) // Remove duplicates
                    .map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setAmount(preset)}
                        className={`py-2 px-3 rounded-lg font-medium transition-all ${
                          Math.abs(amount - preset) < 0.01
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        ${preset.toFixed(2)}
                      </button>
                    ))}
                </div>
              </div>

              <button
                onClick={() => setStep('opinion')}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── Step 2: Opinion ── */}
          {step === 'opinion' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  📝 Your Opinion
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  The AI Oracle will rate your text on clarity, insight, and reasoning — this
                  directly affects your payout (20% of your score).
                </p>
                <p className="text-xs text-gray-500 mb-4">{opinion.length}/280</p>

                <textarea
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value.slice(0, 280))}
                  placeholder="Share a specific, well-reasoned take. Vague opinions score lower with the AI."
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                  rows={4}
                />

                {opinion.length < 50 && opinion.length > 0 && (
                  <p className="text-xs text-yellow-500 mt-2">Minimum 50 characters</p>
                )}

                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                  <p className="text-xs text-blue-300">
                    💡 <strong>Pro tip:</strong> Specific reasoning like "The data shows X because Y"
                    scores much higher than "I think yes."
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('amount')}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep('score')}
                  disabled={opinion.length < 50}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Your Score (opinion_score) ── */}
          {step === 'score' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Your Score
                </label>
                <p className="text-xs text-gray-500 mb-6">
                  How much do you agree? (0 = strongly disagree, 100 = strongly agree).
                  Your score shapes the final Truth Score — the crowd's collective answer.
                </p>

                {/* Score display */}
                <div className="text-center mb-6">
                  <div
                    className="text-7xl font-black mb-2 transition-colors"
                    style={{ color: getSliderColor(opinionScore) }}
                  >
                    {opinionScore}
                  </div>
                  <div
                    className="text-lg font-semibold"
                    style={{ color: getSliderColor(opinionScore) }}
                  >
                    {getPredictionLabel(opinionScore)}
                  </div>
                </div>

                {/* Slider */}
                <div className="relative mb-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={opinionScore}
                    onChange={(e) => setOpinionScore(parseInt(e.target.value))}
                    className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor: getSliderColor(opinionScore) }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>0 — Strongly Disagree</span>
                    <span>50 — Neutral</span>
                    <span>100 — Strongly Agree</span>
                  </div>
                </div>

                {/* Quick preset buttons */}
                <div className="grid grid-cols-5 gap-2 mt-4">
                  {[10, 30, 50, 70, 90].map((p) => (
                    <button
                      key={p}
                      onClick={() => setOpinionScore(p)}
                      className={`py-2 text-sm rounded-lg font-medium transition-all ${
                        Math.abs(opinionScore - p) < 5
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                  <p className="text-xs text-blue-300">
                    <strong>How this works:</strong> Your score combines with other stakers'
                    scores to form the final Truth Score. This is what the market believes is true.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('opinion')}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep('prediction')}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Your Prediction (market_prediction) ── */}
          {step === 'prediction' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Your Prediction
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Where will the crowd land?
                </p>
                <p className="text-xs text-gray-600 mb-6">
                  Predict the final consensus score — earn more if you're closest.
                </p>

                {/* Score display */}
                <div className="text-center mb-6">
                  <div
                    className="text-7xl font-black mb-2 transition-colors"
                    style={{ color: getSliderColor(marketPrediction) }}
                  >
                    {marketPrediction}
                  </div>
                  <div
                    className="text-lg font-semibold"
                    style={{ color: getSliderColor(marketPrediction) }}
                  >
                    {getPredictionLabel(marketPrediction)}
                  </div>
                </div>

                {/* Slider */}
                <div className="relative mb-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={marketPrediction}
                    onChange={(e) => setMarketPrediction(parseInt(e.target.value))}
                    className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor: getSliderColor(marketPrediction) }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>0 — Strongly Against</span>
                    <span>50 — Neutral</span>
                    <span>100 — Strongly For</span>
                  </div>
                </div>

                {/* Quick preset buttons */}
                <div className="grid grid-cols-5 gap-2 mt-4">
                  {[10, 30, 50, 70, 90].map((p) => (
                    <button
                      key={p}
                      onClick={() => setMarketPrediction(p)}
                      className={`py-2 text-sm rounded-lg font-medium transition-all ${
                        Math.abs(marketPrediction - p) < 5
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-purple-900/20 border border-purple-700/50 rounded-lg">
                  <p className="text-xs text-purple-300">
                    <strong>How this works:</strong> At settlement the protocol calculates the
                    weighted average of everyone's opinion scores. You earn from the prediction pool
                    (24% of stakes) based on how close your prediction is to that average.
                    Top 20% closest predictors also enter the jackpot lottery (6% of stakes).
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('score')}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep('review')}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  Review →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: Review ── */}
          {step === 'review' && (
            <div className="space-y-6">
              <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-4 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Stake Amount</p>
                  <p className="text-2xl font-bold text-white">${amount.toFixed(2)}</p>
                </div>

                <div className="border-t border-gray-600 pt-4">
                  <p className="text-xs text-gray-500 mb-2">Your Opinion</p>
                  <p className="text-white italic text-sm">"{opinion}"</p>
                </div>

                <div className="border-t border-gray-600 pt-4">
                  <p className="text-xs text-gray-500 mb-1">Your Score (how much you agree)</p>
                  <p
                    className="text-lg font-bold"
                    style={{ color: getSliderColor(opinionScore) }}
                  >
                    {opinionScore} — {getPredictionLabel(opinionScore)}
                  </p>
                </div>

                <div className="border-t border-gray-600 pt-4">
                  <p className="text-xs text-gray-500 mb-1">Your Prediction (where crowd will land)</p>
                  <p
                    className="text-lg font-bold"
                    style={{ color: getSliderColor(marketPrediction) }}
                  >
                    {marketPrediction} — {getPredictionLabel(marketPrediction)}
                  </p>
                </div>

                <div className="border-t border-gray-600 pt-4">
                  <p className="text-xs text-gray-500 mb-2">Payout Pools</p>
                  <div className="text-xs text-gray-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Opinion Pool (net backing)</span>
                      <span className="text-gray-300">70% of stakes</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prediction Pool (accuracy)</span>
                      <span className="text-gray-300">24% of stakes</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Jackpot (top 20% predictors)</span>
                      <span className="text-gray-300">6% of stakes</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('prediction')}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                >
                  ← Back
                </button>
                <button
                  onClick={handleStake}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm & Submit →'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 6: Confirmation ── */}
          {step === 'confirm' && (
            <div className="text-center space-y-6">
              <div className="text-6xl">✅</div>

              <div>
                <h3 className="text-2xl font-bold text-green-400 mb-2">Opinion Staked!</h3>
                <p className="text-gray-400 mb-4">
                  Your ${amount.toFixed(2)} stake has been recorded with score{' '}
                  <strong style={{ color: getSliderColor(opinionScore) }}>{opinionScore}</strong>{' '}
                  and prediction{' '}
                  <strong style={{ color: getSliderColor(marketPrediction) }}>{marketPrediction}</strong>.
                </p>

                {txHash && (
                  <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-4 mb-6">
                    <p className="text-xs text-gray-500 mb-1">Transaction / Opinion ID</p>
                    <p className="text-sm font-mono text-purple-400 break-all">{txHash}</p>
                  </div>
                )}

                <div className="bg-gray-700/20 border border-gray-600 rounded-lg p-4 text-left">
                  <p className="text-xs text-gray-400 mb-2">What happens next:</p>
                  <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                    <li>Other stakers can <strong className="text-green-400">Back</strong> or <strong className="text-red-400">Slash</strong> your opinion</li>
                    <li>When the market closes, the AI Oracle scores your text</li>
                    <li>Opinion pool (70%): paid by net backing you receive</li>
                    <li>Prediction pool (24%): paid by how close your prediction is</li>
                    <li>Jackpot (6%): random draw from top 20% predictors</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => router.push(`/markets/${marketData.id}`)}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                >
                  Back to Market
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  View All Markets
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StakePageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="h-96 bg-gray-800 rounded animate-pulse" />
      </main>
    </div>
  );
}
