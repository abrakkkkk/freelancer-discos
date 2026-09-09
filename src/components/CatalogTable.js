import Link from 'next/link';
import { FaEdit, FaSortUp, FaSortDown, FaSort } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { getStoreColor } from '@/constants/config';
import AlbumCover from '@/components/AlbumCover';

export default function CatalogTable({ 
  itens, 
  activeTab, 
  ordenarColuna, 
  ordenarDirecao, 
  onSort, 
  onDelete,
  showLoja = true,
  localLabel = 'Localização'
}) {
  const isVideo = activeTab === 'dvds' || activeTab === 'vhs';
  const itemName = activeTab === 'discos' ? 'discos' : activeTab === 'dvds' ? 'DVDs' : activeTab === 'vhs' ? 'VHS' : 'CDs';
  const isDiscosTab = activeTab === 'discos';

  const renderSortIcon = (coluna) => {
    if (ordenarColuna !== coluna) {
      return <FaSort size={12} style={{ marginLeft: '6px', opacity: 0.35 }} />;
    }
    return ordenarDirecao === 'asc' 
      ? <FaSortUp size={12} style={{ marginLeft: '6px', color: 'var(--accent)' }} />
      : <FaSortDown size={12} style={{ marginLeft: '6px', color: 'var(--accent)' }} />;
  };

  const getDisplayCaixa = (d) => {
    if (!d.caixa) return <span className="text-empty">—</span>;
    const isNumeric = !isNaN(Number(d.caixa)) && String(d.caixa).trim() !== '';
    if (d.loja === 'Loja 1' && isNumeric) {
      return `Caixa ${d.caixa}`;
    }
    return d.caixa;
  };

  if (itens.length === 0) {
    return <div className="empty-state">Nenhum {itemName.slice(0, -1)} encontrado.</div>;
  }

  return (
    <div className="tableContainer">
      <table className="styledTable">
        <thead>
          <tr>
            {isDiscosTab && (
              <th style={{ width: '64px', textAlign: 'center' }}>CAPA</th>
            )}
            <th>
              <div style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}} onClick={() => onSort('caixa')}>
                {localLabel.toUpperCase()} {renderSortIcon('caixa')}
              </div>
            </th>
            {!isVideo && (
              <th onClick={() => onSort('artista')} style={{cursor: 'pointer'}}>
                <div style={{display: 'flex', alignItems: 'center'}}>
                  ARTISTA {renderSortIcon('artista')}
                </div>
              </th>
            )}
            <th onClick={() => onSort('titulo')} style={{cursor: 'pointer'}}>
              <div style={{display: 'flex', alignItems: 'center'}}>
                TÍTULO {renderSortIcon('titulo')}
              </div>
            </th>
            <th onClick={() => onSort('ano')} style={{cursor: 'pointer'}}>
              <div style={{display: 'flex', alignItems: 'center'}}>
                ANO {renderSortIcon('ano')}
              </div>
            </th>
            {showLoja && (
              <th onClick={() => onSort('loja')} style={{cursor: 'pointer'}}>
                <div style={{display: 'flex', alignItems: 'center'}}>
                  LOJA {renderSortIcon('loja')}
                </div>
              </th>
            )}
            <th onClick={() => onSort('preco')} style={{cursor: 'pointer'}}>
              <div style={{display: 'flex', alignItems: 'center'}}>
                PREÇO {renderSortIcon('preco')}
              </div>
            </th>
            <th>STATUS</th>
            <th>AÇÕES</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((d) => {
            const isLoja2Disco = d.loja === 'Loja 2' && isDiscosTab;

            if (isLoja2Disco) {
              return (
                <tr 
                  key={d.id} 
                  className="catalog-row card-disco-loja2"
                  style={d.ativo === false ? { opacity: 0.5 } : {}}
                >
                  <td data-label="Capa" className="cell-capa">
                    <AlbumCover artista={d.artista} titulo={d.titulo} id={d.id} size={70} />
                  </td>

                  {/* Informações limpas para exibição mobile: sem os rótulos 'Local', 'Preço', etc. */}
                  <td data-label="Info" className="cell-disco-info">
                    <div className="disco-header-row">
                      <span className="disco-titulo">{d.titulo || <span className="text-empty">—</span>}</span>
                    </div>
                    {d.artista && <span className="disco-artista">{d.artista}</span>}
                    <div className="disco-valores-row">
                      <span className="disco-valor-preco">R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</span>
                      <span className="disco-valor-caixa">{getDisplayCaixa(d)}</span>
                      {d.ano && (
                        <span className="disco-valor-ano">{d.ano}</span>
                      )}
                      <span className={`disco-valor-status ${d.ativo ? 'status-ativo' : 'status-inativo'}`}>
                        {d.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </td>

                  {/* Células mantidas no DOM para compatibilidade desktop */}
                  <td data-label="Local" className="desktop-only cell-desktop-col">{getDisplayCaixa(d)}</td>
                  <td data-label="Artista" className={`desktop-only cell-desktop-col ${!d.artista ? "empty-artist" : ""}`}>
                    {d.artista || <span className="text-empty">—</span>}
                  </td>
                  <td data-label="Título" className="desktop-only cell-desktop-col">{d.titulo || <span className="text-empty">—</span>}</td>
                  <td data-label="Ano" className="desktop-only cell-desktop-col">
                    {d.ano ? (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg)', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border)', fontWeight: 600 }}>
                        {d.ano}
                      </span>
                    ) : (
                      <span className="text-empty">—</span>
                    )}
                  </td>
                  {showLoja && (
                    <td data-label="Loja" className="desktop-only cell-desktop-col">
                      <span style={{ color: getStoreColor(d.loja) }}>{d.loja}</span>
                    </td>
                  )}
                  <td data-label="Preço" className="desktop-only cell-desktop-col">R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</td>
                  <td data-label="Status" className="desktop-only cell-desktop-col">
                    <span className={`badge ${d.ativo ? 'badge-entrada' : 'badge-saida'}`} style={{ borderRadius: '16px', padding: '4px 10px', fontSize: '12px' }}>
                      {d.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td data-label="Ação">
                    <div className="actionBtnRow">
                      <Link href={`/editar?id=${d.id}&tipo=${activeTab}`} title={`Editar ${itemName.slice(0, -1)}`} className="iconBtn">
                        <FaEdit size={14} />
                      </Link>
                      <button 
                        onClick={() => onDelete(d.id, d.titulo || d.artista || 'Item')} 
                        title={`Excluir ${itemName.slice(0, -1)}`}
                        className={`${"iconBtn"} ${"delete"}`}
                      >
                        <MdDelete size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }

            // Renderização padrão para outras lojas e categorias
            return (
              <tr key={d.id} className="catalog-row" style={d.ativo === false ? { opacity: 0.5 } : {}}>
                {isDiscosTab && (
                  <td data-label="Capa" className="cell-capa">
                    <AlbumCover artista={d.artista} titulo={d.titulo} id={d.id} size={44} />
                  </td>
                )}
                <td data-label="Local">{getDisplayCaixa(d)}</td>
                {!isVideo && (
                  <td data-label="Artista" className={!d.artista ? "empty-artist" : ""}>
                    {d.artista || <span className="text-empty">—</span>}
                  </td>
                )}
                <td data-label="Título">{d.titulo || <span className="text-empty">—</span>}</td>
                <td data-label="Ano">
                  {d.ano ? (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg)', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border)', fontWeight: 600 }}>
                      {d.ano}
                    </span>
                  ) : (
                    <span className="text-empty">—</span>
                  )}
                </td>
                {showLoja && (
                  <td data-label="Loja">
                    {d.loja ? (
                      <span className={d.loja === 'Loja 1' ? "lojaText" : ''} style={d.loja !== 'Loja 1' ? { color: getStoreColor(d.loja) } : {}}>
                        {d.loja}
                      </span>
                    ) : (
                      <span className="text-empty">—</span>
                    )}
                  </td>
                )}
                <td data-label="Preço">R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</td>
                <td data-label="Status">
                  <span className={`badge ${d.ativo ? 'badge-entrada' : 'badge-saida'}`} style={{ borderRadius: '16px', padding: '4px 10px', fontSize: '12px' }}>
                    {d.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td data-label="Ação">
                  <div className="actionBtnRow">
                    <Link href={`/editar?id=${d.id}&tipo=${activeTab}`} title={`Editar ${itemName.slice(0, -1)}`} className="iconBtn">
                      <FaEdit size={14} />
                    </Link>
                    <button 
                      onClick={() => onDelete(d.id, d.titulo || d.artista || 'Item')} 
                      title={`Excluir ${itemName.slice(0, -1)}`}
                      className={`${"iconBtn"} ${"delete"}`}
                    >
                      <MdDelete size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
