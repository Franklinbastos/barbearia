// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// O `<BotaoDeCopiar>` chama o sonner, que precisa de um `<Toaster />` montado
// para desenhar. O comportamento dele tem teste próprio; aqui só não pode
// explodir.
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { LinkDeAgendamento } from './link-de-agendamento';

const URL_DA_LOJA = 'https://app.exemplo.com/b/barbearia-do-marcao';

const montar = () => render(<LinkDeAgendamento url={URL_DA_LOJA} />);

describe('LinkDeAgendamento', () => {
  it('a URL fica num campo de leitura, não em texto apagado', () => {
    // Era `InputGroupText`, que nasce em `text-muted-foreground`: a URL saía
    // cinza clara como se o campo estivesse desabilitado. `readOnly` não é
    // `disabled` — continua legível por leitor de tela e selecionável.
    const { container } = montar();
    const campo = container.querySelector('[data-slot="link-endereco"]') as HTMLInputElement;
    expect(campo.tagName).toBe('INPUT');
    expect(campo.readOnly).toBe(true);
    expect(campo.disabled).toBe(false);
    expect(campo.value).toBe(URL_DA_LOJA);
  });

  it('o campo tem nome acessível próprio', () => {
    // O rótulo visível é um `<p>`, não um `<label>` — sem `aria-label` o campo
    // chegaria mudo em leitor de tela.
    montar();
    expect(screen.getByLabelText('Link de agendamento da loja')).toBeDefined();
  });

  it('usa o input-group da lib', () => {
    // O componente que o shadcn tem para "valor com ação colada", e a forma do
    // exemplo canônico dele para este caso exato.
    const { container } = montar();
    expect(container.querySelector('[data-slot="input-group"]')).not.toBeNull();
  });

  it('o copiar diz o que copia', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Copiar o link' })).toBeDefined();
  });

  it('o atalho para a página do cliente fica ao lado do copiar', () => {
    // o dono quer conferir o que o cliente vê, sem sair da tela
    montar();
    const atalho = screen.getByRole('link', { name: /página do cliente/i });
    expect(atalho.getAttribute('href')).toBe(URL_DA_LOJA);
    expect(atalho.getAttribute('target')).toBe('_blank');
    expect(atalho.getAttribute('rel')).toMatch(/noopener/);
  });

  it('o campo e o botão dividem a largura, e nenhum dos dois força altura', () => {
    // Os 44px do `min-h-11` davam um degrau contra os campos de 36px logo acima
    // — foi o que o dono viu. Agora a altura vem do `InputGroup` (h-9) e do
    // `.btn` (`--altura-controle`), que são o mesmo número.
    const { container } = montar();
    const linha = container.querySelector('.sm\\:grid-cols-2')!;
    expect(linha).not.toBeNull();
    expect(linha.querySelector('[data-slot="input-group"]')!.className).not.toMatch(/min-h-11/);
    expect(linha.querySelector('[data-slot="link-abrir"]')!.className).not.toMatch(/min-h-11/);
  });

  it('não é um formulário', () => {
    // Primer: não misturar controle que age na hora com formulário que age no
    // submit. Quem clica em copiar e sai da tela pode achar que salvou.
    const { container } = montar();
    expect(container.querySelector('form')).toBeNull();
  });

  it('não tem mais QR code', () => {
    const { container } = montar();
    expect(container.querySelector('details')).toBeNull();
  });
});
