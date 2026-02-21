import html2canvas from 'html2canvas';
import { Market } from '@/store/marketStore';

/**
 * Generate a shareable market card image
 * Creates an HTML element, renders it to canvas, returns blob URL
 */
export async function generateMarketCard(market: Market): Promise<string> {
  // Create a hidden container for the card
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '1200px';
  container.style.height = '630px';
  container.style.backgroundColor = '#0f172a';
  container.style.fontFamily = 'Inter, sans-serif';

  // Card HTML
  container.innerHTML = `
    <div style="
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 60px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border: 2px solid rgba(147, 112, 219, 0.2);
    ">
      <!-- Header -->
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 40px;">
        <div style="
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #3b82f6 0%, #a855f7 100%);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: bold;
          color: white;
        ">Ω</div>
        <div>
          <div style="font-size: 32px; font-weight: bold; color: white;">Opinion Markets</div>
          <div style="font-size: 14px; color: #cbd5e1;">Decentralized Prediction Platform</div>
        </div>
      </div>

      <!-- Content -->
      <div>
        <!-- Statement -->
        <div style="
          font-size: 36px;
          font-weight: bold;
          color: white;
          margin-bottom: 40px;
          line-height: 1.3;
          max-height: 150px;
          overflow: hidden;
        ">
          "${market.statement}"
        </div>

        <!-- Stats Grid -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; margin-bottom: 40px;">
          <div>
            <div style="font-size: 14px; color: #94a3b8; margin-bottom: 8px;">Total Stake</div>
            <div style="font-size: 28px; font-weight: bold; color: white;">$${(market.total_stake / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          </div>
          <div>
            <div style="font-size: 14px; color: #94a3b8; margin-bottom: 8px;">Stakers</div>
            <div style="font-size: 28px; font-weight: bold; color: white;">${market.staker_count}</div>
          </div>
          <div>
            <div style="font-size: 14px; color: #94a3b8; margin-bottom: 8px;">Status</div>
            <div style="
              font-size: 14px;
              font-weight: bold;
              padding: 8px 16px;
              background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
              color: white;
              border-radius: 6px;
              width: fit-content;
            ">${market.state}</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid rgba(148, 163, 184, 0.2);
        padding-top: 24px;
        font-size: 14px;
        color: #94a3b8;
      ">
        <div>Stake your opinion. Earn rewards based on accuracy.</div>
        <div>opinion-markets.io</div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      width: 1200,
      height: 630,
      scale: 2,
      backgroundColor: '#0f172a',
      logging: false,
    });

    return canvas.toDataURL('image/png');
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Generate a results card (winner announcement)
 */
export async function generateResultsCard(
  market: Market,
  userPrize: number | null
): Promise<string> {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '1200px';
  container.style.height = '630px';

  const hasWon = userPrize && userPrize > 0;

  container.innerHTML = `
    <div style="
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 60px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border: 2px solid rgba(${hasWon ? '34, 197, 94' : '239, 68, 68'}, 0.3);
      text-align: center;
    ">
      <div style="font-size: 24px; color: #94a3b8; margin-bottom: 16px;">Market Settled</div>

      <div style="
        font-size: 48px;
        font-weight: bold;
        color: ${hasWon ? '#22c55e' : '#f87171'};
        margin-bottom: 24px;
      ">
        ${hasWon ? '🎉 You Won! 🎉' : 'Market Closed'}
      </div>

      <div style="
        font-size: 32px;
        color: white;
        margin-bottom: 32px;
        max-width: 800px;
        line-height: 1.4;
      ">
        "${market.statement}"
      </div>

      ${
        hasWon
          ? `
        <div style="
          background: rgba(34, 197, 94, 0.1);
          border: 2px solid #22c55e;
          border-radius: 12px;
          padding: 32px;
          margin-bottom: 32px;
        ">
          <div style="font-size: 16px; color: #86efac; margin-bottom: 8px;">Prize Won</div>
          <div style="font-size: 48px; font-weight: bold; color: #22c55e;">
            $${(userPrize / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </div>
        </div>
      `
          : `
        <div style="
          background: rgba(239, 68, 68, 0.1);
          border: 2px solid #ef4444;
          border-radius: 12px;
          padding: 32px;
          margin-bottom: 32px;
        ">
          <div style="font-size: 16px; color: #fca5a5;">Final Sentiment Score</div>
          <div style="font-size: 48px; font-weight: bold; color: #ef4444;">
            ${market.sentiment_score}/100
          </div>
        </div>
      `
      }

      <div style="
        display: flex;
        gap: 32px;
        font-size: 14px;
        color: #94a3b8;
        border-top: 1px solid rgba(148, 163, 184, 0.2);
        padding-top: 24px;
        width: 100%;
        justify-content: center;
      ">
        <div>Check your earnings on opinion-markets.io</div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      width: 1200,
      height: 630,
      scale: 2,
      backgroundColor: '#0f172a',
      logging: false,
    });

    return canvas.toDataURL('image/png');
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Download card image
 */
export async function downloadCard(
  dataUrl: string,
  filename: string
): Promise<void> {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Share to Twitter
 */
export function shareToTwitter(market: Market, imageUrl: string): void {
  const text = `I'm staking on: "${market.statement.substring(0, 80)}..."`;
  const twitterUrl = new URL('https://twitter.com/intent/tweet');
  twitterUrl.searchParams.set('text', text);
  twitterUrl.searchParams.set('url', `${window.location.origin}/markets/${market.id}`);
  twitterUrl.searchParams.set('via', 'OpinionMarkets');

  window.open(twitterUrl.toString(), '_blank', 'width=550,height=420');
}
