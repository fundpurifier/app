import { useState, useEffect } from 'react';

// Function to check if code is running on the server
const isServer = typeof window === 'undefined';

// The main hook function
export function useLocalState<T>(key: string, initialValue: T) {
    // Initialize state variable with initial value or fallback to initial value
    const [state, setState] = useState<T>(() => {
        if (isServer) return initialValue;

        const storedValue = localStorage.getItem(key);
        return storedValue !== null ? JSON.parse(storedValue) : initialValue;
    });

    // Side-effect to save to localStorage whenever the state changes
    useEffect(() => {
        if (!isServer) {
            localStorage.setItem(key, JSON.stringify(state));
        }
    }, [key, state]);

    return [state, setState] as const;
}