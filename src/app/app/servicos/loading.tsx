import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';
import { Largura } from '@/components/ui/largura';

/**
 * O cabeçalho já é conhecido antes da consulta, então ele aparece de verdade e
 * só a lista fica em esqueleto — a tela não pula quando o conteúdo chega.
 *
 * O mesmo vale para a largura: o esqueleto usa o degrau da tela que ele
 * antecede, senão a lista salta de 720 para o teto de `tabela` ao carregar.
 */
export default function CarregandoServicos() {
  return (
    <Largura tipo="tabela" className="flex flex-col gap-4">
      <CabecalhoDePagina
        titulo="Serviços"
        descricao="O que a barbearia faz, quanto dura e quanto custa."
      />
      <EsqueletoDeLinha altura={72} quantidade={4} />
    </Largura>
  );
}
