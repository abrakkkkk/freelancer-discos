'use client';

import { useState, useEffect } from 'react';
import { PiVinylRecord, PiDisc, PiFilmStrip, PiCassetteTape } from "react-icons/pi";
import { MdDownload } from "react-icons/md";
import { useCatalog } from '@/hooks/useCatalog';
import { useCaixas } from '@/hooks/useCaixas';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import CategoryTabs from '@/components/CategoryTabs';
import Pagination from '@/components/Pagination';
import CatalogTable from '@/components/CatalogTable';
import { PAGINATION, CATEGORY_IDS, STORE_OPTIONS } from '@/constants/config';
import { useUndo } from '@/contexts/UndoContext';
import { useStore } from '@/contexts/StoreContext';

export default function Catalogo() {
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
      case CATEGORY_IDS.DISCOS: return <PiVinylRecord size={28} color="var(--accent)" />;
      case CATEGORY_IDS.DVDS: return <PiFilmStrip size={28} color="var(--accent)" />;
      case CATEGORY_IDS.VHS: return <PiCassetteTape size={28} color="var(--accent)" />;
      default: return <PiDisc size={28} color="var(--accent)" />;
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

  return (
    <div>
      <div className="page-header">
        {getPageIcon()}
        <h1 className="page-title">Catálogo Completo</h1>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <CategoryTabs activeTab={catalog.activeTab} onTabChange={catalog.changeTab} additionalProps={{ style: { marginBottom: 0 } }} />

        <button 
          className="btn btn-primary hide-on-mobile"
          onClick={exportarEstoque} 
          disabled={exportando}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            padding: '10px 16px', borderRadius: '8px',
            background: 'var(--accent)', color: '#fff', border: 'none',
            cursor: exportando ? 'not-allowed' : 'pointer', fontSize: '14px',
            fontWeight: 600, opacity: exportando ? 0.7 : 1, transition: '0.2s',
            marginLeft: 'auto'
          }}
        >
          <MdDownload size={18} />
          {exportando ? 'Gerando...' : 'Exportar (.xlsx)'}
        </button>
      </div>

      <div className="filters">
        <div className="form-group" style={{ flex: '0 0 220px' }}>
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
          <div className="form-group" style={{ flex: '0 0 160px' }}>
            <label>Filtrar por loja</label>
            <select value={catalog.filtroLoja} onChange={(e) => catalog.setFiltroLoja(e.target.value)}>
              <option value="">Todas</option>
              {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        )}
        <div className="form-group" style={{ flex: 1 }}>
          <label>Buscar por {isVideo ? 'título' : 'artista ou título'}</label>
          <input
            type="text"
            placeholder={isVideo ? "Ex: O Poderoso Chefão, Matrix..." : "Ex: Beatles, Abbey Road, Roberto Carlos..."}
            value={catalog.busca}
            onChange={(e) => catalog.setBusca(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ flex: '0 0 auto' }}>
          <label>Exibição</label>
          <div className="filter-checkboxes">
            <label className="filter-checkbox-item" htmlFor="mostrarAtivos">
              <input
                type="checkbox"
                id="mostrarAtivos"
                checked={catalog.mostrarAtivos}
                onChange={(e) => catalog.setMostrarAtivos(e.target.checked)}
              />
              <span>Ativos</span>
            </label>
            <label className="filter-checkbox-item" htmlFor="mostrarInativos">
              <input
                type="checkbox"
                id="mostrarInativos"
                checked={catalog.mostrarInativos}
                onChange={(e) => catalog.setMostrarInativos(e.target.checked)}
              />
              <span>Inativos</span>
            </label>
          </div>
        </div>
      </div>

      {catalog.loading ? (
        <p>Carregando...</p>
      ) : (
        <>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Mostrando {(catalog.pagina - 1) * PAGINATION.ITEMS_PER_PAGE + 1}–{Math.min(catalog.pagina * PAGINATION.ITEMS_PER_PAGE, catalog.total)} de {catalog.total} {itemName}
          </p>
          
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

          <Pagination 
            pagina={catalog.pagina} 
            totalPaginas={totalPaginas} 
            onPageChange={catalog.setPagina} 
          />
        </>
      )}
    </div>
  );
}
