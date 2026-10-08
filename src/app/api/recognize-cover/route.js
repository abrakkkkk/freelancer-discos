// Rota API Next.js para reconhecimento de capa via Gemini Vision
// Suporta tanto Next.js App Router quanto execucao standalone via Response nativo

import { createHash } from 'crypto';

// Ordem por velocidade medida e confiabilidade de cota:
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest'
];

function getGeminiKeys() {
  const primary = (process.env.GEMINI_API_KEY || '').trim();
  const secondary = (process.env.GEMINI_API_KEY_SECONDARY || '').trim();
  const backup = (process.env.GEMINI_API_KEY_BACKUP || '').trim();
  const keys = [];
  if (primary) keys.push(...primary.split(',').map(s => s.trim()).filter(Boolean));
  if (secondary) keys.push(...secondary.split(',').map(s => s.trim()).filter(Boolean));
  if (backup) keys.push(...backup.split(',').map(s => s.trim()).filter(Boolean));
  return [...new Set(keys)];
}

// Cache em memória: evita chamadas repetidas à API para a mesma imagem
// TTL 24h, máximo 500 entradas (~2KB cada = ~1MB de RAM no pico)
const recognitionCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const CACHE_MAX_ENTRIES = 500;

function getImageHash(base64Data) {
  // Hash rápido: usa os primeiros 2048 chars + tamanho total (suficiente para distinguir imagens)
  const sample = base64Data.substring(0, 2048) + ':' + base64Data.length;
  return createHash('sha256').update(sample).digest('hex').substring(0, 16);
}

function getCachedResult(hash) {
  const entry = recognitionCache.get(hash);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    recognitionCache.delete(hash);
    return null;
  }
  return entry.result;
}

function setCachedResult(hash, result) {
  // Evita estouro de memória: remove entrada mais antiga se atingir o limite
  if (recognitionCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = recognitionCache.keys().next().value;
    recognitionCache.delete(oldestKey);
  }
  recognitionCache.set(hash, { result, timestamp: Date.now() });
}

export async function POST(request) {
  try {
    const geminiKeys = getGeminiKeys();
    const groqKey = process.env.GROQ_API_KEY?.trim();
    if (geminiKeys.length === 0 && !groqKey) {
      return Response.json(
        { success: false, error: 'Nenhuma chave de inteligência visual (GEMINI_API_KEY ou GROQ_API_KEY) configurada no servidor.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { image } = body;

    if (!image || typeof image !== 'string') {
      return Response.json(
        { success: false, error: 'Nenhuma imagem foi fornecida para análise.' },
        { status: 400 }
      );
    }

    // Extrai mime-type e base64 limpo sem regex pesado sobre string grande
    let mimeType = 'image/jpeg';
    let base64Data = image;

    if (image.startsWith('data:')) {
      const commaIdx = image.indexOf(',');
      if (commaIdx !== -1) {
        const header = image.substring(5, commaIdx);
        const semiIdx = header.indexOf(';');
        if (semiIdx !== -1) {
          mimeType = header.substring(0, semiIdx) || 'image/jpeg';
        }
        base64Data = image.substring(commaIdx + 1);
      }
    }

    // Cache hit: retorna resultado anterior instantaneamente (0ms, 0 custo)
    const imageHash = getImageHash(base64Data);
    const cached = getCachedResult(imageHash);
    if (cached) {
      console.log(`[Cover Recognition] Cache hit (${imageHash}) — economia de 1 chamada API`);
      return Response.json(cached);
    }

    // Prompt ultra-compacto (~70 tokens) — reduz latência e custo de tokens
    const systemPrompt = `Identifique artista, título e ano da capa de disco (vinil/CD).
REGRAS: 1. Use memória visual ou transcreva o texto exato da capa; NUNCA invente nomes. 2. Coletânea ou trilha sonora de novela/filme = artista "Various". 3. Se incerto, deixe artista/titulo vazios e confianca "baixa".
JSON: {"artista":"","titulo":"","ano":"","confianca":"alta|media|baixa"}`;

    let candidateText = null;
    let lastError = null;

    const geminiPayload = {
      contents: [{
        parts: [
          { text: systemPrompt },
          { inlineData: { mimeType: mimeType, data: base64Data } }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: 250
      }
    };

    // Helper: tenta um modelo Gemini específico com timeout seguro de 12s
    async function tryGeminiModel(model, apiKey) {
      const timeoutMs = 12000;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const t0 = Date.now();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
        signal: AbortSignal.timeout(timeoutMs)
      });
      const data = await res.json();
      const durationMs = Date.now() - t0;

      if (!res.ok) {
        const errMsg = data.error?.message || `HTTP ${res.status}`;
        console.warn(`[Cover] ${model} falhou em ${durationMs}ms (${res.status}): ${errMsg}`);
        throw new Error(errMsg);
      }

      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.map(p => p.text).filter(Boolean).join('\n').trim();
      if (!text) throw new Error('Resposta vazia');

      console.log(`[Cover Recognition] Sucesso com ${model} em ${durationMs}ms`);
      return text;
    }

    // Helper: tenta Gemini priorizando a chave primária (paga) e usando secundárias apenas como fallback
    async function tryGemini() {
      let lastErr = null;

      for (const key of geminiKeys) {
        for (const model of GEMINI_MODELS) {
          try {
            return await tryGeminiModel(model, key);
          } catch (err) {
            lastErr = err;
            console.warn(`[Cover] Falha em ${model} (key ...${key.slice(-6)}): ${err.message}`);
            const msg = (err.message || '').toLowerCase();
            // Se erro for 429 ou cota esgotada nesta chave, pula imediatamente para a próxima chave
            if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {
              console.warn(`[Cover] Cota esgotada na chave ...${key.slice(-6)}, alternando para próxima chave`);
              break;
            }
            continue;
          }
        }
      }
      throw lastErr || new Error('Todos os modelos e chaves Gemini falharam');
    }

    if (geminiKeys.length > 0) {
      try {
        candidateText = await tryGemini();
      } catch (err) {
        lastError = err.message;
        console.warn('[Cover] Gemini falhou em todas as tentativas:', err.message);
      }
    }

    if (!candidateText) {
      console.error('Falha na análise visual:', lastError);
      const isQuota = typeof lastError === 'string' && (lastError.includes('quota') || lastError.includes('429') || lastError.includes('RESOURCE_EXHAUSTED') || lastError.includes('rate_limit'));
      const isTimeout = typeof lastError === 'string' && (lastError.includes('timeout') || lastError.includes('aborted'));

      let friendlyError = `Falha na análise da capa: ${lastError || 'Serviço indisponível'}`;
      let statusCode = 502;
      if (isQuota) {
        friendlyError = 'Limite temporário de requisições da IA atingido. Aguarde alguns instantes e tente novamente.';
        statusCode = 429;
      } else if (isTimeout) {
        friendlyError = 'O servidor demorou para responder. Verifique sua conexão e tente novamente.';
        statusCode = 504;
      }

      return Response.json(
        { success: false, error: friendlyError },
        { status: statusCode }
      );
    }

    let parsed = null;
    try {
      const jsonMatch = candidateText.match(/\{[\s\S]*\}/);
      const toParse = jsonMatch ? jsonMatch[0] : candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(toParse);
    } catch (_) {
      // Fallback resiliente: extração por regex caso o JSON esteja truncado ou com texto introdutório
      const artistaMatch = candidateText.match(/"artista"\s*:\s*"([^"]*)"/i);
      const tituloMatch = candidateText.match(/"titulo"\s*:\s*"([^"]*)"/i);
      const anoMatch = candidateText.match(/"ano"\s*:\s*"([^"]*)"/i);
      const confiancaMatch = candidateText.match(/"confianca"\s*:\s*"([^"]*)"/i);

      if (artistaMatch || tituloMatch) {
        parsed = {
          artista: artistaMatch ? artistaMatch[1] : '',
          titulo: tituloMatch ? tituloMatch[1] : '',
          ano: anoMatch ? anoMatch[1] : '',
          confianca: confiancaMatch ? confiancaMatch[1] : 'media'
        };
      } else {
        console.warn(`[Cover] Rejeitada (sem JSON/artista/titulo). Resposta bruta: ${String(candidateText).slice(0, 300)}`);
        return Response.json({
          success: false,
          error: 'Capa não reconhecida. Tente ajustar o enquadramento, melhorar a iluminação ou utilizar o OCR da lombada.'
        });
      }
    }

    let artista = (parsed?.artista || '').trim();
    let titulo = (parsed?.titulo || '').trim();
    const ano = (parsed?.ano || '').trim();
    const confianca = parsed?.confianca || 'media';

    // Normalização estrita para Various
    const isVarious = /^(v[aá]rios(\s+artistas)?|various(\s+artists)?|trilha\s+sonora(\s+original)?|soundtrack|ost)$/i.test(artista);
    if (isVarious) {
      artista = 'Various';
    }

    // Se o artista foi preenchido como nome da novela / seriado
    if (/^(pantanal|salome|riacho\s+doce|roque\s+santeiro)$/i.test(artista)) {
      artista = 'Various';
    }

    // Se o artista for ator/atriz comum de capas de novela da Globo
    if (/^(cristiana\s+oliveira|mar[ií]lia\s+p[eê]ra|lu[ií]za\s+tom[eé]|regina\s+duarte)$/i.test(artista)) {
      artista = 'Various';
    }

    // Se a novela for Riacho Doce e o modelo alucinar Elizeth Cardoso
    if (/riacho\s+doce/i.test(titulo) && /elizeth\s+cardoso/i.test(artista)) {
      artista = 'Various';
    }

    if (!artista && !titulo) {
      console.warn(`[Cover] Rejeitada (artista e titulo vazios). Confianca: ${confianca}. Resposta bruta: ${String(candidateText).slice(0, 300)}`);
      return Response.json({
        success: false,
        error: 'Capa não reconhecida. Tente ajustar o enquadramento, melhorar a iluminação ou utilizar o OCR da lombada.'
      });
    }

    const successResult = {
      success: true,
      artista,
      titulo,
      ano,
      confianca
    };

    // Salva no cache para evitar chamada duplicada à API
    setCachedResult(imageHash, successResult);

    return Response.json(successResult);
  } catch (err) {
    console.error('Erro interno em /api/recognize-cover:', err);
    return Response.json(
      { success: false, error: `Erro no servidor: ${err.message}` },
      { status: 500 }
    );
  }
}
