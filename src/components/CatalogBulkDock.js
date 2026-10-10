'use client';

import { IoClose } from 'react-icons/io5';

/**
 * Barra flutuante de ações em lote para itens selecionados no catálogo
 */
export default function CatalogBulkDock({
  totalSelecionados,
  valorTotal,
  isSubmitting = false,
  onClear,
  onConfirm,
}) {
  if (totalSelecionados === 0) return null;

  const textoQuantidade =
    totalSelecionados === 1 ? '1 disco selecionado' : `${totalSelecionados} discos selecionados`;

  const valorFormatado = Number(valorTotal || 0)
    .toFixed(2)
    .replace('.', ',');

  return (
    <div className="catalog-bulk-dock" role="toolbar" aria-label="Ações para discos selecionados">
      <div className="catalog-bulk-dock-content">
        <div className="catalog-bulk-dock-info">
          <button
            onClick={onClear}
            className="catalog-bulk-dock-close-btn"
            title="Limpar seleção"
            aria-label="Limpar seleção"
            type="button"
          >
            <IoClose size={18} />
          </button>
          <div className="catalog-bulk-dock-text">
            <span className="catalog-bulk-dock-count">{textoQuantidade}</span>
            <span className="catalog-bulk-dock-sub">Total: R$ {valorFormatado}</span>
          </div>
        </div>

        <div className="catalog-bulk-dock-actions">
          <button
            className="catalog-bulk-dock-clear-btn"
            onClick={onClear}
            type="button"
          >
            Limpar
          </button>
          <button
            className="catalog-bulk-dock-confirm-btn"
            onClick={onConfirm}
            disabled={isSubmitting}
            type="button"
          >
            Dar Baixa ({totalSelecionados})
          </button>
        </div>
      </div>
    </div>
  );
}
