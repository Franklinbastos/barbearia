import { ExternalLink } from 'lucide-react';

import { BotaoDeCopiar } from '@/components/ui/botao-de-copiar';
import { InputGroup, InputGroupAddon, InputGroupText } from '@/components/ui/input-group';

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
 * A moldura é o `input-group` do shadcn — o componente da lib para "valor com
 * ação colada" —, e dentro dela vai `InputGroupText`, não `InputGroupInput`: o
 * Carbon proíbe valor estático em campo desabilitado ou `readOnly`, e
 * desabilitado nem é lido por leitor de tela. O gesto de copiar é o
 * `<BotaoDeCopiar>` da casa, o mesmo que o cartão da agenda usa no telefone —
 * o registry do shadcn não tem componente de copiar, conferido nos 63.
 *
 * **Não é client component.** Depois que o copiar virou componente próprio não
 * sobrou estado nem handler aqui; o que corre no cliente é só o botão.
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
        <InputGroup className="min-h-11">
          {/* `break-all` e `min-w-0`: o slug pode ser longo, e em 360px este é o
              único texto da tela sem onde quebrar. `truncate` esconderia o fim
              do endereço, que é a parte que muda. */}
          <InputGroupText data-slot="link-endereco" className="min-w-0 flex-1 break-all">
            {url}
          </InputGroupText>

          <InputGroupAddon align="inline-end">
            <BotaoDeCopiar texto={url} oQue="o link" className="size-8 [&_svg]:size-4" />
          </InputGroupAddon>
        </InputGroup>

        {/* `min-h-11` igual ao do `InputGroup` ao lado: a altura vem do mesmo
            número nos dois, senão a linha fica com um degrau. */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          data-slot="link-abrir"
          className="btn btn--sec min-h-11 gap-2 no-underline"
        >
          <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
          Abrir a página do cliente
        </a>
      </div>
    </div>
  );
}
