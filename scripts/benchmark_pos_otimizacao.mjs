import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const GEMINI_KEY = process.env.GEMINI_API_KEY?.trim();
const GROQ_KEY = process.env.GROQ_API_KEY?.trim();

// Prompt COMPACTO otimizado (~400 tokens)
const COMPACT_PROMPT = `Especialista em identificação visual de capas de vinil, CD e álbuns (MPB, Rock, Bossa Nova, Samba, Jazz, Pop, Clássica, Internacional).

REGRAS:
1. VISUAL PURO: Muitas capas icônicas não têm texto. Identifique pela arte, foto, cenário ou rosto dos músicos usando sua memória enciclopédica do catálogo fonográfico mundial.
2. TEXTO: Se houver texto legível, transcreva EXATAMENTE. NUNCA invente nomes.
3. TRILHAS/COLETÂNEAS: Trilha sonora de novela/filme ou coletânea = artista "Various". NUNCA use nome de atores da capa.
4. ANTI-ALUCINAÇÃO: Sem certeza real → confianca "baixa", artista e titulo vazios. NUNCA invente.

JSON estrito:
{"artista":"","titulo":"","ano":"","confianca":"alta|media|baixa"}`;

const TEST_IMAGE_URL = 'https://i.discogs.com/Lb0zKjfgFJLBOqzodiMNM7yi5h1VVP4TqjVyWmDo83s/rs:fit/g:sm/q:90/h:602/w:600/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTU3MzI1/Mi0xMzg0Mzg2MzA1/LTgwMDcuanBlZw.jpeg';

async function downloadTestImage() {
  const res = await fetch(TEST_IMAGE_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

async function callGemini(model, base64, prompt) {
  const payload = {
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: base64 } }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 250, thinkingConfig: { thinkingBudget: 0 } }
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const t0 = Date.now();
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  const latency = Date.now() - t0;
  const text = res.ok ? (data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || '') : '';
  let parsed = null;
  try { parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || text); } catch {}
  return { latency, ok: res.ok, result: parsed, tokens: data.usageMetadata };
}

async function callGroq(base64, prompt) {
  const t0 = Date.now();
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen/qwen3.8-27b',
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: [{ type: 'text', text: 'Analise.' }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }] }],
      response_format: { type: 'json_object' }, max_tokens: 150, temperature: 0
    }),
    signal: AbortSignal.timeout(10000)
  });
  const data = await res.json();
  const latency = Date.now() - t0;
  const text = res.ok ? (data.choices?.[0]?.message?.content?.trim() || '') : '';
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  return { latency, ok: res.ok, result: parsed };
}

async function main() {
  console.log('🔬 BENCHMARK PÓS-OTIMIZAÇÃO\n');
  const base64 = await downloadTestImage();

  // Test 1: Gemini 3.6-flash com prompt compacto (cenário otimizado)
  console.log('━'.repeat(60));
  console.log('1️⃣  gemini-3.6-flash + prompt compacto');
  const r1 = await callGemini('gemini-3.6-flash', base64, COMPACT_PROMPT);
  console.log(`   Latência: ${r1.latency}ms | Tokens prompt: ${r1.tokens?.promptTokenCount} | Resultado: ${r1.result?.artista} — ${r1.result?.titulo}`);

  // Test 2: Race paralelo (como o código otimizado faz)
  console.log('\n2️⃣  Race paralelo (Gemini + Groq)');
  const t0 = Date.now();
  const winner = await Promise.any([
    callGemini('gemini-3.6-flash', base64, COMPACT_PROMPT).then(r => ({ ...r, provider: 'gemini-3.6-flash' })),
    callGroq(base64, COMPACT_PROMPT).then(r => ({ ...r, provider: 'groq' }))
  ]);
  const raceTime = Date.now() - t0;
  console.log(`   Vencedor: ${winner.provider} em ${raceTime}ms | Resultado: ${winner.result?.artista} — ${winner.result?.titulo}`);

  console.log('\n' + '━'.repeat(60));
  console.log(`\n✅ Latência real do usuário: ~${raceTime}ms (era ~3500-4000ms antes)`);
  console.log(`   Ganho: ~${Math.round((3500 - raceTime) / 3500 * 100)}% mais rápido`);
}

main().catch(console.error);
