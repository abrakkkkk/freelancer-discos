import Link from 'next/link';
import { FaEdit, FaSortUp, FaSortDown, FaSort } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { getStoreColor } from '@/constants/config';

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

  const renderSortIcon = (coluna) => {
    if (ordenarColuna !== coluna) {
      return <FaSort size={16} style={{ marginLeft: '6px', opacity: 0.35 }} />;
    }
    return ordenarDirecao === 'asc' 
      ? <FaSortUp size={16} style={{ marginLeft: '6px', color: 'var(--accent)' }} />
      : <FaSortDown size={16} style={{ marginLeft: '6px', color: 'var(--accent)' }} />;
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
    <div className="table-responsive">
      <table>
        <thead>
          <tr>
            <th>{localLabel.toUpperCase()}</th>
            {!isVideo && (
              <th className="th-sortable" onClick={() => onSort('artista')}>
                <div className="th-sortable-content">
                  <span>Artista</span>
                  {renderSortIcon('artista')}
                </div>
              </th>
            )}
            <th className="th-sortable" onClick={() => onSort('titulo')}>
              <div className="th-sortable-content">
                <span>Título</span>
                {renderSortIcon('titulo')}
              </div>
            </th>
            {showLoja && <th>Loja</th>}
            <th>Preço</th>
            <th>Obs.</th>
            <th>Status</th>
            <th style={{ width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {itens.map((d) => (
            <tr key={d.id} style={d.ativo === false ? { opacity: 0.5 } : {}}>
              <td data-label="Local">{getDisplayCaixa(d)}</td>
              {!isVideo && (
                <td data-label="Artista" className={!d.artista ? "empty-artist" : ""}>
                  {d.artista || <span className="text-empty">—</span>}
                </td>
              )}
              <td data-label="Título">{d.titulo || <span className="text-empty">—</span>}</td>
              {showLoja && (
                <td data-label="Loja">
                  {d.loja ? (
                    <span style={{ fontWeight: 600, color: getStoreColor(d.loja) }}>{d.loja}</span>
                  ) : (
                    <span className="text-empty">—</span>
                  )}
                </td>
              )}
              <td data-label="Preço">R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</td>
              <td data-label="Obs." title={d.observacao || ''}>
                {d.observacao ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {d.observacao.length > 20 ? d.observacao.substring(0, 20) + '...' : d.observacao}
                  </span>
                ) : (
                  <span className="text-empty">—</span>
                )}
              </td>
              <td data-label="Status">
                <span className={`badge ${d.ativo ? 'badge-entrada' : 'badge-saida'}`}>
                  {d.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              <td data-label="Ação" className="actions-cell">
                <Link href={`/editar?id=${d.id}&tipo=${activeTab}`} title={`Editar ${itemName.slice(0, -1)}`} className="action-btn edit-btn">
                  <FaEdit />
                </Link>
                <button 
                  onClick={() => onDelete(d.id, d.titulo || d.artista || 'Item')} 
                  title={`Excluir ${itemName.slice(0, -1)}`}
                  className="action-btn delete-btn"
                >
                  <MdDelete />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
