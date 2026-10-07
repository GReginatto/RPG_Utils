import { render, screen, fireEvent } from '@testing-library/react';
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

test("Titânico não desperta nenhuma aura, nem as compradas (D-62)", () => {
  const sheet = blankSheet({ level: 15, auras: [{ n: "Titânica", lv: 3, her: true }, { n: "Fogo", lv: 3, her: false, pago: 2 }], ppConf: { attrUps: {}, auras: { "Titânica": 3, Fogo: 3 } } });
  const onUpdate = jest.fn();
  const alerts = []; window.alert = m => alerts.push(m);
  render(<CharacterSheet sheet={sheet} onUpdate={onUpdate} onClose={() => {}} />);
  fireEvent.click(screen.getAllByText("Auras")[0]);
  expect(screen.getAllByText(/Titânico, D-62/)).toHaveLength(2);
  onUpdate.mockClear();
  const plus = screen.getAllByText("+");
  fireEvent.click(plus[plus.length - 1]); // + da Fogo comprada (última aura da lista)
  expect(alerts.some(m => /D-62/.test(m))).toBe(true);
  expect(onUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ auras: expect.anything() }));
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
