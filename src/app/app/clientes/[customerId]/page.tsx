import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { findBarbershopById, findCustomerById, listCustomerHistory } from '@/db/repositories';
import { calcularPerfilDoCliente } from '@/domain/indicadores/perfil-do-cliente';
import { Badge } from '@/components/ui/badge';
import { Largura } from '@/components/ui/largura';
import { Monograma } from '@/components/ui/monograma';
import { Historico } from './historico';
import { IndicadoresDoCliente } from './indicadores-do-cliente';
import { NotesForm } from './notes-form';
import { AnonymizeButton } from './anonymize-button';

const TITULO_DE_SECAO = 'text-lg leading-6 font-bold';

/**
 * O selo ao lado do nome — **no máximo um, e só quando for verdade**.
 *
 * Destacar às vezes é remover, não acrescentar: dois selos lado a lado não
 * destacam nada. Quando as duas condições batem, sumido ganha, porque é a que
 * pede uma ação do dono — o "cliente novo" é contexto, não tarefa.
 */
function seloDoCliente(perfil: ReturnType<typeof calcularPerfilDoCliente>) {
  if (perfil.sumido && perfil.diasSemVir !== null) {
    return {
      texto: `Sumido há ${perfil.diasSemVir} ${perfil.diasSemVir === 1 ? 'dia' : 'dias'}`,
      variante: 'destructive' as const,
    };
  }
  if (perfil.atendimentos <= 1) return { texto: 'Cliente novo', variante: 'secondary' as const };
  return null;
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const sessao = await requireSession();

  const cliente = await findCustomerById(db, sessao.barbershopId, customerId);
  if (!cliente) notFound();

  const [loja, historico] = await Promise.all([
    findBarbershopById(db, sessao.barbershopId),
    listCustomerHistory(db, sessao.barbershopId, customerId),
  ]);
  const timeZone = loja?.timeZone ?? 'America/Sao_Paulo';

  // Os quatro números saem do mesmo histórico que a lista abaixo mostra, somado
  // em memória: nenhuma consulta a mais para a ficha ganhar indicador.
  const perfil = calcularPerfilDoCliente(historico, new Date());
  const selo = seloDoCliente(perfil);

  return (
    <div className="flex flex-col gap-6">
      {/* A identidade não usa `<CabecalhoDePagina>` porque ela não tem lugar
          nem para o monograma nem para um selo colado no nome — e é justamente
          isso que a ficha de pessoa pede (§2.3 do spec). O `<h1>` continua sendo
          o nome, na mesma escala de 22/28 do cabeçalho das outras telas. */}
      <div className="flex flex-col gap-2">
        <Link href="/app/clientes" className="text-sm leading-5">
          ← Clientes
        </Link>
        <div className="flex items-center gap-3">
          <Monograma nome={cliente.name} tamanho={56} />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] leading-7 font-bold">{cliente.name}</h1>
              {selo ? <Badge variant={selo.variante}>{selo.texto}</Badge> : null}
            </div>
            <p className="text-base leading-6 text-tinta-2">{cliente.phone}</p>
          </div>
        </div>
      </div>

      {/* A faixa de cartões é o degrau `leitura` da régua, e não o `tabela` das
          seções de baixo: a §3.7 dá 1120px para grade de cards, e o spec já
          pedia por escrito que os indicadores ocupassem a faixa larga no
          desktop (§2.3).

          O que decide não é o alinhamento, é o número caber. Debaixo dos 880px
          a fileira de quatro dá cartões de 208px — 176px de recheio —, e o valor
          de 34px da §5.12 só segura "R$ 250,00" ali: no primeiro cliente que
          passa de mil reais, "R$ 1.250,00" quebra o "R$" para uma linha só dele.
          O degrau contra a lista é o preço, e é o barato dos dois. */}
      <Largura tipo="leitura">
        <IndicadoresDoCliente perfil={perfil} timeZone={timeZone} />
      </Largura>

      {/* As seções dividem um teto só. Antes o histórico tinha 720px e a
          privacidade 520px, e as bordas não batiam de uma seção para a outra —
          o `<Largura>` fica aqui em volta para que a próxima seção nasça
          alinhada sem ninguém precisar lembrar do número. */}
      <Largura tipo="tabela" className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h2 className={TITULO_DE_SECAO}>Histórico</h2>
          <Historico atendimentos={historico} timeZone={timeZone} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={TITULO_DE_SECAO}>Notas</h2>
          <NotesForm customerId={customerId} notes={cliente.notes} />
        </section>

        {sessao.role === 'OWNER' ? (
          // Ação rara e destrutiva no rodapé, separada por régua — o `⋮` que os
          // grandes usam esconderia atrás de um alvo de 44px justamente o texto
          // que impede o dono de achar que está apagando o passado da barbearia.
          <section className="flex flex-col gap-3 border-t border-linha pt-6">
            <h2 className={TITULO_DE_SECAO}>Privacidade</h2>
            <AnonymizeButton customerId={customerId} nome={cliente.name} />
          </section>
        ) : null}
      </Largura>
    </div>
  );
}
