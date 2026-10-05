import {
  SKILLS, AURA_GROUPS, AURA_DETAILS, RACES_DATA, XP_TABLE, MILESTONES,
  pointBuyCost, profBonus, ppAttrCost, ppEarned, areaDistance, newAuraCost, auraSpent, attrUpsSpent, fortTotal,
} from './rpgData';

// Casos calculados à mão a partir do canon (rodada 5 do artífice)
describe('regras do canon', () => {
  test('31 perícias (D-46)', () => {
    expect(SKILLS).toHaveLength(31);
    expect(SKILLS.filter(s => s.a === 'DOM').map(s => s.n)).toEqual(['Canalização', 'Pressão de Aura']);
  });

  test('hexagrama da imagem e opostos (D-32)', () => {
    expect(AURA_GROUPS.map(g => g.n)).toEqual(['Primordial', 'Emissora', 'Criadora', 'Ícor', 'Deformadora', 'Mental']);
    expect(areaDistance('Primordial', 'Ícor')).toBe(3);
    expect(areaDistance('Emissora', 'Deformadora')).toBe(3);
    expect(areaDistance('Criadora', 'Mental')).toBe(3);
    expect(areaDistance('Emissora', 'Mental')).toBe(2);
    expect(AURA_DETAILS.Primordial.every(a => a.dev)).toBe(true);
    expect(AURA_DETAILS.Emissora.map(a => a.n)).toEqual(['Fogo', 'Água', 'Vento', 'Terra', 'Venenosa', 'Sombria', 'Nebulosa']);
  });

  test('afinidades raciais (D-37)', () => {
    expect(RACES_DATA.Elfo.af).toBe('Mental');
    expect(RACES_DATA['Anão'].af).toBe('Emissora');
    expect(RACES_DATA.Anjo.af).toBe('Deformadora');
    expect(RACES_DATA['Demônio'].af).toBe('Emissora');
    expect(RACES_DATA.Humano.af).toBe('');
  });

  test('compra de pontos: base 8, acima de 14 custa 2 (C-08)', () => {
    expect(pointBuyCost(10, 16)).toBe(8);  // Guerreiro FOR 10 (com profissão) → 16
    expect(pointBuyCost(11, 18)).toBe(11); // Arkano DOM 11 → 18
    expect(pointBuyCost(8, 15)).toBe(8);
  });

  test('proficiência escalonada (PB-1)', () => {
    expect([3, 6, 7, 10, 11, 14, 15].map(profBonus)).toEqual([2, 2, 3, 3, 4, 4, 5]);
  });

  test('XP e marcos sem "+1 atributo"', () => {
    expect(XP_TABLE.slice(2, 14).reduce((a, b) => a + b, 0)).toBe(35600);
    expect(JSON.stringify(MILESTONES)).not.toMatch(/\+1 atributo/);
  });

  test('Pontos de Progressão (PG economia)', () => {
    expect(ppEarned(3)).toBe(0);
    expect(ppEarned(10)).toBe(21);
    expect(ppEarned(15)).toBe(36);
    expect([16, 17, 18, 19, 20].map(ppAttrCost)).toEqual([2, 3, 3, 4, 4]);
    expect(attrUpsSpent(16, 4)).toBe(14); // 16 → 20 = 3+3+4+4
    expect(attrUpsSpent(14, 2)).toBe(4);  // 14 → 16 = 2+2
  });

  test('aura nova pela distância a partir da hereditária; Titânica e Ícor só de nascença', () => {
    const fogo = [{ n: 'Fogo', lv: 1, her: true }];
    expect(newAuraCost(fogo, 'Terra')).toBe(3);
    expect(newAuraCost(fogo, 'Naturae')).toBe(4);
    expect(newAuraCost(fogo, 'Raksasha')).toBe(5);
    expect(newAuraCost(fogo, 'Luz')).toBe(6);
    expect(newAuraCost(fogo, 'Aura Própria')).toBeNull();
    expect(newAuraCost(fogo, 'Titânica')).toBeNull();
    expect(newAuraCost(fogo, 'Selamento')).toBeNull();
    expect(newAuraCost([{ n: 'Aura Própria', lv: 1, her: true }], 'Fogo')).toBe(5);
    expect(newAuraCost([{ n: 'Titânica', lv: 1, her: true }], 'Fogo')).toBeNull();
  });

  test('custo de subir aura e Despertar sem PP (D-47)', () => {
    expect(auraSpent({ n: 'Fogo', lv: 3, her: true })).toBe(18);
    expect(auraSpent({ n: 'Fogo', lv: 4, her: true })).toBe(18);
    expect(auraSpent({ n: 'Terra', lv: 2, her: false, pago: 3 })).toBe(11);
  });

  test('fortalecimentos: teto +300% e máximo 3', () => {
    // Carga 3 turnos (+200%) + Limites 1×/mês (+300%) = 500% → teto 300%
    const r = fortTotal([false, false, true, false, false, false, false, true], { 2: 2, 7: 2 }, false);
    expect(r.total).toBe(300);
    // Votos (+100%) + Limites 1×/dia (+100%): só o maior conta
    expect(fortTotal([false, false, false, false, false, true, false, true], { 7: 0 }, false).total).toBe(100);
    // 3 elementos + Expansão = 4 simultâneos (aviso)
    const w = fortTotal([true, true, false, true], {}, true);
    expect(w.count).toBe(4);
    expect(w.warn.join(' ')).toMatch(/Máximo de 3/);
  });
});
