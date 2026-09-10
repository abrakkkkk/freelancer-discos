'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';

const STORAGE_KEY = 'freelancer_tarefas_reposicao';

const ReposicaoContext = createContext({
  tarefas: [],
  totalPendentes: 0,
  adicionarTarefa: () => {},
  removerTarefa: () => {},
  executarReposicao: async () => {},
  limparTodas: () => {},
});

export function ReposicaoProvider({ children }) {
  const [tarefas, setTarefas] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Carrega do localStorage no mount
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      if (salvo) {
        const parsed = JSON.parse(salvo);
        if (Array.isArray(parsed)) {
          setTarefas(parsed);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar tarefas de reposição:', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Salva no localStorage quando alterado
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tarefas));
    } catch (e) {
      console.warn('Erro ao salvar tarefas de reposição:', e);
    }
  }, [tarefas, isLoaded]);

  const adicionarTarefa = useCallback(({ itemSaida, reserva, totalReservas = 1, categoria = 'discos' }) => {
    if (!itemSaida || !reserva) return;

    setTarefas(prev => {
      // Evita duplicatas da mesma sugestão de reserva
      const jaExiste = prev.some(t => t.reserva?.id === reserva.id && t.categoria === categoria);
      if (jaExiste) return prev;

      const novaTarefa = {
        id: `${categoria}_${reserva.id}`,
        categoria,
        itemSaida: {
          id: itemSaida.id,
          titulo: itemSaida.titulo,
          artista: itemSaida.artista || '',
          caixa: itemSaida.caixa || '',
          loja: itemSaida.loja || '',
          preco: itemSaida.preco,
        },
        reserva: {
          id: reserva.id,
          titulo: reserva.titulo,
          artista: reserva.artista || '',
          caixa: reserva.caixa || '',
          loja: reserva.loja || '',
          preco: reserva.preco,
        },
        totalReservas,
        criadoEm: Date.now(),
      };

      return [novaTarefa, ...prev];
    });
  }, []);

  const removerTarefa = useCallback((id) => {
    setTarefas(prev => prev.filter(t => t.id !== id && `${t.categoria}_${t.reserva?.id}` !== id));
  }, []);

  const limparTodas = useCallback(() => {
    setTarefas([]);
  }, []);

  const executarReposicao = useCallback(async (id) => {
    const tarefa = tarefas.find(t => t.id === id);
    if (!tarefa) throw new Error('Tarefa de reposição não encontrada.');

    const { categoria, reserva, itemSaida } = tarefa;

    // 1. Promover item reserva no banco
    await itemService.promoteReplacement(
      categoria,
      reserva.id,
      itemSaida.caixa,
      itemSaida.loja
    );

    // 2. Registrar movimentação de entrada
    const destinoLocal = itemSaida.caixa ? `Caixa ${itemSaida.caixa}` : 'Balcão';
    const movData = movimentacaoService.createMovementPayload(
      categoria,
      reserva.id,
      'entrada',
      1,
      `Reposição do Estoque Superior para ${destinoLocal}`
    );
    await movimentacaoService.registerMovement(movData);

    // 3. Remover tarefa cumprida
    setTarefas(prev => prev.filter(t => t.id !== id));

    return {
      success: true,
      titulo: reserva.titulo,
      caixa: itemSaida.caixa,
    };
  }, [tarefas]);

  return (
    <ReposicaoContext.Provider
      value={{
        tarefas,
        totalPendentes: tarefas.length,
        adicionarTarefa,
        removerTarefa,
        executarReposicao,
        limparTodas,
      }}
    >
      {children}
    </ReposicaoContext.Provider>
  );
}

export function useReposicao() {
  return useContext(ReposicaoContext);
}
