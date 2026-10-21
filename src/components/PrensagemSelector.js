'use client';

import React from 'react';

const SELOS_PREDEFINIDOS = [
  'Três Selos',
  'Noize',
  'Rocinante',
  'Fatiado',
  'Universal',
  'Polysom',
];

/**
 * Componente para seleção e edição de selo e ano de prensagem de discos
 */
export default function PrensagemSelector({
  selo,
  onSeloChange,
  anoPrensagem,
  onAnoPrensagemChange,
}) {
  return (
    <div className="adicionar-prensagem-box">
      <div className="prensagem-header">
        <span className="prensagem-title">Prensagem / Edição</span>
      </div>

      <div className="prensagem-fields-grid">
        <div className="form-group prensagem-field-selo">
          <label>Selo da Prensagem</label>
          <input
            type="text"
            value={selo || ''}
            onChange={(e) => onSeloChange(e.target.value)}
            placeholder="Ex: Três Selos, Noize..."
          />
        </div>

        <div className="form-group prensagem-field-ano">
          <label>Ano Prensagem</label>
          <input
            type="text"
            value={anoPrensagem || ''}
            onChange={(e) => onAnoPrensagemChange(e.target.value)}
            placeholder="Ex: 2023"
          />
        </div>
      </div>

      <div className="prensagem-chips-row">
        {SELOS_PREDEFINIDOS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSeloChange(s)}
            className={`adicionar-selo-btn ${selo === s ? 'active' : ''}`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
