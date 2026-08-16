'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
} from '@/components/ui/input-group';

/**
 * O mesmo micro-rótulo dos campos vizinhos: este bloco não tem `<label>` para
 * carregar o nome, e ele precisa pesar menos que o `<h2>` da seção.
 */
const ROTULO = 'text-sm leading-5 font-bold text-tinta-2';

/**
 * O link de agendamento: copiar, abrir a página do cliente e o QR.
 *
 * **Fora do `<form>`**, e não por arrumação: copiar age na hora e o formulário
 * age no submit. O Primer manda não misturar os dois, porque quem clica em
 * copiar e sai da tela acha que salvou.
 *
 * **O nome não é mais "endereço público"** (§1.2 da spec de 16/08): é "link de
 * agendamento" em Booksy, Fresha, Mangomint e Boulevard, e "endereço" vai
 * colidir com o endereço físico da loja quando ele entrar.
 *
 * **O endereço vem no `input-group` do shadcn**, que é o componente da lib para
 * "valor com ação colada" — antes era um `<code>` solto com um ícone de 36px na
 * borda, montado à mão.
 *
 * Dentro dele vai `InputGroupText`, e não `InputGroupInput`: valor estático não
 * pode virar campo desabilitado nem `readOnly` (Carbon: *"If the component does
 * not have an enabled state, do not use a read-only state to display static
 * information"*), e campo desabilitado nem é lido por leitor de tela.
 *
 * **O QR saiu** (16/08, pedido do dono). Booksy e Fresha o oferecem para
 * imprimir em cartão de visita e colar na vitrine, e o argumento continua bom —
 * mas ele custava um `<details>`, 160px de tela e uma dependência de 2 MB para
 * um uso que acontece uma vez. Volta como recurso próprio se o dono pedir.
 */
export function LinkDeAgendamento({ url }: { url: string }) {
  const [aviso, setAviso] = useState('');
  // Guardado para poder cancelar: sem isso, o segundo clique herda a contagem
  // do primeiro e o "copiado" pisca fora de hora.
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(relogio.current), []);

  async function copiar() {
    clearTimeout(relogio.current);
    try {
      await navigator.clipboard.writeText(url);
      setAviso('Link copiado.');
      relogio.current = setTimeout(() => setAviso(''), 2000);
    } catch {
      // Mesma saída do "copiar telefone" do cartão da agenda: quando a área de
      // transferência é negada, o aviso vira instrução em vez de sumir calado —
      // e instrução não tem prazo, por isso este não some sozinho.
      setAviso('Não foi possível copiar. Selecione o endereço e copie à mão.');
    }
  }

  return (
    <>
      {/* Sem `SecaoDeAjustes`: desde 16/08 a tela é uma seção só, e este bloco
          mora dentro dela. O que ele **não** deixou de ser é conteúdo de fora do
          `<form>` — copiar age na hora, o formulário age no submit, e o Primer
          manda não misturar os dois. */}
      <div className="flex flex-col gap-2">
        <p className={ROTULO}>Link de agendamento</p>

        {/* Meio a meio, e com a mesma altura: são duas ações irmãs. O
            `input-group` do shadcn é o componente da lib para "valor com ação
            colada", e dentro dele vai `InputGroupText` — um `<span>` — e não
            `InputGroupInput`: o Carbon proíbe valor estático em campo
            desabilitado ou `readOnly`, e desabilitado nem é lido por leitor de
            tela.

            Em 360px os dois empilham: lado a lado dariam ~150px cada, abaixo do
            que cabe um endereço e do que um dedo acerta com folga. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <InputGroup className="min-h-11">
            {/* `break-all` e `min-w-0`: o slug pode ser longo, e em 360px este é
                o único texto da tela sem onde quebrar. `truncate` esconderia o
                fim do endereço, que é a parte que muda. */}
            <InputGroupText data-slot="link-endereco" className="min-w-0 flex-1 break-all">
              {url}
            </InputGroupText>

            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-sm"
                aria-label={`Copiar o link ${url}`}
                onClick={copiar}
              >
                <Copy aria-hidden="true" />
              </InputGroupButton>
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

        {/* Permanente, e não montado junto com o texto: região viva que nasce já
            preenchida costuma não ser anunciada. O ✓ inline que o Polaris pede
            some em 2s; para quem ouve, o que importa é a região existir antes. */}
        <p role="status" data-slot="link-aviso" className="text-sm leading-5 text-tinta-2">
          {aviso}
        </p>
      </div>
    </>
  );
}
