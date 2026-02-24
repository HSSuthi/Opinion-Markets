import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '@solana/wallet-adapter-react';
import { Header } from '@/components/Layout/Header';
import { useUIStore } from '@/store/uiStore';
import { formatDate } from '@/lib/utils/formatting';
import { useOpinionMarket, getExplorerTxUrl, OpinionMarketError } from '@/lib/anchor';
import { PROGRAM_CONSTANTS } from '@/lib/anchor/program';
import { getUsdcFaucetUrl } from '@/lib/anchor/config';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Step = 'statement' | 'duration' | 'review' | 'confirm';

const DURATIONS = [
  { label: '24 Hours', value: 86400, hours: 24 },
  { label: '3 Days', value: 259200, hours: 72 },
  { label: '7 Days', value: 604800, hours: 168 },
  { label: '14 Days', value: 1209600, hours: 336 },
];

export default function CreateMarketPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const addToast = useUIStore((s) => s.addToast);
  const { client, ready, getBalance, faucetUrl } = useOpinionMarket();

  const [step, setStep] = useState<Step>('statement');
  const [statement, setStatement] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [marketId, setMarketId] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);

  // Fetch USDC balance when wallet connects
  useEffect(() => {
    if (ready && publicKey) {
      getBalance().then(setUsdcBalance).catch(() => setUsdcBalance(0));
    }
  }, [ready, publicKey]);

  if (!publicKey) {
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
  const hasEnoughUsdc = usdcBalance !== null && usdcBalance >= PROGRAM_CONSTANTS.CREATE_FEE;

  const handleCreate = async () => {
    if (!statement || !duration || !client) return;

    setIsSubmitting(true);
    try {
      // Send the real on-chain transaction
      const result = await client.createMarket(statement, duration);

      setTxSignature(result.signature);

      // Record the market in the API with the real tx signature
      try {
        const res = await fetch(`${API_URL}/markets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            statement,
            duration,
            creator: publicKey.toBase58(),
            signature: result.signature,
            market_pda: result.marketPda.toBase58(),
            uuid: Buffer.from(result.uuid).toString('hex'),
          }),
        });

        const data = await res.json();
        if (data?.data?.id) {
          setMarketId(data.data.id);
        }
      } catch {
        // API recording is secondary — the on-chain tx is the source of truth
        console.warn('Failed to record market in API, but on-chain tx succeeded');
      }

      setStep('confirm');
      addToast({
        type: 'success',
        message: 'Market created on-chain!',
        duration: 5000,
      });
    } catch (error) {
      const msg =
        error instanceof OpinionMarketError
          ? error.message
          : (error as Error).message || 'Failed to create market';
      addToast({ type: 'error', message: msg, duration: 7000 });
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
            {(['statement', 'duration', 'review', 'confirm'] as Step[]).map(
              (s, idx) => (
                <div
                  key={s}
                  className={`flex-1 h-1 mx-1 rounded-full transition-all ${
                    ['statement', 'duration', 'review', 'confirm'].indexOf(
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
            Step {['statement', 'duration', 'review', 'confirm'].indexOf(step) + 1} of 4
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
                  onClick={() => setStep('review')}
                  disabled={!duration}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  Review
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
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
                  <p className="text-xs text-gray-500 mb-2">Creation Fee</p>
                  <p className="text-lg font-bold text-white">$5.00 USDC</p>
                  {usdcBalance !== null && (
                    <p className="text-xs text-gray-400 mt-1">
                      Your balance: ${(usdcBalance / 1_000_000).toFixed(2)} USDC
                    </p>
                  )}
                </div>
              </div>

              {/* Insufficient USDC warning */}
              {usdcBalance !== null && !hasEnoughUsdc && (
                <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-4">
                  <p className="text-sm text-red-300 mb-2">
                    Insufficient USDC balance. You need at least $5.00 USDC to create a market.
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
                  onClick={() => setStep('duration')}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isSubmitting || !ready || !hasEnoughUsdc}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating on-chain...' : 'Create Market ($5 USDC)'}
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
                  Market Created On-Chain!
                </h3>
                <p className="text-gray-400 mb-4">
                  Your market is now live on Solana. Users can start staking opinions.
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
                  onClick={() => router.push(marketId ? `/markets/${marketId}` : '/')}
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
