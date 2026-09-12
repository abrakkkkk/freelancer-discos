// Rota API Next.js para leitura assistida de codigos de catalogo fonograficos dificeis via Gemini Vision

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
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: 50
      }
    };

    let geminiRes = null;
    let geminiData = null;
    let lastError = null;

    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(4500)
        });

        const data = await res.json();
        if (res.ok) {
          geminiRes = res;
          geminiData = data;
          break;
        } else {
          lastError = data.error?.message || `Erro ${res.status}`;
          console.warn(`Tentativa Gemini OCR com ${model} falhou (${res.status}): ${lastError}`);
          continue;
        }
      } catch (err) {
        lastError = err.message;
        console.warn(`Tentativa Gemini OCR com ${model} disparou exceção: ${err.message}`);
      }
    }

    if (!geminiData || !geminiRes) {
      return Response.json(
        { success: false, error: `Não foi possível ler o código com IA: ${lastError || 'Timeout'}` },
        { status: 502 }
      );
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return Response.json(
        { success: false, error: 'A IA não retornou dados legíveis.' },
        { status: 502 }
      );
    }

    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return Response.json(
          { success: false, error: 'Resposta da IA não está em formato JSON válido.' },
          { status: 502 }
        );
      }
    }

    const codigoLimpo = (parsed.codigo || '').trim();

    return Response.json({
      success: true,
      codigo: codigoLimpo,
      confianca: parsed.confianca || 'media'
    });
  } catch (error) {
    console.error('Erro na rota /api/ocr-assist:', error);
    return Response.json(
      { success: false, error: 'Erro interno ao processar OCR assistido.' },
      { status: 500 }
    );
  }
}
