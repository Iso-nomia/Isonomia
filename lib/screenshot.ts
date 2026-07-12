// lib/screenshot.ts
import { chromium } from "playwright";

export async function screenshotPage(
  absUrl: string,                       // e.g. https://your.site/portfolio/abc123
  viewport = { width: 800, height: 1200 }
): Promise<Buffer> {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport });
    await page.goto(absUrl, { waitUntil: "networkidle" });
    // optional: wait for custom selector if you have dynamic assets
    // await page.waitForSelector(".portfolio-ready");
    return await page.screenshot({ type: "png", fullPage: true });
  } finally {
    await browser.close();
  }
}
