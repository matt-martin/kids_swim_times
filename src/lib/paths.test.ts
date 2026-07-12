import { describe, expect, it } from 'vitest';
import { assetPath } from './paths';

describe('asset paths', () => {
  it('resolves assets under either the local root or a Pages project base', () => {
    expect(assetPath('/', 'data/swim-times.json')).toBe('/data/swim-times.json');
    expect(assetPath('/kids_swim_times/', 'data/swim-times.json')).toBe('/kids_swim_times/data/swim-times.json');
    expect(assetPath('/kids_swim_times/', '/')).toBe('/kids_swim_times/');
  });
});
