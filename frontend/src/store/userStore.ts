import { create } from 'zustand';

export interface Position {
  id: string;
  market_id: string;
  stake_amount: number;
  prize_amount: number | null;
  market_state: string;
  created_at: string;
  settled_at: string | null;
}

export interface Portfolio {
  total_staked: number;
  total_prize_won: number;
  positions_count: number;
  win_count: number;
  win_rate: number;
}

interface UserStore {
  // Auth
  wallet: string | null;
  isConnected: boolean;

  // Portfolio
  portfolio: Portfolio | null;
  positions: Position[];

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  setWallet: (wallet: string | null) => void;
  setConnected: (connected: boolean) => void;
  setPortfolio: (portfolio: Portfolio | null) => void;
  setPositions: (positions: Position[]) => void;
  addPosition: (position: Position) => void;
  updatePosition: (id: string, updates: Partial<Position>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  refreshPortfolio: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  wallet: null,
  isConnected: false,
  portfolio: null,
  positions: [],
  isLoading: false,
  error: null,
};

export const useUserStore = create<UserStore>((set, get) => ({
  ...initialState,

  setWallet: (wallet) => set({ wallet }),

  setConnected: (connected) => set({ isConnected: connected }),

  setPortfolio: (portfolio) => set({ portfolio }),

  setPositions: (positions) => set({ positions }),

  addPosition: (position) =>
    set((state) => ({
      positions: [position, ...state.positions],
      portfolio: state.portfolio
        ? {
            ...state.portfolio,
            positions_count: state.portfolio.positions_count + 1,
            total_staked: state.portfolio.total_staked + position.stake_amount,
          }
        : null,
    })),

  updatePosition: (id, updates) =>
    set((state) => ({
      positions: state.positions.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  refreshPortfolio: async () => {
    const { wallet } = get();
    if (!wallet) return;

    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/user/${wallet}`
      );
      if (!response.ok) throw new Error('Failed to fetch portfolio');

      const data = await response.json();
      set({
        portfolio: {
          total_staked: data.totalStaked || 0,
          total_prize_won: data.totalWon || 0,
          positions_count: data.positions?.length || 0,
          win_count: data.wins || 0,
          win_rate: data.winRate || 0,
        },
        positions: data.positions || [],
      });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  reset: () => set(initialState),
}));
