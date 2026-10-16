import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(path.join(process.env.PLAYWRIGHT_MODULE, 'index.mjs')).href : 'playwright');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(__dirname, '../test-results');
const report = { started: new Date().toISOString(), services: [], pages: [], errors: [], blockedMutations: [] };
const origin = process.env.FRONTEND_URL || 'http://localhost:3000';
const readOperations = new Set(['describe-global', 'describe', 'field-metadata', 'field-usage', 'scan-references', 'full-assessment', 'bulk-scan']);
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => report.errors.push({ type: 'runtime', message: error.message }));
    page.on('response', response => {
      if (response.status() >= 400 && response.url().includes('/api/')) report.errors.push({ type: 'http', status: response.status(), url: response.url() });
    });
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) &&
          !(url.origin === origin && url.pathname.startsWith('/api/salesforce/') && readOperations.has(url.pathname.split('/').at(-1)))) {
        report.blockedMutations.push({ method: request.method(), path: url.pathname });
        return route.abort();
      }
      return route.continue();
    });
    for (const endpoint of ['/api/control-plane/health', '/api/salesforce/health', '/api/salesforce/tools']) {
      const response = await page.request.get(`${origin}${endpoint}`, { timeout: 30000 });
      const data = await response.json();
      report.services.push({ endpoint, status: response.status(), keys: Object.keys(data), online: data.status, toolCount: data.tools?.length });
    }
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    for (const name of ['Overview', 'Agents', 'Approval Queue', 'Proposals', 'Audit Trail', 'Policy Manager', 'Settings', 'Field Tools']) {
      await page.locator('#main-navigation').getByRole('button', { name, exact: true }).click();
      await page.waitForTimeout(1800);
      const alerts = (await page.getByRole('alert').allTextContents()).filter(text => text.trim());
      const text = await page.locator('main').count() ? await page.locator('main').innerText() : await page.locator('body').innerText();
      const unavailable = text.match(/Unexpected [^\n]+response[^\n]*|Could not load[^\n]*|Live data unavailable[^\n]*|Unable to load[^\n]*/g) || [];
      report.pages.push({ name, alerts, unavailable, horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
      if (name === 'Audit Trail') {
        report.signedAuditControls = await page.getByRole('button', { name: 'Copy full HMAC SHA-256 signature' }).count();
        assert.ok(report.signedAuditControls > 0, 'No signed audit events displayed');
        await page.screenshot({ path: path.join(output, 'audit-desktop.png'), fullPage: true });
      }
      if (name === 'Policy Manager') {
        report.policyModeVisible = await page.getByText('Policy mode: enforce', { exact: true }).count();
        assert.equal(report.policyModeVisible, 1);
      }
      if (name === 'Proposals') {
        await page.getByRole('combobox').selectOption('HUMAN_REJECTED');
        await page.waitForTimeout(1000);
        report.rejectedRows = await page.locator('tbody tr').count();
        await page.getByRole('combobox').selectOption('');
        await page.waitForTimeout(1000);
        await page.getByRole('button', { name: 'View', exact: true }).first().click();
        await page.getByRole('heading', { name: 'Activity timeline', exact: true }).waitFor();
        await page.waitForTimeout(1000);
        report.proposalTimelineEvents = await page.getByRole('dialog').locator('ol li').count();
        assert.ok(report.proposalTimelineEvents > 0, 'Proposal lifecycle events were not shown');
        await page.getByRole('button', { name: 'Close proposal details', exact: true }).click();
      }
    }
    const candidateObjects = [];
    for (const objectName of ['Account', 'Contact']) {
      const response = await page.request.post(`${origin}/api/salesforce/describe`, { data: { object_name: objectName }, timeout: 120000 });
      const description = await response.json();
      assert.equal(response.status(), 200);
      candidateObjects.push({ name: objectName, customFields: description.fields.filter(field => field.custom).length });
    }
    const scanObject = candidateObjects.sort((a, b) => a.customFields - b.customFields)[0];
    report.bulkTarget = scanObject;
    console.log(`Testing read-only bulk scan: ${scanObject.name} (${scanObject.customFields} custom fields)`);
    await page.locator('label:has(input[type="checkbox"])').filter({ has: page.locator('span.text-xs').filter({ hasText: new RegExp(`^${scanObject.name}$`) }) }).getByRole('checkbox').check();
    const scanResponse = page.waitForResponse(response => response.url().endsWith('/api/salesforce/bulk-scan'), { timeout: 310000 });
    await page.getByRole('button', { name: 'Run bulk scan', exact: true }).click();
    const scan = await scanResponse;
    assert.equal(scan.status(), 200);
    const scanResult = await scan.json();
    report.bulkScan = { fields: scanResult.total_custom_fields_scanned, candidates: scanResult.total_candidates_found, needsReview: scanResult.total_needs_review, active: scanResult.total_active_in_use };
    await page.getByRole('combobox', { name: 'Filter classification' }).selectOption('all');
    const review = page.getByRole('button', { name: 'Review in Dependency Viewer', exact: true }).first();
    if (await review.count()) {
      let usageRequests = 0;
      let referenceRequests = 0;
      page.on('request', request => {
        if (request.url().endsWith('/api/salesforce/field-usage')) usageRequests += 1;
        if (request.url().endsWith('/api/salesforce/scan-references')) referenceRequests += 1;
      });
      await review.click();
      await page.getByRole('region', { name: 'Assessment summary' }).waitFor({ state: 'visible', timeout: 120000 });
      report.automaticAnalysis = { usageRequests, referenceRequests };
      assert.equal(usageRequests, 1);
      assert.equal(referenceRequests, 1);
      await page.locator('#main-navigation').getByRole('button', { name: 'Field Tools', exact: true }).click();
    }
    await page.screenshot({ path: path.join(output, 'field-tools-desktop.png'), fullPage: true });
    await page.locator('#main-navigation').getByRole('button', { name: 'Dependency Viewer', exact: true }).click();
    await page.getByLabel('Jump to Object.Field').fill('Account.Id');
    await page.getByRole('button', { name: 'Select target', exact: true }).click();
    await page.getByRole('button', { name: 'Analyze dependencies', exact: true }).click();
    await page.getByRole('button', { name: 'Analyze dependencies', exact: true }).waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(b => b.textContent.includes('Analyzing…')), null, { timeout: 120000 });
    report.analysisAlerts = (await page.getByRole('alert').allTextContents()).filter(text => text.trim());
    report.analysisVisible = await page.getByRole('region', { name: 'Assessment summary' }).count();
    await page.screenshot({ path: path.join(output, 'dependency-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    report.mobileHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await page.screenshot({ path: path.join(output, 'dependency-mobile.png'), fullPage: true });
    assert.equal(report.blockedMutations.length, 0, 'The read-only verification attempted a mutation');
    assert.equal(report.errors.length, 0, 'Runtime or HTTP errors were detected');
    assert.ok(report.pages.every(p => !p.alerts.length && !p.unavailable.length), 'A page reported an error');
    assert.equal(report.analysisVisible, 1, 'Live analysis result was not shown');
    assert.equal(report.analysisAlerts.length, 0);
    assert.equal(report.mobileHorizontalOverflow, false);
  } finally {
    await browser.close();
    report.finished = new Date().toISOString();
    fs.writeFileSync(path.join(output, 'live-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
