const MAX_RECOGNIZED_PRICE = 99_999;

export function parseRecognizedPrice(value) {
  if (value === undefined || value === null) return '';

  let normalizedValue = String(value).trim();
  if (!normalizedValue) return '';

  normalizedValue = normalizedValue
    .replace(/r?\$|\s/gi, '')
    .replace(/[,.](?:-|=)$/, '');

  const zeroDecimals = normalizedValue.match(/^((?:\d{1,3}(?:[.,]\d{3})+|\d+))[,.]0{1,2}$/);
  if (zeroDecimals) normalizedValue = zeroDecimals[1];

  const isInteger = /^\d+$/.test(normalizedValue);
  const isGroupedThousands = /^\d{1,3}(?:[.,]\d{3})+$/.test(normalizedValue);
  if (!isInteger && !isGroupedThousands) return '';

  const price = Number(normalizedValue.replace(/[.,]/g, ''));
  if (!Number.isSafeInteger(price) || price <= 0 || price >= MAX_RECOGNIZED_PRICE || price % 5 !== 0) {
    return '';
  }

  return String(price);
}
