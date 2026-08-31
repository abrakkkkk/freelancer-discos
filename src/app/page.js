'use client';

import { useState, useEffect } from 'react';
import { PiVinylRecord, PiDisc, PiFilmStrip, PiCassetteTape } from "react-icons/pi";
import { MdDownload } from "react-icons/md";
import { FiSearch } from "react-icons/fi";
import { useCatalog } from '@/hooks/useCatalog';
import { useCaixas } from '@/hooks/useCaixas';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import CategoryTabs from '@/components/CategoryTabs';
import CatalogTable from '@/components/CatalogTable';
import { PAGINATION, CATEGORY_IDS, STORE_OPTIONS } from '@/constants/config';
import { useUndo } from '@/contexts/UndoContext';
import { useStore } from '@/contexts/StoreContext';


export default function CatalogoClone() {
  const { caixas } = useCaixas();
  const catalog = useCatalog(CATEGORY_IDS.DISCOS);
  const [exportando, setExportando] = useState(false);

  const { registerUndo } = useUndo();
  const { activeStore } = useStore();

  // Sync global store filter with catalog
  useEffect(() => {
    catalog.setFiltroLoja(activeStore);
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
    try {
      const { exportarEstoqueCompleto } = await import('@/utils/export');
      await exportarEstoqueCompleto(activeStore);
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar planilha');
    } finally {
      setExportando(false);
    }
  };

  const excluirItem = async (id, titulo) => {
    if (!confirm(`Tem certeza que deseja registrar a saída de "${titulo}"? O item não aparecerá mais no catálogo, mas o histórico de saída será preservado.`)) {
      return;
    }
    
    try {
      const itemToDelete = catalog.itens.find(i => i.id === id);
      await itemService.deleteItem(catalog.activeTab, id);
      
      const movData = movimentacaoService.createMovementPayload(catalog.activeTab, id, 'saida', itemToDelete?.quantidade || 1, 'Saída (Excluído via Catálogo)');
      await movimentacaoService.registerMovement(movData);

      catalog.setItens(catalog.itens.filter(i => i.id !== id));
      catalog.setTotal(catalog.total - 1);
      
      if (itemToDelete) {
        registerUndo(catalog.activeTab, [itemToDelete], () => {
          catalog.refresh();
        });
      }
    } catch (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir item.");
    }
  };
  
  const totalPaginas = Math.max(1, Math.ceil(catalog.total / PAGINATION.ITEMS_PER_PAGE));
  const itemName = catalog.activeTab === 'discos' ? 'discos' : catalog.activeTab === 'dvds' ? 'DVDs' : catalog.activeTab === 'vhs' ? 'VHS' : 'CDs';
  const isVideo = catalog.activeTab === 'dvds' || catalog.activeTab === 'vhs';
  
  const isLoja1Discos = activeStore === 'Loja 1' && catalog.activeTab === CATEGORY_IDS.DISCOS;
  const localLabel = isLoja1Discos ? 'Caixa' : 'Localização';

  // Custom Pagination logic matching the mockup
  const renderPagination = () => {
    if (totalPaginas <= 1) return null;
    
    let pages = [];
    // Show a few pages for the mockup look
    for (let i = 1; i <= Math.min(3, totalPaginas); i++) {
      pages.push(i);
    }
    
    return (
      <div className="paginationRow">
        <div>
          Itens por página: 
          <select className="pageItemsSelect" style={{ marginLeft: '8px' }}>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </div>
        
        <div className="paginationControls">
          <button 
            className="pageBtn" 
            disabled={catalog.pagina === 1}
            onClick={() => catalog.setPagina(catalog.pagina - 1)}
          >
            &lt;
          </button>
          
          {pages.map(p => (
            <button 
              key={p} 
              className={`${"pageBtn"} ${catalog.pagina === p ? "active" : ''}`}
              onClick={() => catalog.setPagina(p)}
            >
              {p}
            </button>
          ))}
          
          {totalPaginas > 3 && (
            <>
              <span style={{ padding: '0 8px' }}>...</span>
              <button 
                className={`${"pageBtn"} ${catalog.pagina === totalPaginas ? "active" : ''}`}
                onClick={() => catalog.setPagina(totalPaginas)}
              >
                {totalPaginas}
              </button>
            </>
          )}

          <button 
            className="pageBtn" 
            disabled={catalog.pagina === totalPaginas}
            onClick={() => catalog.setPagina(catalog.pagina + 1)}
          >
            &gt;
          </button>
        </div>

        <div>
          Ir para página:
          <input 
            type="number" 
            min="1" 
            max={totalPaginas} 
            defaultValue="1" 
            className="pageItemsSelect" 
            style={{ width: '50px', margin: '0 8px' }} 
          />
          <button className="pageItemsSelect" style={{ cursor: 'pointer' }}>Ir</button>
        </div>
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
              <div className="searchInputWrapper">
                <input
                  type="text"
                  placeholder={isVideo ? "Ex: O Poderoso Chefão, Matrix..." : "Ex: Beatles, Abbey Road, Roberto Carlos..."}
                  value={catalog.busca}
                  onChange={(e) => catalog.setBusca(e.target.value)}
                />
                <FiSearch size={18} className="searchIcon" />
              </div>
            </div>

            <div className="filterGroup">
              <label>Filtrar por caixa</label>
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
              onDelete={excluirItem}
              showLoja={!activeStore}
              localLabel={localLabel}
            />

            {renderPagination()}
          </>
        )}
      </div>
    </div>
  );
}
