import { toString as gerarQrSvg } from 'qrcode';

import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { findBarbershopById } from '@/db/repositories';
import { env } from '@/lib/env';
import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Largura } from '@/components/ui/largura';
import { SettingsForm } from './settings-form';
import { LinkDeAgendamento } from './link-de-agendamento';

export default async function ConfiguracoesPage() {
  const sessao = await requireSession();
  const loja = await findBarbershopById(db, sessao.barbershopId);
  if (!loja) return null;

  const linkPublico = `${env.APP_URL}/b/${loja.slug}`;

  // O QR nasce aqui, e não no cliente: a URL já é conhecida no servidor, então
  // gerar lá em cima é custo zero de JS no navegador e o código não pisca
  // depois da hidratação. O `qrcode` é o pacote de Node — ele arrasta `yargs` e
  // `pngjs` para a CLI dele, e nada disso encosta no bundle enquanto o import
  // ficar em Server Component.
  const qrSvg = await gerarQrSvg(linkPublico, { type: 'svg' });

  return (
    <div className="flex flex-col gap-4">
      {/* Só para o leitor de tela, a pedido do dono. A tela já diz o que é
          três vezes — o item marcado na barra lateral, o título da aba e os três
          `<h2>` das seções logo abaixo —, e a faixa de título mais subtítulo
          empurrava o primeiro campo 60px para baixo para repetir isso.

          O que **não** pode é sumir do documento: sem `<h1>` a página perde o
          nível 1 da estrutura e quem navega por cabeçalho fica sem âncora. É o
          `<CabecalhoDePagina>` de sempre, escondido — a §5.9 manda toda tela
          abrir com ele, e há teste guardando. */}
      <CabecalhoDePagina titulo="Configurações" className="mb-0 sr-only" />

      {/* O teto da tela mora aqui, não dentro do formulário: a página decide
          quanto ocupa, o formulário decide como se arruma por dentro. Era um
          card de 520px sobre um formulário de 520px numa tela de 1400 — dois
          terços vazios.

          `tabela`, e não `leitura`, pelo mesmo motivo que tirou a agenda dos
          1120px: as cinco telas do painel começam na mesma coluna, e a que
          escolher outro teto é a que parece de outro produto quando se navega
          entre elas. As duas colunas de campos continuam: o `lg:` do
          `settings-form` olha a janela, não este teto, e em 880px cada coluna
          fica com ~430px — abaixo dos 520 da régua, que é o teto do campo e
          não o piso. */}
      {/* Três seções empilhadas, nesta ordem: **identidade → link → regras**.
          Ordenar por importância é o princípio escrito de Primer, Polaris e
          Android, e é o que a página General do Shopify faz — identidade antes
          de regra operacional. O link fica no meio porque **deriva** da
          identidade: o slug nasce do nome da loja.

          Quem posiciona o link é o `SettingsForm`, e não esta coluna, porque as
          duas seções de campo saem dele. O bloco continua fora do `<form>` —
          ver o `ID_DO_FORMULARIO` lá. */}
      <Largura tipo="tabela" className="flex flex-col gap-4">
        <SettingsForm
          loja={loja}
          linkDeAgendamento={<LinkDeAgendamento url={linkPublico} qrSvg={qrSvg} />}
        />
      </Largura>
    </div>
  );
}
