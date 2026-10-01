import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const GEMINI_KEY = process.env.GEMINI_API_KEY?.trim();
const GROQ_KEY = process.env.GROQ_API_KEY?.trim();

if (!GEMINI_KEY) {
  console.error('GEMINI_API_KEY não encontrada em .env.local');
  process.exit(1);
}

// Imagem de teste: criar imagem JPEG mínima de 800x800 (quadrado vermelho)
// Para simular payload real, usamos uma imagem do Discogs
const TEST_IMAGE_URL = 'https://i.discogs.com/Lb0zKjfgFJLBOqzodiMNM7yi5h1VVP4TqjVyWmDo83s/rs:fit/g:sm/q:90/h:602/w:600/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTU3MzI1/Mi0xMzg0Mzg2MzA1/LTgwMDcuanBlZw.jpeg';

const MODELS = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
];

const PROMPT = `Analise esta imagem de capa de álbum.
Retorne estritamente um JSON: {"artista":"","titulo":"","ano":"","confianca":"alta|media|baixa"}`;

async function downloadTestImage() {
  console.log('⏳ Baixando imagem de teste do Discogs...');
  const t0 = Date.now();
  const res = await fetch(TEST_IMAGE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!res.ok) throw new Error(`Falha ao baixar imagem: ${res.status}`);
  const buf = await res.arrayBuffer();
  const base64 = Buffer.from(buf).toString('base64');
  const sizeKB = (buf.byteLength / 1024).toFixed(1);
  console.log(`✅ Imagem baixada: ${sizeKB}KB em ${Date.now() - t0}ms\n`);
  return base64;
}

async function benchmarkGemini(model, base64, apiKey) {
  const payload = {
    contents: [{
      parts: [
        { text: PROMPT },
        { inlineData: { mimeType: 'image/jpeg', data: base64 } }
      ]
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0,
      maxOutputTokens: 250,
      ...(model.includes('flash') ? { thinkingConfig: { thinkingBudget: 0 } } : {})
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });
    const latency = Date.now() - t0;
    const data = await res.json();

    if (!res.ok) {
      return { model, latency, status: res.status, error: data.error?.message || `HTTP ${res.status}`, result: null };
    }

    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || '';
    let parsed = null;
    try { parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || text); } catch {}
    
    return { model, latency, status: 200, error: null, result: parsed, tokensUsed: data.usageMetadata };
  } catch (err) {
    return { model, latency: Date.now() - t0, status: 0, error: err.message, result: null };
  }
}

async function benchmarkGroq(base64) {
  if (!GROQ_KEY) return null;

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const payload = {
    model: 'qwen/qwen3.8-27b',
    messages: [
      { role: 'system', content: PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analise a imagem da capa do álbum.' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
        ]
      }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 150,
    temperature: 0
  };

  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });
    const latency = Date.now() - t0;
    const data = await res.json();

    if (!res.ok) {
      return { model: 'groq/qwen3.8-27b', latency, status: res.status, error: data.error?.message, result: null };
    }

    const text = data.choices?.[0]?.message?.content?.trim() || '';
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}

    return { model: 'groq/qwen3.8-27b', latency, status: 200, error: null, result: parsed, usage: data.usage };
  } catch (err) {
    return { model: 'groq/qwen3.8-27b', latency: Date.now() - t0, status: 0, error: err.message, result: null };
  }
}

async function main() {
  console.log('🔬 BENCHMARK DE VELOCIDADE — Reconhecimento de Capa\n');
  console.log(`Chave Gemini: ${GEMINI_KEY.substring(0, 12)}...`);
  console.log(`Chave Groq: ${GROQ_KEY ? GROQ_KEY.substring(0, 12) + '...' : 'NÃO CONFIGURADA'}\n`);

  const base64 = await downloadTestImage();
  const payloadSizeKB = (base64.length * 0.75 / 1024).toFixed(1);
  console.log(`📦 Payload base64: ~${payloadSizeKB}KB decodificado\n`);

  console.log('='.repeat(70));
  console.log('MODELO'.padEnd(25) + 'LATÊNCIA'.padEnd(12) + 'STATUS'.padEnd(10) + 'RESULTADO');
  console.log('='.repeat(70));

  // Benchmark Gemini models sequencialmente
  for (const model of MODELS) {
    const r = await benchmarkGemini(model, base64, GEMINI_KEY);
    const latStr = `${r.latency}ms`;
    const statusStr = r.error ? `❌ ${r.status}` : `✅ ${r.status}`;
    const resultStr = r.result 
      ? `${r.result.artista || '?'} — ${r.result.titulo || '?'}` 
      : (r.error || 'Sem resultado');
    console.log(`${model.padEnd(25)}${latStr.padEnd(12)}${statusStr.padEnd(10)}${resultStr}`);
    
    if (r.tokensUsed) {
      console.log(`  └─ Tokens: prompt=${r.tokensUsed.promptTokenCount}, resp=${r.tokensUsed.candidatesTokenCount || r.tokensUsed.totalTokenCount}`);
    }
  }

  // Benchmark Groq
  if (GROQ_KEY) {
    console.log('-'.repeat(70));
    const gr = await benchmarkGroq(base64);
    if (gr) {
      const latStr = `${gr.latency}ms`;
      const statusStr = gr.error ? `❌ ${gr.status}` : `✅ ${gr.status}`;
      const resultStr = gr.result
        ? `${gr.result.artista || '?'} — ${gr.result.titulo || '?'}`
        : (gr.error || 'Sem resultado');
      console.log(`${'groq/qwen3.8-27b'.padEnd(25)}${latStr.padEnd(12)}${statusStr.padEnd(10)}${resultStr}`);
    }
  }

  console.log('='.repeat(70));
  console.log('\n📊 ANÁLISE:');
  console.log('- Gemini Flash com billing: espera-se ~1-3s por request');
  console.log('- Sem billing (free tier): rate-limit severo, 429s frequentes, latência alta');
  console.log('- Groq Vision: ~600-1200ms típico');
}

main().catch(console.error);
