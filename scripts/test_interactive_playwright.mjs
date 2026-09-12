import { chromium, devices } from 'playwright';
import path from 'path';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();

  // 1. Testar busca no catálogo
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  const searchInput = page.locator('input[type="text"]').first();
  await searchInput.fill('Beatles');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'public/audit_screenshots/11_catalogo_busca_beatles.png' });

  // 2. Testar clicar no botão de saída (lixeira / baixa) do primeiro card para ver o modal de confirmação
  const deleteBtn = page.locator('button[title*="baixa" i], button:has(svg)').nth(5);
  // Vamos buscar pelo botão vermelho com svg de lixeira
  const trashBtn = page.locator('button[style*="rgb(229, 62, 62)"], button[style*="#e53e3e"], button:has-text("Excluir"), button:has-text("Saída")').first();
  if (await trashBtn.count() > 0) {
    await trashBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'public/audit_screenshots/12_modal_baixa_rapida.png' });
    // Cancelar para não apagar nada
    const cancelBtn = page.locator('button:has-text("Cancelar")').first();
    if (await cancelBtn.count() > 0) await cancelBtn.click();
  }

  // 3. Testar página de edição
  const editBtn = page.locator('a[href*="/editar"]').first();
  if (await editBtn.count() > 0) {
    await editBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'public/audit_screenshots/13_editar_mobile.png' });

    // Rolar até o fim do formulário de edição
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'public/audit_screenshots/14_editar_scrolled_bottom.png' });
  }

  await browser.close();
  console.log('✅ Testes complementares de busca, modal de saída e edição concluídos!');
}

run().catch(console.error);
