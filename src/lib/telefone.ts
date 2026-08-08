/**
 * Máscara de telefone brasileiro, aplicada a cada tecla.
 *
 * Vivia dentro de `contact-step.tsx` e agora é compartilhada: o campo de
 * telefone do painel tem os atributos certos (`type`, `inputMode`,
 * `autoComplete`) e nenhuma máscara, e duas implementações divergentes do
 * mesmo formato é como o número entra torto no banco.
 *
 * Aceita entrada suja (o próprio valor já mascarado, colado do WhatsApp) e
 * corta no 11º dígito, que é o máximo de um celular com DDD.
 */
export function aplicarMascaraTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  // Até 10 dígitos ainda pode ser fixo — (11) 3333-4444. No 11º vira celular.
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}
