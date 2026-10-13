import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import { registerMarkdownTags } from '@binarynoir/vitepress-markdown-tags/theme';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    registerMarkdownTags(app);
  },
} satisfies Theme;
