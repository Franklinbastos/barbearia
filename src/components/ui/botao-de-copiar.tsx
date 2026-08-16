'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Botao } from './botao';

/**
 * Copiar um texto, com o retorno que a ação exige.
 *
 * **Por que existe, já que quase tudo aqui vem do CLI.** O registry do shadcn
 * tem 63 componentes e nenhum de copiar — conferido na lista inteira, não de
 * memória. Nos registries de terceiros em Base UI (neon-ui, coss, reui)
 * também não há. O `snippet` do Kibo tem um `SnippetCopyButton`, mas ele vem
 * colado num bloco de código com abas e arrasta `tabs` junto: peso morto para
 * copiar uma linha de texto.
 *
 * O que a lib entrega é a moldura (`input-group`) e o botão (`Botao`). O gesto
 * — escrever na área de transferência, dizer que deu certo, e dizer o que fazer
 * quando o navegador nega — é sempre escrito à mão, no shadcn e no Cal.com.
 * Escrito **uma vez**, aqui, em vez de duas: o telefone do cartão da agenda e o
 * link de agendamento faziam a mesma coisa em arquivos diferentes.
 *
 * **O retorno é obrigatório, não enfeite.** Polaris: *"Provide feedback inline
 * using a confirmation check icon post-click or tap"*. Sem ele a pessoa clica de
 * novo achando que falhou. E quando a área de transferência é negada — o que
 * acontece em contexto não seguro e em alguns navegadores embutidos — o aviso
 * vira **instrução** em vez de sumir calado, e instrução não tem prazo.
 */
export type BotaoDeCopiarProps = Omit<
  React.ComponentProps<typeof Botao>,
  'onClick' | 'children'
> & {
  /** O que vai para a área de transferência. */
  texto: string;
  /** Só ícone (padrão) ou ícone com rótulo. */
  rotulo?: string;
  /** Entra no `aria-label` quando não há rótulo visível: "Copiar {oQue}". */
  oQue: string;
  /** Onde o aviso aparece. `proprio` desenha um `role="status"` logo abaixo. */
  aviso?: 'proprio' | 'nenhum';
};

/** Milissegundos que o "copiado" fica na tela. O erro não some sozinho. */
const DURACAO_DO_AVISO = 2000;

export const botaoDeCopiarVariants = cva('', {
  variants: {
    // Só ícone é alvo quadrado; com rótulo ele cresce com o texto.
    comRotulo: { true: 'gap-2', false: 'px-0' },
  },
  defaultVariants: { comRotulo: false },
});

export function BotaoDeCopiar({
  texto,
  rotulo,
  oQue,
  aviso = 'proprio',
  className,
  variante = 'texto',
  ...resto
}: BotaoDeCopiarProps) {
  const [estado, setEstado] = useState<'parado' | 'copiado' | 'falhou'>('parado');
  // Guardado para poder cancelar: sem isso o segundo clique herda a contagem do
  // primeiro e o "copiado" pisca fora de hora.
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(relogio.current), []);

  async function copiar() {
    clearTimeout(relogio.current);
    try {
      await navigator.clipboard.writeText(texto);
      setEstado('copiado');
      relogio.current = setTimeout(() => setEstado('parado'), DURACAO_DO_AVISO);
    } catch {
      setEstado('falhou');
    }
  }

  const mensagem =
    estado === 'copiado'
      ? 'Copiado.'
      : estado === 'falhou'
        ? `Não foi possível copiar. Selecione ${oQue} e copie à mão.`
        : '';

  return (
    <>
      <Botao
        type="button"
        variante={variante}
        // O nome carrega o objeto: numa tela com dois "Copiar", um rótulo
        // genérico deixa quem usa leitor de tela sem saber qual é qual.
        aria-label={rotulo ? undefined : `Copiar ${oQue}`}
        onClick={copiar}
        className={cn(botaoDeCopiarVariants({ comRotulo: Boolean(rotulo) }), className)}
        {...resto}
      >
        {/* O ✓ é o retorno que o Polaris pede. `aria-hidden` porque quem ouve
            recebe a mesma notícia pelo `role="status"` abaixo — sem isso, ouve
            duas vezes. */}
        {estado === 'copiado' ? (
          <Check aria-hidden="true" data-slot="copiar-feito" />
        ) : (
          <Copy aria-hidden="true" data-slot="copiar-icone" />
        )}
        {rotulo}
      </Botao>

      {/* Permanente, e não montado junto com o texto: região viva que nasce já
          preenchida costuma não ser anunciada. */}
      {aviso === 'proprio' ? (
        <p role="status" data-slot="copiar-aviso" className="text-sm leading-5 text-tinta-2">
          {mensagem}
        </p>
      ) : null}
    </>
  );
}
