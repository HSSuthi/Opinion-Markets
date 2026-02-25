import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '@solana/wallet-adapter-react';
import { Header } from '@/components/Layout/Header';
import { useUIStore } from '@/store/uiStore';
import { formatDate } from '@/lib/utils/formatting';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Step = 'statement' | 'duration' | 'stake-cap' | 'review' | 'confirm';

const DURATIONS = [
  { label: '24 Hours', value: 86400, hours: 24 },
  { label: '3 Days', value: 259200, hours: 72 },
  { label: '7 Days', value: 604800, hours: 168 },
  { label: '14 Days', value: 1209600, hours: 336 },
];

const STAKE_CAPS = [
  { label: 'Default ($10)', value: 10_000_000, description: 'Twitter-bait markets, casual opinions' },
  { label: '$50', value: 50_000_000, description: 'More serious staking' },
  { label: '$100', value: 100_000_000, description: 'High-conviction markets' },
  { label: '$250', value: 250_000_000, description: 'Institutional interest' },
  { label: '$500 (Max)', value: 500_000_000, description: 'Maximum depth allowed' },
];

const CREATE_FEE = 5_000_000; // $5.00 in micro-USDC

export default function CreateMarketPage() {
  const router = useRouter();
  const { wallet } = useWallet();
  const addToast = useUIStore((s) => s.addToast);

  const [step, setStep] = useState<Step>('statement');
  const [statement, setStatement] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [maxStake, setMaxStake] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  if (!wallet) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex justify-center items-center h-96">
          <p className="text-gray-400">Please connect your wallet to create a market</p>
        </div>
      </div>
    );
  }

  const durationConfig = duration
    ? DURATIONS.find((d) => d.value === duration)
    : null;
  const closesAt = duration ? new Date(Date.now() + duration * 1000) : null;

  const handleCreate = async () => {
    if (!statement || !duration || !maxStake) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/markets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statement,
          duration,
          max_stake: maxStake,
          creator: wallet.publicKey?.toBase58() || '',
          signature: 'pending', // Will be replaced by real Solana tx signature
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create market');

      setTxHash(data.data?.id || data.id);
      setStep('confirm');

      addToast({
        type: 'success',
        message: 'Market created successfully!',
        duration: 5000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: (error as Error).message || 'Failed to create market',
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between mb-4">
            {(['statement', 'duration', 'stake-cap', 'review', 'confirm'] as Step[]).map(
              (s, idx) => (
                <div
                  key={s}
                  className={`flex-1 h-1 mx-1 rounded-full transition-all ${
                    ['statement', 'duration', 'stake-cap', 'review', 'confirm'].indexOf(
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
            Step {['statement', 'duration', 'stake-cap', 'review', 'confirm'].indexOf(step) + 1} of 5
          </p>
        </div>

        {/* Card container */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 mb-8">
          <h2 className="text-3xl font-bold text-white mb-8">Create a Market</h2>

          {/* Step 1: Statement */}
          {step === 'statement' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Market Statement
                </label>
                <p className="text-xs text-gray-500 mb-4">
                  {statement.length}/280 characters
                </p>

                <textarea
                  value={statement}
                  onChange={(e) => setStatement(e.target.value.slice(0, 280))}
                  placeholder="What's your opinion question or statement?"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                  rows={5}
                />

                {statement.length === 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Examples: "Bitcoin will reach $100k by EOY 2025", "AI will be more
                    important than the internet by 2030"
                  </p>
                )}
              </div>

              <button
                onClick={() => setStep('duration')}
                disabled={statement.length < 10}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Duration */}
          {step === 'duration' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  How long should this market run?
                </label>

                <div className="grid grid-cols-2 gap-3">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setDuration(d.value)}
                      className={`p-4 rounded-lg font-medium transition-all ${
                        duration === d.value
                          ? 'bg-purple-500 text-white border-purple-500'
                          : 'bg-gray-700 text-gray-300 border border-gray-600 hover:border-purple-500'
                      }`}
                    >
                      {d.label}
                      <div className="text-xs opacity-75 mt-1">
                        {d.hours} hours
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('statement')}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('stake-cap')}
                  disabled={!duration}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Stake Cap */}
          {step === 'stake-cap' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  Maximum Stake Per Opinion/Reaction
                </label>
                <p className="text-xs text-gray-500 mb-6">
                  Set the cap that controls how much participants can stake on individual opinions.
                  Higher caps attract serious money and depth; lower caps keep the market casual and accessible.
                </p>

                <div className="space-y-2">
                  {STAKE_CAPS.map((cap) => (
                    <button
                      key={cap.value}
                      onClick={() => setMaxStake(cap.value)}
                      className={`w-full p-4 rounded-lg text-left transition-all border ${
                        maxStake === cap.value
                          ? 'bg-purple-500/20 border-purple-500 text-white'
                          : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:border-purple-500'
                      }`}
                    >
                      <div className="font-semibold">{cap.label}</div>
                      <div className="text-xs text-gray-400 mt-1">{cap.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('duration')}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('review')}
                  disabled={!maxStake}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  Review
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 'review' && (
            <div className="space-y-6">
              <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-6 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Statement</p>
                  <p className="text-lg text-white">{statement}</p>
                </div>

                <div className="border-t border-gray-600 pt-4">
                  <p className="text-xs text-gray-500 mb-2">Duration</p>
                  <p className="text-lg text-white">
                    {durationConfig?.label} ({durationConfig?.hours} hours)
                  </p>
                  {closesAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Closes: {formatDate(closesAt)}
                    </p>
                  )}
                </div>

                <div className="border-t border-gray-600 pt-4">
                  <p className="text-xs text-gray-500 mb-2">Maximum Stake Per Opinion</p>
                  <p className="text-lg text-white">
                    ${(maxStake ? maxStake / 1_000_000 : 0).toFixed(2)} USDC
                  </p>
                </div>

                <div className="border-t border-gray-600 pt-4">
                  <p className="text-xs text-gray-500 mb-2">Creation Fee</p>
                  <p className="text-lg font-bold text-white">$5.00 USDC</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('stake-cap')}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Market'}
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
                  Market Created!
                </h3>
                <p className="text-gray-400 mb-4">
                  Your market is now live. Users can start staking opinions.
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

              <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-6 text-left">
                <h4 className="font-semibold text-white mb-4">Your Market</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Statement:</span>
                    <span className="text-white">{statement}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Duration:</span>
                    <span className="text-white">
                      {durationConfig?.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Closes:</span>
                    <span className="text-white">
                      {closesAt && formatDate(closesAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => router.push('/')}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                >
                  Back to Markets
                </button>
                <button
                  onClick={() => router.push(`/markets/${txHash}`)}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  View Market
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
