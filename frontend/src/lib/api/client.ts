import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let apiClient: AxiosInstance;

export function initializeApiClient() {
  apiClient = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Response interceptor for error handling
  apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        // Handle unauthorized
        window.location.href = '/';
      }
      return Promise.reject(error);
    }
  );

  return apiClient;
}

export function getApiClient() {
  if (!apiClient) {
    initializeApiClient();
  }
  return apiClient;
}

// API Methods
export const api = {
  markets: {
    list: async (params?: {
      limit?: number;
      offset?: number;
      state?: string;
      sortBy?: string;
    }) => {
      const { data } = await getApiClient().get('/markets', { params });
      return data;
    },

    get: async (id: string) => {
      const { data } = await getApiClient().get(`/markets/${id}`);
      return data;
    },

    create: async (payload: {
      statement: string;
      duration: number;
      signature: string;
      wallet: string;
    }) => {
      const { data } = await getApiClient().post('/markets', payload);
      return data;
    },
  },

  opinions: {
    list: async (marketId: string) => {
      const { data } = await getApiClient().get(
        `/markets/${marketId}/opinions`
      );
      return data;
    },

    create: async (
      marketId: string,
      payload: {
        amount: number;
        opinion_text: string;
        signature: string;
        wallet: string;
      }
    ) => {
      const { data } = await getApiClient().post(
        `/markets/${marketId}/opinions`,
        payload
      );
      return data;
    },
  },

  user: {
    portfolio: async (wallet: string) => {
      const { data } = await getApiClient().get(`/user/${wallet}`);
      return data;
    },

    positions: async (wallet: string) => {
      const { data } = await getApiClient().get(`/user/${wallet}/positions`);
      return data;
    },
  },

  sentiment: {
    history: async () => {
      const { data } = await getApiClient().get('/sentiment/history');
      return data;
    },

    topicSearch: async (query: string) => {
      const { data } = await getApiClient().get('/sentiment/topic', {
        params: { q: query },
      });
      return data;
    },
  },
};
