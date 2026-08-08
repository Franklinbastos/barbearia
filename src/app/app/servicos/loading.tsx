import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';

/**
 * O cabeçalho já é conhecido antes da consulta, então ele aparece de verdade e
 * só a lista fica em esqueleto — a tela não pula quando o conteúdo chega.
 */
export default function CarregandoServicos() {
  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDePagina
        titulo="Serviços"
        descricao="O que a barbearia faz, quanto dura e quanto custa."
      />
      <div className="max-w-[720px]">
        <EsqueletoDeLinha altura={72} quantidade={4} />
      </div>
    </div>
  );
}
