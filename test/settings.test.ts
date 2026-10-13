import { describe, expect, it } from 'vitest';
import { resolveSettings } from '../src/settings.js';

const ALL_TAGS = {
  unclosedTags: true,
  strayEndTags: true,
  unclosedComments: true,
  xmlSyntax: true,
  voidEndTags: true,
};
const NO_TAGS = {
  unclosedTags: false,
  strayEndTags: false,
  unclosedComments: false,
  xmlSyntax: false,
  voidEndTags: false,
};
const DEFAULTS = { tags: ALL_TAGS, interpolation: { prose: true, code: true }, hints: false, asCode: false };

describe('resolveSettings', () => {
  it('turns every rule on and hints off by default', () => {
    expect(resolveSettings(undefined)).toEqual(DEFAULTS);
    expect(resolveSettings({ title: 'x' })).toEqual(DEFAULTS);
  });

  it('turns a whole group on or off with a boolean', () => {
    expect(resolveSettings({}, { tags: false, interpolation: false })).toEqual({
      ...DEFAULTS,
      tags: NO_TAGS,
      interpolation: { prose: false, code: false },
    });
  });

  it('turns single rules off in the options, leaving the rest on', () => {
    expect(resolveSettings({}, { tags: { voidEndTags: false }, interpolation: { code: false } })).toEqual({
      ...DEFAULTS,
      tags: { ...ALL_TAGS, voidEndTags: false },
      interpolation: { prose: true, code: false },
    });
  });

  it('lets a page override single rules on top of the options', () => {
    const options = { tags: { voidEndTags: false, xmlSyntax: false } };
    expect(resolveSettings({ htmlEscape: { tags: { voidEndTags: true } } }, options).tags).toEqual({
      ...ALL_TAGS,
      xmlSyntax: false,
    });
    expect(resolveSettings({ htmlEscape: { tags: { strayEndTags: false } } }, options).tags).toEqual({
      ...ALL_TAGS,
      voidEndTags: false,
      xmlSyntax: false,
      strayEndTags: false,
    });
  });

  it('lets a page turn one rule back on when the options turn its group off', () => {
    expect(resolveSettings({ htmlEscape: { interpolation: { code: true } } }, { interpolation: false })).toEqual({
      ...DEFAULTS,
      interpolation: { prose: false, code: true },
    });
  });

  it('lets a page boolean replace the whole group', () => {
    expect(resolveSettings({ htmlEscape: { tags: true } }, { tags: { unclosedTags: false } }).tags).toEqual(ALL_TAGS);
    expect(resolveSettings({ htmlEscape: { tags: false } }, { tags: { unclosedTags: true } }).tags).toEqual(NO_TAGS);
  });

  it('turns everything off with htmlEscape: false', () => {
    expect(resolveSettings({ htmlEscape: false }, { hints: true, asCode: true })).toEqual({
      tags: NO_TAGS,
      interpolation: { prose: false, code: false },
      hints: false,
      asCode: false,
    });
  });

  it('turns hints on or off per page', () => {
    expect(resolveSettings({ htmlEscape: { hints: true } }).hints).toBe(true);
    expect(resolveSettings({ htmlEscape: { hints: false } }, { hints: true }).hints).toBe(false);
  });

  it('turns asCode on or off in the options and per page', () => {
    expect(resolveSettings({}, { asCode: true }).asCode).toBe(true);
    expect(resolveSettings({ htmlEscape: { asCode: true } }).asCode).toBe(true);
    expect(resolveSettings({ htmlEscape: { asCode: false } }, { asCode: true }).asCode).toBe(false);
    expect(resolveSettings({ htmlEscape: { asCode: 'yes' } }).asCode).toBe(false);
  });

  it('ignores values that are not booleans, and unknown rules', () => {
    expect(resolveSettings({ htmlEscape: { tags: 'no', hints: 'yes' } })).toEqual(DEFAULTS);
    expect(resolveSettings({ htmlEscape: { tags: { voidEndTags: 'off', madeUp: false } } })).toEqual(DEFAULTS);
    expect(resolveSettings({ htmlEscape: { tags: ['voidEndTags'] } })).toEqual(DEFAULTS);
    expect(resolveSettings({ htmlEscape: 'off' })).toEqual(DEFAULTS);
  });
});
