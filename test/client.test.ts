// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableHtmlEscapeHints } from '../src/client.js';

const HINT =
  '<span class="html-escape-hint html-escape-hint--error" data-html-escape-hint="`&lt;T&gt;` is never closed." data-html-escape-hint-line="3" data-html-escape-hint-file="guide/api.md">&lt;T&gt;</span>';
const WARNING =
  '<span class="html-escape-hint html-escape-hint--warning" data-html-escape-hint="Shown as written.">{{ x }}</span>';

const popover = () => document.querySelector<HTMLElement>('.html-escape-hint-popover');
const hint = (index = 0) => document.querySelectorAll<HTMLElement>('.html-escape-hint')[index];
const pointer = (type: string, target: Element, relatedTarget: Element | null = null) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'mouse', relatedTarget }));

let disable: () => void;

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = `<p>Returns Array${HINT} and ${WARNING}.</p><p id="other">Other</p>`;
});

afterEach(() => {
  disable?.();
  vi.useRealTimers();
});

describe('enableHtmlEscapeHints', () => {
  it('injects the underline, cursor and popover styles once', () => {
    disable = enableHtmlEscapeHints();
    enableHtmlEscapeHints()();
    const styles = document.querySelectorAll('#html-escape-hint-style');
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toContain('cursor: not-allowed');
    expect(styles[0].textContent).toContain('underline wavy');
  });

  it('keeps only the touch rule with injectStyles: false', () => {
    disable = enableHtmlEscapeHints({ injectStyles: false });
    const css = document.getElementById('html-escape-hint-style')!.textContent!;
    expect(css).toContain('cursor: pointer !important');
    expect(css).not.toContain('not-allowed');
  });

  it('opens a popover with the location and message on click, and closes it on a second click', () => {
    disable = enableHtmlEscapeHints();
    hint().click();
    expect(popover()?.getAttribute('role')).toBe('tooltip');
    expect(popover()?.querySelector('.html-escape-hint-popover-location')?.textContent).toBe('guide/api.md, line 3');
    expect(popover()?.querySelector('code')?.textContent).toBe('<T>');
    expect(popover()?.textContent).toContain('is never closed.');
    hint().click();
    expect(popover()).toBeNull();
  });

  it('styles warnings differently and leaves out a missing location', () => {
    disable = enableHtmlEscapeHints();
    hint(1).click();
    expect(popover()?.classList.contains('html-escape-hint-popover--warning')).toBe(true);
    expect(popover()?.querySelector('.html-escape-hint-popover-location')).toBeNull();
  });

  it('closes on a click elsewhere and on Escape', () => {
    disable = enableHtmlEscapeHints();
    hint().click();
    document.getElementById('other')!.click();
    expect(popover()).toBeNull();
    hint().click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(popover()).toBeNull();
  });

  it('opens on mouse hover after the delay and closes when the mouse leaves', () => {
    vi.useFakeTimers();
    disable = enableHtmlEscapeHints({ hoverDelay: 300 });
    pointer('pointerover', hint());
    vi.advanceTimersByTime(299);
    expect(popover()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(popover()).not.toBeNull();
    pointer('pointerout', hint(), document.getElementById('other'));
    expect(popover()).toBeNull();
  });

  it('ignores hover with hover: false', () => {
    disable = enableHtmlEscapeHints({ hover: false, hoverDelay: 0 });
    pointer('pointerover', hint());
    expect(popover()).toBeNull();
  });

  it('removes its listeners and popover when disabled', () => {
    disable = enableHtmlEscapeHints();
    hint().click();
    disable();
    expect(popover()).toBeNull();
    hint().click();
    expect(popover()).toBeNull();
  });
});
