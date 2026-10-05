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
