import { create } from 'zustand';

export interface Market {
  id: string;
  uuid: string;
  creator_address: string;
  statement: string;
  created_at: string;
  closes_at: string;
  state: 'Active' | 'Closed' | 'Scored' | 'AwaitingRandomness' | 'Settled';
  total_stake: number;
  staker_count: number;
  sentiment_score: number | null;
  sentiment_confidence: number | null; // 0=low, 1=medium, 2=high — matches entity field name
  summary_hash?: string;
  crowd_score: number | null; // Volume-weighted mean of all agreement predictions
  distributable_pool?: number; // Total stake minus protocol fee (set at finalize_settlement)
  winner?: string;
  updated_at: string;
}

export interface MarketFilter {
  state?: 'Active' | 'Closed' | 'Scored' | 'Settled';
  sortBy?: 'closesAt' | 'createdAt' | 'totalStake';
  sortOrder?: 'asc' | 'desc';
  searchTerm?: string;
}

interface MarketStore {
  // Data
  markets: Market[];
  selectedMarket: Market | null;

  // Pagination
  page: number;
  limit: number;
  hasMore: boolean;

  // Filtering
  filters: MarketFilter;

  // Loading states
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;

  // Actions
  setMarkets: (markets: Market[]) => void;
  addMarkets: (markets: Market[]) => void;
  setSelectedMarket: (market: Market | null) => void;
  updateMarket: (id: string, updates: Partial<Market>) => void;
  setFilters: (filters: MarketFilter) => void;
  setLoading: (loading: boolean) => void;
  setFetching: (fetching: boolean) => void;
  setError: (error: string | null) => void;
  setPage: (page: number) => void;
  setHasMore: (hasMore: boolean) => void;
  reset: () => void;
}

const initialState = {
  markets: [],
  selectedMarket: null,
  page: 0,
  limit: 20,
  hasMore: true,
  filters: {
    state: 'Active',
    sortBy: 'closesAt',
    sortOrder: 'asc',
    searchTerm: '',
  },
  isLoading: false,
  isFetching: false,
  error: null,
};

export const useMarketStore = create<MarketStore>((set) => ({
  ...initialState,

  setMarkets: (markets) => set({ markets }),

  addMarkets: (newMarkets) =>
    set((state) => ({
      markets: [...state.markets, ...newMarkets],
    })),

  setSelectedMarket: (market) => set({ selectedMarket: market }),

  updateMarket: (id, updates) =>
    set((state) => ({
      markets: state.markets.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
      selectedMarket:
        state.selectedMarket?.id === id
          ? { ...state.selectedMarket, ...updates }
          : state.selectedMarket,
    })),

  setFilters: (filters) =>
    set({
      filters,
      page: 0, // Reset to first page when filters change
      markets: [], // Clear markets when filters change
    }),

  setLoading: (loading) => set({ isLoading: loading }),
  setFetching: (fetching) => set({ isFetching: fetching }),
  setError: (error) => set({ error }),
  setPage: (page) => set({ page }),
  setHasMore: (hasMore) => set({ hasMore }),

  reset: () => set(initialState),
}));
