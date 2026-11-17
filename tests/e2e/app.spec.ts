import { expect, test } from '@playwright/test';

function segment(type: number, body: number[], pts90k = 0): number[] {
  return [
    0x50,
    0x47,
    (pts90k >>> 24) & 0xff,
    (pts90k >>> 16) & 0xff,
    (pts90k >>> 8) & 0xff,
    pts90k & 0xff,
    0,
    0,
    0,
    0,
    type,
    (body.length >>> 8) & 0xff,
    body.length & 0xff,
    ...body,
  ];
}

function minimalSup(): Buffer {
  const pcs = [0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const pds = [0, 0, 1, 235, 128, 128, 255];
  const ods = [0, 1, 0, 0xc0, 0, 0, 7, 0, 1, 0, 1, 1, 0, 0];
  return Buffer.from([...segment(0x16, pcs), ...segment(0x14, pds), ...segment(0x15, ods), ...segment(0x80, [])]);
}

function manySup(count: number): Buffer {
  const pcs = [0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const ods = [0, 1, 0, 0xc0, 0, 0, 7, 0, 1, 0, 1, 1, 0, 0];
  return Buffer.from(
    Array.from({ length: count }, (_, index) => {
      const pts = index * 90_000;
      const pds = [0, 0, 1, 235 - (index % 10), 128, 128, 255];
      return [
        ...segment(0x16, pcs, pts),
        ...segment(0x14, pds, pts),
        ...segment(0x15, ods, pts),
        ...segment(0x80, [], pts),
      ];
    }).flat(),
  );
}

test('renders the empty preview workspace', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Supview/);
  await expect(page.getByRole('heading', { name: 'Cues' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Preview subtitles/ })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Drop a .sup file');
});

test('switches and persists the selected theme', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('opens and closes the Bits UI jump dialog', async ({ page }) => {
  await page.goto('/');

  const openButton = page.getByRole('button', { name: 'Open jump dialog' });
  await openButton.click();
  const dialog = page.getByRole('dialog', { name: 'Jump to a cue' });
  await expect(dialog).toBeVisible();
  const timeMode = dialog.getByRole('radio', { name: 'Time' });
  await expect(timeMode).toBeChecked();
  const timeInput = dialog.getByLabel('Time');
  await expect(timeInput).toBeFocused();
  await expect(timeInput).toHaveValue('00:00:00.000');

  // Overwrites digits in place and auto-skips separators
  await timeInput.pressSequentially('123456789');
  await expect(timeInput).toHaveValue('12:34:56.789');

  await dialog.getByRole('radio', { name: 'Cue number' }).click();
  const cueInput = dialog.getByLabel('Cue number');
  await cueInput.fill('42');
  await expect(cueInput).toHaveValue('42');

  await dialog.getByRole('button', { name: 'Jump ↵' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close jump dialog' }).click();
  await expect(dialog).toBeHidden();

  await page.keyboard.press('Control+G');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('does not activate the previous trigger when submitting with Enter', async ({ page }) => {
  await page.goto('/');
  await page.locator('#primary-file').setInputFiles({
    name: 'sample.sup',
    mimeType: 'application/octet-stream',
    buffer: minimalSup(),
  });
  await expect(page.getByRole('option')).toHaveCount(1);

  const themeButton = page.getByRole('button', { name: 'Switch to light theme' });
  await themeButton.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.keyboard.press('Control+G');
  const dialog = page.getByRole('dialog', { name: 'Jump to a cue' });
  const timeInput = dialog.getByLabel('Time');
  await timeInput.fill('00:00:00.000');
  await timeInput.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('parses a SUP file through the worker', async ({ page }) => {
  await page.goto('/');

  await page.locator('#primary-file').setInputFiles({
    name: 'sample.sup',
    mimeType: 'application/octet-stream',
    buffer: minimalSup(),
  });

  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('status')).toContainText('Ready for local preview');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('SUP', { exact: true })).toBeVisible();
});

test('keeps the keyboard-selected cue visible', async ({ page }) => {
  await page.goto('/');
  await page.locator('#primary-file').setInputFiles({
    name: 'many.sup',
    mimeType: 'application/octet-stream',
    buffer: manySup(30),
  });

  const options = page.getByRole('option');
  await expect(options).toHaveCount(30);
  for (let index = 0; index < 29; index += 1) await page.keyboard.press('ArrowDown');

  const lastOption = options.nth(29);
  await expect(lastOption).toHaveAttribute('aria-selected', 'true');
  await expect
    .poll(() =>
      lastOption.evaluate((element) => {
        const list = element.closest('[role="listbox"]');
        if (!list) return false;
        const item = element.getBoundingClientRect();
        const viewport = list.getBoundingClientRect();
        return item.top >= viewport.top && item.bottom <= viewport.bottom;
      }),
    )
    .toBe(true);
});
