import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Header } from '@/components/Layout/Header';
import { formatUSDC } from '@/lib/utils/formatting';
import { useUIStore } from '@/store/uiStore';
import type { Market } from '@/store/marketStore';
import { useOpinionMarket, getExplorerTxUrl, OpinionMarketError } from '@/lib/anchor';
import { getUsdcFaucetUrl } from '@/lib/anchor/config';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Step = 'amount' | 'opinion' | 'prediction' | 'review' | 'confirm';

const STEPS: Step[] = ['amount', 'opinion', 'prediction', 'review', 'confirm'];

function getSliderColor(value: number): string {
  if (value < 33) return '#ef4444';  // red
  if (value < 66) return '#f59e0b';  // amber
  return '#22c55e';                  // green
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
  const { publicKey } = useWallet();
  const addToast = useUIStore((s) => s.addToast);
  const { client, ready, getBalance, faucetUrl } = useOpinionMarket();

  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState(0.5);
  const [opinion, setOpinion] = useState('');
  const [prediction, setPrediction] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);

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

  // Fetch USDC balance
  useEffect(() => {
    if (ready && publicKey) {
      getBalance().then(setUsdcBalance).catch(() => setUsdcBalance(0));
    }
  }, [ready, publicKey]);

  const stakeAmountMicroUsdc = Math.round(amount * 1_000_000);
  const hasEnoughUsdc = usdcBalance !== null && usdcBalance >= stakeAmountMicroUsdc;

  const handleStake = async () => {
    if (!publicKey || !marketData || !client) return;

    setIsSubmitting(true);
    try {
      // Derive market PDA from the UUID stored in the API
      const marketUuidHex = marketData.uuid;
      const marketUuid = Uint8Array.from(
        Buffer.from(marketUuidHex.replace(/-/g, ''), 'hex')
      );
      const marketPda = client.deriveMarketPda(marketUuid);

      // Send the real on-chain transaction
      const result = await client.stakeOpinion(
        marketPda,
        marketUuid,
        stakeAmountMicroUsdc,
        opinion,
        prediction,
        '' // IPFS CID — TODO: upload opinion text to IPFS first
      );

      setTxSignature(result.signature);

      // Record in API with real tx signature
      try {
        await fetch(`${API_URL}/markets/${id}/stake`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staker: publicKey.toBase58(),
            amount: stakeAmountMicroUsdc,
            opinion_text: opinion,
            prediction,
            signature: result.signature,
            opinion_pda: result.opinionPda.toBase58(),
          }),
        });
      } catch {
        console.warn('Failed to record stake in API, but on-chain tx succeeded');
      }

      setStep('confirm');
      addToast({ type: 'success', message: 'Opinion staked on-chain!', duration: 5000 });
    } catch (error) {
      const msg =
        error instanceof OpinionMarketError
          ? error.message
          : (error as Error).message || 'Failed to stake opinion';
      addToast({ type: 'error', message: msg, duration: 7000 });
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

          {/* Step 1: Amount */}
          {step === 'amount' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  Stake Amount
                </label>

                <div className="mb-6">
                  <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>$0.50</span>
                    <span>$10.00</span>
                  </div>
                </div>

                <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-6 text-center mb-6">
                  <div className="text-5xl font-bold text-purple-400 mb-2">
                    ${amount.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-400">{formatUSDC(amount * 1_000_000)}</div>
                  {usdcBalance !== null && (
                    <div className="text-xs text-gray-500 mt-2">
                      Balance: ${(usdcBalance / 1_000_000).toFixed(2)} USDC
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[0.5, 1, 5, 10].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setAmount(preset)}
                      className={`py-2 px-3 rounded-lg font-medium transition-all ${
                        amount === preset
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setStep('opinion')}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Opinion */}
          {step === 'opinion' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Your Opinion
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
                    <strong>Pro tip:</strong> Specific reasoning like "The data shows X because Y"
                    scores much higher than "I think yes."
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('amount')}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('prediction')}
                  disabled={opinion.length < 50}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Prediction Slider */}
          {step === 'prediction' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Agreement Prediction
                </label>
                <p className="text-xs text-gray-500 mb-6">
                  Predict where the crowd will land (0 = strongly against, 100 = strongly for).
                  If your prediction is close to the volume-weighted crowd average, your Consensus
                  Score goes up — worth 30% of your payout.
                </p>

                <div className="text-center mb-6">
                  <div
                    className="text-7xl font-black mb-2 transition-colors"
                    style={{ color: getSliderColor(prediction) }}
                  >
                    {prediction}
                  </div>
                  <div
                    className="text-lg font-semibold"
                    style={{ color: getSliderColor(prediction) }}
                  >
                    {getPredictionLabel(prediction)}
                  </div>
                </div>

                <div className="relative mb-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={prediction}
                    onChange={(e) => setPrediction(parseInt(e.target.value))}
                    className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor: getSliderColor(prediction) }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>0 — Strongly Against</span>
                    <span>50 — Neutral</span>
                    <span>100 — Strongly For</span>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2 mt-4">
                  {[10, 30, 50, 70, 90].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPrediction(p)}
                      className={`py-2 text-sm rounded-lg font-medium transition-all ${
                        Math.abs(prediction - p) < 5
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
                    volume-weighted average of all predictions. Your Consensus Score (30% of payout)
                    is based on how accurately you predicted that average.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('opinion')}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('review')}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  Review
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
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
                  <p className="text-xs text-gray-500 mb-1">Agreement Prediction</p>
                  <p
                    className="text-lg font-bold"
                    style={{ color: getSliderColor(prediction) }}
                  >
                    {prediction} — {getPredictionLabel(prediction)}
                  </p>
                </div>

                <div className="border-t border-gray-600 pt-4">
                  <p className="text-xs text-gray-500 mb-2">Payout Formula</p>
                  <div className="text-xs text-gray-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Peer Backing (W)</span>
                      <span className="text-gray-300">50% of score</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prediction Accuracy (C)</span>
                      <span className="text-gray-300">30% of score</span>
                    </div>
                    <div className="flex justify-between">
                      <span>AI Quality (A)</span>
                      <span className="text-gray-300">20% of score</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Insufficient USDC warning */}
              {usdcBalance !== null && !hasEnoughUsdc && (
                <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-4">
                  <p className="text-sm text-red-300 mb-2">
                    Insufficient USDC balance. You need ${amount.toFixed(2)} but have $
                    {(usdcBalance / 1_000_000).toFixed(2)}.
                  </p>
                  {faucetUrl && (
                    <a
                      href={faucetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:text-blue-300 underline"
                    >
                      Get devnet USDC from the faucet
                    </a>
                  )}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('prediction')}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleStake}
                  disabled={isSubmitting || !ready || !hasEnoughUsdc}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Staking on-chain...' : `Confirm & Stake $${amount.toFixed(2)} USDC`}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Confirmation */}
          {step === 'confirm' && (
            <div className="text-center space-y-6">
              <div className="text-6xl">✅</div>

              <div>
                <h3 className="text-2xl font-bold text-green-400 mb-2">Opinion Staked On-Chain!</h3>
                <p className="text-gray-400 mb-4">
                  Your ${amount.toFixed(2)} stake has been recorded with prediction{' '}
                  <strong style={{ color: getSliderColor(prediction) }}>{prediction}</strong>.
                </p>

                {txSignature && (
                  <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-4 mb-6">
                    <p className="text-xs text-gray-500 mb-1">Transaction Signature</p>
                    <a
                      href={getExplorerTxUrl(txSignature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-purple-400 break-all hover:text-purple-300 underline"
                    >
                      {txSignature}
                    </a>
                    <p className="text-xs text-gray-500 mt-2">
                      <a
                        href={getExplorerTxUrl(txSignature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        View on Solana Explorer
                      </a>
                    </p>
                  </div>
                )}

                <div className="bg-gray-700/20 border border-gray-600 rounded-lg p-4 text-left">
                  <p className="text-xs text-gray-400 mb-2">What happens next:</p>
                  <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                    <li>Other stakers can <strong className="text-green-400">Back</strong> or <strong className="text-red-400">Slash</strong> your opinion</li>
                    <li>When the market closes, the AI Oracle scores your text</li>
                    <li>Your payout = W x 50% + C x 30% + A x 20%</li>
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
