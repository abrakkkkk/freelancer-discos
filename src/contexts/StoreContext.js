'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const StoreContext = createContext();

const STORAGE_KEY = 'freelancer-discos-loja-ativa';

export function StoreProvider({ children }) {
  const [activeStore, setActiveStore] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setActiveStore(saved);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, activeStore);
    }
  }, [activeStore, loaded]);

  return (
    <StoreContext.Provider value={{ activeStore, setActiveStore }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore deve ser usado dentro de StoreProvider');
  return context;
}
