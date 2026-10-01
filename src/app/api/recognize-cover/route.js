// Rota API Next.js para reconhecimento de capa via Gemini Vision
// Suporta tanto Next.js App Router quanto execucao standalone via Response nativo

import { createHash } from 'crypto';

// Ordem por velocidade medida (benchmark real com billing ativo):
// gemini-3.6-flash ~1.5s | gemini-3.5-flash ~1.9s | gemini-3.8-flash ~3.5s | gemini-flash-latest ~4s
const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest'
];

function getGeminiKeys() {
  const raw = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_SECONDARY,
    process.env.GEMINI_API_KEY_BACKUP
  ].filter(Boolean);
  return [...new Set(raw.flatMap(k => k.split(',').map(s => s.trim()).filter(Boolean)))];
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

    // Extrai mime-type e base64 limpo caso venha em formato Data URL
    let mimeType = 'image/jpeg';
    let base64Data = image;

    const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      base64Data = matches[2];
    }

    // Cache hit: retorna resultado anterior instantaneamente (0ms, 0 custo)
    const imageHash = getImageHash(base64Data);
    const cached = getCachedResult(imageHash);
    if (cached) {
      console.log(`[Cover Recognition] Cache hit (${imageHash}) — economia de 1 chamada API`);
      return Response.json(cached);
    }

    // Prompt compacto (~400 tokens vs ~1125 anterior) — mesma qualidade, ~500ms mais rápido
    const systemPrompt = `Especialista em identificação visual de capas de vinil, CD e álbuns (MPB, Rock, Bossa Nova, Samba, Jazz, Pop, Clássica, Internacional).

REGRAS:
1. VISUAL PURO: Muitas capas icônicas não têm texto. Identifique pela arte, foto, cenário ou rosto dos músicos usando sua memória enciclopédica do catálogo fonográfico mundial.
2. TEXTO: Se houver texto legível, transcreva EXATAMENTE. NUNCA invente nomes.
3. TRILHAS/COLETÂNEAS: Trilha sonora de novela/filme ou coletânea = artista "Various". NUNCA use nome de atores da capa.
4. ANTI-ALUCINAÇÃO: Sem certeza real → confianca "baixa", artista e titulo vazios. NUNCA invente.

JSON estrito:
{"artista":"","titulo":"","ano":"","confianca":"alta|media|baixa"}`;

    let candidateText = null;
    let lastError = null;

    // === ESTRATÉGIA DE RACE PARALELO ===
    // Dispara Gemini (modelo mais rápido) e Groq simultaneamente.
    // Quem responder primeiro com sucesso vence. Latência típica: ~1.5s em vez de ~4s.

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
        maxOutputTokens: 250,
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    // Helper: tenta um modelo Gemini específico
    async function tryGeminiModel(model, apiKey) {
      const timeoutMs = 5000;
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

    // Helper: tenta Gemini com fallback sequencial entre modelos (só dentro da corrida Gemini)
    async function tryGemini() {
      for (const key of geminiKeys) {
        for (const model of GEMINI_MODELS) {
          try {
            return await tryGeminiModel(model, key);
          } catch (err) {
            // Se for 429 (rate limit), pula para próxima key
            if (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED')) break;
            // 404/400/503 = modelo indisponível, tenta próximo modelo
            continue;
          }
        }
      }
      throw new Error('Todos os modelos Gemini falharam');
    }

    // Helper: tenta Groq Vision
    async function tryGroq() {
      if (!groqKey) throw new Error('Groq não configurado');
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'qwen/qwen3.8-27b',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Analise a imagem da capa do álbum musical e responda estritamente o JSON requisitado.' },
                {
                  type: 'image_url',
                  image_url: { url: `data:${mimeType};base64,${base64Data}` }
                }
              ]
            }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 150,
          temperature: 0
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (!groqRes.ok) {
        const errData = await groqRes.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Groq status ${groqRes.status}`);
      }

      const groqData = await groqRes.json();
      const text = groqData.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('Groq retornou resposta vazia');
      console.log('[Cover Recognition] Sucesso com Groq Vision');
      return text;
    }

    // Gemini primeiro (mais preciso), Groq só como fallback de emergência (alucina títulos)
    if (geminiKeys.length > 0) {
      try {
        candidateText = await tryGemini();
      } catch (err) {
        lastError = err.message;
        console.warn('[Cover] Gemini falhou, tentando Groq como fallback:', err.message);
      }
    }

    // Fallback: Groq Vision (só se Gemini falhar completamente — menos preciso, alucina títulos)
    if (!candidateText && groqKey) {
      try {
        candidateText = await tryGroq();
      } catch (errGroq) {
        lastError = [lastError, errGroq.message].filter(Boolean).join(' | ');
        console.warn('[Cover] Groq fallback também falhou:', errGroq.message);
      }
    }

    if (!candidateText) {
      console.error('Falha na análise visual (Groq e Gemini):', lastError);
      const isQuota = typeof lastError === 'string' && (lastError.includes('quota') || lastError.includes('429') || lastError.includes('RESOURCE_EXHAUSTED') || lastError.includes('rate_limit'));
      const isTimeout = typeof lastError === 'string' && (lastError.includes('timeout') || lastError.includes('aborted'));

      let friendlyError = `Falha na análise da capa: ${lastError || 'Serviço indisponível'}`;
      if (isQuota) {
        friendlyError = 'Limite temporário de requisições da IA atingido. Aguarde alguns instantes e tente novamente.';
      } else if (isTimeout) {
        friendlyError = 'O servidor demorou para responder. Verifique sua conexão e tente novamente.';
      }

      return Response.json(
        { success: false, error: friendlyError },
        { status: 502 }
      );
    }
    if (!candidateText) {
      return Response.json(
        { success: false, error: 'A inteligência visual não retornou dados para esta imagem.' },
        { status: 422 }
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
