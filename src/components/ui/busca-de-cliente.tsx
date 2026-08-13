'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatDayLabelFromInstant, formatTime, isoDateInZone } from '@/lib/format';
import { Bloco } from './bloco';
import { Botao } from './botao';
import { Campo } from './campo';
import { EsqueletoDeLinha } from './esqueleto-de-linha';
import { FolhaInferior } from './folha-inferior';
import { Monograma } from './monograma';

/**
 * Busca de cliente do balcão (§5.10).
 *
 * Toca o telefone: "aqui é o Marcos, que horas eu marquei?". Sem isto, a única
 * saída é varrer a agenda um dia por vez com o cliente esperando na linha —
 * acontece várias vezes por dia e não tinha resposta em nenhuma das três
 * direções de design.
 *
 * O botão mora na barra preta do painel e está sempre visível, em qualquer
 * tela: quem atende o telefone não está necessariamente na página de clientes.
 *
 * ## Por que isto NÃO veio do `command` do shadcn
 *
 * O mapa da migração previa `busca-de-cliente ← command`. O `command` foi
 * trazido pelo CLI, medido e devolvido: o `cmdk` é uma paleta de comandos, e a
 * §5.10 aqui é um campo de formulário com uma lista de links. Sete conflitos,
 * todos verificados renderizando o componente, não lidos do código:
 *
 * 1. **O campo perde o nome acessível.** O `Command.Input` escreve
 *    `aria-labelledby` apontando para o rótulo escondido do próprio `cmdk`, e
 *    isso vence o `<label for>` do `Campo`. `getByLabelText('Buscar cliente')`
 *    devolveu `null` nas duas montagens testadas — com e sem `asChild`.
 * 2. **`type="search"` vira `type="text"`.** O `cmdk` escreve `type` depois do
 *    espalhamento das props. Só volta com `asChild` e um componente-adaptador.
 * 3. **O papel vira `combobox`**, nunca `searchbox`.
 * 4. **`CommandItem` acrescenta um `<CheckIcon>` depois do `children`**, com
 *    `ml-auto size-4`: uma coluna de 16px no fim de cada linha de 72px.
 * 5. **`CommandList` mete um `<div cmdk-list-sizer>` entre a lista e os itens**,
 *    então `.lista > li` da §3.1 deixa de casar.
 * 6. **O `cmdk` marca o primeiro resultado sozinho** (`aria-selected="true"`), e
 *    o `data-selected:bg-muted` do base-nova pinta de cinza uma linha que hoje
 *    não é pintada.
 * 7. **Custo de dependência**: o `cmdk` traz 16 pacotes `@radix-ui/*` — outra
 *    pilha de diálogo, portal e foco ao lado do `@base-ui/react` que já temos —
 *    e obriga a suíte inteira a ganhar `ResizeObserver` e `scrollIntoView`
 *    falsos no `vitest.setup.ts`.
 *
 * Os itens 1 a 3 são contrato escrito da §5.10; 4 a 6 são mudança de tela, que
 * é justamente o que esta migração não pode causar. Fica como está, com os
 * cinco casos de `busca-de-cliente.test.tsx` guardando o comportamento.
 */
export type ClienteAchado = {
  id: string;
  name: string;
  phone: string;
  /** ISO do próximo horário agendado, ou `null` para quem não tem nenhum. */
  proximo: string | null;
};

export type BuscaDeClienteProps = { valorInicial?: string };

/** Mesmo mínimo do servidor: uma letra devolveria a base quase inteira. */
const MINIMO_DE_CARACTERES = 2;

/** Uma consulta por pausa de digitação, não uma por tecla. */
const ESPERA_MS = 250;

const FUSO_PADRAO = 'America/Sao_Paulo';

type Resultado = { chave: string; clientes: ClienteAchado[]; timeZone: string };

export function BuscaDeCliente({ valorInicial = '' }: BuscaDeClienteProps) {
  const [aberta, setAberta] = useState(false);
  const [termo, setTermo] = useState(valorInicial);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<{ chave: string } | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const alvo = termo.trim();
  const curto = alvo.length < MINIMO_DE_CARACTERES;
  // A chave carrega a tentativa: "Tentar de novo" com o mesmo texto tem de
  // valer como uma busca nova, e não como o erro que já está na tela.
  const chave = `${tentativa}:${alvo}`;
  // Estado derivado, não `useState`: guardar "carregando" em estado obriga a
  // escrevê-lo dentro do efeito, e é assim que a resposta antiga pinta sob o
  // termo novo.
  const carregando = !curto && resultado?.chave !== chave && erro?.chave !== chave;

  useEffect(() => {
    if (!aberta || curto) return;

    const controlador = new AbortController();
    const relogio = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/panel/clientes?q=${encodeURIComponent(alvo)}`, {
            signal: controlador.signal,
          });
          if (controlador.signal.aborted) return;
          if (!res.ok) {
            setErro({ chave });
            return;
          }
          const corpo = (await res.json()) as { clientes?: ClienteAchado[]; timeZone?: string };
          if (controlador.signal.aborted) return;
          setResultado({
            chave,
            clientes: Array.isArray(corpo.clientes) ? corpo.clientes : [],
            timeZone: corpo.timeZone ?? FUSO_PADRAO,
          });
        } catch {
          if (!controlador.signal.aborted) setErro({ chave });
        }
      })();
    }, ESPERA_MS);

    return () => {
      clearTimeout(relogio);
      controlador.abort();
    };
  }, [aberta, curto, alvo, chave]);

  function fechar() {
    setAberta(false);
    // Reabrir mostrando o resultado de um telefonema anterior é pior que
    // reabrir vazio.
    setTermo(valorInicial);
    setResultado(null);
    setErro(null);
  }

  const clientes = resultado?.chave === chave ? resultado.clientes : [];
  const timeZone = resultado?.timeZone ?? FUSO_PADRAO;

  return (
    <>
      <button
        type="button"
        data-slot="busca-disparador"
        onClick={() => setAberta(true)}
        aria-label="Buscar cliente"
        className="flex shrink-0 items-center justify-center text-[var(--acao-tinta)]"
        style={{ width: 44, height: 44, background: 'transparent', border: 0 }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M13.5 13.5L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <FolhaInferior aberta={aberta} titulo="Buscar cliente" aoFechar={fechar}>
        <Campo rotulo="Buscar cliente" dica="Nome ou telefone, a partir de duas letras.">
          <input
            type="search"
            inputMode="search"
            autoComplete="off"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
        </Campo>

        <div data-slot="busca-resposta" className="mt-3">
          {carregando ? (
            <>
              <div data-slot="busca-carregando" className="barra-busca" />
              <div className="mt-2">
                <EsqueletoDeLinha altura={72} quantidade={3} />
              </div>
            </>
          ) : null}

          {erro?.chave === chave ? (
            <Bloco
              tom="perigo"
              papel="alert"
              acao={
                <Botao variante="secundario" onClick={() => setTentativa((n) => n + 1)}>
                  Tentar de novo
                </Botao>
              }
            >
              Não foi possível buscar agora.
            </Bloco>
          ) : null}

          {resultado?.chave === chave && clientes.length === 0 ? (
            <Bloco>Nenhum cliente com esse nome ou telefone.</Bloco>
          ) : null}

          {clientes.length > 0 ? (
            <ul data-slot="busca-resultados" className="lista">
              {clientes.map((c) => (
                <li key={c.id} data-slot="busca-resultado" className="flex items-stretch gap-2">
                  <Link
                    href={`/app/clientes/${c.id}`}
                    data-slot="busca-ficha"
                    onClick={fechar}
                    className="flex min-h-[72px] min-w-0 flex-1 items-center gap-3 py-2 no-underline"
                  >
                    <Monograma nome={c.name} />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-[17px] leading-[22px] font-bold">{c.name}</span>
                      <span className="truncate text-sm leading-5 text-tinta-2">{c.phone}</span>
                    </span>
                  </Link>

                  {/* O próximo horário é o segundo destino da linha: quem quer
                      ver o dia inteiro toca aqui e cai na agenda daquele dia. */}
                  {c.proximo ? (
                    <Link
                      href={`/app/agenda?data=${isoDateInZone(c.proximo, timeZone)}`}
                      data-slot="busca-proximo"
                      onClick={fechar}
                      className="flex min-h-[72px] shrink-0 items-center px-2 text-right text-sm leading-5 no-underline"
                    >
                      {formatDayLabelFromInstant(c.proximo, timeZone)} ·{' '}
                      {formatTime(c.proximo, timeZone)}
                    </Link>
                  ) : (
                    <span
                      data-slot="busca-proximo"
                      className="flex min-h-[72px] shrink-0 items-center px-2 text-right text-sm leading-5 text-tinta-3"
                    >
                      sem horário marcado
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </FolhaInferior>
    </>
  );
}
