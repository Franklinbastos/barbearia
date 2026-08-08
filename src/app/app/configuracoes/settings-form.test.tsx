// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsForm } from './settings-form';
import { MATIZES_PERMITIDOS } from '@/domain/catalog/shop-settings';

const loja = {
  name: 'Barbearia do Marcão',
  slotMinutes: 30,
  minLeadMinutes: 60,
  maxAdvanceDays: 30,
  timeZone: 'America/Sao_Paulo',
  accentHue: null,
};

describe('SettingsForm — cor da loja', () => {
  it('oferece as doze fichas de cor, e nenhum input type=color', () => {
    const { container } = render(<SettingsForm loja={loja} />);
    const grupo = screen.getByRole('group', { name: 'Cor da loja' });
    expect(grupo.querySelectorAll('button')).toHaveLength(MATIZES_PERMITIDOS.length + 1);
    expect(container.querySelector('input[type="color"]')).toBeNull();
  });

  it('sem matiz, "Sem cor" é a ficha marcada e o campo vai vazio', () => {
    const { container } = render(<SettingsForm loja={loja} />);
    expect(screen.getByRole('button', { name: 'Sem cor' }).getAttribute('aria-pressed')).toBe('true');
    const oculto = container.querySelector('input[name="accentHue"]') as HTMLInputElement;
    expect(oculto.value).toBe('');
  });

  it('escolher um matiz escreve o número no campo oculto — a action não muda', async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsForm loja={loja} />);

    await user.click(screen.getByRole('button', { name: 'Azul' }));
    const oculto = container.querySelector('input[name="accentHue"]') as HTMLInputElement;
    expect(oculto.value).toBe('210');
    expect(screen.getByRole('button', { name: 'Azul' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Sem cor' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('a cor escolhida chega marcada quando a loja já tem matiz', () => {
    const { container } = render(<SettingsForm loja={{ ...loja, accentHue: 30 }} />);
    expect(screen.getByRole('button', { name: 'Laranja' }).getAttribute('aria-pressed')).toBe('true');
    const oculto = container.querySelector('input[name="accentHue"]') as HTMLInputElement;
    expect(oculto.value).toBe('30');
  });

  it('mantém os cinco campos que já existiam, com os mesmos rótulos', () => {
    render(<SettingsForm loja={loja} />);
    for (const rotulo of [
      'Nome da barbearia',
      'Fuso horário',
      'Grade de horários (minutos)',
      'Antecedência mínima (minutos)',
      'Janela máxima de agendamento (dias)',
    ]) {
      expect(screen.getByLabelText(rotulo)).toBeDefined();
    }
    expect(screen.getByRole('button', { name: 'Salvar configurações' })).toBeDefined();
  });
});
