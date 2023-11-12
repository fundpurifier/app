'use client';

import { create } from 'zustand';

interface Store {
    isOpen: boolean;
    open: () => void;
    close: () => void;
}

export const useFundSettingsModal = create<Store>((set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
}));
