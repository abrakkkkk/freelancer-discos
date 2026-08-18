'use client';

import { useEffect } from 'react';

export function useMobileLeaveConfirm(shouldConfirm = true) {
  useEffect(() => {
    if (!shouldConfirm) return;

    const handleBeforeUnload = (e) => {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        e.returnValue = ''; 
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Push a dummy state to history so we can intercept the back button
    window.history.pushState(null, '', window.location.href);
    
    const handlePopState = (e) => {
      if (window.innerWidth <= 768) {
        const confirmed = window.confirm("Você tem certeza que quer sair dessa página?");
        if (!confirmed) {
          window.history.pushState(null, '', window.location.href);
        } else {
          window.history.back();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [shouldConfirm]);
}
