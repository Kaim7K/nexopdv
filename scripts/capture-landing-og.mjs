import { chromium } from "playwright";

// Share image taken from the real landing and product capture, not a fabricated UI.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto("http://127.0.0.1:4173/");
  await page.locator(".lp-hero-screen img").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content:
      ".lp-nav-inner{min-height:72px}.lp-hero{min-height:558px;padding:35px 0}.lp-hero-grid{grid-template-columns:.88fr 1.3fr;gap:48px}.lp-hero-copy{text-align:left}.lp-hero::after{display:none}.lp-hero h1{font-size:41px}.lp-hero .lp-lead{font-size:14px;margin-inline:0}.lp-hero .lp-actions,.lp-hero-note{justify-content:flex-start}.lp-hero-copy .lp-eyebrow{font-size:8px;padding:7px 10px}.lp-hero-note{font-size:9px}.lp-hero-screen figcaption{display:none}",
  });
  await page.screenshot({
    path: "public/nexo-pdv-og.png",
    animations: "disabled",
  });
  console.log("Updated 1200x630 share image from the actual landing.");
} finally {
  await browser.close();
}
