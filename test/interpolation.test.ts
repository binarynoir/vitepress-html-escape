import { describe, expect, it } from 'vitest';
import { escapeInterpolation } from '../src/interpolation.js';

describe('escapeInterpolation', () => {
  it('escapes every opening brace', () => {
    expect(escapeInterpolation('{{ a }} and {b}')).toBe('&#123;&#123; a }} and &#123;b}');
  });

  it('leaves text without braces alone', () => {
    expect(escapeInterpolation('plain &amp; text')).toBe('plain &amp; text');
  });
});
