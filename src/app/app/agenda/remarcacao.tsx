'use client';

import { useEffect, useState, useTransition } from 'react';
import { executarAcao } from '@/components/action-error';
import { Bloco } from '@/components/ui/bloco';
import { Botao } from '@/components/ui/botao';
import { Checkbox } from '@/components/ui/checkbox';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { FolhaInferior } from '@/components/ui/folha-inferior';
import { Largura } from '@/components/ui/largura';
import { formatDayLabelLong } from '@/lib/format';
import { rescheduleAppointmentAction } from './actions';
import { desviarPedidoDeVao, type PedidoDeEncaixe } from './vao-livre';

/**
 * O estado "escolhendo novo horário" (Task 4 do plano de 15/08/2026).
 *
 * **Select-and-place, não arrastar** — é o do Boulevard, e é o que faz isto
 * funcionar sem colunas e sem gesto contínuo:
 *
 * 1. `Remarcar`, no menu da linha, liga o modo.
 * 2. Um aviso fixo diz de quem é a remarcação e como sair dela.
 * 3. Todas as faixas de vão livre viram destino — o clique nelas deixa de abrir
 *    o encaixe e passa a pousar quem está sendo remarcado.
 * 4. A faixa clicada abre a confirmação, com "Avisar o cliente" ligado.
 * 5. `Esc` e o "Desistir" desligam o modo.
 *
 * **Este é o primeiro estado modal da tela**, e é daí que vem o cuidado: enquanto
 * ele está ligado, clicar em qualquer faixa significa outra coisa. Se ele puder
 * ficar ligado sem a pessoa perceber, a próxima ação surpreende. Por isso o
 * aviso é fixo e não some com a rolagem, `Esc` desliga de qualquer lugar, e o
 * rótulo das faixas troca de verbo junto com o modo — quem usa leitor de tela
 * não depende do realce para saber que o botão mudou de assunto.
 *
 * **O canal não é novo.** O clique na faixa continua sendo `pedirEncaixe`; o que
 * o modo faz é pendurar um desvio nele (`desviarPedidoDeVao`), para o pedido não
 * chegar à folha de encaixe. Um segundo canal faria as duas folhas abrirem
 * juntas.
 *
 * **O celular não muda.** O único gatilho do modo é o `⋯` da linha do desktop,
 * que só existe de `md:` para cima; abaixo disso nada aqui chega a renderizar.
 */
export type RemarcacaoContexto = {
  /** ID do atendimento sendo remarcado, ou `null` fora do modo. */
  appointmentId: string | null;
  /** Nome do cliente — é ele que o aviso e o rótulo das faixas dizem. */
  customerName: string | null;
  /**
   * Duração do atendimento sendo remarcado, quando a lista já a conhece.
   *
   * É o piso das faixas enquanto o modo está ligado: vão de 30 min não é
   * destino para um atendimento de uma hora, e oferecê-lo como destino é
   * oferecer um clique que a constraint vai recusar. `null` até a lista informar
   * — aí vale o piso de sempre, o serviço mais curto da loja.
   */
  duracaoMinutos: number | null;
  entrar: (appointmentId: string, customerName: string) => void;
  /** A lista conta ao modo quanto dura o atendimento; só ela tem esse dado. */
  informarDuracao: (appointmentId: string, minutos: number) => void;
  sair: () => void;
};

/**
 * Módulo, e não React: a linha que liga o modo e a lista que o obedece são
 * irmãs debaixo de um Server Component, e o modo tem que sobreviver à navegação
 * entre dias — "semana que vem, mesma hora" é o caso mais comum de todos, e um
 * estado dentro da lista morreria na primeira troca de data.
 */
let atual: RemarcacaoContexto = {
  appointmentId: null,
  customerName: null,
  duracaoMinutos: null,
  entrar,
  informarDuracao,
  sair,
};

type Ouvinte = (contexto: RemarcacaoContexto) => void;
const ouvintes = new Set<Ouvinte>();

function avisar() {
  for (const ouvinte of [...ouvintes]) ouvinte(atual);
}

function entrar(appointmentId: string, customerName: string) {
  atual = { ...atual, appointmentId, customerName, duracaoMinutos: null };
  avisar();
}

/**
 * Só avisa quando o número muda de verdade: a lista chama isto a cada render em
 * que o atendimento aparece, e um aviso por render seria um laço de renderização
 * com o assinante.
 */
function informarDuracao(appointmentId: string, minutos: number) {
  if (atual.appointmentId !== appointmentId || atual.duracaoMinutos === minutos) return;
  atual = { ...atual, duracaoMinutos: minutos };
  avisar();
}

function sair() {
  if (atual.appointmentId === null) return;
  atual = { ...atual, appointmentId: null, customerName: null, duracaoMinutos: null };
  avisar();
}

/**
 * O objeto de contexto só muda de identidade quando o modo muda, então avisar o
 * assinante novo do estado corrente não custa um render extra.
 */
export function assinarRemarcacao(ouvinte: Ouvinte): () => void {
  ouvinte(atual);
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** O modo, para quem só precisa saber se está ligado (a lista, para acender as faixas). */
export function useRemarcacao(): RemarcacaoContexto {
  const [contexto, setContexto] = useState(atual);
  useEffect(() => assinarRemarcacao(setContexto), []);
  return contexto;
}

/**
 * Aviso fixo do modo.
 *
 * Vai no rodapé, e não no topo: no topo ele cobriria a primeira linha da lista e
 * disputaria os mesmos `top-16` dos cabeçalhos de hora, que são `sticky`. Barra
 * de rodapé é o lugar de sempre da ação em lote (é onde o encaixe do celular já
 * mora, no mesmo `z-30`), e daqui ela não esconde nenhum horário.
 *
 * `role="status"` porque a entrada no modo precisa ser **anunciada**: quem não
 * vê o realce das faixas descobriria a mudança só ao apertar uma delas.
 */
export function AvisoDeRemarcacao({ contexto }: { contexto: RemarcacaoContexto }) {
  useEffect(() => {
    if (contexto.appointmentId === null) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') contexto.sair();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [contexto]);

  if (contexto.appointmentId === null) return null;

  return (
    <div
      data-slot="aviso-de-remarcacao"
      role="status"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-bg px-3 py-2"
    >
      {/* O mesmo degrau da lista (§3.7): o aviso é sobre a linha que está lá em
          cima e tem que nascer alinhado com ela. */}
      <Largura tipo="tabela" className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-[14px] leading-5">
          Escolhendo novo horário para <strong>{contexto.customerName}</strong> — Esc para desistir
        </p>
        {/* O botão existe além do `Esc` porque atalho de teclado sozinho não é
            caminho: quem usa só o ponteiro precisa de algo para apertar. */}
        <Botao type="button" variante="secundario" onClick={contexto.sair}>
          Desistir
        </Botao>
      </Largura>
    </div>
  );
}

const ID_DO_FORMULARIO = 'formulario-de-remarcacao';

/**
 * Aviso + confirmação. É o que a lista renderiza; o modo em si mora no módulo.
 *
 * `dataISO` é o dia **mostrado**, que é de onde a faixa clicada tirou a hora —
 * por isso ele viaja junto no formulário: o servidor precisa do dia e da hora
 * para virar instante no fuso da barbearia, e essa conta é a mesma do encaixe
 * (`resolverInicioDoEncaixe`).
 */
export function Remarcacao({
  dataISO,
  timeZone,
  nomePorStaff,
}: {
  dataISO: string;
  timeZone: string;
  /** `staffId` → nome, para a confirmação dizer em que cadeira o cliente vai cair. */
  nomePorStaff: Map<string, string>;
}) {
  const contexto = useRemarcacao();
  const [pedido, setPedido] = useState<(PedidoDeEncaixe & { dataISO: string }) | null>(null);
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [remarcou, setRemarcou] = useState(false);

  const ligado = contexto.appointmentId !== null;

  // O desvio só existe enquanto o modo está ligado — desligar devolve o clique
  // da faixa para a folha de encaixe, que é o dono de sempre do canal. O dia
  // entra aqui porque é o mostrado **no instante do clique**: quem escolhe pode
  // rolar para outra data sem sair do modo.
  useEffect(() => {
    if (!ligado) return undefined;
    return desviarPedidoDeVao((novo) => setPedido({ ...novo, dataISO }));
  }, [ligado, dataISO]);

  // O fechamento é consequência do envio, não de um efeito olhando o retorno:
  // deixar o modo ligado depois do sucesso é justamente a armadilha — o próximo
  // clique numa faixa remarcaria de novo sem ninguém ter pedido. Falhou (o
  // horário foi tomado no meio do caminho), a folha fica aberta com o erro e a
  // pessoa escolhe outro vão.
  function confirmar(formData: FormData) {
    setErro(null);
    setRemarcou(false);
    iniciarTransicao(async () => {
      let deuCerto = false;
      await executarAcao(async () => {
        const retorno = await rescheduleAppointmentAction({}, formData);
        deuCerto = retorno.ok === true;
        return retorno;
      }, setErro);
      if (!deuCerto) return;
      setPedido(null);
      setRemarcou(true);
      contexto.sair();
    });
  }

  const nomeDoBarbeiro = pedido ? nomePorStaff.get(pedido.staffId) : undefined;
  const dia = pedido ? formatDayLabelLong(pedido.dataISO, timeZone) : '';

  return (
    <>
      {/* Fora do bloco do modo, e permanente: no sucesso a folha fecha e o aviso
          some, então este é o único lugar de onde o leitor de tela ainda pode
          ouvir que deu certo. Mesmo desenho do "Encaixe agendado." da folha de
          encaixe. */}
      <p role="status" className="sr-only">
        {remarcou ? 'Atendimento remarcado.' : ''}
      </p>

      {!ligado ? null : (
        <>
          <AvisoDeRemarcacao contexto={contexto} />

          {/* Fechar a folha volta para a escolha, não para fora do modo: quem
              errou a faixa quer apontar outra, e desligar o modo aqui obrigaria
              a abrir o menu do atendimento de novo. Sair de vez é o "Desistir" e
              o `Esc` do aviso. */}
          <FolhaInferior
            aberta={pedido !== null}
            titulo={`Remarcar ${contexto.customerName}`}
            aoFechar={() => setPedido(null)}
            rodape={
              <Botao
                type="submit"
                form={ID_DO_FORMULARIO}
                tamanho="lg"
                largura="total"
                pendente={pendente}
                rotuloPendente="Remarcando…"
              >
                Confirmar remarcação
              </Botao>
            }
          >
            {pedido ? (
              <form id={ID_DO_FORMULARIO} action={confirmar} className="flex flex-col gap-3">
                <input type="hidden" name="appointmentId" value={contexto.appointmentId ?? ''} />
                <input type="hidden" name="date" value={pedido.dataISO} />
                <input type="hidden" name="hora" value={pedido.hora} />
                <input type="hidden" name="staffId" value={pedido.staffId} />

                {/* Só o destino. O serviço e o preço ficam de fora de propósito:
                    o snapshot não muda, e mostrá-lo aqui sugeriria que dá para
                    mexer nele por aqui. */}
                <Bloco compacto>
                  <p className="text-[16px] leading-6">
                    {dia}, às <strong>{pedido.hora}</strong>
                    {nomeDoBarbeiro ? ` com ${nomeDoBarbeiro}` : ''}
                  </p>
                </Bloco>

                {/* Ligado por padrão: quem remarca quer avisar. O caso de
                    desligar é o cliente que está no balcão e já ouviu a hora
                    nova. O `<label>` por fora é a anatomia do checkbox do
                    base-ui, e é o que dá 44px de alvo a um quadradinho de 16px. */}
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <Checkbox name="avisarCliente" value="sim" defaultChecked />
                  <span className="text-[15px] leading-5">Avisar o cliente</span>
                </label>

                <ErroDeAcao mensagem={erro} />
              </form>
            ) : null}
          </FolhaInferior>
        </>
      )}
    </>
  );
}
