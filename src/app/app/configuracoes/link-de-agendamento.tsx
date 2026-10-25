import { ExternalLink } from 'lucide-react';

import { BotaoDeCopiar } from '@/components/ui/botao-de-copiar';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';

/**
 * O mesmo micro-rótulo dos campos vizinhos: este bloco não tem `<label>` para
 * carregar o nome, e ele precisa pesar menos que o `<h2>` da seção.
 */
const ROTULO = 'text-sm leading-5 font-bold text-tinta-2';

/**
 * O link de agendamento: copiar e abrir a página do cliente.
 *
 * **Fora do `<form>`**, e não por arrumação: copiar age na hora e o formulário
 * age no submit. O Primer manda não misturar os dois, porque quem clica em
 * copiar e sai da tela acha que salvou.
 *
 * **O nome não é mais "endereço público"** (§1.2 da spec de 16/08): é "link de
 * agendamento" em Booksy, Fresha, Mangomint e Boulevard, e "endereço" ia
 * colidir com o endereço físico da loja quando ele entrar.
 *
 * A moldura é o `input-group` do shadcn com `InputGroupInput readOnly` dentro —
 * a forma do exemplo canônico da própria lib para este caso e do `CopyableField`
 * do design system novo do Cal.com, que é Base UI como nós. O gesto de copiar é
 * o `<BotaoDeCopiar>` da casa, o mesmo que o cartão da agenda usa no telefone.
 *
 * **Não é client component.** O copiar é componente próprio; aqui não sobrou
 * estado nem handler, e o que corre no cliente é só o botão.
 *
 * **O QR saiu** (16/08, pedido do dono). Booksy e Fresha o oferecem para
 * imprimir em cartão de visita e colar na vitrine, e o argumento continua bom —
 * mas ele custava um `<details>`, 160px de tela e uma dependência de 2 MB para
 * um uso que acontece uma vez. Volta como recurso próprio se o dono pedir.
 */
export function LinkDeAgendamento({ url }: { url: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={ROTULO}>Link de agendamento</p>

      {/* Meio a meio, e com a mesma altura: são duas ações irmãs. Em 360px os
          dois empilham — lado a lado dariam ~150px cada, abaixo do que cabe um
          endereço e do que um dedo acerta com folga. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* `InputGroupInput readOnly`, e não `InputGroupText`: é a forma do
            exemplo canônico do shadcn para este caso exato
            (`examples/input-group-button.tsx`) e do `CopyableField` do design
            system novo do Cal.com, que é Base UI como nós.

            O `InputGroupText` estava errado por dois motivos medidos: ele nasce
            em `text-muted-foreground`, então a URL saía cinza clara como se o
            campo estivesse desabilitado — exatamente o que o Carbon manda
            evitar —, e o `min-h-11` que ele precisava dava 44px ao lado de
            campos de 36px, o degrau que o dono viu.

            `readOnly` não é o mesmo que `disabled`: o valor continua legível
            por leitor de tela, selecionável e navegável por teclado. O que o
            Carbon proíbe é o desabilitado. */}
        <InputGroup>
          <InputGroupInput
            data-slot="link-endereco"
            readOnly
            value={url}
            aria-label="Link de agendamento da loja"
            // `truncate` como Vercel, Cal.com e shadcn fazem: o começo do
            // endereço é o que identifica, e quem precisa do fim inteiro usa o
            // botão ao lado em vez de ler na tela.
            className="truncate"
          />

          <InputGroupAddon align="inline-end">
            <BotaoDeCopiar texto={url} oQue="o link" className="size-6 [&_svg]:size-4" />
          </InputGroupAddon>
        </InputGroup>

        {/* Sem altura própria: o `.btn` já mede `--altura-controle` (36px), que
            é o mesmo do `InputGroup` ao lado e o mesmo dos campos de cima. Era
            aqui e no campo que estavam os 44px que destoavam da tela inteira. */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          data-slot="link-abrir"
          className="btn btn--sec gap-2 no-underline"
        >
          <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
          Abrir a página do cliente
        </a>
      </div>
    </div>
  );
}
