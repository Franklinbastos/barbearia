'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Botao } from './botao';

/**
 * Copiar um texto, com o retorno que a ação exige.
 *
 * **Por que é da casa.** O registry do shadcn tem 63 componentes e nenhum de
 * copiar — conferido na lista inteira. Nos registries de terceiros em Base UI
 * (neon-ui, coss, reui) também não. O que a lib entrega é a moldura
 * (`input-group`) e o botão; o gesto é escrito à mão em todo lugar, inclusive
 * no exemplo canônico do próprio shadcn (`examples/input-group-button.tsx`) e
 * no `CopyableField` do design system novo do Cal.com. Escrito **uma vez**
 * aqui, em vez de duas: o telefone do cartão da agenda e o link de agendamento
 * faziam a mesma coisa em arquivos diferentes.
 *
 * **O retorno é duplo, e cada metade tem um porquê diferente:**
 *
 * - **O ícone vira ✓ por 2s.** É o que o Polaris pede (*"Provide feedback inline
 *   using a confirmation check icon post-click"*) e o número que Primer,
 *   github/docs, shadcn e Cal.com usam — os quatro em 2000ms.
 * - **Mais um toast.** A pesquisa de 17/08 achou a regra de corte: botão visível
 *   junto do valor ganha só o ✓; botão que pode sair de vista ganha toast. Aqui
 *   valem os dois porque o ✓ tem 16px no canto de um campo e o dono pediu
 *   confirmação que ele veja sem procurar. É o que o `CopyableField` do Cal.com
 *   faz — check, tooltip e toast juntos.
 *
 * Isso **não** contraria a §P5, que proíbe toast no painel: aquela regra é sobre
 * ação que acontece debaixo do dedo e confirma no próprio lugar ("Compareceu"
 * troca a cor da linha). Copiar é o contrário — o resultado vai para a área de
 * transferência, que não tem representação na tela.
 *
 * Quando a área de transferência é negada — contexto não seguro, navegador
 * embutido — o aviso vira **instrução** em vez de sumir calado.
 */
export type BotaoDeCopiarProps = Omit<
  React.ComponentProps<typeof Botao>,
  'onClick' | 'children'
> & {
  /** O que vai para a área de transferência. */
  texto: string;
  /** Rótulo visível. Sem ele o botão é só ícone e o nome vem do `oQue`. */
  rotulo?: string;
  /** Entra no `aria-label` e nas mensagens: "Copiar {oQue}", "Selecione {oQue}…". */
  oQue: string;
};

/** Os 2000ms que Primer, github/docs, shadcn e Cal.com usam, todos os quatro. */
const DURACAO_DO_CHECK = 2000;

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
  className,
  variante = 'texto',
  ...resto
}: BotaoDeCopiarProps) {
  const [copiado, setCopiado] = useState(false);
  // Guardado para poder cancelar: sem isso o segundo clique herda a contagem do
  // primeiro e o ✓ volta a ser ícone fora de hora.
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(relogio.current), []);

  async function copiar() {
    clearTimeout(relogio.current);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success('Copiado.');
      relogio.current = setTimeout(() => setCopiado(false), DURACAO_DO_CHECK);
    } catch {
      setCopiado(false);
      toast.error(`Não foi possível copiar. Selecione ${oQue} e copie à mão.`);
    }
  }

  return (
    <Botao
      type="button"
      variante={variante}
      // O nome carrega o objeto: numa tela com dois "Copiar", um rótulo genérico
      // deixa quem usa leitor de tela sem saber qual é qual.
      aria-label={rotulo ? undefined : `Copiar ${oQue}`}
      onClick={copiar}
      className={cn(botaoDeCopiarVariants({ comRotulo: Boolean(rotulo) }), className)}
      {...resto}
    >
      {/* `aria-hidden` nos dois: quem ouve recebe a notícia pelo toast, que o
          sonner já anuncia em região viva. Sem isso, ouve duas vezes. */}
      {copiado ? (
        <Check aria-hidden="true" data-slot="copiar-feito" />
      ) : (
        <Copy aria-hidden="true" data-slot="copiar-icone" />
      )}
      {rotulo}
    </Botao>
  );
}
