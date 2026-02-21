/**
 * Format micro-USDC to human-readable USDC
 * USDC has 6 decimal places, so 1,000,000 micro-USDC = $1.00
 */
export function formatUSDC(microAmount: number): string {
  const usdc = microAmount / 1_000_000;
  return `$${usdc.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format micro-USDC to compact notation (e.g., $1.2M)
 */
export function formatUSDCCompact(microAmount: number): string {
  const usdc = microAmount / 1_000_000;

  if (usdc >= 1_000_000) {
    return `$${(usdc / 1_000_000).toFixed(1)}M`;
  }
  if (usdc >= 1_000) {
    return `$${(usdc / 1_000).toFixed(1)}K`;
  }
  return formatUSDC(microAmount);
}

/**
 * Parse USDC string to micro-USDC
 */
export function parseUSDC(usdcString: string): number {
  const num = parseFloat(usdcString.replace('$', '').replace(',', ''));
  return Math.round(num * 1_000_000);
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number, decimals = 0): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Truncate wallet address
 */
export function truncateAddress(address: string, length = 6): string {
  if (!address) return '';
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

/**
 * Format timestamp to readable date
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate time remaining from now until a future date
 */
export function getTimeRemaining(endDate: string | Date): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
} {
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const now = new Date();
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isExpired: true,
    };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / 1000 / 60) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    totalSeconds: Math.floor(diff / 1000),
    isExpired: false,
  };
}

/**
 * Format time remaining for display
 */
export function formatTimeRemaining(endDate: string | Date): string {
  const time = getTimeRemaining(endDate);

  if (time.isExpired) {
    return 'Expired';
  }

  if (time.days > 0) {
    return `${time.days}d ${time.hours}h`;
  }
  if (time.hours > 0) {
    return `${time.hours}h ${time.minutes}m`;
  }
  return `${time.minutes}m`;
}
