import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { listAllServices } from '@/db/repositories';
import { formatPrice, formatDuration } from '@/lib/format';
import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Badge } from '@/components/ui/badge';
import { Bloco } from '@/components/ui/bloco';
import { Card } from '@/components/ui/card';
import { ServicoForm } from './servico-form';
import { ToggleButton } from './toggle-button';

/**
 * O padrão de cadastro do painel (§5.9): cabeçalho, formulário recolhido e uma
 * `.lista` de linhas de 72px.
 *
 * A tabela de cinco colunas com largura de 100% que estava aqui é o motivo de
 * a tela rolar de lado em 360px — e nenhum `min-width` conserta tabela em
 * celular. No desktop as colunas voltam por grade, que quebra sozinha.
 */
export default async function ServicosPage() {
  const sessao = await requireSession();
  const servicos = await listAllServices(db, sessao.barbershopId);

  return (
    <div className="flex flex-col gap-4">
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
        <Card className="max-w-[720px] gap-0 py-0">
          <div className="hidden h-9 grid-cols-[1fr_120px_120px_120px] items-center gap-3 border-b border-linha px-3 text-xs leading-4 font-bold text-tinta-3 uppercase md:grid">
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
                <div className="grid min-h-[72px] grid-cols-[1fr_auto] items-center gap-3 p-3 md:grid-cols-[1fr_120px_120px_120px]">
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

                  <div className="justify-self-end md:w-[120px] md:justify-self-stretch">
                    <ToggleButton id={s.id} active={s.active} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
