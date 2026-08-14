import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { listAllServices } from '@/db/repositories';
import { formatPrice, formatDuration } from '@/lib/format';
import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Badge } from '@/components/ui/badge';
import { Bloco } from '@/components/ui/bloco';
import { Card } from '@/components/ui/card';
import { Largura } from '@/components/ui/largura';
import { ServicoForm } from './servico-form';
import { ToggleButton } from './toggle-button';

/**
 * Cabeçalho e linha compartilham a definição das colunas porque são grades
 * separadas — uma por `<li>` —, e duas definições diferentes põem o rótulo fora
 * de cima do valor. Pelo mesmo motivo a coluna de ação é `minmax` e não `auto`
 * puro: sem o mínimo, a linha e o cabeçalho (que tem a última célula vazia)
 * resolveriam larguras diferentes.
 *
 * O topo fica solto de propósito. Quando a ação falha, o aviso vermelho nasce
 * dentro desta mesma célula; travar a coluna em 104px o espremeria em cinco
 * linhas de duas palavras. O preço é a coluna alargar enquanto o aviso estiver
 * na tela — e ele some no clique seguinte.
 */
const COLUNAS_DO_DESKTOP = 'md:grid-cols-[1fr_120px_120px_minmax(104px,auto)]';

/**
 * O padrão de cadastro do painel (§5.9): cabeçalho, formulário recolhido e uma
 * `.lista` de linhas de 72px.
 *
 * A tabela de cinco colunas com largura de 100% que estava aqui é o motivo de
 * a tela rolar de lado em 360px — e nenhum `min-width` conserta tabela em
 * celular. No desktop as colunas voltam por grade, que quebra sozinha.
 *
 * **Uma largura só para a tela inteira** (§3.7): cabeçalho, formulário e lista
 * dividem o mesmo teto de `tabela`. Antes o card do formulário tinha 520px e o
 * da lista 720px, um logo acima do outro, e o degrau entre as duas caixas era o
 * que mais saltava na captura. O 520 continua existindo — mas dentro do
 * formulário, em volta dos campos, que é onde ele quer dizer alguma coisa.
 */
export default async function ServicosPage() {
  const sessao = await requireSession();
  const servicos = await listAllServices(db, sessao.barbershopId);

  return (
    <Largura tipo="tabela" className="flex flex-col gap-4">
      <CabecalhoDePagina
        titulo="Serviços"
        descricao="O que a barbearia faz, quanto dura e quanto custa."
      />

      <ServicoForm />

      {servicos.length === 0 ? (
        <Bloco>
          <p className="font-bold">Nenhum serviço cadastrado ainda.</p>
          <p className="mt-1 text-tinta-2">Comece pelo corte simples: nome, duração e preço.</p>
        </Bloco>
      ) : (
        // `gap-0 py-0` e a lista de ponta a ponta: o recheio do card ficaria por
        // fora das divisórias e a linha de 72px já tem o seu. O que o card traz
        // aqui é a moldura — anel, raio e fundo —, não mais margem.
        <Card className="gap-0 py-0">
          <div
            className={`hidden h-9 items-center gap-3 border-b border-linha px-3 text-xs leading-4 font-bold text-tinta-3 uppercase md:grid ${COLUNAS_DO_DESKTOP}`}
          >
            <span>Nome</span>
            <span className="text-right">Duração</span>
            <span className="text-right">Preço</span>
            <span />
          </div>

          {/* A borda de cima e a de baixo saem: quem fecha a caixa agora é o
              anel do card. */}
          <ul className="lista border-t-0 [&>li:last-child]:border-b-0">
            {servicos.map((s) => (
              // Serviço inativo muda de fundo e ganha etiqueta — nunca opacidade,
              // que apaga o contraste do texto junto com a ênfase. É
              // `--superficie-2` porque o fundo do card já é `--superficie`.
              <li key={s.id} className={s.active ? undefined : 'bg-superficie-2'}>
                <div
                  className={`grid min-h-[72px] grid-cols-[1fr_auto] items-center gap-3 p-3 ${COLUNAS_DO_DESKTOP}`}
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[17px] leading-[22px] font-bold ${
                          s.active ? '' : 'text-tinta-3'
                        }`}
                      >
                        {s.name}
                      </span>
                      {/* `outline` é a variante que a lib tem para etiqueta
                          neutra de borda — a linha do serviço desligado já
                          mudou de fundo, e uma etiqueta cheia por cima seria a
                          segunda ênfase na mesma informação. */}
                      {s.active ? null : <Badge variant="outline">INATIVO</Badge>}
                    </span>
                    <span className="text-sm leading-5 text-tinta-2 md:hidden">
                      {formatDuration(s.durationMinutes)} · {formatPrice(s.priceCents)}
                    </span>
                  </div>

                  <span className="hidden text-right text-sm leading-5 text-tinta-2 md:block">
                    {formatDuration(s.durationMinutes)}
                  </span>
                  <span className="hidden text-right text-sm leading-5 text-tinta-2 md:block">
                    {formatPrice(s.priceCents)}
                  </span>

                  {/* Sem esticar: quem garante o alinhamento entre as linhas é
                      o mínimo da coluna, e o botão só precisa encostar na
                      direita como no celular. */}
                  <div className="justify-self-end">
                    <ToggleButton id={s.id} active={s.active} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Largura>
  );
}
