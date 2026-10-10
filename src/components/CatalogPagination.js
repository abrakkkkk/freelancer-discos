'use client';

/**
 * Componente de paginação acessível e responsivo para o catálogo
 */
export default function CatalogPagination({ pagina, totalPaginas, onPageChange }) {
  if (totalPaginas <= 1) return null;

  const handlePaginaAnterior = () => {
    onPageChange(Math.max(1, pagina - 1));
  };

  const handleProximaPagina = () => {
    onPageChange(Math.min(totalPaginas, pagina + 1));
  };

  const obterNumerosPagina = () => {
    return Array.from({ length: Math.min(5, totalPaginas) }, (_, indice) => {
      if (totalPaginas <= 5) {
        return indice + 1;
      }
      if (pagina <= 3) {
        return indice + 1;
      }
      if (pagina >= totalPaginas - 2) {
        return totalPaginas - 4 + indice;
      }
      return pagina - 2 + indice;
    });
  };

  const numerosPagina = obterNumerosPagina();

  return (
    <nav
      className="paginationRow"
      aria-label="Navegação entre páginas do catálogo"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px 0',
        gap: '8px',
        borderTop: '1px solid var(--border)',
        marginTop: '16px',
        flexWrap: 'wrap',
      }}
    >
      <button
        className="pageBtn"
        disabled={pagina === 1}
        onClick={handlePaginaAnterior}
        style={{
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
        title="Página anterior"
        aria-label="Página anterior"
      >
        &lt;
      </button>

      {numerosPagina.map((numero) => (
        <button
          key={numero}
          className={`pageBtn ${pagina === numero ? 'active' : ''}`}
          onClick={() => onPageChange(numero)}
          style={{
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          aria-current={pagina === numero ? 'page' : undefined}
        >
          {numero}
        </button>
      ))}

      {totalPaginas > 5 && pagina < totalPaginas - 2 && (
        <>
          <span style={{ padding: '0 4px', color: 'var(--text-muted)' }}>...</span>
          <button
            className={`pageBtn ${pagina === totalPaginas ? 'active' : ''}`}
            onClick={() => onPageChange(totalPaginas)}
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            {totalPaginas}
          </button>
        </>
      )}

      <button
        className="pageBtn"
        disabled={pagina === totalPaginas}
        onClick={handleProximaPagina}
        style={{
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
        title="Próxima página"
        aria-label="Próxima página"
      >
        &gt;
      </button>
    </nav>
  );
}
