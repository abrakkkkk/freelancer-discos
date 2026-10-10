/**
 * Utilitários de manipulação e formatação de datas
 */

/**
 * Formata um timestamp ISO em formato relativo amigável em pt-BR (ex: "Hoje às 14:30", "Ontem às 09:15", "10/10/2026 • 11:20")
 */
export function formatarDataHoraRelativa(dataIso) {
  if (!dataIso) return '—';
  try {
    const dataObj = new Date(dataIso.endsWith('Z') ? dataIso : dataIso + 'Z');
    const agora = new Date();

    const ehHoje = dataObj.toLocaleDateString('pt-BR') === agora.toLocaleDateString('pt-BR');

    const hora = dataObj.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });

    if (ehHoje) return `Hoje às ${hora}`;

    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    if (dataObj.toLocaleDateString('pt-BR') === ontem.toLocaleDateString('pt-BR')) {
      return `Ontem às ${hora}`;
    }

    return `${dataObj.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} • ${hora}`;
  } catch (_) {
    return dataIso;
  }
}
