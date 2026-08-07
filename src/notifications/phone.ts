/**
 * Ponto único de normalização do telefone para o WhatsApp.
 *
 * A rota pública aceita de 10 a 13 dígitos, então chega tanto `11999998888`
 * quanto `5511999998888`. A decisão é pelo **tamanho**, nunca pelo prefixo:
 * existe o DDD 55 (Santa Maria/RS), e `5533334444` é um número local de dez
 * dígitos que continua precisando do DDI.
 *
 * - 12 ou 13 dígitos começando em 55 → já tem DDI, vai como está.
 * - 10 ou 11 dígitos → DDD + número, ganha o 55 na frente.
 * - qualquer outra coisa → erro, e sem o número na mensagem: telefone é dado
 *   pessoal e a mensagem de erro vai parar no `notification_log`.
 */
export function toWhatsAppNumber(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '');

  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    return digitos;
  }
  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`;
  }

  throw new Error(`Telefone fora do formato esperado (${digitos.length} dígitos)`);
}
