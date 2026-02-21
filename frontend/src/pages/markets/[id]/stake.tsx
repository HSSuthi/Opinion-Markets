import React, { useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { useWallet } from '@solana/wallet-adapter-react';
import { Header } from '@/components/Layout/Header';
import { formatUSDC } from '@/lib/utils/formatting';
import { useUIStore } from '@/store/uiStore';
import type { Market } from '@/store/marketStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Step = 'amount' | 'opinion' | 'review' | 'confirm';

export default function StakePage() {
  const router = useRouter();
  const { id } = router.query;
  const { wallet } = useWallet();
  const addToast = useUIStore((s) => s.addToast);

  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState(0.5); // Default to $0.50
  const [opinion, setOpinion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch market');
    return res.json();
  };

  const { data: market, error } = useSWR<Market>(
    id ? `${API_URL}/markets/${id}` : null,
    fetcher
  );

  const handleStake = async () => {
    if (!wallet || !market) return;

    setIsSubmitting(true);
    try {
      // In production, this would:
      // 1. Build a Solana transaction
      // 2. Sign with wallet adapter
      // 3. Submit to RPC
      // 4. Record in database

      // For MVP, simulate submission
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const mockTxHash = `${Math.random().toString(36).substring(7)}`;
      setTxHash(mockTxHash);
      setStep('confirm');

      addToast({
        type: 'success',
        message: 'Opinion staked successfully!',
        duration: 5000,
      });
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

  if (!market && !error) {
    return <StakePageSkeleton />;
  }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between mb-4">
            {(['amount', 'opinion', 'review', 'confirm'] as Step[]).map(
              (s, idx) => (
                <div
                  key={s}
                  className={`flex-1 h-1 mx-1 rounded-full transition-all ${
                    ['amount', 'opinion', 'review', 'confirm'].indexOf(
                      step
                    ) >= idx
                      ? 'bg-purple-500'
                      : 'bg-gray-700'
                  }`}
                />
              )
            )}
          </div>
          <p className="text-sm text-gray-400 text-center">
            Step {['amount', 'opinion', 'review', 'confirm'].indexOf(step) + 1} of 4
          </p>
        </div>

        {/* Card container */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 mb-8">
          {/* Market statement */}
          <h2 className="text-2xl font-bold text-white mb-8">
            {market.statement}
          </h2>

          {/* Step 1: Amount */}
          {step === 'amount' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  Stake Amount
                </label>

                {/* Slider */}
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

                {/* Amount display */}
                <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-6 text-center mb-6">
                  <div className="text-5xl font-bold text-purple-400 mb-2">
                    ${amount.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-400">
                    {formatUSDC(amount * 1_000_000)}
                  </div>
                </div>

                {/* Preset buttons */}
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
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Your Opinion
                </label>
                <p className="text-xs text-gray-500 mb-4">
                  {opinion.length}/280 characters
                </p>

                <textarea
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value.slice(0, 280))}
                  placeholder="Share your thoughts on this statement..."
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                  rows={4}
                />

                {opinion.length < 50 && opinion.length > 0 && (
                  <p className="text-xs text-yellow-500 mt-2">
                    Minimum 50 characters
                  </p>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('amount')}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('review')}
                  disabled={opinion.length < 50}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Review
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && (
            <div className="space-y-6">
              <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-4 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Amount</p>
                  <p className="text-2xl font-bold text-white">
                    ${amount.toFixed(2)}
                  </p>
                </div>

                <div className="border-t border-gray-600 pt-4">
                  <p className="text-xs text-gray-500 mb-2">Your Opinion</p>
                  <p className="text-white italic">"{opinion}"</p>
                </div>

                <div className="border-t border-gray-600 pt-4">
                  <p className="text-xs text-gray-500 mb-1">Fee (0%)</p>
                  <p className="text-lg text-white">Free for MVP</p>
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
                  onClick={handleStake}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm & Submit'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 'confirm' && (
            <div className="text-center space-y-6">
              <div className="text-6xl">✅</div>

              <div>
                <h3 className="text-2xl font-bold text-green-400 mb-2">
                  Opinion Staked!
                </h3>
                <p className="text-gray-400 mb-4">
                  Your stake of ${amount.toFixed(2)} has been recorded.
                </p>

                {txHash && (
                  <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-4 mb-6">
                    <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
                    <p className="text-sm font-mono text-purple-400 break-all">
                      {txHash}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => router.push(`/markets/${market.id}`)}
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
