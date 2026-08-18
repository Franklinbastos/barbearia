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
  minChangeMinutes: 1440,
  timeZone: 'America/Sao_Paulo',
  accentHue: null,
};

describe('SettingsForm — cor da loja', () => {
  it('oferece as doze cores e o "sem cor", e nenhum input type=color', async () => {
    // As treze fichas viraram um `Select` em 16/08, a pedido do dono. O que a
    // §3.4 guarda não mudou: o valor é um matiz de 0 a 360 com L e croma
    // travados — nada de hex, que obrigaria a avisar sobre contraste como o
    // Cal.com faz.
    const user = userEvent.setup();
    const { container } = render(<SettingsForm loja={loja} />);
    expect(container.querySelector('input[type="color"]')).toBeNull();

    await user.click(screen.getByLabelText('Cor da loja'));
    expect(await screen.findAllByRole('option')).toHaveLength(MATIZES_PERMITIDOS.length + 1);
  });

  it('sem matiz, o disparador diz "Sem cor" e o campo vai vazio', () => {
    const { container } = render(<SettingsForm loja={loja} />);
    expect(screen.getByLabelText('Cor da loja').textContent).toMatch(/sem cor/i);
    const oculto = container.querySelector('input[name="accentHue"]') as HTMLInputElement;
    expect(oculto.value).toBe('');
  });

  it('escolher um matiz escreve o número no campo oculto — a action não muda', async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsForm loja={loja} />);

    await user.click(screen.getByLabelText('Cor da loja'));
    await user.click(await screen.findByRole('option', { name: /Azul/ }));

    // O oculto é quem viaja no submit: o `Select` recolhido tiraria o campo do
    // `<form>` e o valor sumiria — o mesmo defeito que o fuso teve.
    const oculto = container.querySelector('input[name="accentHue"]') as HTMLInputElement;
    expect(oculto.value).toBe('210');
    expect(screen.getByLabelText('Cor da loja').textContent).toMatch(/Azul/);
  });

  it('a cor escolhida chega no disparador quando a loja já tem matiz', () => {
    const { container } = render(<SettingsForm loja={{ ...loja, accentHue: 30 }} />);
    expect(screen.getByLabelText('Cor da loja').textContent).toMatch(/Laranja/);
    const oculto = container.querySelector('input[name="accentHue"]') as HTMLInputElement;
    expect(oculto.value).toBe('30');
  });

  it('mantém os campos que o dono edita — o fuso não é mais um deles', () => {
    render(<SettingsForm loja={loja} />);
    for (const rotulo of [
      'Nome da barbearia',
      'Grade de horários',
      'Antecedência mínima',
      'Até quando o cliente pode marcar',
    ]) {
      expect(screen.getByLabelText(rotulo)).toBeDefined();
    }
    // O fuso saiu da tela em 16/08: ele é capturado do navegador no cadastro,
    // como Calendly, Cal.com e Acuity fazem. Uma barbearia tem um endereço e
    // nunca muda de fuso.
    expect(screen.queryByText(loja.timeZone)).toBeNull();
    expect(screen.queryByRole('button', { name: /alterar/i })).toBeNull();
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

  it('a cor fica na mesma linha do nome da barbearia', () => {
    // Pedido do dono em 16/08: são as duas coisas que o cliente vê, e ele
    // confere as duas de uma olhada. Meio a meio.
    const { container } = render(<SettingsForm loja={loja} />);
    const linha = container.querySelector('.sm\\:grid-cols-2');
    expect(linha).not.toBeNull();
    expect(linha!.textContent).toMatch(/Nome da barbearia/);
    expect(linha!.textContent).toMatch(/Cor da loja/);
  });
});

describe('o link entra no meio da seção, e o formulário não o engole', () => {
  it('o link vem depois da identidade e antes das regras', () => {
    // §2.3: ordenar por importância, e o link **depois** da identidade porque
    // deriva dela — o slug nasce do nome. Até 16/08 ele caía depois do
    // formulário inteiro, o que punha a regra operacional na frente da coisa
    // que o dono mais manda para o cliente.
    const { container } = render(
      <SettingsForm loja={loja} linkDeAgendamento={<section data-slot="link-de-teste" />} />,
    );

    // Desde 16/08 é uma seção só, então a ordem se lê pela posição do link
    // entre o campo de nome e o de grade — não mais por três títulos.
    const texto = container.textContent ?? '';
    expect(texto.indexOf('Nome da barbearia')).toBeLessThan(texto.indexOf('Grade de horários'));
    const blocos = [
      ...container.querySelectorAll('[name="name"], [data-slot="link-de-teste"], [name="slotMinutes"]'),
    ];
    expect(blocos.map((b) => b.getAttribute('data-slot') ?? b.getAttribute('name'))).toEqual([
      'name',
      'link-de-teste',
      'slotMinutes',
    ]);
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
      'minChangeMinutes',
      'minLeadMinutes',
      'name',
      'slotMinutes',
      'timeZone',
    ]);
  });
});
