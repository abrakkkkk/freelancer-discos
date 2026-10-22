"use client";

import { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const UndoContext = createContext();

export function UndoProvider({ children }) {
  const [undoState, setUndoState] = useState(null);
  const [isUndoing, setIsUndoing] = useState(false);

  /**
   * Registra uma ação que pode ser desfeita.
   * @param {string} tab - A tabela do supabase (ex: 'discos', 'dvds')
   * @param {Array} previousItemsArray - Array com os dados antigos dos itens antes da alteração
   * @param {Function} onUndoSuccess - Callback chamado quando o desfazer for concluído com sucesso
   */
  const registerUndo = useCallback((tab, previousItemsArray, onUndoSuccess = null, undoMovements = []) => {
    // Clona os dados para evitar referências mutáveis
    setUndoState({
      tab,
      itens: JSON.parse(JSON.stringify(previousItemsArray)),
      undoMovements: JSON.parse(JSON.stringify(undoMovements)),
      onUndoSuccess
    });
  }, []);

  const clearUndo = useCallback(() => {
    setUndoState(null);
  }, []);

  const performUndo = async () => {
    if (!undoState || isUndoing) return;
    setIsUndoing(true);
    try {
      const movementById = new Map(
        (undoState.undoMovements || []).map((movement) => [String(movement.itemId), movement.payload])
      );
      const operations = undoState.itens.map((item) => {
        const patch = Object.fromEntries(
          Object.entries(item).filter(([key, value]) =>
            !['id', 'created_at', 'criado_em', 'updated_at', 'atualizado_em'].includes(key) && value !== undefined
          )
        );
        if (!Object.prototype.hasOwnProperty.call(patch, 'deletado')) patch.deletado = false;

        const operation = { id: item.id, patch };
        const movement = movementById.get(String(item.id));
        if (movement) operation.movement = movement;
        return operation;
      });

      const { data, error } = await supabase.rpc('stock_write_transaction', {
        p_action: 'restore',
        p_category: undoState.tab,
        p_operations: operations,
      });
      if (error) throw error;
      if (data?.count !== operations.length) throw new Error('Nem todos os itens puderam ser restaurados.');
      
      if (undoState.onUndoSuccess) {
        try {
          await undoState.onUndoSuccess();
        } catch (e) {
          // Closure pode referenciar componente desmontado se o usuário navegou; ignorar
          console.warn("Callback de undo falhou (componente pode ter sido desmontado):", e);
        }
      }
      
      // Limpa após sucesso
      setUndoState(null);
      return { success: true };
    } catch (err) {
      console.error("Erro ao desfazer:", err);
      return { success: false, error: err };
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <UndoContext.Provider value={{
      hasUndo: !!undoState,
      isUndoing,
      registerUndo,
      clearUndo,
      performUndo
    }}>
      {children}
    </UndoContext.Provider>
  );
}

export function useUndo() {
  const context = useContext(UndoContext);
  if (!context) {
    throw new Error('useUndo must be used within an UndoProvider');
  }
  return context;
}
