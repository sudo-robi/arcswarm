'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const VIDEO_DIR = path.join(__dirname, 'output');
const OUTPUT_RAW = path.join(VIDEO_DIR, 'demo-raw.webm');

(async () => {
  if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  async function injectCursor() {
    await page.evaluate(() => {
      if (document.getElementById('demo-cursor')) return;
      const cursor = document.createElement('div');
      cursor.id = 'demo-cursor';
      cursor.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`;
      cursor.style.cssText = `
        position: fixed; z-index: 999999; pointer-events: none;
        width: 24px; height: 24px;
        transition: left 0.08s linear, top 0.08s linear;
        filter: drop-shadow(1px 1px 3px rgba(0,0,0,0.4));
      `;
      cursor.style.left = '0px';
      cursor.style.top = '0px';
      document.body.appendChild(cursor);
      document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      });
    });
  }

  async function injectSubtitleBar() {
    await page.evaluate(() => {
      if (document.getElementById('demo-subtitle')) return;
      const bar = document.createElement('div');
      bar.id = 'demo-subtitle';
      bar.style.cssText = `
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 999998;
        text-align: center; padding: 14px 24px;
        background: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.95) 100%);
        color: white; font-family: -apple-system, "Segoe UI", sans-serif;
        font-size: 17px; font-weight: 500; letter-spacing: 0.3px;
        transition: opacity 0.3s;
        pointer-events: none;
        border-top: 2px solid rgba(59,130,246,0.5);
      `;
      bar.textContent = '';
      bar.style.opacity = '0';
      document.body.appendChild(bar);
    });
  }

  async function showSubtitle(text) {
    await page.evaluate((t) => {
      const bar = document.getElementById('demo-subtitle');
      if (!bar) return;
      if (t) {
        bar.textContent = t;
        bar.style.opacity = '1';
      } else {
        bar.style.opacity = '0';
      }
    }, text);
  }

  async function moveAndClick(locator, label, opts = {}) {
    const { postClickDelay = 1000, ...clickOpts } = opts;
    const el = typeof locator === 'string' ? page.locator(locator).first() : locator;
    const visible = await el.isVisible().catch(() => false);
    if (!visible) {
      console.log(`SKIP: "${label}" not visible`);
      return false;
    }
    try {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const box = await el.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
        await page.waitForTimeout(500);
      }
      await el.click(clickOpts);
    } catch (e) {
      console.log(`FAIL: "${label}": ${e.message}`);
      return false;
    }
    await page.waitForTimeout(postClickDelay);
    return true;
  }

  async function smoothScrollTo(y) {
    await page.evaluate((target) => window.scrollTo({ top: target, behavior: 'smooth' }), y);
    await page.waitForTimeout(1200);
  }

  try {
    // Load dashboard
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(4000);
    await injectCursor();
    await injectSubtitleBar();

    // Intro subtitle
    await showSubtitle('ArcSwarm - Autonomous Multi-Agent Treasury Management on Arc');
    await page.waitForTimeout(4000);

    // Pan sidebar
    await page.mouse.move(80, 300, { steps: 10 });
    await page.waitForTimeout(1500);

    // Treasury Overview
    await showSubtitle('Treasury Overview - Vault balance, deposits, yield earned');
    await page.waitForTimeout(500);
    await smoothScrollTo(0);
    await page.waitForTimeout(4000);

    // Scroll to agents section
    await showSubtitle('Agent Registry - 6 specialized AI agents on Arc testnet');
    await smoothScrollTo(400);
    await page.waitForTimeout(5000);

    // Pan across agent cards
    const agentCards = await page.locator('[class*="grid"] > div').all();
    for (let i = 0; i < Math.min(agentCards.length, 6); i++) {
      try {
        const box = await agentCards[i].boundingBox();
        if (box && box.y > 200 && box.y < 700) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
          await page.waitForTimeout(800);
        }
      } catch (e) {}
    }

    // Risk Monitor
    await showSubtitle('Risk Monitor - Score, health status, circuit breaker');
    await smoothScrollTo(600);
    await page.waitForTimeout(4000);

    // Click Risk tab if visible
    await moveAndClick('button:has-text("Risk")', 'Risk tab', { postClickDelay: 2000 });
    await page.waitForTimeout(3000);

    // Yield Strategies
    await showSubtitle('Yield Strategies - Farming, harvest history, rewards');
    await smoothScrollTo(0);
    await page.waitForTimeout(4000);

    // Click Yield tab
    await moveAndClick('button:has-text("Yield")', 'Yield tab', { postClickDelay: 2000 });
    await page.waitForTimeout(3000);

    // Click Agents tab
    await moveAndClick('button:has-text("Agents")', 'Agents tab', { postClickDelay: 2000 });
    await page.waitForTimeout(3000);

    // Click Treasury tab
    await moveAndClick('button:has-text("Treasury")', 'Treasury tab', { postClickDelay: 2000 });
    await page.waitForTimeout(2000);

    // Show notifications bell
    await showSubtitle('Notifications - Real-time event tracking');
    const bellBtn = page.locator('button:has(svg)').last();
    await moveAndClick(bellBtn, 'Notifications bell', { postClickDelay: 1500 });
    await page.waitForTimeout(2500);

    // Final pan
    await showSubtitle('Built with Foundry, React, TypeScript, and Circle Agent Stack');
    await page.waitForTimeout(4000);

    await showSubtitle('ArcSwarm - Autonomous Treasury Management on Arc');
    await page.waitForTimeout(3000);

    await showSubtitle('');

  } catch (err) {
    console.error('DEMO ERROR:', err.message);
  } finally {
    await context.close();
    const video = page.video();
    if (video) {
      const src = await video.path();
      try {
        fs.copyFileSync(src, OUTPUT_RAW);
        console.log('Raw video saved:', OUTPUT_RAW);
      } catch (e) {
        console.error('ERROR: Failed to copy video:', e.message);
      }
    }
    await browser.close();
  }
})();
