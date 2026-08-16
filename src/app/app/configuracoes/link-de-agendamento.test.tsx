// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkDeAgendamento } from './link-de-agendamento';

const URL_DA_LOJA = 'https://app.exemplo.com/b/barbearia-do-marcao';

const montar = () => render(<LinkDeAgendamento url={URL_DA_LOJA} />);

describe('LinkDeAgendamento', () => {
  it('mostra a URL inteira, sem cortar', () => {
    // o slug pode ser longo e em 360px o endereço é a única coisa da tela que
    // não tem onde quebrar — por isso `break-all`, nunca `truncate`
    const { container } = montar();
    const endereco = container.querySelector('[data-slot="link-endereco"]')!;
    expect(endereco.textContent).toBe(URL_DA_LOJA);
    expect(endereco.className).toMatch(/break-all/);
  });

  it('copiar põe a URL na área de transferência e avisa', async () => {
    // Sem mock: o `setup()` do userEvent já instala uma área de transferência
    // de mentira que grava de verdade, e depois disso `navigator.clipboard` só
    // tem getter — trocá-la por um `vi.fn()` lança `TypeError`. Ler o que ficou
    // guardado testa o comportamento em vez da chamada.
    const usuario = userEvent.setup();
    montar();

    await usuario.click(screen.getByRole('button', { name: /copiar/i }));

    expect(await navigator.clipboard.readText()).toBe(URL_DA_LOJA);
    // Polaris: "Provide feedback inline using a confirmation check icon
    // post-click". Sem retorno, a pessoa clica de novo achando que falhou.
    expect(screen.getByRole('status').textContent).toMatch(/copiad/i);
  });

  it('a região de aviso existe antes do clique', () => {
    // região viva que nasce já preenchida costuma não ser anunciada
    montar();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('o endereço vem no input-group da lib, e não como campo', () => {
    // O componente que o shadcn tem para "valor com ação colada" — mas com
    // `InputGroupText`, que é `<span>`. O Carbon proíbe valor estático em campo
    // desabilitado ou `readOnly`, e desabilitado nem é lido por leitor de tela.
    const { container } = montar();
    expect(container.querySelector('[data-slot="input-group"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="input-group"] input')).toBeNull();
  });

  it('o copiar diz o que copia', () => {
    // "Copiar o link", e não "Copiar": o `<BotaoDeCopiar>` monta o nome a partir
    // do `oQue`, e a URL fica no `InputGroupText` ao lado, no mesmo grupo.
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

  it('o copiar e o abrir dividem a largura e medem a mesma altura', () => {
    // pedido do dono em 16/08: meio a meio, e sem degrau entre os dois. A
    // altura vem do mesmo `min-h-11` nos dois lados.
    const { container } = montar();
    const linha = container.querySelector('.sm\\:grid-cols-2')!;
    expect(linha).not.toBeNull();
    const grupo = linha.querySelector('[data-slot="input-group"]')!;
    const abrir = linha.querySelector('[data-slot="link-abrir"]')!;
    expect(grupo.className).toMatch(/min-h-11/);
    expect(abrir.className).toMatch(/min-h-11/);
  });

  it('não é um formulário', () => {
    // Primer: não misturar controle que age na hora com formulário que age no
    // submit. Quem clica em copiar e sai da tela pode achar que salvou.
    const { container } = montar();
    expect(container.querySelector('form')).toBeNull();
  });

  it('não tem mais QR code', () => {
    // saiu em 16/08 a pedido do dono: custava um `<details>`, 160px de tela e
    // uma dependência de 2 MB para um uso que acontece uma vez
    const { container } = montar();
    expect(container.querySelector('details')).toBeNull();
  });
});
