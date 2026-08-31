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
          {itens.map((d) => (
            <tr key={d.id} style={d.ativo === false ? { opacity: 0.5 } : {}}>
              <td>{getDisplayCaixa(d)}</td>
              {!isVideo && (
                <td className={!d.artista ? "empty-artist" : ""}>
                  {d.artista || <span className="text-empty">—</span>}
                </td>
              )}
              <td>{d.titulo || <span className="text-empty">—</span>}</td>
              {showLoja && (
                <td>
                  {d.loja ? (
                    <span className={d.loja === 'Loja 1' ? "lojaText" : ''} style={d.loja !== 'Loja 1' ? { color: getStoreColor(d.loja) } : {}}>
                      {d.loja}
                    </span>
                  ) : (
                    <span className="text-empty">—</span>
                  )}
                </td>
              )}
              <td>R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</td>
              <td>
                <span className={`badge ${d.ativo ? 'badge-entrada' : 'badge-saida'}`} style={{ borderRadius: '16px', padding: '4px 10px', fontSize: '12px' }}>
                  {d.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              <td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
