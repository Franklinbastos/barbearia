/**
 * Cor estável por barbeiro — a aresta de 4px na borda esquerda do cartão da
 * agenda (§3.5).
 *
 * A atribuição é **por índice na equipe**, nunca por hash do id: com 6 baldes e
 * 4 barbeiros, a chance de pelo menos uma colisão é 72%, e dois barbeiros da
 * mesma cor destroem exatamente a informação que a aresta existe para dar.
 *
 * Por isso a função recebe a equipe inteira e devolve o mapa pronto — não há
 * como pedir "a cor do barbeiro X" sem dizer quem são os outros.
 *
 * A cor nunca é o único portador: o nome do barbeiro continua escrito na linha
 * 2 do cartão. Com mais de 8 barbeiros ativos as cores repetem — aceito.
 */

/** Os 8 matizes da paleta, bem separados no círculo. */
const MATIZES = [25, 60, 135, 175, 215, 265, 310, 345];

/**
 * L e croma são travados: 0.52 no claro (contraste sobre a página branca) e
 * 0.72 no escuro. Croma 0.13 cabe no sRGB em todo o círculo nos dois valores.
 * `light-dark()` resolve sozinho porque o `globals.css` declara `color-scheme`.
 */
function corDoMatiz(hue: number): string {
  return `light-dark(oklch(0.52 0.13 ${hue}), oklch(0.72 0.13 ${hue}))`;
}

export function coresDeBarbeiro(staff: { id: string; name: string }[]): Map<string, string> {
  // Ordem própria, para que a cor não dependa da ordem em que a lista chegou.
  // Desempate por id porque dois barbeiros podem ter o mesmo nome.
  const ordenada = [...staff].sort(
    (a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id),
  );

  const cores = new Map<string, string>();
  ordenada.forEach((barbeiro, indice) => {
    cores.set(barbeiro.id, corDoMatiz(MATIZES[indice % MATIZES.length]));
  });
  return cores;
}
