'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MdCurrencyExchange } from "react-icons/md";

export default function SaidaDeDiscos() {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [qtdSaida, setQtdSaida] = useState(1);
  const [observacao, setObservacao] = useState('');
  const [mensagem, setMensagem] = useState(null);

  async function buscar() {
    if (!termo) return;
    const { data } = await supabase
      .from('discos')
      .select('id, caixa, artista, titulo, quantidade, preco')
      .or(`artista.ilike.%${termo}%,titulo.ilike.%${termo}%`)
      .order('artista')
      .limit(50);
    
    setResultados(data || []);
    setSelecionado(null);
    setMensagem(null);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') buscar();
  }

  async function confirmarSaida() {
    if (!selecionado) return;
    setMensagem(null);

    if (qtdSaida > selecionado.quantidade) {
      setMensagem({ tipo: 'error', texto: 'Quantidade maior que o estoque disponível.' });
      return;
    }

    const { error: errUpdate } = await supabase
      .from('discos')
      .update({ quantidade: selecionado.quantidade - qtdSaida })
      .eq('id', selecionado.id);

    if (errUpdate) {
      setMensagem({ tipo: 'error', texto: errUpdate.message });
      return;
    }

    await supabase.from('movimentacoes').insert({
      disco_id: selecionado.id,
      tipo: 'saida',
      quantidade: qtdSaida,
      observacao: observacao || null,
    });

    setMensagem({ tipo: 'success', texto: 'Saída registrada com sucesso!' });
    setSelecionado(null);
    setQtdSaida(1);
    setObservacao('');
    buscar(); // refresh list
  }

  return (
    <div>
      <div className="page-header">
        <MdCurrencyExchange size={28} color="var(--accent)" />
        <h1 className="page-title">Registrar Saída</h1>
      </div>

      {mensagem && (
        <div className={`alert alert-${mensagem.tipo}`}>{mensagem.texto}</div>
      )}

      <div className="filters">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Buscar disco por artista ou título</label>
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite e aperte Enter..."
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={buscar}>Buscar</button>
      </div>

      {resultados.length > 0 && (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Caixa</th>
                <th>Artista</th>
                <th>Título</th>
                <th>Estoque</th>
                <th>Preço</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((d) => (
                <tr key={d.id}>
                  <td data-label="Caixa">{d.caixa}</td>
                  <td data-label="Artista">{d.artista}</td>
                  <td data-label="Título">{d.titulo}</td>
                  <td data-label="Estoque">{d.quantidade}</td>
                  <td data-label="Preço">R$ {Number(d.preco || 0).toFixed(2)}</td>
                  <td data-label="Ação">
                    <button
                      className="btn btn-primary"
                      onClick={() => { setSelecionado(d); setQtdSaida(1); setObservacao(''); }}
                    >
                      Selecionar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resultados.length > 0 && resultados.length === 0 && (
        <div className="empty-state">Nenhum disco encontrado.</div>
      )}

      {selecionado && (
        <div style={{ marginTop: '24px' }}>
          <div className="summary-box">
            <strong>Disco selecionado:</strong> [{`Cx ${selecionado.caixa}`}] {selecionado.artista} — {selecionado.titulo}
            <br />
            <strong>Estoque atual:</strong> {selecionado.quantidade} | <strong>Preço unitário:</strong> R$ {Number(selecionado.preco || 0).toFixed(2)}
          </div>

          <div className="form-row" style={{ maxWidth: '500px' }}>
            <div className="form-group">
              <label>Quantidade a retirar</label>
              <input
                type="number"
                min="1"
                max={selecionado.quantidade}
                value={qtdSaida}
                onChange={(e) => setQtdSaida(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label>Observação (opcional)</label>
              <input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="ex: venda balcão, troca, dano"
              />
            </div>
          </div>

          <div className="summary-box">
            <strong>Resumo:</strong> {qtdSaida}x a R$ {Number(selecionado.preco || 0).toFixed(2)} = R$ {(qtdSaida * Number(selecionado.preco || 0)).toFixed(2)} | Estoque após saída: {selecionado.quantidade - qtdSaida}
          </div>

          <button className="btn btn-primary" onClick={confirmarSaida}>Confirmar Saída</button>
        </div>
      )}
    </div>
  );
}
