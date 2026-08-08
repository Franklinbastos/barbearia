import { describe, it, expect } from 'vitest';
import { coresDeBarbeiro } from './cores-de-barbeiro';

const equipe = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: `Barbeiro ${i}` }));

describe('coresDeBarbeiro', () => {
  it('dá uma cor para cada barbeiro', () => {
    const m = coresDeBarbeiro(equipe(4));
    expect(m.size).toBe(4);
  });

  it('nunca repete cor até acabar a paleta', () => {
    const m = coresDeBarbeiro(equipe(6));
    expect(new Set(m.values()).size).toBe(6);
  });

  it('é estável: a mesma equipe devolve as mesmas cores', () => {
    expect([...coresDeBarbeiro(equipe(4)).values()]).toEqual([...coresDeBarbeiro(equipe(4)).values()]);
  });

  it('não depende da ordem de chegada, só do id', () => {
    const a = coresDeBarbeiro(equipe(3));
    const invertida = [...equipe(3)].reverse();
    const b = coresDeBarbeiro(invertida);
    expect(b.get('s0')).toBe(a.get('s0'));
  });

  it('aguenta equipe maior que a paleta sem quebrar', () => {
    const m = coresDeBarbeiro(equipe(20));
    expect(m.size).toBe(20);
    expect([...m.values()].every((c) => typeof c === 'string' && c.length > 0)).toBe(true);
  });

  it('devolve mapa vazio para equipe vazia', () => {
    expect(coresDeBarbeiro([]).size).toBe(0);
  });
});
