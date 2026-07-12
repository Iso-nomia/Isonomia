// lib/evidential/math.test.ts
import { describe, it, expect } from 'vitest';
import { compose, join } from './math'; // if you split helpers

describe('compose/join', () => {
  it('product compose; prob OR join', () => {
    expect(compose([0.8, 0.6], 'product')).toBeCloseTo(0.48);
    expect(join([0.5, 0.5], 'product')).toBeCloseTo(0.75);
  });
  it('min compose; max join', () => {
    expect(compose([0.8, 0.6], 'min')).toBeCloseTo(0.6);
    expect(join([0.5, 0.5], 'min')).toBeCloseTo(0.5);
  });
});
