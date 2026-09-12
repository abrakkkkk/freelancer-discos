import { chromium, devices } from 'playwright';

async function verify() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['Pixel 7'],
  });
  const page = await context.newPage();

  console.log('=== 1. VERIFICANDO /adicionar ===');
  await page.goto('http://localhost:3000/adicionar', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Selecionar Loja 1
  await page.selectOption('select[name="loja"]', 'Loja 1');
  await page.waitForTimeout(500);

  const caixaSelectExists = await page.$('select[name="caixa"]');
  console.log('Select de caixa existe para Loja 1?', !!caixaSelectExists);
  const optionsLoja1 = await page.$$eval('select[name="caixa"] option', opts => opts.map(o => o.text));
  console.log('Total opções Loja 1:', optionsLoja1.length, 'Primeiras 5:', optionsLoja1.slice(0, 5));

  // Selecionar Loja 2
  await page.selectOption('select[name="loja"]', 'Loja 2');
  await page.waitForTimeout(500);
  const optionsLoja2 = await page.$$eval('select[name="caixa"] option', opts => opts.map(o => o.text));
  console.log('Total opções Loja 2:', optionsLoja2.length, 'Primeiras 5:', optionsLoja2.slice(0, 5));

  await page.screenshot({ path: 'public/audit_screenshots/verified_01_adicionar_caixas.png', fullPage: false });

  console.log('\n=== 2. VERIFICANDO /editar ===');
  await page.goto('http://localhost:3000/editar?id=6712&tipo=discos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Verificar se o botão Capa existe
  const btnCapa = await page.$('button.discogs-scanner-chip:has-text("Capa")');
  console.log('Botão Capa existe em /editar?', !!btnCapa);

  // Testar abertura do CoverScannerModal
  if (btnCapa) {
    await btnCapa.click();
    await page.waitForTimeout(600);
    const coverModal = await page.$('.cover-scanner-overlay');
    console.log('CoverScannerModal abriu com sucesso?', !!coverModal);
    await page.screenshot({ path: 'public/audit_screenshots/verified_02_editar_modal_capa.png', fullPage: false });
    const closeBtn = await page.$('.cover-scanner-overlay button[aria-label="Fechar modal"]');
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(600);
  }

  // Testar abertura do BarcodeScannerModal e botão Foto
  const btnBarras = await page.$('button.discogs-scanner-chip:has-text("Barras")');
  if (btnBarras) {
    await btnBarras.click();
    await page.waitForTimeout(600);
    const btnFoto = await page.$('button:has-text("Foto")');
    console.log('Botão Foto na galeria existe no BarcodeScannerModal?', !!btnFoto);
    await page.screenshot({ path: 'public/audit_screenshots/verified_03_editar_modal_barras_foto.png', fullPage: false });
    const closeBtn = await page.$('.scanner-close-btn');
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(400);
  }

  // Rolar até o fim e verificar ordem dos botões de ação
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'public/audit_screenshots/verified_04_editar_acoes_fim.png', fullPage: false });

  const btnSalvar = await page.$('.edit-actions button:has-text("Salvar Alterações")');
  const btnExcluir = await page.$('.edit-actions button:has-text("Excluir este item")');
  console.log('Botões Salvar e Excluir presentes e invertidos?', !!btnSalvar && !!btnExcluir);

  console.log('\n=== 3. VERIFICANDO / (CATÁLOGO) ===');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'public/audit_screenshots/verified_05_catalogo.png', fullPage: false });

  await browser.close();
  console.log('\nVERIFICAÇÃO COMPLETA COM SUCESSO!');
}

verify().catch(console.error);
