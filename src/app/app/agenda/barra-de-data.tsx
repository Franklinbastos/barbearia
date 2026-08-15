'use client';

import { format } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ptBR } from 'react-day-picker/locale';
import { useState, type ReactNode } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Largura } from '@/components/ui/largura';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { dataParaISO, isoParaData } from '@/lib/data-local';
import { cn } from '@/lib/utils';

/**
 * A barra de data da agenda (§5.7, item 2).
 *
 * Fica grudada no topo porque a lista é longa e "que dia é este?" é a pergunta
 * que se faz no meio da rolagem. As setas são `<Link>` do Next e não `<a href>`
 * cru: na tela mais aberta do produto, recarregar o documento inteiro para
 * andar um dia muda a sensação de velocidade. Elas continuam sendo links de
 * verdade — só vestem o `buttonVariants` da lib em vez do contorno à mão.
 *
 * A legenda de contagem substitui a faixa de quatro blocos de resumo: 64px da
 * primeira dobra para um filtro que ninguém usa com cliente esperando é enfeite
 * que custa rolagem. E nunca diz "HOJE" — a barra navega para qualquer dia, e o
 * rótulo mentiria.
 *
 * **O seletor do meio.** Era `<input type="date">` mais um botão "Ir"; desde
 * 13/08/2026 é `Popover` + `Calendar` do shadcn, e escolher o dia já navega —
 * o "Ir" some porque não há mais um valor pendente de submeter.
 *
 * **Fuso.** O dia da agenda anda pelo mundo como `YYYY-MM-DD` *já no fuso da
 * barbearia* (o `page.tsx` o produz com Luxon). O `Calendar` fala `Date` do
 * navegador, então a única regra aqui é **não converter**: `isoParaData` monta
 * um `Date` local com aquele ano/mês/dia, e `dataParaISO` lê de volta pelos
 * getters locais. Nenhum dos dois passa por UTC, então a ida e a volta são
 * exatas em qualquer fuso de navegador — inclusive quando ele não é o da loja.
 *
 * O que **não** se pode fazer aqui, e é o erro que este comentário existe para
 * evitar: `new Date('2026-08-13')` (o padrão lê como meia-noite UTC, e em
 * São Paulo isso é dia 12) e `data.toISOString().slice(0, 10)` (que devolve o
 * dia em UTC, e às 21h em São Paulo já é o dia seguinte) — o mesmo erro que o
 * `isoDateInZone` do `src/lib/format.ts` foi criado para tirar do produto.
 *
 * **Largura (§3.7).** O teto entra **dentro** da faixa fixa, nunca em volta
 * dela: o fundo e a borda continuam atravessando a tela de ponta a ponta, e é o
 * `-mx-3 md:-mx-5` que os faz encostar nas laterais. O que fica contido é o
 * conteúdo da faixa, não a faixa. O degrau é `tabela`, o mesmo da lista logo
 * abaixo e o das outras telas de lista do painel — barra num teto e lista em
 * outro é o degrau que o teto existe para não ter.
 *
 * Conter a faixa não bastava para o botão do meio: mesmo dentro do teto ele
 * esticava para 932px para escrever "sexta, 14 de agosto", ~150px de texto. No
 * desktop ele passa a ter largura fixa (`md:w-60`, 240px), medida pelo rótulo
 * mais longo do ano ("quarta, 30 de setembro"); no celular continua esticando
 * entre as duas setas, que lá é o certo.
 *
 * **Duas ordens, uma árvore.** No desktop a linha é `Hoje ‹ › data contagem …
 * ação` — a ordem do Google, do exemplo canônico do FullCalendar
 * (`end: 'today prev,next'`), do react-big-calendar e do ReUI: nenhum deles
 * cerca o rótulo com uma seta de cada lado. No celular ela continua
 * `‹ data ›`, porque o rótulo precisa de ~250px e três botões antes dele o
 * truncariam — coisa que o Material 3 proíbe em letra ("Don't truncate the
 * headline text").
 *
 * A troca é de `order`, nunca de dois blocos duplicados: **dois `Popover`
 * irmãos escondidos por `md:` não funcionam**, porque o `PopoverContent` sai
 * por `Portal` e o `hidden` do pai não o alcança — abririam dois calendários
 * sobrepostos, e o gatilho de data que `tests/unit/seletor-de-data.test.tsx`
 * procura por nome acessível passaria a aparecer duas vezes.
 *
 * O DOM segue a ordem do desktop e é o celular que reordena: onde a ordem
 * visual e a de foco divergem, quem paga é o teclado, e o teclado está no
 * desktop.
 */
export type BarraDeDataProps = {
  dataISO: string;
  hojeISO: string;
  contagens: { total: number; aAtender: number };
  /**
   * A ação da tela, à direita da linha de navegação — quem passa é que decide
   * qual é. Esta barra é sobre **data**: ela reserva o lugar e não conhece o que
   * entra nele, senão a próxima ação a aparecer viraria mais uma prop com nome
   * próprio aqui dentro.
   *
   * Quem passa também decide em que largura a ação aparece: a barra **não**
   * esconde nada no celular. O `hidden md:*` é do conteúdo porque lá a ação mora
   * na barra fixa do rodapé, e um `hidden` **aqui** apagaria junto o que o
   * chamador renderiza fora de fluxo (barra fixa, `role="status"`, folha) —
   * `display: none` no pai leva junto até filho `position: fixed`.
   */
  acao?: ReactNode;
};

/**
 * Alvo de 44px das setas. Continua acima dos 36px de controle da lib porque
 * esta é barra fixa: o `--tap-min` da §3.6 é piso de acessibilidade, não a
 * densidade antiga de balcão que a reforma aposentou.
 */
const ALVO_44 = 'size-11 shrink-0';

function deslocarDia(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(ano!, mes! - 1, dia!));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/**
 * "sexta, 14 de agosto". Sem o "-feira", como o `formatDayLabelLong` — o botão
 * divide uma linha de 360px com duas setas de 44px.
 *
 * Formata a partir do `Date` flutuante montado pelo `isoParaData`, e por isso
 * não recebe fuso: o dia já é o da loja, e mandar o `Intl` reinterpretá-lo em
 * outro fuso é justamente a conversão que deslocaria o rótulo.
 */
function rotuloDoDia(dia: Date): string {
  return format(dia, "EEEE, d 'de' MMMM", { locale: ptBR }).replace('-feira', '');
}

export function BarraDeData({ dataISO, hojeISO, contagens, acao }: BarraDeDataProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  const ontem = deslocarDia(dataISO, -1);
  const amanha = deslocarDia(dataISO, 1);
  const eHoje = dataISO === hojeISO;
  const diaSelecionado = isoParaData(dataISO);

  // **WCAG 2.5.3 (Label in Name).** Era um `aria-label` fixo na palavra Data. Um
  // rótulo escondido que **cobre** o texto visível reprova de duas maneiras:
  // quem comanda por voz fala o que está escrito na tela ("sexta, 15 de agosto")
  // e não casa com nada, e quem ouve o leitor de tela ouve "Data" no lugar do
  // dia em que a agenda está — que é a única coisa que este botão informa.
  //
  // O texto visível vem primeiro, e não no fim: o casamento por voz é por
  // prefixo na maioria dos motores. O que sobra depois dele é a afordância, que
  // o dia sozinho não entrega — é a mesma regra da faixa de vão livre, cujo nome
  // acessível também começa pelo verbo e contém a frase inteira da tela.
  const rotuloDaData = `${rotuloDoDia(diaSelecionado)}, escolher outro dia`;

  // No dia vazio a contagem some: "0 no dia · 0 a atender" é ruído com forma de
  // dado, e quem fala num dia sem nada é o estado vazio da lista. Uma string só
  // para os dois lugares onde ela aparece — a linha do desktop e a linha de
  // baixo do celular —, senão são duas verdades para manter.
  const contagem =
    contagens.total > 0 ? `${contagens.total} no dia · ${contagens.aAtender} a atender` : null;

  // `/app/agenda` sem `?data=`, e não `?data=${hojeISO}`: o servidor recalcula o
  // dia da loja a cada visita, então o botão continua acertando o dia numa aba
  // que ficou aberta desde ontem.
  const irParaHoje = () => {
    setAberto(false);
    router.push('/app/agenda');
  };

  return (
    // `mb-3` é o mesmo respiro que o `<CabecalhoDePagina>` dá às telas irmãs.
    // A barra é o último bloco antes da lista nas duas larguras: no celular o
    // cabeçalho da agenda é `sr-only` e nem ocupa fluxo, e no desktop ele fica
    // acima com o `md:mb-3` do `page.tsx`. Com `mb-2` a lista começava 4px mais
    // cedo que a de Clientes e a de Serviços — degrau que só se vê trocando de
    // tela na navegação, e é justamente aí que ele incomoda.
    <div className="-mx-3 mb-3 md:-mx-5">
      <div className="sticky top-0 z-10 flex h-16 flex-col justify-center border-b border-border bg-background px-3 md:px-5">
        <Largura tipo="tabela" className="flex flex-col gap-1">
          {/* A ação divide a linha com a navegação em vez de ganhar uma faixa
              própria abaixo. No celular ela não rende nenhum item de flex — o
              que o chamador manda para cá é `hidden` ou fora de fluxo — e por
              isso o `gap-2` não abre buraco nos 360px. */}
          <div className="flex h-11 items-center gap-2">
            {/* Desabilita quando o dia mostrado já é hoje, e **não** some: um
                botão que aparece e desaparece muda a largura dos vizinhos a
                cada dia, que era o defeito da faixa de baixo. `disabled` de
                verdade tiraria o botão da ordem de tabulação — o mesmo sumiço,
                para quem navega por teclado —, então é `focusableWhenDisabled`:
                fica focável e se anuncia como indisponível.

                É `<Button>` e não `<Link>` como as setas justamente por causa
                desse estado: link desabilitado não existe em HTML. */}
            <Button
              variant="outline"
              disabled={eHoje}
              focusableWhenDisabled
              onClick={irParaHoje}
              className="hidden h-11 px-4 md:inline-flex aria-disabled:opacity-50"
            >
              Hoje
            </Button>

            <Link
              href={`/app/agenda?data=${ontem}`}
              aria-label="Ontem"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'icon' }),
                ALVO_44,
                '-order-3 md:order-none',
              )}
            >
              <ChevronLeft aria-hidden="true" />
            </Link>

            <Link
              href={`/app/agenda?data=${amanha}`}
              aria-label="Amanhã"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'icon' }),
                ALVO_44,
                '-order-1 md:order-none',
              )}
            >
              <ChevronRight aria-hidden="true" />
            </Link>

            <Popover open={aberto} onOpenChange={setAberto}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    aria-label={rotuloDaData}
                    className="-order-2 h-11 min-w-0 flex-1 justify-between px-3 font-normal md:order-none md:w-60 md:flex-none"
                  >
                    <span className="truncate">{rotuloDoDia(diaSelecionado)}</span>
                    <CalendarDays aria-hidden="true" />
                  </Button>
                }
              />
              {/* `gap-0` porque o popover empilha com 10px de folga por padrão,
                  e aqui o que separa o calendário do "Hoje" é o fio de 1px. */}
              <PopoverContent align="center" className="w-auto gap-0 p-0">
                <Calendar
                  mode="single"
                  locale={ptBR}
                  autoFocus
                  selected={diaSelecionado}
                  defaultMonth={diaSelecionado}
                  // "Hoje" é o de quem abriu a loja, não o do relógio do
                  // navegador: o servidor já mandou `hojeISO` no fuso dela.
                  today={isoParaData(hojeISO)}
                  onSelect={(escolhido) => {
                    if (!escolhido) return;
                    setAberto(false);
                    // Mesma URL que as setas montam — a agenda continua sendo
                    // uma tela endereçável por `?data=`.
                    router.push(`/app/agenda?data=${dataParaISO(escolhido)}`);
                  }}
                />
                {/* O "ir para hoje" do celular. Lá ele não cabe na linha — o
                    rótulo da data come a largura toda entre as duas setas —,
                    e o lugar dele é aqui dentro, junto do resto da navegação
                    por data. No desktop o botão da barra já faz isso. */}
                <div className="border-t border-border p-2 md:hidden">
                  <Button
                    variant="outline"
                    disabled={eHoje}
                    focusableWhenDisabled
                    onClick={irParaHoje}
                    className="h-11 w-full aria-disabled:opacity-50"
                  >
                    Hoje
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* `titleMetadata` do Polaris: status curto, importante e que não se
                clica. O `md:mr-auto` é o mesmo elemento fazendo de vão — é ele
                que empurra a ação para a ponta direita —, e é margem e não
                `flex-1` porque o vão tem que existir também no dia vazio, com o
                texto ausente: `flex-1` esticaria o cinza do texto pela barra
                toda, e um vão que some com o texto devolveria o "Encaixe" para
                o meio da linha. */}
            <span className="hidden min-w-0 truncate text-[12px] leading-4 text-tinta-3 md:block md:mr-auto">
              {contagem}
            </span>

            {acao}
          </div>

          {/* No celular a contagem continua sendo a linha de baixo, com a mesma
              letra de sempre: em 360px não há vão nenhum na linha de cima. O que
              saiu foi a altura fixa de 20px — sem ela a faixa fecha nos 64px que
              o `h-16` promete, em vez de vazar 4px. */}
          {contagem ? (
            <p className="text-[12px] leading-4 font-bold tracking-wide text-muted-foreground uppercase md:hidden">
              {contagem}
            </p>
          ) : null}
        </Largura>
      </div>
    </div>
  );
}
