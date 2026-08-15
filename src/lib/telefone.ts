/**
 * As duas formas de um telefone brasileiro no produto: a que a pessoa lê
 * enquanto digita e a que o `wa.me` exige.
 *
 * Elas moram juntas de propósito. Cada vez que uma delas foi reescrita no lugar
 * onde era precisa, a cópia saiu diferente da original — e telefone que sai
 * diferente é link que abre o WhatsApp em conversa vazia.
 */

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

/**
 * Telefone brasileiro no formato que o `wa.me` exige: só dígitos, com o código
 * do país na frente.
 *
 * O banco guarda o que o balcão digitou — `(11) 99999-8888`, `11999998888`, às
 * vezes já com o 55. A regra: 10 ou 11 dígitos é número nacional e ganha o 55;
 * qualquer coisa maior já vem com país e passa direto.
 *
 * Nasceu em `clientes-sumidos.tsx` e mudou para cá em 15/08/2026, quando a
 * agenda também passou a levar ao WhatsApp: a versão que a agenda tinha escrito
 * era `replace(/\D/g, '')` sem o 55, e `wa.me/11999998888` não abre conversa
 * nenhuma. É a única função daqui que erra calado, e por isso é uma só.
 */
export function telefoneParaWaMe(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos;
}
