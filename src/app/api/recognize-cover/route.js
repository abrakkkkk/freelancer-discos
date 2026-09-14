// Rota API Next.js para reconhecimento de capa via Gemini Vision
// Suporta tanto Next.js App Router quanto execucao standalone via Response nativo

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest'
];

export async function POST(request) {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return Response.json(
        { success: false, error: 'Chave GEMINI_API_KEY não configurada no servidor.' },
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

Regras:
1. "artista": Nome do artista, banda ou compositor principal (ex: "Secos & Molhados", "Milton Nascimento", "Pink Floyd").
2. "titulo": Título oficial do álbum (ex: "Clube da Esquina", "Construção", "The Dark Side of the Moon"). Se for álbum homônimo, repita o nome do artista.
3. Não inclua ruídos como gravadora (Odeon, Philips, EMI), selos de promoção, carimbos, preços ou termos como "Série Luxo", "Disco é Cultura", "Stereo/Mono".
4. Se for impossível identificar o álbum com qualquer razoabilidade ou a imagem não for de um álbum musical, responda:
{
  "artista": "",
  "titulo": "",
  "ano": "",
  "confianca": "baixa"
}`;

    let geminiRes = null;
    let geminiData = null;
    let lastError = null;

    // Tenta os modelos disponíveis em ordem de prioridade com timeout adequado para mobile
    for (const model of GEMINI_MODELS) {
      try {
        const generationConfig = {
          responseMimeType: 'application/json',
          temperature: 0,
          maxOutputTokens: 800
        };

        // gemini-3.5-flash suporta desativar thinking para respostas instantâneas sem estourar orçamento de tokens
        if (model === 'gemini-3.5-flash') {
          generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }

        const payload = {
          contents: [
            {
              parts: [
                { text: systemPrompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig
        };

        const timeoutMs = model === 'gemini-3.5-flash-lite' ? 9000 : 7000;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs)
        });

        const data = await res.json();
        if (res.ok) {
          geminiRes = res;
          geminiData = data;
          break;
        } else {
          lastError = data.error?.message || `Erro ${res.status}`;
          // Se for 404 (modelo descontinuado) ou 503 (alta demanda) ou 429 (quota), tenta o próximo modelo
          if (res.status === 404 || res.status === 503 || res.status === 429) {
            continue;
          } else {
            break;
          }
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!geminiData || !geminiRes || !geminiRes.ok) {
      console.error('Erro ao chamar Gemini Vision:', lastError);
      const isQuota = typeof lastError === 'string' && (lastError.includes('quota') || lastError.includes('429') || lastError.includes('RESOURCE_EXHAUSTED'));
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

    const parts = geminiData.candidates?.[0]?.content?.parts || [];
    const candidateText = parts.map(p => p.text).filter(Boolean).join('\n').trim();
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

    const artista = (parsed?.artista || '').trim();
    const titulo = (parsed?.titulo || '').trim();
    const ano = (parsed?.ano || '').trim();
    const confianca = parsed?.confianca || 'media';

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
