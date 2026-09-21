import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT_DIR = path.resolve(__dirname, '../public/screenshots');

async function captureAll() {
  console.log('Launching Chrome from:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-running-insecure-content',
    ],
  });

  try {
    const page = await browser.newPage();

    const hideDevOverlays = async () => {
      await page.addStyleTag({
        content: `
          nextjs-portal, 
          [data-nextjs-dialog-overlay], 
          [data-nextjs-toast], 
          div[class*="toast"], 
          div[class*="error"] { 
            display: none !important; 
          }
        `,
      });
    };

    // 1. Mobile PWA Viewport: 01_onboarding.png
    await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2 });
    console.log('Capturing 01_onboarding.png...');
    await page.goto(`${BASE_URL}/onboarding`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    await hideDevOverlays();
    await page.screenshot({ path: path.join(OUT_DIR, '01_onboarding.png') });

    // 2. Mobile PWA Viewport: 02_home_dashboard.png
    console.log('Capturing 02_home_dashboard.png (Mobile)...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2500));
    await hideDevOverlays();
    await page.screenshot({ path: path.join(OUT_DIR, '02_home_dashboard.png') });

    // 2b. Desktop Viewport: 02_home_dashboard_desktop.png
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    console.log('Capturing 02_home_dashboard_desktop.png (Desktop)...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2500));
    await hideDevOverlays();
    await page.screenshot({ path: path.join(OUT_DIR, '02_home_dashboard_desktop.png') });

    // 3. Mobile PWA Viewport: 05_chat_empty_state.png
    await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2 });
    console.log('Capturing 05_chat_empty_state.png...');
    await page.goto(`${BASE_URL}/chat`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    await hideDevOverlays();
    await page.screenshot({ path: path.join(OUT_DIR, '05_chat_empty_state.png') });

    // 4. Mobile PWA Viewport: 03_chat_active.png
    console.log('Capturing 03_chat_active.png (Active Grounded Chat)...');
    await page.setViewport({ width: 412, height: 1080, deviceScaleFactor: 2 });
    await page.goto(`${BASE_URL}/chat`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));
    await hideDevOverlays();

    const form = await page.$('form');
    if (form) {
      const input = await form.$('input');
      if (input) {
        await input.type('Is it safe to spray crops today?');
        await new Promise(r => setTimeout(r, 400));
        await page.keyboard.press('Enter');
      }
    }
    await page.waitForFunction(() => {
      const hasBadge = document.body.innerText.includes('Verified IMD Grounding');
      const hasAdvice = document.body.innerText.includes('spray') || document.body.innerText.includes('safe');
      return hasBadge && hasAdvice;
    }, { timeout: 35000 }).catch(() => console.log('Wait timeout or completed'));
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => {
      const scrollable = document.querySelector('.overflow-y-auto');
      if (scrollable) scrollable.scrollTop = 0;
    });
    await new Promise(r => setTimeout(r, 500));
    await hideDevOverlays();
    await page.screenshot({ path: path.join(OUT_DIR, '03_chat_active.png') });

    // 5. Mobile PWA Viewport: 06_forecast_and_advisory.png
    await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2 });
    console.log('Capturing 06_forecast_and_advisory.png...');
    await page.goto(`${BASE_URL}/forecast`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2500));
    await hideDevOverlays();
    await page.screenshot({ path: path.join(OUT_DIR, '06_forecast_and_advisory.png') });

    // 6. Mobile PWA Viewport: 07_alerts_and_warnings.png
    console.log('Capturing 07_alerts_and_warnings.png...');
    await page.goto(`${BASE_URL}/alerts`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2500));
    await hideDevOverlays();
    await page.screenshot({ path: path.join(OUT_DIR, '07_alerts_and_warnings.png') });

    // 7. Mobile PWA Viewport: 08_settings.png
    console.log('Capturing 08_settings.png...');
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    await hideDevOverlays();
    await page.screenshot({ path: path.join(OUT_DIR, '08_settings.png') });

    // 8. Desktop Viewport: 10_satellite_truecolor.png
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    console.log('Capturing 10_satellite_truecolor.png (NASA VIIRS)...');
    await page.goto(`${BASE_URL}/satellite`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 4000));
    await hideDevOverlays();
    await page.screenshot({ path: path.join(OUT_DIR, '10_satellite_truecolor.png') });

    // 9. Desktop Viewport: 11_satellite_insat.png
    console.log('Capturing 11_satellite_insat.png (IMD INSAT-3D)...');
    const insatBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.innerText.includes('INSAT-3D') || b.innerText.includes('Official IMD'));
    });
    if (insatBtn && insatBtn.asElement()) {
      await insatBtn.asElement().click();
      await new Promise(r => setTimeout(r, 3500));
      await hideDevOverlays();
      await page.screenshot({ path: path.join(OUT_DIR, '11_satellite_insat.png') });
    }

    // 10. Desktop Viewport: 12_satellite_depressions.png
    console.log('Capturing 12_satellite_depressions.png...');
    const synopticBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.innerText.includes('Depressions') || b.innerText.includes('Synoptic'));
    });
    if (synopticBtn && synopticBtn.asElement()) {
      await synopticBtn.asElement().click();
      await new Promise(r => setTimeout(r, 3500));
      await hideDevOverlays();
      await page.screenshot({ path: path.join(OUT_DIR, '12_satellite_depressions.png') });
    }

    // 11. Desktop Viewport: 13_radar_doppler.png
    console.log('Capturing 13_radar_doppler.png (Doppler Radar)...');
    await page.goto(`${BASE_URL}/radar`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 4000));
    await hideDevOverlays();
    await page.screenshot({ path: path.join(OUT_DIR, '13_radar_doppler.png') });

    console.log('✓ All real-time product captures generated successfully!');
  } finally {
    await browser.close();
  }
}

captureAll().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
