import type {
  RespostaDeCatalogo,
  LojaDoBrain,
  ServicoDoBrain,
  BarbeiroDoBrain,
} from './tipos';
import { formatarPreco } from './mapeamento';

export const OP_MARCAR = 'marcar_horario';
export const OP_CANCELAR = 'cancelar_horario';

type HorarioDoBrain = { weekday: number; startTime: string; endTime: string };

const DIAS_DA_SEMANA = [
  'domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado',
];

/** Junta nomes em pt-BR: ["a"] -> "a"; ["a","b"] -> "a e b"; ["a","b","c"] -> "a, b e c". */
function juntarEmPtBr(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/**
 * Resume o expediente da loja (a união dos horários dos barbeiros) numa frase pt-BR para a FAQ
 * de horário de funcionamento — o que faltava fazer o brain responder "abrem domingo?" em vez de
 * repetir a lista de serviços. Ex.: "Atendemos de segunda a sábado, das 09:00 às 18:00. Fechado
 * domingo." Dias contíguos viram faixa ("de X a Y"); senão são listados.
 */
export function resumirExpediente(horarios: HorarioDoBrain[]): string {
  if (!horarios || horarios.length === 0) {
    return 'Nosso horário de funcionamento ainda não está cadastrado.';
  }
  const abertos = [...new Set(horarios.map((h) => h.weekday))].sort((a, b) => a - b);
  const hhmm = (t: string) => t.slice(0, 5);
  const abre = horarios.map((h) => h.startTime).sort()[0];
  const fecha = horarios.map((h) => h.endTime).sort().slice(-1)[0];

  const contiguo =
    abertos.length >= 3 && abertos.every((d, i) => i === 0 || d === abertos[i - 1] + 1);
  const diasTxt = contiguo
    ? `de ${DIAS_DA_SEMANA[abertos[0]]} a ${DIAS_DA_SEMANA[abertos[abertos.length - 1]]}`
    : juntarEmPtBr(abertos.map((d) => DIAS_DA_SEMANA[d]));

  const fechados = [0, 1, 2, 3, 4, 5, 6].filter((d) => !abertos.includes(d));
  const fechadoTxt = fechados.length
    ? ` Fechado ${juntarEmPtBr(fechados.map((d) => DIAS_DA_SEMANA[d]))}.`
    : '';

  return `Atendemos ${diasTxt}, das ${hhmm(abre)} às ${hhmm(fecha)}.${fechadoTxt}`;
}

/**
 * Monta o catálogo que o brain lê para saber o que a barbearia sabe fazer.
 *
 * Função pura: recebe serviços e equipe já carregados e devolve o objeto que
 * casa com `catalog-response.schema.json`. Os nomes reais de serviços e
 * barbeiros entram nas dicas dos slots e no menu de conversa — é isso que
 * "monta o catálogo a partir de serviços/equipe" quer dizer, e não uma lista
 * fixa que ignora a loja.
 */
export function montarCatalogo(
  loja: LojaDoBrain,
  servicos: ServicoDoBrain[],
  equipe: BarbeiroDoBrain[],
  horarios: HorarioDoBrain[] = [],
): RespostaDeCatalogo {
  const nomesDeServico = servicos.map((s) => s.name);
  const nomesDeBarbeiro = equipe.map((b) => b.name);

  const listaDeServicos = servicos
    .map((s) => `${s.name} (${formatarPreco(s.priceCents)})`)
    .join(', ');

  return {
    operations: [OP_MARCAR, OP_CANCELAR],

    intentSlots: {
      [OP_MARCAR]: [
        {
          name: 'serviceName',
          format: 'text',
          hint: nomesDeServico.length
            ? `Qual serviço? Temos: ${nomesDeServico.join(', ')}.`
            : 'Qual serviço você quer?',
          resolverKey: 'session',
          values: nomesDeServico,
        },
        {
          name: 'staffName',
          format: 'text',
          hint: nomesDeBarbeiro.length
            ? `Com qual profissional? ${nomesDeBarbeiro.join(', ')} — ou deixe que a gente encaixa.`
            : 'Com qual profissional?',
          alwaysMissing: false,
          optional: true,
          values: nomesDeBarbeiro,
        },
        {
          name: 'sessionDate',
          format: 'date',
          hint: 'Para qual dia? (ex.: 2026-08-20)',
        },
        {
          name: 'sessionTime',
          format: 'time',
          hint: 'Qual horário?',
          resolverKey: 'session',
          // "CANDIDATES" é a string que o brain reconhece como slot resolvido por lista
          // (OperationSession.isCandidatesStrategy / o assistente). Com outra string o motor
          // pediria o horário como texto livre e nunca chamaria o /resolve das vagas.
          resolutionStrategy: 'CANDIDATES',
          minimumSlots: ['serviceName', 'sessionDate'],
        },
        {
          // O telefone é o remetente do WhatsApp (o brain semeia sozinho); o nome, não —
          // por isso é o único dado de cliente que o bot pergunta. Fica por último, depois
          // dos detalhes da reserva.
          name: 'clientName',
          format: 'text',
          hint: 'Beleza! E qual o seu nome pra reserva?',
        },
      ],
      [OP_CANCELAR]: [
        {
          name: 'appointmentId',
          format: 'text',
          hint: 'Qual agendamento você quer cancelar?',
          resolutionStrategy: 'CANDIDATES',
          resolverKey: 'session',
          minimumSlots: [],
        },
      ],
    },

    uxHints: {
      [OP_MARCAR]: {
        label: 'Marcar horário',
        emoji: '📅',
        showInMenu: true,
        inverseOperation: OP_CANCELAR,
        suggestedNextOperations: [OP_CANCELAR],
        temporalPolicy: 'FUTURE_ONLY',
        supportsCollectiveMode: false,
      },
      [OP_CANCELAR]: {
        label: 'Cancelar horário',
        emoji: '🗑️',
        showInMenu: true,
        inverseOperation: OP_MARCAR,
        temporalPolicy: 'FUTURE_ONLY',
        supportsCollectiveMode: false,
      },
    },

    slotDisplayNames: {
      serviceName: 'serviço',
      staffName: 'profissional',
      sessionDate: 'data',
      sessionTime: 'horário',
      appointmentId: 'agendamento',
    },

    copyHintsByOperation: {
      [OP_MARCAR]: {
        candidateSelectionPromptsBySlot: {
          serviceName: 'Qual serviço você quer?',
          staffName: 'Com qual profissional?',
          sessionTime: 'Escolha o melhor horário:',
        },
        // Sem {staffName}: o barbeiro é opcional e, quando o cliente diz "tanto faz", só é
        // definido na hora de marcar (agenda mais vazia) — então não entra na confirmação.
        // A mensagem de "marcado" mostra o barbeiro real.
        confirmationTemplate:
          'Confirmo {serviceName} em {sessionDate} às {sessionTime}?',
      },
      [OP_CANCELAR]: {
        confirmationTemplate: 'Confirmo o cancelamento do seu horário?',
      },
    },

    // O cliente da barbearia não é um "perfil" do sistema; o papel fica nulo.
    profileRole: null,

    conversationMenu: {
      offerText: `Oi! Aqui é a ${loja.name}. Posso te ajudar a marcar ou cancelar um horário. O que você prefere?`,
      intents: [
        { name: 'saudacao', behavior: 'GREETING' },
        {
          name: 'lista_de_servicos',
          behavior: 'INFO',
          replyText: listaDeServicos
            ? `Nossos serviços: ${listaDeServicos}.`
            : 'Ainda não temos serviços cadastrados por aqui.',
        },
        // FAQ de horário de funcionamento: sem isto, "abrem domingo?" caía no intent de
        // serviços e repetia (o loop da p7). Só entra quando há expediente cadastrado.
        ...(horarios.length
          ? [
              {
                name: 'horario_funcionamento',
                behavior: 'INFO',
                replyText: resumirExpediente(horarios),
              },
            ]
          : []),
        { name: 'falar_com_atendente', behavior: 'HANDOFF' },
      ],
    },
  };
}
