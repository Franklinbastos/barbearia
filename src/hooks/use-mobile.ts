import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Veio com a sidebar pelo CLI, com uma troca: o original guardava a largura em
 * `useState` e chamava `setIsMobile` no corpo do efeito de montagem, o que a
 * regra `react-hooks/set-state-in-effect` reprova — é uma renderização em
 * cascata a cada montagem, e no painel isso acontece em toda navegação.
 *
 * `useSyncExternalStore` é o mesmo comportamento sem a cascata: a `matchMedia` é
 * a fonte externa, `larguraAtual` é a leitura e `noServidor` é o que vale no SSR
 * e na hidratação. O servidor responde "desktop" porque não há largura para
 * medir; logo depois da hidratação o React relê e, no celular, a sidebar troca
 * para gaveta antes da primeira pintura útil — a coluna de desktop já nasce
 * escondida por CSS (`hidden md:block`), então não há piscada.
 */
function assinar(aoMudar: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", aoMudar)
  return () => mql.removeEventListener("change", aoMudar)
}

const larguraAtual = () => window.innerWidth < MOBILE_BREAKPOINT
const noServidor = () => false

export function useIsMobile() {
  return React.useSyncExternalStore(assinar, larguraAtual, noServidor)
}
