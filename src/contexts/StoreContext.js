'use client';

import { createContext, useContext, useState } from 'react';

const StoreContext = createContext();

const STORAGE_KEY = 'freelancer-discos-loja-ativa';

export function StoreProvider({ children }) {
  const [activeStore, setActiveStoreState] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(STORAGE_KEY) || '';
      } catch (e) {
        return '';
      }
    }
    return '';
  });

  const setActiveStore = (store) => {
    setActiveStoreState(store);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, store);
      } catch (e) {}
    }
  };

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
