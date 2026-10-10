'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { PiVinylRecord, PiDisc, PiFilmStrip, PiCassetteTape } from "react-icons/pi";
import { MdDownload } from "react-icons/md";
import { FiSearch } from "react-icons/fi";
import { IoCamera, IoClose } from "react-icons/io5";

const CoverScannerModal = dynamic(() => import('@/components/CoverScannerModal'), { ssr: false });
import { useCatalog } from '@/hooks/useCatalog';
import { useCaixas } from '@/hooks/useCaixas';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import CategoryTabs from '@/components/CategoryTabs';
import CatalogTable from '@/components/CatalogTable';
import { PAGINATION, CATEGORY_IDS, STORE_OPTIONS } from '@/constants/config';
import { useUndo } from '@/contexts/UndoContext';
import { useStore } from '@/contexts/StoreContext';


import ConfirmModal from '@/components/ConfirmModal';
import ReposicaoModal from '@/components/ReposicaoModal';
import AlertMessage from '@/components/AlertMessage';
import { useReposicao } from '@/contexts/ReposicaoContext';

export default function CatalogoClone() {
  const catalog = useCatalog(CATEGORY_IDS.DISCOS);
  const { activeStore } = useStore();
  const { caixas } = useCaixas(catalog.filtroLoja || activeStore);
  const [exportando, setExportando] = useState(false);
  const [itemParaExcluir, setItemParaExcluir] = useState(null);
  const [isExcluindo, setIsExcluindo] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [reposicaoData, setReposicaoData] = useState(null);
  const [isRepondo, setIsRepondo] = useState(false);
  const [isCoverScannerOpen, setIsCoverScannerOpen] = useState(false);
  const [itensSelecionados, setItensSelecionados] = useState([]);
  const [isBaixandoLote, setIsBaixandoLote] = useState(false);
  const [showConfirmBaixaLote, setShowConfirmBaixaLote] = useState(false);

  const { registerUndo } = useUndo();
  const { adicionarTarefa, removerTarefa } = useReposicao();

  const handleCoverRecognized = ({ artista, titulo }) => {
    if (!artista && !titulo) return;
    // Para coletâneas / Various, pesquisar diretamente pelo título da obra para maior precisão no acervo local
    let query = '';
    const isVarious = !artista || /^(various|v[aá]rios(\s+artistas)?|trilha\s+sonora)$/i.test(artista);
    if (isVarious) {
      query = (titulo || artista || '').trim();
    } else {
      query = `${artista} ${titulo || ''}`.trim();
    }
    catalog.setBusca(query);
    catalog.setPagina(1);
    setFeedbackMsg({
      tipo: 'success',
      texto: `Capa identificada: "${[artista, titulo].filter(Boolean).join(' - ')}". Exibindo resultados do estoque.`
    });
  };

  // Auto-dismiss para alertas de feedback (desocupa espaço do viewport mobile após 5 segundos)
  useEffect(() => {
    if (!feedbackMsg) return;
    const timer = setTimeout(() => {
      setFeedbackMsg(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [feedbackMsg]);

  // Limpa avisos residuais e seleção ao trocar de aba de categoria
  useEffect(() => {
    setFeedbackMsg(null);
    setItensSelecionados([]);
  }, [catalog.activeTab]);

  // Sync global store filter with catalog
  useEffect(() => {
    catalog.setFiltroLoja(activeStore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStore]);

  const getPageIcon = () => {
    switch (catalog.activeTab) {
      case CATEGORY_IDS.DISCOS: return <PiVinylRecord size={34} color="var(--accent)" />;
      case CATEGORY_IDS.DVDS: return <PiFilmStrip size={34} color="var(--accent)" />;
      case CATEGORY_IDS.VHS: return <PiCassetteTape size={34} color="var(--accent)" />;
      default: return <PiDisc size={34} color="var(--accent)" />;
    }
  };

  const exportarEstoque = async () => {
    setExportando(true);
    setFeedbackMsg(null);
    try {
      const { exportarEstoqueCompleto } = await import('@/utils/export');
      await exportarEstoqueCompleto(activeStore);
    } catch (err) {
      console.error(err);
      setFeedbackMsg({ tipo: 'error', texto: 'Erro ao exportar planilha: ' + (err.message || 'Tente novamente.') });
    } finally {
      setExportando(false);
    }
  };

  const toggleSelecionar = (item) => {
    setItensSelecionados(prev => {
      const exists = prev.some(i => i.id === item.id);
      if (exists) {
        return prev.filter(i => i.id !== item.id);
      }
      return [...prev, item];
    });
  };

  const toggleSelectAllPage = (pageItems) => {
    if (!pageItems || pageItems.length === 0) return;
    const allInPage = pageItems.every(i => itensSelecionados.some(s => s.id === i.id));
    if (allInPage) {
      const pageIds = new Set(pageItems.map(i => i.id));
      setItensSelecionados(prev => prev.filter(i => !pageIds.has(i.id)));
    } else {
      setItensSelecionados(prev => {
        const existingIds = new Set(prev.map(i => i.id));
        const newItems = pageItems.filter(i => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });
    }
  };

  const limparSelecao = () => {
    setItensSelecionados([]);
  };

  const confirmarBaixaLote = async () => {
    if (itensSelecionados.length === 0 || isBaixandoLote) return;
    setIsBaixandoLote(true);
    setFeedbackMsg(null);

    const totalItens = itensSelecionados.length;
    const category = catalog.activeTab;
    const ids = itensSelecionados.map(i => i.id);

    try {
      // 1. Soft delete e registro de saída encapsulados no itemService
      await itemService.bulkDeleteWithMovement(category, itensSelecionados, 'Saída (Baixa via Catálogo)');

      // 3. Registrar Undo para todos os itens
      registerUndo(category, itensSelecionados, () => {
        catalog.refresh();
      });

      // 4. Buscar reposições para os itens ativos que saíram
      for (const item of activeItens) {
        try {
          const replacements = await itemService.findReplacements(category, {
            titulo: item.titulo,
            artista: item.artista,
            excludeId: item.id,
          });
          if (replacements && replacements.length > 0) {
            adicionarTarefa({
              itemSaida: item,
              reserva: replacements[0],
              totalReservas: replacements.length,
              categoria: category,
            });
          }
        } catch (repErr) {
          console.warn('Erro ao checar reposição para item:', item.id, repErr);
        }
      }

      setFeedbackMsg({
        tipo: 'success',
        texto: `Baixa registrada com sucesso para ${totalItens} ${totalItens === 1 ? 'disco' : 'discos'}!`
      });

      setItensSelecionados([]);
      setShowConfirmBaixaLote(false);
      catalog.refresh();
    } catch (error) {
      console.error('Erro na baixa em lote:', error);
      setFeedbackMsg({
        tipo: 'error',
        texto: `Erro ao dar baixa nos discos: ${error.message || 'Falha na operação.'}`
      });
    } finally {
      setIsBaixandoLote(false);
    }
  };

  const solicitarExclusao = (id, titulo) => {
    setFeedbackMsg(null);
    setItemParaExcluir({ id, titulo });
  };

  const confirmarExclusao = async () => {
    if (!itemParaExcluir || isExcluindo) return;
    setIsExcluindo(true);
    setFeedbackMsg(null);
    
    const { id, titulo } = itemParaExcluir;

    try {
      const itemToDelete = catalog.itens.find(i => i.id === id);
      const isAtivo = itemToDelete?.ativo !== false;

      await itemService.deleteItemWithMovement(catalog.activeTab, itemToDelete, 'Saída (Excluído via Catálogo)');

      catalog.setItens(catalog.itens.filter(i => i.id !== id));
      catalog.setTotal(catalog.total - 1);
      
      if (itemToDelete) {
        registerUndo(catalog.activeTab, [itemToDelete], () => {
          catalog.refresh();
        });
      }
      setItemParaExcluir(null);

      // Checa se existe cópia inativa para reposição APENAS se o item excluído era ativo
      if (isAtivo) {
        try {
          const replacements = await itemService.findReplacements(catalog.activeTab, {
            titulo: itemToDelete?.titulo,
            artista: itemToDelete?.artista,
            excludeId: id,
          });
          if (replacements && replacements.length > 0) {
            const reserva = replacements[0];
            // Adiciona tarefa ao sininho de notificações
            adicionarTarefa({
              itemSaida: itemToDelete,
              reserva,
              totalReservas: replacements.length,
              categoria: catalog.activeTab,
            });

            setReposicaoData({
              itemSaida: itemToDelete,
              reserva,
              totalReservas: replacements.length,
            });
          }
        } catch (e) {
          console.warn('Erro ao verificar reposição:', e);
        }
      }

      setFeedbackMsg({
        tipo: 'success',
        texto: isAtivo ? `Saída de "${titulo}" registrada.` : `"${titulo}" (Inativo) excluído com sucesso.`
      });
    } catch (error) {
      console.error("Erro ao excluir:", error);
      setFeedbackMsg({ tipo: 'error', texto: `Erro ao excluir "${titulo}": ${error.message || 'Falha na operação.'}` });
    } finally {
      setIsExcluindo(false);
    }
  };

  const handleConfirmarRepor = async () => {
    if (!reposicaoData || isRepondo) return;
    setIsRepondo(true);
    try {
      const { itemSaida, reserva } = reposicaoData;
      await itemService.promoteReplacement(
        catalog.activeTab,
        reserva.id,
        itemSaida.caixa,
        itemSaida.loja
      );
      
      const destinoLocal = itemSaida.caixa ? `Caixa ${itemSaida.caixa}` : 'estoque ativo';
      const movData = movimentacaoService.createMovementPayload(
        catalog.activeTab,
        reserva.id,
        'entrada',
        1,
        `Ativação de cópia reserva para ${destinoLocal}`
      );
      await movimentacaoService.registerMovement(movData);

      setFeedbackMsg({
        tipo: 'success',
        texto: `"${reserva.titulo}" reposto com sucesso na ${itemSaida.caixa ? `Caixa ${itemSaida.caixa}` : 'sua localização'}!`
      });
      removerTarefa(`${catalog.activeTab}_${reserva.id}`);
      setReposicaoData(null);
      catalog.refresh();
    } catch (err) {
      console.error(err);
      setFeedbackMsg({ tipo: 'error', texto: `Erro ao repor item: ${err.message}` });
    } finally {
      setIsRepondo(false);
    }
  };
  
  const totalPaginas = Math.max(1, Math.ceil(catalog.total / PAGINATION.ITEMS_PER_PAGE));
  const itemName = catalog.activeTab === 'discos' ? 'discos' : catalog.activeTab === 'dvds' ? 'DVDs' : catalog.activeTab === 'vhs' ? 'VHS' : 'CDs';
  const isVideo = catalog.activeTab === 'dvds' || catalog.activeTab === 'vhs';
  
  const isDiscos = (activeStore === 'Loja 1' || activeStore === 'Loja 2') && catalog.activeTab === CATEGORY_IDS.DISCOS;
  const localLabel = isDiscos ? 'Caixa' : 'Localização';

  // Custom Pagination logic matching the mockup
  const renderPagination = () => {
    if (totalPaginas <= 1) return null;
    
    return (
      <div className="paginationRow" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px 0', gap: '8px', borderTop: '1px solid var(--border)', marginTop: '16px', flexWrap: 'wrap' }}>
        <button 
          className="pageBtn" 
          disabled={catalog.pagina === 1}
          onClick={() => catalog.setPagina(Math.max(1, catalog.pagina - 1))}
          style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          title="Página anterior"
        >
          &lt;
        </button>
        
        {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
          let pageNum;
          if (totalPaginas <= 5) {
            pageNum = i + 1;
          } else if (catalog.pagina <= 3) {
            pageNum = i + 1;
          } else if (catalog.pagina >= totalPaginas - 2) {
            pageNum = totalPaginas - 4 + i;
          } else {
            pageNum = catalog.pagina - 2 + i;
          }
          return (
            <button 
              key={pageNum} 
              className={`pageBtn ${catalog.pagina === pageNum ? 'active' : ''}`}
              onClick={() => catalog.setPagina(pageNum)}
              style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            >
              {pageNum}
            </button>
          );
        })}
        
        {totalPaginas > 5 && catalog.pagina < totalPaginas - 2 && (
          <>
            <span style={{ padding: '0 4px', color: 'var(--text-muted)' }}>...</span>
            <button 
              className={`pageBtn ${catalog.pagina === totalPaginas ? 'active' : ''}`}
              onClick={() => catalog.setPagina(totalPaginas)}
              style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            >
              {totalPaginas}
            </button>
          </>
        )}

        <button 
          className="pageBtn" 
          disabled={catalog.pagina === totalPaginas}
          onClick={() => catalog.setPagina(Math.min(totalPaginas, catalog.pagina + 1))}
          style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          title="Próxima página"
        >
          &gt;
        </button>
      </div>
    );
  };

  return (
    <div className="pageContainer">
      <style dangerouslySetInnerHTML={{ __html: `.desktop-theme-toggle { display: none !important; }` }} />
      <div className="topHeader">
        <div className="titleGroup">
          {getPageIcon()}
          <h1>Catálogo Completo</h1>
        </div>

        <div className="headerActions hide-on-mobile">
          <button 
            onClick={exportarEstoque} 
            disabled={exportando}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              padding: '8px 16px', borderRadius: '8px',
              background: 'var(--accent)', color: '#fff', border: 'none',
              cursor: exportando ? 'not-allowed' : 'pointer', fontSize: '14px',
              fontWeight: 600, opacity: exportando ? 0.7 : 1, transition: '0.2s'
            }}
          >
            <MdDownload size={18} />
            {exportando ? 'Exportando...' : 'Exportar (.xlsx)'}
          </button>
        </div>
      </div>

      <div className="mainCard">
        <div className="tabsRow">
          <CategoryTabs activeTab={catalog.activeTab} onTabChange={catalog.changeTab} additionalProps={{ style: { margin: 0, padding: 0, borderBottom: 'none' } }} />
        </div>

        <div className="filterCard">
          <div className="filtersRow">
            <div className="filterGroup" style={{ flex: '1 1 100%' }}>
              <label>Buscar por {isVideo ? 'título' : 'artista ou título'}</label>
              <div className="search-bar-row">
                <div className="searchInputWrapper">
                  <FiSearch size={18} className="searchIconLeft" />
                  <input
                    type="text"
                    className="searchInputWithLeftIcon"
                    placeholder={isVideo ? "Ex: O Poderoso Chefão, Matrix..." : "Ex: Beatles, Abbey Road, Roberto Carlos..."}
                    value={catalog.busca}
                    onChange={(e) => catalog.setBusca(e.target.value)}
                  />
                  {catalog.busca && (
                    <button
                      type="button"
                      onClick={() => catalog.setBusca('')}
                      className="search-clear-btn"
                      title="Limpar busca"
                      aria-label="Limpar busca"
                    >
                      <IoClose size={16} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsCoverScannerOpen(true)}
                  className="catalog-camera-btn"
                  title="Buscar disco por foto da capa"
                  aria-label="Buscar disco por foto da capa"
                >
                  <IoCamera size={20} />
                </button>
              </div>
            </div>

            <div className="filterGroup">
              <label>Filtrar por {localLabel.toLowerCase()}</label>
              <select value={catalog.filtroCaixa} onChange={(e) => catalog.setFiltroCaixa(e.target.value)}>
                <option value="">Todas</option>
                {caixas.map(c => (
                  <option key={`${c.caixa}-${c.loja}`} value={c.caixa}>
                    {c.label} {!activeStore && c.loja ? `(${c.loja})` : ''}
                  </option>
                ))}
              </select>
            </div>
            
            {!activeStore && (
              <div className="filterGroup">
                <label>Filtrar por loja</label>
                <select value={catalog.filtroLoja} onChange={(e) => catalog.setFiltroLoja(e.target.value)}>
                  <option value="">Todas</option>
                  {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            )}
            
            <div className="filterGroup" style={{ flex: '0 0 auto' }}>
              <label>Exibição</label>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', height: '100%' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text)', fontSize: '13px', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={catalog.mostrarAtivos}
                    onChange={(e) => catalog.setMostrarAtivos(e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  Ativos
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text)', fontSize: '13px', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={catalog.mostrarInativos}
                    onChange={(e) => catalog.setMostrarInativos(e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  Inativos
                </label>
              </div>
            </div>
          </div>
        </div>

        <AlertMessage 
          message={feedbackMsg} 
          onClose={() => setFeedbackMsg(null)} 
        />

        {catalog.loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
        ) : (
          <>
            <div className="tableHeader">
              <span>Mostrando {(catalog.pagina - 1) * PAGINATION.ITEMS_PER_PAGE + 1}–{Math.min(catalog.pagina * PAGINATION.ITEMS_PER_PAGE, catalog.total)} de {catalog.total} {itemName}</span>
            </div>
            
            <CatalogTable 
              itens={catalog.itens}
              activeTab={catalog.activeTab}
              ordenarColuna={catalog.ordenarColuna}
              ordenarDirecao={catalog.ordenarDirecao}
              onSort={catalog.toggleOrdenacao}
              onDelete={solicitarExclusao}
              showLoja={!activeStore}
              localLabel={localLabel}
              selectedIds={itensSelecionados.map(i => i.id)}
              onToggleSelect={toggleSelecionar}
              onToggleSelectAll={toggleSelectAllPage}
            />

            {renderPagination()}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={!!itemParaExcluir}
        title="Registrar Saída"
        message={
          <div>
            Tem certeza que deseja registrar a saída de{' '}
            <strong style={{ color: 'var(--text, #fff)' }}>&quot;{itemParaExcluir?.titulo}&quot;</strong>?
            <span style={{ display: 'block', marginTop: '8px', fontSize: '13px', opacity: 0.85 }}>
              O item não aparecerá mais no catálogo, mas o histórico de saída será preservado.
            </span>
          </div>
        }
        confirmText="Registrar Saída"
        cancelText="Cancelar"
        variant="danger"
        isSubmitting={isExcluindo}
        onClose={() => setItemParaExcluir(null)}
        onConfirm={confirmarExclusao}
      />

      <ReposicaoModal
        isOpen={!!reposicaoData}
        itemSaida={reposicaoData?.itemSaida}
        reserva={reposicaoData?.reserva}
        totalReservas={reposicaoData?.totalReservas}
        isRepondo={isRepondo}
        onConfirmRepor={handleConfirmarRepor}
        onClose={() => setReposicaoData(null)}
      />

      <CoverScannerModal
        isOpen={isCoverScannerOpen}
        onClose={() => setIsCoverScannerOpen(false)}
        onRecognized={handleCoverRecognized}
        title="Buscar Disco por Capa"
      />

      {itensSelecionados.length > 0 && (
        <div className="catalog-bulk-dock" role="toolbar" aria-label="Ações para discos selecionados">
          <div className="catalog-bulk-dock-content">
            <div className="catalog-bulk-dock-info">
              <button 
                onClick={limparSelecao} 
                className="catalog-bulk-dock-close-btn" 
                title="Limpar seleção"
                aria-label="Limpar seleção"
              >
                <IoClose size={18} />
              </button>
              <div className="catalog-bulk-dock-text">
                <span className="catalog-bulk-dock-count">
                  {itensSelecionados.length} {itensSelecionados.length === 1 ? 'disco selecionado' : 'discos selecionados'}
                </span>
                <span className="catalog-bulk-dock-sub">
                  Total: R$ {itensSelecionados.reduce((acc, i) => acc + (Number(i.preco) || 0), 0).toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
            <div className="catalog-bulk-dock-actions">
              <button 
                className="catalog-bulk-dock-clear-btn" 
                onClick={limparSelecao}
                type="button"
              >
                Limpar
              </button>
              <button 
                className="catalog-bulk-dock-confirm-btn" 
                onClick={() => setShowConfirmBaixaLote(true)}
                disabled={isBaixandoLote}
                type="button"
              >
                Dar Baixa ({itensSelecionados.length})
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirmBaixaLote}
        title={`Dar Baixa em ${itensSelecionados.length} ${itensSelecionados.length === 1 ? 'Disco' : 'Discos'}`}
        message={
          <div>
            <p style={{ margin: '0 0 12px 0', fontSize: '14px', lineHeight: 1.5 }}>
              Tem certeza que deseja registrar a baixa e saída de{' '}
              <strong style={{ color: 'var(--text, #fff)' }}>{itensSelecionados.length} {itensSelecionados.length === 1 ? 'disco selecionado' : 'discos selecionados'}</strong>?
            </p>
            <div style={{
              maxHeight: '160px',
              overflowY: 'auto',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              marginBottom: '10px'
            }}>
              {itensSelecionados.map((item, idx) => (
                <div key={item.id} style={{ fontSize: '13px', color: 'var(--text, #fff)', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {idx + 1}. {item.artista ? `${item.artista} - ` : ''}<strong>{item.titulo}</strong>
                  </span>
                  <span style={{ color: 'var(--text-muted, #a1a1aa)', flexShrink: 0 }}>
                    {item.caixa ? `Caixa ${item.caixa}` : ''}
                  </span>
                </div>
              ))}
            </div>
            <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted, #a1a1aa)' }}>
              Os itens serão retirados do estoque ativo e a saída será registrada. Você poderá desfazer a ação imediatamente no alerta de confirmação.
            </span>
          </div>
        }
        confirmText={isBaixandoLote ? "Dando baixa..." : `Dar Baixa (${itensSelecionados.length})`}
        cancelText="Cancelar"
        variant="danger"
        isSubmitting={isBaixandoLote}
        onClose={() => setShowConfirmBaixaLote(false)}
        onConfirm={confirmarBaixaLote}
      />
    </div>
  );
}
