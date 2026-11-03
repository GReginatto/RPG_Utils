import { render, screen, fireEvent, within } from '@testing-library/react';
import CharacterSheet from './CharacterSheet';
import { blankSheet } from '../utils/rpgData';

// Renderiza cada aba com uma ficha nova e uma ficha antiga (formato anterior ao canon de 2026-10)
function renderAllTabs(sheet) {
  const onUpdate = jest.fn();
  render(<CharacterSheet sheet={sheet} onUpdate={onUpdate} onClose={() => {}} />);
  ['Perfil', 'Atributos', 'Perícias', 'Inventário', 'Auras', 'Técnicas', 'XP', 'Salvar'].forEach(lbl => {
    fireEvent.click(screen.getAllByText(lbl)[0]);
  });
  return onUpdate;
}

test('ficha nova abre todas as abas', () => {
  renderAllTabs(blankSheet({ name: 'Teste', prof: 'Guerreiro', level: 10, auras: [{ n: 'Fogo', lv: 1, her: true }] }));
  fireEvent.click(screen.getAllByText('XP')[0]);
  expect(screen.getByText(/Progressão por Nível/i)).toBeInTheDocument(); // D-89
  expect(screen.queryByText(/Legado da Arka \(nv 15\)/)).toBeNull();
  fireEvent.click(screen.getAllByText('Perícias')[0]);
  expect(screen.getByText('Pressão de Aura')).toBeInTheDocument();
});

test('ficha antiga (atributos base 6, auraInit, hpRolls) não quebra', () => {
  renderAllTabs({ name: 'Antiga', race: 'Elfo', prof: 'Arkano', attrs: { FOR: 6, DEX: 10, CON: 8, SAB: 8, INT: 10, CAR: 6, DOM: 12 }, auraInit: 'Dracônica', hpRolls: [5, 6], mpRolls: [7, 8], level: 1, proficiencies: ['Arcanismo'] });
  fireEvent.click(screen.getAllByText('Auras')[0]);
  expect(screen.getAllByText('Animalesca').length).toBeGreaterThan(0);
});

test('PP: subir FOR com pontos no nível 10', () => {
  const sheet = blankSheet({ prof: 'Guerreiro', level: 10, attrs: { FOR: 14, DEX: 8, CON: 8, SAB: 8, INT: 8, CAR: 8, DOM: 8 } });
  const onUpdate = jest.fn();
  render(<CharacterSheet sheet={sheet} onUpdate={onUpdate} onClose={() => {}} />);
  fireEvent.click(screen.getAllByText('Atributos')[0]);
  expect(screen.getAllByText(/9 ganhos \(1 por nível/).length).toBeGreaterThan(0); // 9 PP ganhos no nível 10 (D-89)
});

test('Auras: Primordial no catálogo com Dons; Despertar mostra o deus (rodada 6)', () => {
  const sheet = blankSheet({ level: 15, auras: [{ n: 'Fogo', lv: 4, her: true, deus: 'Agni' }], ppConf: { attrUps: {}, auras: { Fogo: 4 } } });
  render(<CharacterSheet sheet={sheet} onUpdate={jest.fn()} onClose={() => {}} />);
  fireEvent.click(screen.getAllByText('Auras')[0]);
  expect(screen.getAllByText(/Boca dos Deuses/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByText('PRIMORDIAL')[0]);
  expect(screen.getAllByText('Nulidade').length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Mini-Selo/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Águas que Contêm/).length).toBeGreaterThan(0);
});

test('PP: compra pendente mostra o botão de confirmar (D-53)', () => {
  const sheet = blankSheet({ level: 10, attrUps: { FOR: 1, DEX: 0, CON: 0, SAB: 0, INT: 0, CAR: 0, DOM: 0 }, ppConf: null });
  const onUpdate = jest.fn();
  window.confirm = () => true;
  render(<CharacterSheet sheet={sheet} onUpdate={onUpdate} onClose={() => {}} />);
  fireEvent.click(screen.getAllByText('Atributos')[0]);
  fireEvent.click(screen.getByText(/Confirmar compras \(1\)/));
  expect(onUpdate).toHaveBeenCalledWith({ ppConf: expect.objectContaining({ attrUps: expect.objectContaining({ FOR: 1 }) }), herLivre: false });
});

test('ficha sem ppConf recebe as compras como confirmadas (D-53)', () => {
  const { ppConf, ...old } = blankSheet({ id: 'x1', level: 8, auras: [{ n: 'Água', lv: 2, her: true }] });
  const onUpdate = jest.fn();
  render(<CharacterSheet sheet={old} onUpdate={onUpdate} onClose={() => {}} />);
  expect(onUpdate).toHaveBeenCalledWith({ ppConf: expect.objectContaining({ auras: { 'Água': 2 } }) });
});

test("Titânico: as compradas não despertam; a Titânica alcança o Ápice Titânico (D-135)", () => {
  const sheet = blankSheet({ level: 15, auras: [{ n: "Titânica", lv: 3, her: true }, { n: "Fogo", lv: 3, her: false, pago: 2 }], ppConf: { attrUps: {}, auras: { "Titânica": 3, Fogo: 3 } } });
  const onUpdate = jest.fn();
  const alerts = []; window.alert = m => alerts.push(m); window.confirm = () => true;
  render(<CharacterSheet sheet={sheet} onUpdate={onUpdate} onClose={() => {}} />);
  fireEvent.click(screen.getAllByText("Auras")[0]);
  expect(screen.getAllByText(/Titânico, D-135/)).toHaveLength(1);
  expect(screen.getAllByText(/Ápice Titânico \(evento, 0 PP\)/)).toHaveLength(1);
  expect(screen.queryByText(/D-62/)).toBeNull();
  onUpdate.mockClear();
  const plus = screen.getAllByText("+");
  fireEvent.click(plus[plus.length - 1]); // + da Fogo comprada (última aura da lista)
  expect(alerts.some(m => /D-135/.test(m))).toBe(true);
  expect(onUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ auras: expect.anything() }));
  fireEvent.click(plus[plus.length - 2]); // + da Titânica: Ápice, sem deus
  expect(onUpdate).toHaveBeenCalledWith({ auras: [{ n: "Titânica", lv: 4, her: true }, { n: "Fogo", lv: 3, her: false, pago: 2 }] });
});

test("Titânica: emprestadas no nível da Titânica, limite de vagas e Corpo Titânico na CA (D-135)", () => {
  const sheet = blankSheet({ level: 9, auras: [{ n: "Titânica", lv: 2, her: true }], emprest: [{ n: "Fogo" }, { n: "Dreno" }, { n: "Luz" }], ppConf: { attrUps: {}, auras: { "Titânica": 2 } } });
  const onUpdate = jest.fn();
  const alerts = []; window.alert = m => alerts.push(m);
  render(<CharacterSheet sheet={sheet} onUpdate={onUpdate} onClose={() => {}} />);
  fireEvent.click(screen.getAllByText("Auras")[0]);
  expect(screen.getByText("3/3 vagas")).toBeInTheDocument();
  expect(screen.getAllByText("nível 2")).toHaveLength(4); // "todas no nível 2" + as 3 emprestadas
  const empSel = screen.getByDisplayValue("Escolha uma aura já vista em uso");
  expect(within(empSel).queryByRole("option", { name: "Aura Própria" })).toBeNull(); // nunca o Ícor
  expect(within(empSel).getByRole("option", { name: "Selamento" })).toBeInTheDocument(); // Primordial pode
  fireEvent.change(empSel, { target: { value: "Água" } });
  fireEvent.click(screen.getByText("Emprestar"));
  expect(alerts.some(m => /Sem vaga/.test(m))).toBe(true);
  expect(onUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ emprest: expect.anything() }));
  fireEvent.click(screen.getAllByText("Atributos")[0]);
  expect(screen.getAllByText(/\+1 Corpo Titânico/).length).toBeGreaterThan(0); // CA 9 + 1 = 10 (DEX 8, sem armadura)
});

test("Ápice Titânico dá a Ação Lendária; Titânico convertido guarda a aura antiga como fixa (D-134, D-135)", () => {
  const apice = blankSheet({ level: 15, auras: [{ n: "Titânica", lv: 4, her: true }], ppConf: { attrUps: {}, auras: { "Titânica": 4 } } });
  const { unmount } = render(<CharacterSheet sheet={apice} onUpdate={jest.fn()} onClose={() => {}} />);
  fireEvent.click(screen.getAllByText("Atributos")[0]);
  expect(screen.getByText(/\(Ápice Titânico\): 1 por rodada/)).toBeInTheDocument(); // Ação Lendária do Ápice
  unmount();
  const conv = blankSheet({ level: 9, auras: [{ n: "Fogo", lv: 3, her: true }], ppConf: { attrUps: {}, auras: { Fogo: 3 } } });
  const onUpdate = jest.fn(); window.confirm = () => true;
  render(<CharacterSheet sheet={conv} onUpdate={onUpdate} onClose={() => {}} />);
  fireEvent.click(screen.getAllByText("Auras")[0]);
  fireEvent.click(screen.getByText("tornar Titânico (Mestre)"));
  expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ auras: [{ n: "Titânica", lv: 1, her: true }], emprest: [{ n: "Fogo", lv: 3, fixa: true, pp: 7 }], auraInit: "Titânica" }));
});

test("hereditária Primordial: aviso de raríssima, sem bloquear (D-61)", () => {
  const sheet = blankSheet({ level: 3, auras: [{ n: "Dreno", lv: 1, her: true }] });
  render(<CharacterSheet sheet={sheet} onUpdate={jest.fn()} onClose={() => {}} />);
  fireEvent.click(screen.getAllByText("Auras")[0]);
  expect(screen.getAllByText(/raríssima — requer aprovação do Mestre/).length).toBeGreaterThan(0);
});

test("rodada 8: perícias e resistências por profissão, Especialista do Diplomata, Canalizador", () => {
  const sheet = blankSheet({ prof: "Diplomata", level: 3, attrs: { FOR: 8, DEX: 8, CON: 8, SAB: 8, INT: 8, CAR: 8, DOM: 8 }, proficiencies: ["Enganação"], especialista: "Enganação" });
  render(<CharacterSheet sheet={sheet} onUpdate={jest.fn()} onClose={() => {}} />);
  fireEvent.click(screen.getAllByText("Perfil")[0]);
  expect(screen.getAllByText(/Inspirar:/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/140 CO/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByText("Perícias")[0]);
  expect(screen.getByText("Testes de Resistência")).toBeInTheDocument();
  expect(screen.getAllByText(/Especialista/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/×2/).length).toBe(2); // Persuasão e Enganação
});

test("rodada 8: ficha com Arkano vira Canalizador (P-040)", () => {
  const onUpdate = jest.fn();
  render(<CharacterSheet sheet={blankSheet({ id: "a1", prof: "Arkano", ppConf: null })} onUpdate={onUpdate} onClose={() => {}} />);
  expect(onUpdate).toHaveBeenCalledWith({ prof: "Canalizador" });
});

test("rodada 8: Ação Lendária só para quem despertou, máx. 2 por combate", () => {
  const sheet = blankSheet({ level: 15, acaoLend: 2, auras: [{ n: "Fogo", lv: 4, her: true, deus: "Agni" }], ppConf: { attrUps: {}, auras: { Fogo: 4 } } });
  render(<CharacterSheet sheet={sheet} onUpdate={jest.fn()} onClose={() => {}} />);
  fireEvent.click(screen.getAllByText("Atributos")[0]);
  expect(screen.getByText("2/2")).toBeInTheDocument();
  expect(screen.getAllByText(/Cobertura/).length).toBeGreaterThan(0);
});

test("rodada 9: ficha da economia antiga é reembolsada com aviso (D-89)", () => {
  const { ppEco, ...old } = blankSheet({ id: "v1", level: 9, attrUps: { FOR: 0, DEX: 0, CON: 0, SAB: 0, INT: 2, CAR: 0, DOM: 0 }, auras: [{ n: "Ilusão", lv: 3, her: true }], ppConf: { attrUps: { INT: 2 }, auras: { "Ilusão": 3 } } });
  const onUpdate = jest.fn();
  render(<CharacterSheet sheet={old} onUpdate={onUpdate} onClose={() => {}} />);
  expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ ppEco: 2, auras: [{ n: "Ilusão", lv: 1, her: true }], ppAntigo: expect.stringMatching(/INT \+2/) }));
});

test("rodada 9: profissão montada mostra a régua; aura de nascença travada; Fúria do Demônio", () => {
  const sheet = blankSheet({ race: "Demônio", prof: "custom", level: 5, auras: [{ n: "Fogo", lv: 1, her: true }], ppConf: { attrUps: {}, auras: { Fogo: 1 } } });
  render(<CharacterSheet sheet={sheet} onUpdate={jest.fn()} onClose={() => {}} />);
  fireEvent.click(screen.getAllByText("Perfil")[0]);
  expect(screen.getAllByText(/Fora da régua da profissão montada/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByText("Atributos")[0]);
  expect(screen.getAllByText(/Fúria Ancestral/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByText("Auras")[0]);
  expect(screen.getByText(/travada/)).toBeInTheDocument();
});

test("G-09: Despertar guardado reativa sozinho quando a aura volta ao nível 3", () => {
  const sheet = blankSheet({ level: 9, auras: [{ n: "Fogo", lv: 2, her: true }], despGuarda: { n: "Fogo", deus: "Agni" }, ppConf: { attrUps: {}, auras: { Fogo: 1 } } });
  const onUpdate = jest.fn();
  render(<CharacterSheet sheet={sheet} onUpdate={onUpdate} onClose={() => {}} />);
  fireEvent.click(screen.getAllByText("Auras")[0]);
  expect(screen.getAllByText(/restaura o Despertar/).length).toBeGreaterThan(0);
  const plus = screen.getAllByText("+");
  fireEvent.click(plus[plus.length - 1]);
  expect(onUpdate).toHaveBeenCalledWith({ auras: [{ n: "Fogo", lv: 4, her: true, deus: "Agni", despRest: true }], despGuarda: null });
});
