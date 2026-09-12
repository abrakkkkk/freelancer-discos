import { chromium, devices } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  const editLink = page.locator('a[href*="/editar"]').first();
  const href = await editLink.getAttribute('href');
  console.log('Link de edição encontrado:', href);

  if (href) {
    await page.goto('http://localhost:3000' + href, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'public/audit_screenshots/12_editar_mobile.png' });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'public/audit_screenshots/13_editar_scrolled_bottom.png' });
  }

  await browser.close();
  console.log('✅ Edição capturada com sucesso!');
}

run().catch(console.error);
