export default function Pagination({ pagina, totalPaginas, onPageChange }) {
  if (totalPaginas <= 1) return null;

  return (
    <div className="pagination">
      <button
        className="btn btn-secondary"
        disabled={pagina <= 1}
        onClick={() => onPageChange(pagina - 1)}
      >
        ← Anterior
      </button>
      <span>Página {pagina} de {totalPaginas}</span>
      <button
        className="btn btn-secondary"
        disabled={pagina >= totalPaginas}
        onClick={() => onPageChange(pagina + 1)}
      >
        Próxima →
      </button>
    </div>
  );
}
