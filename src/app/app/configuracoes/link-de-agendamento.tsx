'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';

import { Botao } from '@/components/ui/botao';
import { SecaoDeAjustes } from '@/components/ui/secao-de-ajustes';

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
 * **O endereço é o próprio botão de copiar**, dividindo a largura com o atalho
 * para a página do cliente. Antes era texto com um ícone de 36px colado na
 * borda: o alvo menor da tela para a ação mais usada dela, e sem nada que
 * dissesse que aquilo se clica.
 *
 * O que ele não pode ser é input desabilitado ou `readOnly` — Carbon: *"If the
 * component does not have an enabled state, do not use a read-only state to
 * display static information"*, e campo desabilitado nem é lido por leitor de
 * tela. Botão resolve os dois: é ação de verdade e tem nome acessível.
 *
 * O SVG do QR **chega pronto do servidor**. Gerar aqui custaria a biblioteca
 * inteira no bundle e o código apareceria só depois da hidratação.
 */
export function LinkDeAgendamento({ url, qrSvg }: { url: string; qrSvg: string }) {
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
    <SecaoDeAjustes
      titulo="Link de agendamento"
      descricao="É por aqui que o cliente marca. Vale no WhatsApp, na bio do Instagram e no QR da vitrine."
    >
      {/* Dois alvos dividindo a largura, e nenhum deles é ícone mudo: à
          esquerda o endereço **é** o botão de copiar, à direita o atalho para a
          página. Era um `<code>` com um ícone de 36px colado na borda — o alvo
          menor da tela para a ação mais usada dela, e ninguém adivinha que o
          endereço se clica se ele não parece um botão.

          `grid-cols-1 sm:grid-cols-2`: em 360px o endereço precisa da linha
          inteira para quebrar, e dois botões lado a lado ali dariam ~150px cada
          — abaixo do que cabe um endereço e do que um dedo acerta com folga. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Botao
          type="button"
          variante="secundario"
          aria-label={`Copiar o link ${url}`}
          onClick={copiar}
          className="min-h-11 justify-start gap-2 px-3 text-left"
        >
          <Copy aria-hidden="true" className="size-4 shrink-0" />
          {/* `break-all` e `min-w-0`: o slug pode ser longo, e em 360px este é o
              único texto da tela sem onde quebrar. `truncate` esconderia
              justamente o fim do endereço, que é a parte que muda. */}
          <span data-slot="link-endereco" className="min-w-0 break-all">
            {url}
          </span>
        </Botao>

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

      {/* O QR fica recolhido porque é uso ocasional — imprimir no cartão de
          visita, colar na vitrine (Booksy e Fresha documentam exatamente isso).
          Aberto, ocuparia a dobra inteira de quem só queria o endereço. */}
      <details data-slot="link-qr">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm leading-5 font-bold text-tinta-2 md:min-h-9">
          Ver QR code
        </summary>

        {/* `role="img"` no contêiner, e não `aria-label` no SVG: o rótulo solto
            no elemento gráfico não é exposto por todo leitor de tela, e o papel
            aqui ainda poda a papelada de traços da árvore de acessibilidade.
            Fundo branco e zona de silêncio já vêm dentro do próprio SVG — QR
            invertido ou sem margem não escaneia, e um `p-*` aqui só roubaria
            módulo. 160px dá ~3px por módulo, que a câmera do celular pega. */}
        <div
          role="img"
          aria-label="QR code do link de agendamento"
          className="mt-2 size-40 [&>svg]:size-full"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      </details>
    </SecaoDeAjustes>
  );
}
