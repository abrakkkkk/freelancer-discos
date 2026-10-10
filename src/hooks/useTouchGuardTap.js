'use client';

import { useRef } from 'react';

/**
 * Hook para detectar toque (tap) em cards mobile com proteção de rolagem (scroll guard).
 * Se o usuário mover o dedo mais de 8px (gesto de scroll), a seleção é cancelada.
 * Também gerencia clicks no desktop e previne duplo disparo por eventos sintéticos.
 */
export function useTouchGuardTap(onTap) {
  const stateRef = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    isScrolling: false,
    ignore: false,
    lastTapTime: 0,
  });

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) {
      stateRef.current.ignore = true;
      return;
    }

    // Se o toque iniciou dentro de um botão, link, input ou ação interativa, ignora
    if (e.target.closest('button, a, input, select, textarea, .actionBtnRow, .iconBtn')) {
      stateRef.current.ignore = true;
      return;
    }

    const touch = e.touches[0];
    stateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isScrolling: false,
      ignore: false,
      lastTapTime: stateRef.current.lastTapTime || 0,
    };
  };

  const onTouchMove = (e) => {
    if (stateRef.current.ignore || stateRef.current.isScrolling) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - stateRef.current.startX);
    const deltaY = Math.abs(touch.clientY - stateRef.current.startY);

    // Se o dedo mover mais de 8px em qualquer direção, é rolagem de tela e NÃO tap
    if (deltaX > 8 || deltaY > 8) {
      stateRef.current.isScrolling = true;
    }
  };

  const onTouchEnd = (e) => {
    if (stateRef.current.ignore) {
      stateRef.current.ignore = false;
      return;
    }

    // Apenas aciona se não foi rolagem e se a duração do toque for curta (< 450ms)
    if (!stateRef.current.isScrolling) {
      const elapsed = Date.now() - stateRef.current.startTime;
      if (elapsed < 450) {
        stateRef.current.lastTapTime = Date.now();
        if (onTap) onTap(e);
      }
    }

    stateRef.current.isScrolling = false;
  };

  const onClick = (e) => {
    // Se o clique veio de botão, link ou input, deixa o elemento filho tratar
    if (e.target.closest('button, a, input, select, textarea, .actionBtnRow, .iconBtn')) {
      return;
    }

    // Previne que o clique sintético do browser dispare logo após o touchend
    if (Date.now() - stateRef.current.lastTapTime < 450) {
      return;
    }

    if (onTap) onTap(e);
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onClick,
  };
}
