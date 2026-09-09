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
  const str = String(caixa).trim();
  if (str.toLowerCase().startsWith('caixa ')) {
    return str;
  }
  const isNumeric = !isNaN(Number(str)) && str !== '';
  if (loja === 'Loja 1' && isNumeric) {
    return `Caixa ${str}`;
  }
  return str;
}

export function cleanDiscogsString(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .replace(/\*+$/g, '')
    .replace(/\s*\(\d+\)$/g, '')
    .trim();
}
