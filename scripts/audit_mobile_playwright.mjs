import { chromium, devices } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve('public/audit_screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runAudit() {
  console.log('🚀 Iniciando auditoria mobile com Playwright...');
  const browser = await chromium.launch({ headless: true });
  
  // Emulação Pixel 7 (Android) e iPhone 14 Pro
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    permissions: ['camera']
  });

  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  // 1. Página Inicial / Catálogo
  console.log('📸 1. Acessando Catálogo mobile...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_catalogo_mobile.png'), fullPage: false });

  // Checar overflow horizontal no body
  const overflowX = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`Verificação de overflow horizontal no catálogo: ${overflowX ? '⚠️ VAZAMENTO DETECTADO' : '✅ OK (sem vazamento)'}`);

  // 2. Abrir Modal de Scanner de Capa no Catálogo
  console.log('📸 2. Abrindo Modal de Scanner de Capa...');
  // Procura o botão de scanner de capa na barra do catálogo
  const btnCapa = page.locator('.catalog-camera-btn, .discogs-btn-capa, button:has(svg)').first();
  // Se houver botão com título ou aria ou classe
  const btnCapaCatalogo = page.locator('button[title*="capa" i], button:has-text("Capa"), .catalog-camera-btn').first();
  if (await btnCapaCatalogo.count() > 0) {
    await btnCapaCatalogo.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_modal_capa_catalogo.png') });
    // Fecha o modal
    const closeBtn = page.locator('button[aria-label="Fechar modal"], .scanner-close-btn').first();
    if (await closeBtn.count() > 0) await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // 3. Página de Adicionar Disco
  console.log('📸 3. Acessando Adicionar Disco mobile...');
  await page.goto('http://localhost:3000/adicionar', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_adicionar_mobile.png') });

  // 4. Testar Botões de Scanner em /adicionar (Capa, Barras, OCR)
  console.log('📸 4. Testando Modal de Capa em /adicionar...');
  const chipCapa = page.locator('.discogs-btn-capa, button:has-text("Capa")').first();
  if (await chipCapa.count() > 0) {
    await chipCapa.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_modal_capa_adicionar.png') });
    const closeBtn = page.locator('button[aria-label="Fechar modal"]').first();
    if (await closeBtn.count() > 0) await closeBtn.click();
    await page.waitForTimeout(500);
  }

  console.log('📸 5. Testando Modal de Código de Barras em /adicionar...');
  const chipBarras = page.locator('.discogs-btn-escanear, button:has-text("Barras")').first();
  if (await chipBarras.count() > 0) {
    await chipBarras.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_modal_barcode_adicionar.png') });
    const closeBtn = page.locator('.scanner-close-btn').first();
    if (await closeBtn.count() > 0) await closeBtn.click();
    await page.waitForTimeout(500);
  }

  console.log('📸 6. Testando Modal de OCR em /adicionar...');
  const chipOcr = page.locator('.discogs-btn-ocr, button:has-text("OCR")').first();
  if (await chipOcr.count() > 0) {
    await chipOcr.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_modal_ocr_adicionar.png') });
    const closeBtn = page.locator('.scanner-close-btn').first();
    if (await closeBtn.count() > 0) await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // 7. Página de Movimentações
  console.log('📸 7. Acessando Movimentações...');
  await page.goto('http://localhost:3000/movimentacoes', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_movimentacoes_mobile.png') });

  // 8. Página de Lote
  console.log('📸 8. Acessando Cadastro em Lote...');
  await page.goto('http://localhost:3000/lote', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08_lote_mobile.png') });

  // Resumo de Erros
  console.log('\n--- RELATÓRIO DE CONSOLE & ERROS ---');
  console.log('Total de Page Errors:', pageErrors.length);
  if (pageErrors.length > 0) {
    pageErrors.forEach(e => console.log('❌ Error:', e));
  }
  console.log('Total de Logs/Warnings:', consoleLogs.length);
  if (consoleLogs.length > 0) {
    consoleLogs.slice(0, 10).forEach(l => console.log('⚠️ Log:', l));
  }

  await browser.close();
  console.log('\n✅ Auditoria concluída! Screenshots salvos em public/audit_screenshots/');
}

runAudit().catch(err => {
  console.error('Falha na auditoria Playwright:', err);
  process.exit(1);
});
