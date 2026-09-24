// Rota API Next.js para reconhecimento de capa via Gemini Vision
// Suporta tanto Next.js App Router quanto execucao standalone via Response nativo

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

    // Extrai mime-type e base64 limpo caso venha em formato Data URL
    let mimeType = 'image/jpeg';
    let base64Data = image;

    const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      base64Data = matches[2];
    }

    const systemPrompt = `Você é um especialista em identificação de discos de vinil, CDs e capas de álbuns musicais (MPB, Samba, Rock, Bossa Nova, Pop, Internacional).
Analise com máxima atenção a imagem desta capa de álbum de música.
Mesmo que a tipografia seja estilizada, caligráfica, psicodélica ou que a arte seja puramente visual/fotográfica sem texto explícito, use seu conhecimento histórico fonográfico para identificar com precisão a obra.

Retorne estritamente um objeto JSON com esta estrutura:
{
  "artista": "Nome do Artista ou Grupo",
  "titulo": "Nome do Álbum",
  "ano": "1973",
  "confianca": "alta"
}

Regras Obrigatórias:
1. "artista": Nome do artista, banda ou compositor principal (ex: "Secos & Molhados", "Milton Nascimento", "Pink Floyd").
2. TRILHAS SONORAS E COLETÂNEAS (REGRA CRÍTICA):
   - Se o álbum for uma trilha sonora de novela, seriado, minissérie ou filme (ex: "Riacho Doce", "Pantanal", "Roque Santeiro", "Selva de Pedra", "Ciranda de Pedra", "Anos Dourados", "Anos Rebeldes", "Tieta", "Vale Tudo", etc.) ou coletânea de múltiplos intérpretes: o campo "artista" DEVE SER OBRIGATORIAMENTE "Various" (em inglês, padrão internacional fonográfico Discogs).
   - NUNCA use "Vários", "Varios", "Vários Artistas" ou "Trilha Sonora".
   - NUNCA use o nome de atores/atrizes que aparecem na foto da capa (ex: Luíza Tomé, Cristiana Oliveira, Regina Duarte, Malu Mader, Marília Pêra) como artista.
   - NUNCA use cantores de faixas avulsas (ex: Elizeth Cardoso, Ronnie Von) como artista de uma trilha sonora de novela.
3. "titulo": Título oficial do álbum ou da novela (ex: "Riacho Doce", "Roque Santeiro - Volume 2", "Pantanal", "Clube da Esquina"). Se for álbum homônimo, repita o nome do artista.
4. Não inclua ruídos como gravadora (Odeon, Philips, Som Livre, EMI), selos de promoção, carimbos, preços ou termos como "Série Luxo", "Disco é Cultura", "Stereo/Mono".
5. Se for impossível identificar o álbum com qualquer razoabilidade ou a imagem não for de um álbum musical, responda:
{
  "artista": "",
  "titulo": "",
  "ano": "",
  "confianca": "baixa"
}`;

    let candidateText = null;
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
                  { type: 'text', text: 'Analise a imagem da capa do álbum musical e responda estritamente o JSON requisitado.' },
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
            max_tokens: 80,
            temperature: 0
          }),
          signal: AbortSignal.timeout(4500)
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          candidateText = groqData.choices?.[0]?.message?.content?.trim();
        } else {
          const errData = await groqRes.json().catch(() => ({}));
          lastError = errData?.error?.message || `Groq status ${groqRes.status}`;
          console.warn('Groq Vision falhou, acionando fallback Gemini:', lastError);
        }
      } catch (errGroq) {
        lastError = errGroq.message;
        console.warn('Groq Vision indisponível, acionando fallback Gemini:', errGroq.message);
      }
    }

    // 2. FALLBACK AUTOMÁTICO: Google Gemini Vision
    if (!candidateText && geminiKeys.length > 0) {
      keysLoop: for (const key of geminiKeys) {
        for (const model of GEMINI_MODELS) {
          try {
            const generationConfig = {
              responseMimeType: 'application/json',
              temperature: 0,
              maxOutputTokens: 80
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
              candidateText = parts.map(p => p.text).filter(Boolean).join('\n').trim();
              if (candidateText) break keysLoop;
            } else {
              lastError = data.error?.message || `Erro ${res.status}`;
              console.warn(`Tentativa Gemini Capa com ${model} falhou (${res.status}): ${lastError}`);
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
            console.warn(`Tentativa Gemini Capa com ${model} disparou exceção: ${err.message}`);
          }
        }
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

    return Response.json({
      success: true,
      artista,
      titulo,
      ano,
      confianca
    });
  } catch (err) {
    console.error('Erro interno em /api/recognize-cover:', err);
    return Response.json(
      { success: false, error: `Erro no servidor: ${err.message}` },
      { status: 500 }
    );
  }
}
