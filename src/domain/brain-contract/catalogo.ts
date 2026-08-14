import type {
  RespostaDeCatalogo,
  LojaDoBrain,
  ServicoDoBrain,
  BarbeiroDoBrain,
} from './tipos';
import { formatarPreco } from './mapeamento';

export const OP_MARCAR = 'marcar_horario';
export const OP_CANCELAR = 'cancelar_horario';

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
          resolutionStrategy: 'AVAILABILITY',
          minimumSlots: ['serviceName', 'sessionDate'],
        },
      ],
      [OP_CANCELAR]: [
        {
          name: 'appointmentId',
          format: 'text',
          hint: 'Qual agendamento você quer cancelar?',
          alwaysMissing: true,
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
        confirmationTemplate:
          'Confirmo {serviceName} com {staffName} em {sessionDate} às {sessionTime}?',
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
        { name: 'falar_com_atendente', behavior: 'HANDOFF' },
      ],
    },
  };
}
