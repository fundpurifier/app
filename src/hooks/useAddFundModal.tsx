'use client';

import { FormSchema } from '@/components/AddFundModal/FundSettingsStep';
import { create } from 'zustand';

type Settings = Partial<FormSchema & {
    symbol: string;
}>

interface Store {
    isOpen: boolean;
    step: number;
    settings: Settings;
    portfolioId?: string;
    busy: boolean;

    setBusy: (busy: boolean) => void;
    setSettings: (settings: Settings) => void;
    setPortfolioId: (portfolioId: string) => void;
    open: () => void;
    close: () => void;
    forward: () => void;
}

export const useAddFundModal = create<Store>((set) => ({
    isOpen: false,
    step: 0,
    settings: {},
    busy: false,

    setBusy: (busy: boolean) => set({ busy }),
    setSettings: (settings: Settings) => set({ settings }),
    setPortfolioId: (portfolioId: string) => set({ portfolioId }),
    open: () => set({ step: 0, isOpen: true }),
    close: () => set({ isOpen: false, step: 0, settings: {} }),
    forward: () => set((state) => ({ step: state.step + 1 })),
}));
