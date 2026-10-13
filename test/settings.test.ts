import { describe, expect, it } from 'vitest';
import { resolveSettings } from '../src/settings.js';

describe('resolveSettings', () => {
  it('turns everything on by default', () => {
    expect(resolveSettings(undefined)).toEqual({ tags: true, interpolation: true });
    expect(resolveSettings({ title: 'x' })).toEqual({ tags: true, interpolation: true });
  });

  it('uses the plugin options when the page sets nothing', () => {
    expect(resolveSettings({}, { interpolation: false })).toEqual({ tags: true, interpolation: false });
  });

  it('turns everything off with htmlEscape: false', () => {
    expect(resolveSettings({ htmlEscape: false })).toEqual({ tags: false, interpolation: false });
  });

  it('lets the page override individual options', () => {
    expect(resolveSettings({ htmlEscape: { interpolation: false } }, { tags: false })).toEqual({
      tags: false,
      interpolation: false,
    });
    expect(resolveSettings({ htmlEscape: { tags: true } }, { tags: false })).toEqual({
      tags: true,
      interpolation: true,
    });
  });

  it('ignores values that are not booleans', () => {
    expect(resolveSettings({ htmlEscape: { tags: 'no' } })).toEqual({ tags: true, interpolation: true });
    expect(resolveSettings({ htmlEscape: 'off' })).toEqual({ tags: true, interpolation: true });
  });
});
