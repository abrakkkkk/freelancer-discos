export function removeAcentos(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function formatCaixa(caixa, loja) {
  if (!caixa) return '—';
  const isNumeric = !isNaN(Number(caixa)) && String(caixa).trim() !== '';
  if (loja === 'Loja 1' && isNumeric) {
    return `Caixa ${caixa}`;
  }
  return caixa;
}
