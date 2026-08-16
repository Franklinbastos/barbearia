// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkDeAgendamento } from './link-de-agendamento';

const URL_DA_LOJA = 'https://app.exemplo.com/b/barbearia-do-marcao';
// Marcação qualquer no lugar do QR de verdade: o componente só injeta o que o
// servidor mandou, e `tests/unit/icones.test.ts` proíbe SVG literal em `src`.
const QR_FALSO = '<i data-teste="qr"></i>';

const montar = () => render(<LinkDeAgendamento url={URL_DA_LOJA} qrSvg={QR_FALSO} />);

describe('LinkDeAgendamento', () => {
  it('mostra a URL inteira, sem cortar', () => {
    // o slug pode ser longo e em 360px o endereço é a única coisa da tela que
    // não tem onde quebrar — por isso `break-all`, nunca `truncate`
    montar();
    const endereco = screen.getByText(URL_DA_LOJA);
    expect(endereco.className).toMatch(/break-all/);
    expect(endereco.className).not.toMatch(/truncate/);
  });

  it('copiar avisa que copiou', async () => {
    // `setup()` instala o próprio dublê de área de transferência, então o espião
    // vai nele — trocar o `navigator.clipboard` antes seria sobrescrito.
    const usuario = userEvent.setup();
    montar();
    const escrever = vi.spyOn(navigator.clipboard, 'writeText');

    await usuario.click(screen.getByRole('button', { name: /copiar/i }));

    expect(escrever).toHaveBeenCalledWith(URL_DA_LOJA);
    // Polaris: "Provide feedback inline using a confirmation check icon
    // post-click". Sem retorno, a pessoa clica de novo achando que falhou.
    expect(screen.getByRole('status').textContent).toMatch(/copiad/i);
  });

  it('a região do aviso existe antes de haver aviso', () => {
    // região viva montada junto com o texto costuma não ser anunciada: ela
    // precisa estar no DOM quando o conteúdo muda
    montar();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('o QR chega por prop e tem nome acessível', () => {
    // bloco gráfico mudo não diz nada a quem usa leitor de tela
    const { container } = montar();
    expect(screen.getByRole('img', { name: /qr code/i })).toBeDefined();
    expect(container.querySelector('[data-teste="qr"]')).not.toBeNull();
  });

  it('não gera o QR no cliente', () => {
    // gerar aqui custaria a biblioteca inteira no bundle e o código só
    // apareceria depois da hidratação — o servidor já conhece a URL
    const fonte = readFileSync(
      resolve(process.cwd(), 'src/app/app/configuracoes/link-de-agendamento.tsx'),
      'utf8',
    );
    expect(fonte).not.toMatch(/'qrcode'/);
  });

  it('o atalho para a página pública não fica escondido dentro do QR', () => {
    // o dono quer conferir o que o cliente vê, e isso não é assunto do QR
    const { container } = montar();
    const atalho = screen.getByRole('link', { name: /página pública/i });
    expect(atalho.getAttribute('href')).toBe(URL_DA_LOJA);
    expect(atalho.getAttribute('target')).toBe('_blank');
    expect(container.querySelector('details')?.contains(atalho)).toBe(false);
  });

  it('não é um formulário', () => {
    // Primer: não misturar controle que age na hora com formulário que age no
    // submit. Quem clica em copiar e sai da tela pode achar que salvou.
    const { container } = montar();
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('input')).toBeNull();
  });

  it('o copiar é alvo de 44px no toque', () => {
    // §3.6: `--tap-min` onde o dedo alcança; 36px fica para o ponteiro
    montar();
    const botao = screen.getByRole('button', { name: /copiar/i });
    expect(botao.className).toMatch(/size-11/);
    expect(botao.className).toMatch(/md:size-9/);
  });
});
