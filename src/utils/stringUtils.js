export function removeAcentos(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function normalizeCaixa(caixa, loja = '') {
  if (!caixa) return '';
  const str = String(caixa).trim();
  if (!str) return '';

  // 1. Shorthand com B: "5b", "19b", "5B", "caixa 5b", "caixa 19b", "c5b", "c 19b", "caixa5b" -> "Caixa 5B", "Caixa 19B"
  const matchB = str.match(/^(?:caixa|c)?\s*(\d+)\s*b$/i);
  if (matchB) {
    return `Caixa ${matchB[1]}B`;
  }

  // 2. Com prefixo caixa/c mas sem B: "caixa 5", "caixa 19", "c 5", "c5"
  const matchCaixaNum = str.match(/^(?:caixa|c)\s*(\d+)$/i);
  if (matchCaixaNum) {
    const num = matchCaixaNum[1];
    if (loja === 'Loja 1') {
      return num; // No banco Loja 1 armazena número puro
    }
    if (loja === 'Loja 2') {
      return `Caixa ${num}B`;
    }
    return `Caixa ${num}`;
  }

  // 3. Se for Loja 2 e digitar apenas número puro "5", entende como "Caixa 5B"
  if (loja === 'Loja 2') {
    const matchJustNum = str.match(/^(\d+)$/);
    if (matchJustNum) {
      return `Caixa ${matchJustNum[1]}B`;
    }
  }

  return str;
}

export function formatCaixa(caixa, loja) {
  if (!caixa) return '—';
  const str = String(caixa).trim();
  if (!str) return '—';

  // Se for "5b", "19b", "5B", etc.
  const matchB = str.match(/^(\d+)\s*b$/i);
  if (matchB) {
    return `Caixa ${matchB[1]}B`;
  }

  if (str.toLowerCase().startsWith('caixa ')) {
    const matchCaixaB = str.match(/^caixa\s*(\d+)\s*b$/i);
    if (matchCaixaB) {
      return `Caixa ${matchCaixaB[1]}B`;
    }
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
