import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';
import { markdownTags } from '@binarynoir/vitepress-markdown-tags';
import { glossaryAbbr } from 'markdown-it-glossary';
import { markdownHtmlEscape } from '../../../../src/index.js';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A small site with the plugins a real BinaryNoir docs site runs, so the build
// test checks them together. The escape plugin is registered first on purpose:
// it must still run after the others.
export default defineConfig({
  title: 'html-escape fixture',
  markdown: {
    config(md) {
      md.use(markdownHtmlEscape);
      md.use(glossaryAbbr, { file: path.join(siteRoot, 'glossary.md') });
      md.use(markdownTags);
    },
  },
});
