import { expect, test } from '@playwright/test';

test('event charts stay inside the viewport on every browser profile', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('[data-chart]').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLCanvasElement>('.chart-wrap canvas')].every((canvas) => {
    const wrap = canvas.parentElement?.getBoundingClientRect();
    const rect = canvas.getBoundingClientRect();
    return wrap && rect.width > 0 && rect.left >= wrap.left - 1 && rect.right <= wrap.right + 1;
  }));

  const layout = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const cards = [...document.querySelectorAll<HTMLElement>('.chart-card:has(canvas)')];
    const charts = cards.map((card) => {
      const wrap = card.querySelector<HTMLElement>('.chart-wrap')!;
      const canvas = card.querySelector<HTMLCanvasElement>('canvas')!;
      const cardRect = card.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      return {
        card: { left: cardRect.left, right: cardRect.right },
        wrap: { left: wrapRect.left, right: wrapRect.right },
        canvas: { left: canvasRect.left, right: canvasRect.right, width: canvasRect.width },
      };
    });

    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      charts,
    };
  });

  // Keep a browser-specific full-page capture attached to the test report. This makes
  // any platform-specific clipping visible alongside the geometry failure.
  const screenshot = await page.screenshot({ path: testInfo.outputPath('responsive-layout.png'), fullPage: true });
  await testInfo.attach(`${testInfo.project.name} responsive layout`, {
    body: screenshot,
    contentType: 'image/png',
  });

  expect(layout.documentWidth, 'the page must not horizontally scroll').toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.charts.length, 'the selected swimmer should render event charts').toBeGreaterThan(0);

  for (const chart of layout.charts) {
    expect(chart.wrap.right, 'the chart wrapper must stay inside its card').toBeLessThanOrEqual(chart.card.right + 1);
    expect(chart.canvas.left, 'the canvas must not be clipped past the left of its wrapper').toBeGreaterThanOrEqual(chart.wrap.left - 1);
    expect(chart.canvas.right, 'the canvas must not be clipped past its wrapper').toBeLessThanOrEqual(chart.wrap.right + 1);
    expect(chart.canvas.width, 'the chart canvas must have a measurable width').toBeGreaterThan(0);
  }
});
