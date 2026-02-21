import { create } from 'zustand';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

interface UIStore {
  // Modals
  modals: {
    shareOpen: boolean;
    confirmStakeOpen: boolean;
    errorOpen: boolean;
    walletOpen: boolean;
  };

  // Toasts
  toasts: Toast[];

  // Loading states
  isProcessing: boolean;

  // Modal Actions
  openModal: (modal: keyof UIStore['modals']) => void;
  closeModal: (modal: keyof UIStore['modals']) => void;
  closeAllModals: () => void;

  // Toast Actions
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  // Processing state
  setProcessing: (processing: boolean) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  modals: {
    shareOpen: false,
    confirmStakeOpen: false,
    errorOpen: false,
    walletOpen: false,
  },
  toasts: [],
  isProcessing: false,
};

export const useUIStore = create<UIStore>((set) => ({
  ...initialState,

  openModal: (modal) =>
    set((state) => ({
      modals: { ...state.modals, [modal]: true },
    })),

  closeModal: (modal) =>
    set((state) => ({
      modals: { ...state.modals, [modal]: false },
    })),

  closeAllModals: () =>
    set({
      modals: {
        shareOpen: false,
        confirmStakeOpen: false,
        errorOpen: false,
        walletOpen: false,
      },
    }),

  addToast: (toast) =>
    set((state) => {
      const id = `toast-${Date.now()}`;
      return {
        toasts: [...state.toasts, { ...toast, id }],
      };
    }),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearToasts: () => set({ toasts: [] }),

  setProcessing: (processing) => set({ isProcessing: processing }),

  reset: () => set(initialState),
}));
