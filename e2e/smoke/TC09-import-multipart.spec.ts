/**
 * TC09 — Import uses multipart/form-data.
 * Regression-locks commit 1c350d9 — customInstance must not force
 * Content-Type: application/json when the body is FormData (orval's import
 * endpoint builds a FormData body for the tar file).
 */
import { test, expect } from '@playwright/test';
import { stubAuth, mockHappyPath } from '../fixtures/routes';

test.describe('@smoke TC09 — import uses multipart content-type', () => {
  test('POST /imports Content-Type is multipart/form-data (not json)', async ({ page }) => {
    await stubAuth(page);
    await mockHappyPath(page);

    let capturedContentType: string | null = null;
    await page.route('**/api/v2/imports', (route) => {
      capturedContentType = route.request().headers()['content-type'] ?? null;
      return route.fulfill({ json: { jobId: 99 }, status: 202 });
    });
    await page.route('**/api/v2/quests', (route) =>
      route.fulfill({
        json: [{ id: 99, description: 'Import', state: 'finished-ok' }],
        status: 200,
      }),
    );

    // Restore lives on the System page's Backup & migration section.
    await page.goto('/#/system');
    await page.getByRole('button', { name: 'Restore backup' }).click();

    const restoreDialog = page.getByRole('dialog', { name: 'Restore backup' });
    await expect(restoreDialog.locator('input[type="file"]')).toHaveAttribute(
      'accept',
      '.tar.gz, .tar',
    );
    await restoreDialog.locator('input[type="file"]').setInputFiles({
      name: 'export.tar',
      mimeType: 'application/x-tar',
      buffer: Buffer.from('fake-tar-bytes'),
    });

    await expect.poll(() => capturedContentType).not.toBeNull();
    expect(capturedContentType).toMatch(/^multipart\/form-data;\s*boundary=/);
    expect(capturedContentType).not.toContain('application/json');
  });

  test('restore remains active beyond the former 15-second client deadline', async ({ page }) => {
    await stubAuth(page);
    await mockHappyPath(page);

    let acceptRestore: (() => void) | undefined;
    await page.route('**/api/v2/imports', async (route) => {
      await new Promise<void>((resolve) => {
        acceptRestore = resolve;
      });
      await route.fulfill({ json: { jobId: 99 }, status: 202 });
    });
    await page.route('**/api/v2/quests/99', (route) =>
      route.fulfill({ json: { id: 99, description: 'Import', state: 'success' }, status: 200 }),
    );

    await page.goto('/#/system');
    await page.getByRole('button', { name: 'Restore backup' }).click();
    const restoreDialog = page.getByRole('dialog', { name: 'Restore backup' });
    await restoreDialog.locator('input[type="file"]').setInputFiles({
      name: 'export.tar',
      mimeType: 'application/x-tar',
      buffer: Buffer.from('fake-tar-bytes'),
    });

    await page.waitForTimeout(15_500);
    await expect(restoreDialog.getByText('Uploading backup')).toBeVisible();
    expect(acceptRestore).toBeDefined();
    acceptRestore?.();
    await expect(restoreDialog.getByText('Restore job started')).toBeVisible({ timeout: 3_000 });
    await expect(restoreDialog).not.toBeVisible();
    await expect(page.getByText('Restore failed')).not.toBeVisible();
  });

  test('restore bridges the upload request into the visible jobs rail', async ({ page }) => {
    await stubAuth(page);
    await mockHappyPath(page);

    let acceptRestore: (() => void) | undefined;
    let releaseJobs: (() => void) | undefined;
    let importAccepted = false;
    let jobsRefreshStarted = false;
    await page.route('**/api/v2/imports', async (route) => {
      await new Promise<void>((resolve) => {
        acceptRestore = resolve;
      });
      importAccepted = true;
      return route.fulfill({ json: { jobId: 99 }, status: 202 });
    });
    await page.route('**/api/v2/quests', async (route) => {
      if (importAccepted) {
        jobsRefreshStarted = true;
        await new Promise<void>((resolve) => {
          releaseJobs = resolve;
        });
      }
      return route.fulfill({
        json: importAccepted
          ? [
              {
                id: 99,
                description: 'Restore backup',
                state: 'ongoing',
                progress: { current: 1, total: 4 },
              },
            ]
          : [],
        status: 200,
      });
    });
    await page.route('**/api/v2/quests/99', (route) =>
      route.fulfill({
        json: {
          id: 99,
          description: 'Restore backup',
          state: 'ongoing',
          progress: { current: 1, total: 4 },
        },
        status: 200,
      }),
    );

    await page.goto('/#/system');
    await page.getByRole('button', { name: 'Restore backup' }).click();

    const restoreDialog = page.getByRole('dialog', { name: 'Restore backup' });
    await restoreDialog.locator('input[type="file"]').setInputFiles({
      name: 'factory-line-backup.tar',
      mimeType: 'application/x-tar',
      buffer: Buffer.from('fake-tar-bytes'),
    });

    await expect(restoreDialog.getByText('Uploading backup')).toBeVisible();
    await expect(restoreDialog.getByText('factory-line-backup.tar')).toBeVisible();
    await expect(restoreDialog.getByRole('button', { name: 'Close' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(restoreDialog).toBeVisible();

    await expect.poll(() => typeof acceptRestore).toBe('function');
    acceptRestore?.();

    await expect(restoreDialog.getByText('Restore job started')).toBeVisible();
    await expect.poll(() => jobsRefreshStarted).toBe(true);
    await expect(restoreDialog).toBeVisible();
    releaseJobs?.();
    const jobsRail = page.getByRole('button', { name: /1 running/i });
    await expect(jobsRail).toBeVisible();
    await expect(restoreDialog).not.toBeVisible();
    const jobsPanel = jobsRail.locator('..');
    await jobsRail.click();
    await expect(jobsPanel.getByText('Restore backup', { exact: true })).toBeVisible();
    await expect(jobsPanel.getByText('1 of 4', { exact: true })).toBeVisible();
  });
});
