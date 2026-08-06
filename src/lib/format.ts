export function formatPrice(cents: number): string {
  if (cents === 0) return 'Grátis';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(cents / 100)
    .replace(/ /g, ' ');
}

export function formatDuration(minutes: number): string {
  const horas = Math.floor(minutes / 60);
  const resto = minutes % 60;
  if (horas === 0) return `${resto} min`;
  if (resto === 0) return `${horas} h`;
  return `${horas} h ${resto} min`;
}

export function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone, hour: '2-digit', minute: '2-digit',
  });
}

export function formatDayLabel(isoDate: string, timeZone: string): string {
  const data = new Date(`${isoDate}T12:00:00Z`);
  return data
    .toLocaleDateString('pt-BR', { timeZone, weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/\.$/, '');
}
