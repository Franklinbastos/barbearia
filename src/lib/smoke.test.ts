import { describe, it, expect } from 'vitest';

describe('ambiente de testes', () => {
  it('roda TypeScript e resolve o alias @', () => {
    expect(1 + 1).toBe(2);
  });
});
