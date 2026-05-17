import { test, expect } from '@playwright/test';

test.describe('GoHighLevel encrypted context gate', () => {
  test('shows backend/CORS guidance when encrypted context cannot be decrypted', async ({
    page,
  }) => {
    await page.route(/\/v1\/sessions\/gohighlevel\/context(\?|$)/, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      return route.abort('failed');
    });

    await page.route('**/__ghl-host', async (route) => {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html>
          <html>
            <body>
              <script>
                window.addEventListener('message', (event) => {
                  if (event.data && event.data.message === 'REQUEST_USER_DATA') {
                    event.source.postMessage({
                      message: 'REQUEST_USER_DATA_RESPONSE',
                      payload: { encryptedData: 'encrypted-context-without-ids' },
                    }, '*');
                  }
                });
              </script>
              <iframe title="4Reels" src="/reels"></iframe>
            </body>
          </html>`,
      });
    });

    await page.goto('/__ghl-host');

    const app = page.frameLocator('iframe[title="4Reels"]');
    await expect(app.getByRole('heading', { name: 'Connect GoHighLevel' })).toBeVisible();
    await expect(
      app.getByText('could not reach the backend decrypt endpoint'),
    ).toBeVisible();
    await expect(
      app.getByText('Configure the backend GO_HIGH_LEVEL_APP_SHARED_SECRET'),
    ).toBeHidden();
    await expect(
      app.getByText('Network/CORS error calling'),
    ).toHaveCount(0);
  });
});
