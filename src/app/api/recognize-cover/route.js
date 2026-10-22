// Rota API Next.js para reconhecimento de capa via Gemini Vision
// Suporta tanto Next.js App Router quanto execucao standalone via Response nativo

import { createHash } from 'crypto';
import { readAiImage } from '@/lib/ai-image';

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
  return createHash('sha256').update(base64Data).digest('hex');
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

function extrairPrecoValido(valor) {
  if (valor === undefined || valor === null) return '';
  let str = String(valor).trim();
  if (!str) return '';

  // Remove "R$", "$", espaços
  str = str.replace(/r?\$|\s/gi, '');
  // Remove sufixos comuns de preços manuscritos como ",-", ",=", ",00", ".00"
  str = str.replace(/[,.](00|-|=)$/, '');

  // Se tiver vírgula ou ponto decimal para centavos (ex: "35,50" ou "35.50")
  if (/^\d+[,.]\d{1,2}$/.test(str)) {
    const floatVal = parseFloat(str.replace(',', '.'));
    if (!isNaN(floatVal) && floatVal > 0 && floatVal < 100000) {
      return Math.round(floatVal).toString();
    }
  }

  // Preço puro inteiro ou com pontos de milhar (ex: "50", "150", "1.200")
  const digitos = str.replace(/\D/g, '');
  if (digitos) {
    const num = parseInt(digitos, 10);
    if (num > 0 && num < 100000) {
      return num.toString();
    }
  }

  return '';
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

    const parsedImage = await readAiImage(request);
    if (!parsedImage.ok) {
      return Response.json(
        { success: false, error: parsedImage.error },
        { status: parsedImage.status }
      );
    }
    const { mimeType, base64Data } = parsedImage;

    // Cache hit: retorna resultado anterior instantaneamente (0ms, 0 custo)
    const imageHash = getImageHash(base64Data);
    const cached = getCachedResult(imageHash);
    if (cached) {
      console.log(`[Cover Recognition] Cache hit (${imageHash}) — economia de 1 chamada API`);
      return Response.json(cached);
    }

    // Prompt otimizado para capas e detecção de etiqueta de preço branca manuscrita
    const systemPrompt = `Identifique artista, título, ano e preço da capa de disco (vinil/CD).
REGRAS:
1. Use memória visual ou transcreva o texto exato da capa; NUNCA invente nomes.
2. Coletânea ou trilha sonora de novela/filme = artista "Various".
3. ETIQUETA DE PREÇO: Procure por uma etiqueta adesiva padrão branca (colada na capa ou no plástico) com preço escrito à mão.
- Não existem valores quebrados ou centavos.
- Os preços SEMPRE terminam em 0 ou 5 (raramente em 5; na grande maioria das vezes terminam em 0, por exemplo: 120, 50, 40, 20, e raramente 45). Use esse padrão para desambiguar a caligrafia manuscrita.
- Extraia apenas o número inteiro no campo "preco" (ex: "120", "50", "40", "20", "45"). Não confunda com números de catálogo ou preços gráficos da capa. Se não houver etiqueta legível, deixe "preco": "".
4. Se incerto sobre a capa, deixe artista/titulo vazios e confianca "baixa".
JSON: {"artista":"","titulo":"","ano":"","preco":"","confianca":"alta|media|baixa"}`;

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
      const precoMatch = candidateText.match(/"preco"\s*:\s*"?([^",}]*)"?/i);
      const confiancaMatch = candidateText.match(/"confianca"\s*:\s*"([^"]*)"/i);

      if (artistaMatch || tituloMatch) {
        parsed = {
          artista: artistaMatch ? artistaMatch[1] : '',
          titulo: tituloMatch ? tituloMatch[1] : '',
          ano: anoMatch ? anoMatch[1] : '',
          preco: precoMatch ? precoMatch[1] : '',
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
    const preco = extrairPrecoValido(parsed?.preco);
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
      preco,
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
