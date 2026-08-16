'use client';

import { useEffect, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';

import { Botao } from '@/components/ui/botao';
import { SecaoDeAjustes } from '@/components/ui/secao-de-ajustes';

/**
 * O link de agendamento: o endereço para ler, o copiar, o QR e o atalho para a
 * página pública.
 *
 * **Fora do `<form>`**, e não por arrumação: copiar age na hora e o formulário
 * age no submit. O Primer manda não misturar os dois, porque quem clica em
 * copiar e sai da tela acha que salvou.
 *
 * **O nome não é mais "endereço público"** (§1.2 da spec de 16/08): é "link de
 * agendamento" em Booksy, Fresha, Mangomint e Boulevard, e "endereço" vai
 * colidir com o endereço físico da loja quando ele entrar.
 *
 * O endereço fica em `<code>`, nunca em input desabilitado ou `readOnly` —
 * Carbon: *"If the component does not have an enabled state, do not use a
 * read-only state to display static information"*, e campo desabilitado nem é
 * lido por leitor de tela.
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
      <div className="flex items-start gap-2">
        {/* `break-all`, nunca `truncate`: o slug pode ser longo e em 360px o
            endereço é a única coisa da tela que não tem onde quebrar.
            `min-w-0` porque item de flex não encolhe abaixo do conteúdo sem
            ele, e aí é a linha inteira que rola de lado. */}
        <code
          data-slot="link-endereco"
          className="block min-w-0 flex-1 py-2.5 break-all text-base leading-6"
        >
          {url}
        </code>

        {/* Ícone de link, não de prancheta, em botão terciário — Polaris: "Use
            the link icon with a tertiary icon button for copying deep links and
            URLs". 44px no toque e 36px no ponteiro, como o gatilho da barra do
            painel: o alvo aqui é do tamanho de um dedo, não de um cursor. */}
        <Botao
          type="button"
          variante="texto"
          aria-label="Copiar link de agendamento"
          onClick={copiar}
          className="size-11 shrink-0 px-0 md:size-9"
        >
          <Link2 aria-hidden="true" />
        </Botao>
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

      {/* Fora do `<details>`: o dono quer conferir o que o cliente vê, e isso
          não é assunto do QR. Escondido lá dentro, some junto com ele. */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center self-start text-sm leading-5 text-tinta-2 underline underline-offset-[3px] md:min-h-9"
      >
        Abrir a página pública em outra aba
      </a>
    </SecaoDeAjustes>
  );
}
