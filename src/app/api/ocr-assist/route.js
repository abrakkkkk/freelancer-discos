// Rota API Next.js para leitura assistida de codigos de catalogo fonograficos dificeis via Gemini Vision

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash'
];

function getGeminiKeys() {
  const raw = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_SECONDARY,
    process.env.GEMINI_API_KEY_BACKUP
  ].filter(Boolean);
  return [...new Set(raw.flatMap(k => k.split(',').map(s => s.trim()).filter(Boolean)))];
}

export async function POST(request) {
  try {
    const groqKey = process.env.GROQ_API_KEY?.trim();
    const geminiKeys = getGeminiKeys();
    if (!groqKey && geminiKeys.length === 0) {
      return Response.json(
        { success: false, error: 'Nenhuma chave de IA (GROQ_API_KEY ou GEMINI_API_KEY) configurada no servidor.' },
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

    let mimeType = 'image/jpeg';
    let base64Data = image;

    const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      base64Data = matches[2];
    }

    const systemPrompt = `Você é um perito fonográfico e catalogador de discos de vinil e CDs brasileiros e internacionais.
Analise a imagem deste recorte (lombada, contracapa ou selo do vinil).
Identifique e extraia estritamente o CÓDIGO DE CATÁLOGO / NÚMERO DE REFERÊNCIA FONOGRÁFICA (ex: "COLP 12225", "SMOFB 3624", "BPL 15", "OW 606", "31C 064 422894", "6349 050", "150 0006", "138.250", "XSLP 1001", "710 0680").

Retorne estritamente um JSON com este formato:
{
  "codigo": "COLP 12225",
  "confianca": "alta"
}

Regras obrigatórias:
1. Ignore palavras institucionais como "STEREO", "MONO", "LADO 1", "33 RPM", "DISCO É CULTURA", "SÉRIE LUXO", nomes de músicas, preços ou CNPJ.
2. Preserve letras do prefixo e números (ex: se estiver escrito "COLP 12225", retorne "COLP 12225").
3. Se não houver nenhum código legível na imagem, responda:
{
  "codigo": "",
  "confianca": "baixa"
}`;

    let rawText = null;
    let lastError = null;

    // 1. TENTATIVA PRIORITÁRIA: Groq Vision (qwen/qwen3.8-27b - ultra-rápido ~800ms)
    if (groqKey) {
      try {
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
                  { type: 'text', text: 'Extraia o código de catálogo desta imagem e responda estritamente o JSON requisitado.' },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${mimeType};base64,${base64Data}`
                    }
                  }
                ]
              }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 50,
            temperature: 0
          }),
          signal: AbortSignal.timeout(4000)
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          rawText = groqData.choices?.[0]?.message?.content?.trim();
        } else {
          const errData = await groqRes.json().catch(() => ({}));
          lastError = errData?.error?.message || `Groq status ${groqRes.status}`;
          console.warn('Groq OCR falhou, acionando fallback Gemini:', lastError);
        }
      } catch (errGroq) {
        lastError = errGroq.message;
        console.warn('Groq OCR indisponível, acionando fallback Gemini:', errGroq.message);
      }
    }

    // 2. FALLBACK AUTOMÁTICO: Google Gemini Vision
    if (!rawText && geminiKeys.length > 0) {
      keysLoop: for (const key of geminiKeys) {
        for (const model of GEMINI_MODELS) {
          try {
            const generationConfig = {
              responseMimeType: 'application/json',
              temperature: 0,
              maxOutputTokens: 50
            };

            if (model === 'gemini-3.6-flash' || model === 'gemini-flash-latest') {
              generationConfig.thinkingConfig = { thinkingBudget: 0 };
            }

            const payload = {
              contents: [
                {
                  parts: [
                    { text: systemPrompt },
                    {
                      inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                      }
                    }
                  ]
                }
              ],
              generationConfig
            };

            const timeoutMs = 25000;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(timeoutMs)
            });

            const data = await res.json();
            if (res.ok) {
              const parts = data.candidates?.[0]?.content?.parts || [];
              rawText = parts.map(p => p.text).filter(Boolean).join('\n').trim();
              if (rawText) break keysLoop;
            } else {
              lastError = data.error?.message || `Erro ${res.status}`;
              console.warn(`Tentativa Gemini OCR com ${model} falhou (${res.status}): ${lastError}`);
              if (res.status === 429) {
                break;
              }
              if (res.status === 404 || res.status === 503 || res.status === 400) {
                continue;
              } else {
                break;
              }
            }
          } catch (err) {
            lastError = err.message;
            console.warn(`Tentativa Gemini OCR com ${model} disparou exceção: ${err.message}`);
          }
        }
      }
    }

    if (!rawText) {
      const isQuota = typeof lastError === 'string' && (lastError.includes('quota') || lastError.includes('429') || lastError.includes('RESOURCE_EXHAUSTED') || lastError.includes('rate_limit'));
      const isTimeout = typeof lastError === 'string' && (lastError.includes('timeout') || lastError.includes('aborted'));

      let friendlyError = `Não foi possível ler o código com IA: ${lastError || 'Serviço indisponível'}`;
      if (isQuota) {
        friendlyError = 'Limite temporário de requisições da IA atingido. Aguarde alguns instantes.';
      } else if (isTimeout) {
        friendlyError = 'Tempo limite de leitura esgotado. Tente aproximar a câmera da lombada.';
      }

      return Response.json(
        { success: false, error: friendlyError },
        { status: 502 }
      );
    }
    if (!rawText) {
      return Response.json(
        { success: false, error: 'A IA não retornou dados legíveis.' },
        { status: 502 }
      );
    }

    let parsed = null;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const toParse = jsonMatch ? jsonMatch[0] : rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(toParse);
    } catch {
      const codigoMatch = rawText.match(/"codigo"\s*:\s*"([^"]*)"/i);
      const confiancaMatch = rawText.match(/"confianca"\s*:\s*"([^"]*)"/i);
      if (codigoMatch) {
        parsed = {
          codigo: codigoMatch[1],
          confianca: confiancaMatch ? confiancaMatch[1] : 'media'
        };
      } else {
        return Response.json(
          { success: false, error: 'Não foi possível isolar um código válido nesta imagem.' },
          { status: 502 }
        );
      }
    }

    const codigoLimpo = (parsed?.codigo || '').trim();

    return Response.json({
      success: true,
      codigo: codigoLimpo,
      confianca: parsed?.confianca || 'media'
    });
  } catch (error) {
    console.error('Erro na rota /api/ocr-assist:', error);
    return Response.json(
      { success: false, error: 'Erro interno ao processar OCR assistido.' },
      { status: 500 }
    );
  }
}
