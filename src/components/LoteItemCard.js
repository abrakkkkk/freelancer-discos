'use client';

import React from 'react';
import { FaCamera, FaTrash, FaMagnifyingGlass } from 'react-icons/fa6';
import { PiVinylRecord } from 'react-icons/pi';
import { IoRefresh } from 'react-icons/io5';

/**
 * Card individual de cada foto processada no lote de cadastro por fotos
 */
export default function LoteItemCard({
  item,
  indice,
  caixaPadrao,
  isProcessandoLote,
  isSalvando,
  onToggleSelect,
  onUpdateField,
  onRemove,
  onRetryItem,
  onSearchDiscogs,
}) {
  const estaVazio = !item.titulo?.trim() && !item.artista?.trim();

  return (
    <div className={`lote-fotos-card ${item.selecionado ? 'selected' : ''}`}>
      {/* Linha 1: Seleção, Número, Selo e Ações */}
      <div className="lote-fotos-card-header">
        <div className="lote-fotos-card-header-left">
          <input
            type="checkbox"
            checked={item.selecionado}
            onChange={() => onToggleSelect(item.id)}
            style={{ width: '20px', height: '20px', accentColor: 'var(--accent)', cursor: 'pointer' }}
            aria-label={`Selecionar disco #${indice + 1}`}
          />
          <span className="lote-fotos-card-idx">#{indice + 1}</span>
          {estaVazio && <span className="lote-fotos-badge-empty">NÃO IDENTIFICADO</span>}
          {item.selo && <span className="lote-fotos-badge-selo">{item.selo.toUpperCase()}</span>}
        </div>

        <div className="lote-fotos-card-header-actions">
          {estaVazio && (
            <button
              type="button"
              onClick={() => onRetryItem(item.id)}
              disabled={item.processandoItem || isProcessandoLote || isSalvando}
              className="btn lote-fotos-item-btn-retry"
              title="Tentar reconhecer foto novamente"
            >
              <IoRefresh
                size={12}
                style={{ animation: item.processandoItem ? 'spin 1s linear infinite' : 'none' }}
              />
              {item.processandoItem ? 'Lendo...' : 'Reconhecer'}
            </button>
          )}

          <button
            type="button"
            onClick={() => onSearchDiscogs(item)}
            className="btn lote-fotos-item-btn"
            title="Procurar outra edição no Discogs"
          >
            <FaMagnifyingGlass size={10} /> Trocar
          </button>

          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="lote-fotos-item-btn-remove"
            title="Remover da lista"
          >
            <FaTrash size={12} />
          </button>
        </div>
      </div>

      {/* Linha 2: Capas + Título & Artista */}
      <div className="lote-fotos-card-body">
        {/* Capas lado a lado */}
        <div className="lote-fotos-covers-wrap">
          <div className="lote-fotos-cover-thumb" title="Foto Real da Câmera">
            {item.fotoPreview ? (
              <img
                src={item.fotoPreview}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : null}
            <div className="lote-fotos-cover-placeholder">
              <FaCamera size={18} color="var(--text-muted)" />
            </div>
          </div>

          <div className="lote-fotos-cover-thumb" title="Capa Localizada no Discogs">
            {item.capaUrl ? (
              <img
                src={item.capaUrl}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : null}
            <div className="lote-fotos-cover-placeholder">
              <PiVinylRecord size={22} color="var(--text-muted)" />
            </div>
          </div>
        </div>

        {/* Campos Principais: Título e Artista */}
        <div className="lote-fotos-fields-main">
          <input
            type="text"
            value={item.titulo || ''}
            onChange={(e) => onUpdateField(item.id, 'titulo', e.target.value)}
            placeholder="Título do álbum *"
            className="lote-fotos-input-titulo"
          />
          <input
            type="text"
            value={item.artista || ''}
            onChange={(e) => onUpdateField(item.id, 'artista', e.target.value)}
            placeholder="Artista"
            className="lote-fotos-input-artista"
          />
        </div>
      </div>

      {/* Linha 3: Detalhes compactos (Ano, Preço, Caixa) */}
      <div className="lote-fotos-card-grid-details">
        <div>
          <input
            type="text"
            value={item.ano || ''}
            onChange={(e) => onUpdateField(item.id, 'ano', e.target.value)}
            placeholder="Ano"
            className="lote-fotos-input-detail"
          />
        </div>
        <div>
          <input
            type="text"
            inputMode="numeric"
            value={item.preco || ''}
            onChange={(e) => onUpdateField(item.id, 'preco', e.target.value)}
            placeholder="Preço R$"
            className="lote-fotos-input-detail"
          />
        </div>
        <div>
          <input
            type="text"
            value={item.caixa || ''}
            onChange={(e) => onUpdateField(item.id, 'caixa', e.target.value)}
            placeholder={caixaPadrao || 'Caixa'}
            className="lote-fotos-input-detail"
          />
        </div>
      </div>
    </div>
  );
}
