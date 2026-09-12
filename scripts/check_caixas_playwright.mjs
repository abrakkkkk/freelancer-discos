import { chromium, devices } from 'playwright';

async function checkCaixas() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['Pixel 7'],
  });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLogs.push(`[PAGE ERROR] ${err.message}`));

  console.log('--- 1. VERIFICANDO / (CATÁLOGO) ---');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const selectCaixasOptions = await page.$$eval('select', selects => {
    return selects.map(s => ({
      name: s.name,
      id: s.id,
      optionsCount: s.options.length,
      firstOptions: Array.from(s.options).slice(0, 5).map(o => o.text)
    }));
  });
  console.log('Selects no Catálogo:', JSON.stringify(selectCaixasOptions, null, 2));

  console.log('\n--- 2. VERIFICANDO /adicionar ---');
  await page.goto('http://localhost:3000/adicionar', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const datalistAdicionar = await page.$$eval('datalist#caixas-list option', opts => {
    return {
      count: opts.length,
      firstOptions: opts.slice(0, 5).map(o => o.value)
    };
  });
  console.log('Datalist em /adicionar:', datalistAdicionar);

  const inputCaixa = await page.$('input[name="caixa"]');
  console.log('Existe input[name="caixa"] em /adicionar?', !!inputCaixa);

  console.log('\n--- 3. VERIFICANDO /editar?id=6712&tipo=discos ---');
  await page.goto('http://localhost:3000/editar?id=6712&tipo=discos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const datalistEditar = await page.$$eval('datalist#caixas-list option', opts => {
    return {
      count: opts.length,
      firstOptions: opts.slice(0, 5).map(o => o.value)
    };
  });
  console.log('Datalist em /editar:', datalistEditar);

  console.log('\n--- 4. VERIFICANDO /lote ---');
  await page.goto('http://localhost:3000/lote', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const selectsLote = await page.$$eval('select', selects => {
    return selects.map(s => ({
      name: s.name,
      id: s.id,
      optionsCount: s.options.length,
      firstOptions: Array.from(s.options).slice(0, 5).map(o => o.text)
    }));
  });
  console.log('Selects em /lote:', JSON.stringify(selectsLote, null, 2));

  console.log('\n--- CONSOLE LOGS ---');
  console.log(consoleLogs.join('\n'));

  await browser.close();
}

checkCaixas().catch(console.error);
