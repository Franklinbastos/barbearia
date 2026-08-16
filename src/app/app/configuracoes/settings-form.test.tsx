// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
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

  it('mantém os campos que já existiam — fuso agora é um texto com "alterar"', () => {
    render(<SettingsForm loja={loja} />);
    for (const rotulo of [
      'Nome da barbearia',
      'Grade de horários',
      'Antecedência mínima',
      'Até quando o cliente pode marcar',
    ]) {
      expect(screen.getByLabelText(rotulo)).toBeDefined();
    }
    // O fuso não é mais um campo visível — é um texto com botão "alterar"
    expect(screen.getByText(loja.timeZone)).toBeDefined();
    expect(screen.getByRole('button', { name: /alterar/i })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Salvar configurações' })).toBeDefined();
  });
});

describe('o formulário depois da reforma de 16/08', () => {
  it('o fuso não está na primeira dobra', () => {
    // Nenhum produto de salão trata fuso como preferência: a Booksy não deixa
    // o dono mexer, a Vagaro não tem o campo. Fica alcançável, não no caminho.
    const fonte = readFileSync(resolve(process.cwd(), 'src/app/app/configuracoes/settings-form.tsx'), 'utf8');
    const posFuso = fonte.indexOf('timeZone');
    const posGrade = fonte.indexOf('slotMinutes');
    expect(posFuso).toBeGreaterThan(posGrade);
  });

  it('há um botão de salvar, e só um', () => {
    // Primer: "There should only be one save button on a page"
    render(<SettingsForm loja={loja} />);
    expect(screen.getAllByRole('button', { name: /salvar/i })).toHaveLength(1);
  });

  it('o salvar nunca nasce desabilitado', () => {
    // Primer: "Disabled buttons cannot be focused using the Tab key"
    render(<SettingsForm loja={loja} />);
    const botao = screen.getByRole('button', { name: /salvar/i }) as HTMLButtonElement;
    expect(botao.disabled).toBe(false);
  });

  it('a antecedência explica com exemplo', () => {
    // Mangomint, Vagaro, Calendly e Fresha explicam todos com um caso concreto
    render(<SettingsForm loja={{ ...loja, minLeadMinutes: 60 }} />);
    expect(screen.getByText(/16h.*15h|antes/i)).toBeDefined();
  });

  it('o exemplo acompanha o que está digitado, não o que está salvo', async () => {
    // O plano pede a frase andando com o valor: com 30 min o prazo é 15h30.
    const user = userEvent.setup();
    render(<SettingsForm loja={{ ...loja, minLeadMinutes: 60 }} />);

    const campo = screen.getByLabelText('Antecedência mínima');
    await user.clear(campo);
    await user.type(campo, '30');

    expect(screen.getByText(/fechar até 15h30/)).toBeDefined();
  });

  it('antecedência maior que o exemplo não escreve hora negativa', () => {
    // O campo aceita até 10080 minutos (sete dias). A conta crua de 16h menos a
    // antecedência escrevia "até -8h00" a partir de 17 horas.
    render(<SettingsForm loja={{ ...loja, minLeadMinutes: 1440 }} />);
    const dica = screen.getByText(/fechar até/);
    expect(dica.textContent).not.toMatch(/-\d/);
    expect(dica.textContent).toMatch(/16h do dia anterior/);
  });

  it('a dica da grade é lida junto com o campo', () => {
    // O `Campo` não consegue amarrar a dica num `Select` — o `aria-describedby`
    // dele morre no `Select.Root`. Sem a amarração à mão a frase fica só na
    // tela, e some para quem ouve.
    render(<SettingsForm loja={loja} />);
    const disparador = screen.getByLabelText('Grade de horários');
    const idDaDica = disparador.getAttribute('aria-describedby');
    expect(idDaDica).toBeTruthy();
    expect(document.getElementById(idDaDica!)?.textContent).toMatch(/de quanto em quanto tempo/i);
  });

  it('as fichas de cor e o "Sem cor" ficam na mesma grade', () => {
    // "Sem cor" flutuava numa linha só dele, em x=588, fora do alinhamento das
    // doze que vinham abaixo
    const { container } = render(<SettingsForm loja={loja} />);
    const grade = container.querySelector('[data-slot="fichas-de-cor"]');
    expect(grade?.querySelectorAll('button')).toHaveLength(13);
  });
});

describe('o link entra entre as seções, e o formulário não o engole', () => {
  it('a ordem é identidade → link → regras', () => {
    // §2.3: ordenar por importância, e o link **depois** da identidade porque
    // deriva dela — o slug nasce do nome. Até 16/08 ele caía depois do
    // formulário inteiro, o que punha a regra operacional na frente da coisa
    // que o dono mais manda para o cliente.
    const { container } = render(
      <SettingsForm loja={loja} linkDeAgendamento={<section data-slot="link-de-teste" />} />,
    );

    const blocos = [
      ...container.querySelectorAll('[data-slot="secao-titulo"], [data-slot="link-de-teste"]'),
    ];
    expect(blocos.map((bloco) => bloco.getAttribute('data-slot'))).toEqual([
      'secao-titulo',
      'link-de-teste',
      'secao-titulo',
    ]);
    expect(blocos[0].textContent).toBe('Identidade');
    expect(blocos[2].textContent).toBe('Regras da agenda');
  });

  it('o bloco do link fica fora do <form>', () => {
    // Primer: não misturar controle que age na hora com formulário que age no
    // submit. É por isso que o `<form>` é só a barra do salvar e os campos se
    // amarram nele pelo atributo `form`.
    const { container } = render(
      <SettingsForm loja={loja} linkDeAgendamento={<section data-slot="link-de-teste" />} />,
    );

    const formulario = container.querySelector('form')!;
    expect(formulario.contains(container.querySelector('[data-slot="link-de-teste"]'))).toBe(false);
  });

  it('todo campo com nome chega ao formulário, mesmo morando fora dele', () => {
    // A trava do atributo `form`: campo novo sem ele fica na tela, parece
    // salvar e não chega na action. É o defeito silencioso mais caro da tela.
    const { container } = render(<SettingsForm loja={loja} />);

    const formulario = container.querySelector('form') as HTMLFormElement;
    const nomeados = [...container.querySelectorAll<HTMLInputElement>('input[name], select[name]')];
    expect(nomeados.length).toBeGreaterThan(0);

    const soltos = nomeados.filter((campo) => campo.form !== formulario).map((campo) => campo.name);
    expect(soltos).toEqual([]);

    const dados = new FormData(formulario);
    expect([...dados.keys()].sort()).toEqual([
      'accentHue',
      'maxAdvanceDays',
      'minLeadMinutes',
      'name',
      'slotMinutes',
      'timeZone',
    ]);
  });
});
