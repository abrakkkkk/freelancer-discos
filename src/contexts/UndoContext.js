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
  const registerUndo = useCallback((tab, previousItemsArray, onUndoSuccess = null) => {
    // Clona os dados para evitar referências mutáveis
    setUndoState({
      tab,
      itens: JSON.parse(JSON.stringify(previousItemsArray)),
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
      const promises = undoState.itens.map(item => {
        const updateData = {
          titulo: item.titulo,
          preco: item.preco,
          ativo: item.ativo,
          deletado: item.deletado ?? false,
          quantidade: item.quantidade,
          loja: item.loja,
          caixa: item.caixa,
          artista: item.artista
        };
        // Remove undefined properties that might not exist in some items (like artista for DVDs)
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
        
        return supabase.from(undoState.tab).update(updateData).eq('id', item.id);
      });
      
      await Promise.all(promises);
      
      if (undoState.onUndoSuccess) {
        try {
          undoState.onUndoSuccess();
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
