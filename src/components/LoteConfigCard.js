'use client';

import React from 'react';
import { STORE_OPTIONS, CATEGORY_IDS } from '@/constants/config';

/**
 * Card de configuração dos valores padrão (Loja, Caixa, Preço e Formato) para o lote de fotos
 */
export default function LoteConfigCard({
  loja,
  onLojaChange,
  caixaPadrao,
  onCaixaPadraoChange,
  precoPadrao,
  onPrecoPadraoChange,
  tipo,
  onTipoChange,
  caixas,
}) {
  return (
    <div className="lote-fotos-config-card">
      <div className="lote-fotos-config-grid">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Loja</label>
          <select value={loja} onChange={(e) => onLojaChange(e.target.value)}>
            {STORE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Caixa Padrão</label>
          <input
            type="text"
            list="caixas-lote-list"
            value={caixaPadrao}
            onChange={(e) => onCaixaPadraoChange(e.target.value)}
            placeholder="Ex: 15, 49..."
          />
          <datalist id="caixas-lote-list">
            {caixas.map((c) => (
              <option key={`${c.caixa}-${c.loja}`} value={c.caixa}>
                {c.label}
              </option>
            ))}
          </datalist>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Preço Padrão</label>
          <input
            type="text"
            inputMode="numeric"
            value={precoPadrao}
            onChange={(e) => onPrecoPadraoChange(e.target.value)}
            placeholder="R$ (opcional)"
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Formato</label>
          <select value={tipo} onChange={(e) => onTipoChange(e.target.value)}>
            <option value={CATEGORY_IDS.DISCOS}>Vinil</option>
            <option value={CATEGORY_IDS.CDS}>CD</option>
          </select>
        </div>
      </div>
    </div>
  );
}
