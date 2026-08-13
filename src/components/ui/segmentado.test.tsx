// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Segmentado } from './segmentado';
import { FichasDeEscolha } from './fichas-de-escolha';

const OPCOES = [
  { valor: 'agora', rotulo: 'Agora' },
  { valor: 'marcar', rotulo: 'Marcar hora' },
] as const;

function montar(valor: 'agora' | 'marcar' = 'agora') {
  const aoTrocar = vi.fn();
  render(
    <Segmentado
      rotuloDoGrupo="Modo do encaixe"
      opcoes={[...OPCOES]}
      valor={valor}
      aoTrocar={aoTrocar}
    />,
  );
  return { aoTrocar };
}

describe('Segmentado', () => {
  it('é um grupo rotulado, não dois botões soltos', () => {
    montar();
    expect(screen.getByRole('group', { name: 'Modo do encaixe' })).toBeDefined();
  });

  it('marca o modo ativo com aria-pressed', () => {
    montar('agora');
    expect(screen.getByRole('button', { name: 'Agora' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Marcar hora' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('troca de modo com um toque', async () => {
    const { aoTrocar } = montar('agora');
    await userEvent.click(screen.getByRole('button', { name: 'Marcar hora' }));
    expect(aoTrocar).toHaveBeenCalledWith('marcar');
  });

  it('tocar no modo que já está ativo não troca nada', async () => {
    const { aoTrocar } = montar('agora');
    await userEvent.click(screen.getByRole('button', { name: 'Agora' }));
    expect(aoTrocar).not.toHaveBeenCalled();
  });

  it('cada modo carrega a própria altura de balcão (--tap-md, 52px na §3.1)', () => {
    // A altura vem do controle, não de classe utilitária colada pela tela: é a
    // diferença entre um alvo de 52px e o texto de 24px que o preflight deixa.
    montar();
    for (const rotulo of ['Agora', 'Marcar hora']) {
      const botao = screen.getByRole('button', { name: rotulo });
      expect(botao.style.minHeight).toBe('var(--tap-md)');
    }
  });
});

describe('FichasDeEscolha — contrato com a server action', () => {
  it('renderiza o campo oculto com o valor escolhido', () => {
    const { container } = render(
      <FichasDeEscolha
        rotuloDoGrupo="Barbeiro"
        opcoes={[
          { valor: 'a', rotulo: 'João' },
          { valor: 'b', rotulo: 'Pedro' },
        ]}
        valor="b"
        aoTrocar={() => {}}
        nomeDoCampoOculto="staffId"
      />,
    );
    const oculto = container.querySelector('input[type="hidden"][name="staffId"]');
    expect(oculto).not.toBeNull();
    expect((oculto as HTMLInputElement).value).toBe('b');
  });

  it('sem nomeDoCampoOculto não renderiza campo oculto', () => {
    const { container } = render(
      <FichasDeEscolha
        rotuloDoGrupo="Barbeiro"
        opcoes={[{ valor: 'a', rotulo: 'João' }]}
        valor="a"
        aoTrocar={() => {}}
      />,
    );
    expect(container.querySelector('input[type="hidden"]')).toBeNull();
  });

  it('o grupo é anunciado pelo rótulo', () => {
    render(
      <FichasDeEscolha
        rotuloDoGrupo="Serviço"
        opcoes={[{ valor: 'a', rotulo: 'Corte' }]}
        valor="a"
        aoTrocar={() => {}}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Serviço' })).toBeDefined();
  });

  it('cada ficha é uma opção nomeada, e a escolhida está marcada', () => {
    render(
      <FichasDeEscolha
        rotuloDoGrupo="Barbeiro"
        opcoes={[
          { valor: 'a', rotulo: 'João' },
          { valor: 'b', rotulo: 'Pedro' },
        ]}
        valor="b"
        aoTrocar={() => {}}
      />,
    );
    expect(screen.getByRole('radio', { name: 'João' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('radio', { name: 'Pedro' }).getAttribute('aria-checked')).toBe('true');
  });

  it('trocar de ficha avisa quem chamou', async () => {
    const aoTrocar = vi.fn();
    render(
      <FichasDeEscolha
        rotuloDoGrupo="Barbeiro"
        opcoes={[
          { valor: 'a', rotulo: 'João' },
          { valor: 'b', rotulo: 'Pedro' },
        ]}
        valor="a"
        aoTrocar={aoTrocar}
      />,
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Pedro' }));
    expect(aoTrocar).toHaveBeenCalledWith('b');
  });

  it('tocar na ficha que já está ativa não troca nada', async () => {
    const aoTrocar = vi.fn();
    render(
      <FichasDeEscolha
        rotuloDoGrupo="Barbeiro"
        opcoes={[
          { valor: 'a', rotulo: 'João' },
          { valor: 'b', rotulo: 'Pedro' },
        ]}
        valor="a"
        aoTrocar={aoTrocar}
      />,
    );
    await userEvent.click(screen.getByRole('radio', { name: 'João' }));
    expect(aoTrocar).not.toHaveBeenCalled();
  });

  it('a ficha "qualquer barbeiro" tem valor vazio e continua marcável', () => {
    // A agenda manda `{ valor: '' }` para "Qualquer um" — se o valor vazio
    // deixar de casar, o encaixe abre sem nenhuma ficha escolhida.
    const { container } = render(
      <FichasDeEscolha
        rotuloDoGrupo="Barbeiro"
        opcoes={[
          { valor: '', rotulo: 'Qualquer um' },
          { valor: 'b', rotulo: 'Pedro' },
        ]}
        valor=""
        aoTrocar={() => {}}
        nomeDoCampoOculto="staffId"
      />,
    );
    expect(screen.getByRole('radio', { name: 'Qualquer um' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(
      (container.querySelector('input[type="hidden"][name="staffId"]') as HTMLInputElement).value,
    ).toBe('');
  });

  it('cada ficha carrega a própria altura de balcão (--tap, 48px na §3.1)', () => {
    render(
      <FichasDeEscolha
        rotuloDoGrupo="Barbeiro"
        opcoes={[{ valor: 'a', rotulo: 'João' }]}
        valor="a"
        aoTrocar={() => {}}
      />,
    );
    expect((screen.getByRole('radio', { name: 'João' }) as HTMLElement).style.minHeight).toBe(
      'var(--tap)',
    );
  });
});

describe('FichasDeEscolha dentro de um <form>', () => {
  it('o FormData chega com o campo uma vez só', () => {
    // O `Radio.Root` do base-ui renderiza um `<input type="radio">` escondido ao
    // lado de cada ficha. Se o `RadioGroup` ganhasse `name`, esses inputs iriam
    // junto no envio e a server action receberia `staffId` duas vezes.
    const { container } = render(
      <form>
        <FichasDeEscolha
          rotuloDoGrupo="Barbeiro"
          opcoes={[
            { valor: 'a', rotulo: 'João' },
            { valor: 'b', rotulo: 'Pedro' },
          ]}
          valor="b"
          aoTrocar={() => {}}
          nomeDoCampoOculto="staffId"
        />
      </form>,
    );
    const dados = new FormData(container.querySelector('form') as HTMLFormElement);
    expect(dados.getAll('staffId')).toEqual(['b']);
    expect([...dados.keys()]).toEqual(['staffId']);
  });
});
