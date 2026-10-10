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
    <div
      className="adicionar-prensagem-box"
      style={{
        marginTop: '12px',
        padding: '12px 14px',
        borderRadius: '8px',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <span className="badge-selo-discogs">Prensagem / Edição</span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Identificação do selo e ano da edição
        </span>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
            Selo da Prensagem
          </label>
          <input
            type="text"
            value={selo || ''}
            onChange={(e) => onSeloChange(e.target.value)}
            placeholder="Ex: Três Selos, Noize..."
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            {SELOS_PREDEFINIDOS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSeloChange(s)}
                className={`adicionar-selo-btn ${selo === s ? 'active' : ''}`}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  minHeight: '28px',
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: selo === s ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                  color: selo === s ? '#fff' : 'var(--text-muted)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: '120px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
            Ano Prensagem
          </label>
          <input
            type="text"
            value={anoPrensagem || ''}
            onChange={(e) => onAnoPrensagemChange(e.target.value)}
            placeholder="Ex: 2023"
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
