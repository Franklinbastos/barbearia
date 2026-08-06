import { parseTimeToMinutes } from '@/domain/availability';

export function validateWorkingBlocks(blocos: Array<{ startTime: string; endTime: string }>): void {
  const intervalos = blocos
    .map((b) => ({ inicio: parseTimeToMinutes(b.startTime), fim: parseTimeToMinutes(b.endTime) }))
    .sort((a, b) => a.inicio - b.inicio);

  for (const intervalo of intervalos) {
    if (intervalo.fim <= intervalo.inicio) {
      throw new Error('O início do expediente precisa vir antes do fim');
    }
  }

  for (let i = 1; i < intervalos.length; i++) {
    if (intervalos[i].inicio < intervalos[i - 1].fim) {
      throw new Error('Os blocos de expediente não podem se sobrepor');
    }
  }
}

export function validateTimeOff(startAt: Date, endAt: Date): void {
  if (endAt.getTime() <= startAt.getTime()) {
    throw new Error('O início do bloqueio precisa vir antes do fim');
  }
}
