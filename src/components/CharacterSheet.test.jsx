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
  expect(screen.getByText(/Marcos de Nível/i)).toBeInTheDocument();
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
  expect(screen.getByText('21')).toBeInTheDocument(); // 21 PP disponíveis no nível 10
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
  expect(onUpdate).toHaveBeenCalledWith({ ppConf: expect.objectContaining({ attrUps: expect.objectContaining({ FOR: 1 }) }) });
});

test('ficha sem ppConf recebe as compras como confirmadas (D-53)', () => {
  const { ppConf, ...old } = blankSheet({ id: 'x1', level: 8, auras: [{ n: 'Água', lv: 2, her: true }] });
  const onUpdate = jest.fn();
  render(<CharacterSheet sheet={old} onUpdate={onUpdate} onClose={() => {}} />);
  expect(onUpdate).toHaveBeenCalledWith({ ppConf: expect.objectContaining({ auras: { 'Água': 2 } }) });
});
