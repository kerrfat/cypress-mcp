// MCP Puppeteer Server with Tools for AI Codegen
import puppeteer from 'puppeteer';
import { defineToolbox, stdioTransport } from '@modelcontextprotocol/sdk';
import { z } from 'zod';

const toolbox = defineToolbox({
  name: 'puppeteer-tools',
  description: 'Use Puppeteer to analyze and extract web elements, DOM trees, screenshots, or page metadata.',

  tools: {
    'analyze-page': {
      description: 'Analyze the interactive elements on a given URL page.',
      input: z.object({ url: z.string().url() }),
      output: z.object({
        title: z.string(),
        elements: z.array(z.object({
          tag: z.string(),
          type: z.string().optional(),
          text: z.string().optional(),
          selector: z.string(),
        })),
      }),
      run: async ({ url }) => {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url);

        const title = await page.title();
        const elements = await page.$$eval(
          'input, button, a, select, textarea, [role="button"]',
          (nodes) => nodes.map((el) => ({
            tag: el.tagName.toLowerCase(),
            type: (el as HTMLInputElement).type || undefined,
            text: el.textContent?.trim(),
            selector: el.getAttribute('id')
              ? `#${el.getAttribute('id')}`
              : el.getAttribute('name')
              ? `[name="${el.getAttribute('name')}"]`
              : el.tagName.toLowerCase(),
          }))
        );

        await browser.close();
        return { title, elements };
      },
    },

    'analyze-html': {
      description: 'Analyze HTML string and return interactive elements.',
      input: z.object({ html: z.string() }),
      output: z.object({
        title: z.string(),
        elements: z.array(z.object({
          tag: z.string(),
          type: z.string().optional(),
          text: z.string().optional(),
          selector: z.string(),
        })),
      }),
      run: async ({ html }) => {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(html);

        const title = await page.title();
        const elements = await page.$$eval(
          'input, button, a, select, textarea, [role="button"]',
          (nodes) => nodes.map((el) => ({
            tag: el.tagName.toLowerCase(),
            type: (el as HTMLInputElement).type || undefined,
            text: el.textContent?.trim(),
            selector: el.getAttribute('id')
              ? `#${el.getAttribute('id')}`
              : el.getAttribute('name')
              ? `[name="${el.getAttribute('name')}"]`
              : el.tagName.toLowerCase(),
          }))
        );

        await browser.close();
        return { title, elements };
      },
    },

    'get-page-screenshot': {
      description: 'Take a full-page screenshot and return it as base64.',
      input: z.object({ url: z.string().url() }),
      output: z.object({ imageBase64: z.string() }),
      run: async ({ url }) => {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url);
        const imageBuffer = await page.screenshot({ fullPage: true });
        await browser.close();
        return { imageBase64: imageBuffer.toString('base64') };
      },
    },

    'extract-dom-tree': {
      description: 'Extract a simplified DOM tree structure from a page.',
      input: z.object({ url: z.string().url() }),
      output: z.object({ tree: z.any() }),
      run: async ({ url }) => {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url);

        const tree = await page.evaluate(() => {
          function serialize(el: Element): any {
            return {
              tag: el.tagName.toLowerCase(),
              id: el.id || undefined,
              class: el.className || undefined,
              children: Array.from(el.children).map(serialize),
            };
          }
          return serialize(document.body);
        });

        await browser.close();
        return { tree };
      },
    },

    'get-html-content': {
      description: 'Get the full HTML content of a URL.',
      input: z.object({ url: z.string().url() }),
      output: z.object({ html: z.string() }),
      run: async ({ url }) => {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url);
        const html = await page.content();
        await browser.close();
        return { html };
      },
    },

    'extract-inner-html': {
      description: 'Extract innerHTML of an element using a CSS selector.',
      input: z.object({ url: z.string().url(), selector: z.string() }),
      output: z.object({ innerHTML: z.string().nullable() }),
      run: async ({ url, selector }) => {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url);
        const innerHTML = await page.$eval(selector, el => el.innerHTML).catch(() => null);
        await browser.close();
        return { innerHTML };
      },
    },

    'sanitize-html': {
      description: 'Sanitize an HTML string (remove scripts/styles and unsafe tags).',
      input: z.object({ html: z.string() }),
      output: z.object({ sanitized: z.string() }),
      run: async ({ html }) => {
        // Minimal sanitization
        const sanitized = html
          .replace(/<script[^>]*>.*?<\/script>/gis, '')
          .replace(/<style[^>]*>.*?<\/style>/gis, '')
          .replace(/on\w+="[^"]*"/g, '')
          .replace(/javascript:/gi, '')
          .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '');

        return { sanitized };
      },
    },
  },
});

stdioTransport({ toolbox });
