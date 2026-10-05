import {
  SKILLS, AURA_GROUPS, AURA_DETAILS, RACES_DATA, XP_TABLE, MILESTONES,
  pointBuyCost, profBonus, ppAttrCost, ppEarned, areaDistance, newAuraCost, auraSpent, attrUpsSpent, fortTotal,
  PANTHEON, GENERIC_TECHS, ppConfirmState, ppPending, attrConfirmed, auraConfirmed, awakenedAura, techDiceCap, titanicBorn, rareHereditary,
} from './rpgData';

// Casos calculados à mão a partir do canon (rodadas 5 e 6 do artífice)
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
    expect(AURA_DETAILS.Primordial.map(a => a.n + a.l.length)).toEqual(['Selamento3', 'Dreno3', 'Nulidade3', 'Corrente3']); // D-55
    expect(AURA_DETAILS.Primordial.every(a => a.l[2].includes('30% a mais de dano de técnicas de Ícor'))).toBe(true); // PR5-06
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
    // D-52: faixa pelo valor comprado antes do +1 (sem raça/profissão)
    expect([14, 16, 17, 18, 19].map(ppAttrCost)).toEqual([2, 2, 3, 3, 4]);
    expect(attrUpsSpent(16, 1)).toBe(2);  // exemplo do canon: FOR comprada 16 (18 com bônus) → +1 = 2 PP
    expect(attrUpsSpent(14, 4)).toBe(9);  // Guerreiro FOR comprada 14 (16 final) → final 20: 2+2+2+3
    expect(attrUpsSpent(14, 2)).toBe(4);  // 14 → 16 = 2+2
    // D-60: 16→17 = 2; 17→18 = 3; 19→20 = 4 (valor comprado antes do +1)
    expect([ppAttrCost(16), ppAttrCost(17), ppAttrCost(19)]).toEqual([2, 3, 4]);
    expect(attrUpsSpent(16, 4)).toBe(2 + 3 + 3 + 4); // 16 → 20 comprado
  });

  test('aura nova pela distância a partir da hereditária; Titânica e Ícor só de nascença', () => {
    const fogo = [{ n: 'Fogo', lv: 1, her: true }];
    expect(newAuraCost(fogo, 'Terra')).toBe(3);
    expect(newAuraCost(fogo, 'Naturae')).toBe(4);
    expect(newAuraCost(fogo, 'Raksasha')).toBe(5);
    expect(newAuraCost(fogo, 'Luz')).toBe(6);
    expect(newAuraCost(fogo, 'Aura Própria')).toBeNull();
    expect(newAuraCost(fogo, 'Titânica')).toBeNull();
    expect(newAuraCost(fogo, 'Selamento')).toBe(4);  // Emissora → Primordial: vizinha (D-55)
    expect(newAuraCost([{ n: 'Aura Própria', lv: 1, her: true }], 'Fogo')).toBe(5);
    expect(newAuraCost([{ n: 'Aura Própria', lv: 1, her: true }], 'Dreno')).toBe(6); // Ícor ↔ Primordial: oposta
    expect(newAuraCost([{ n: 'Luz', lv: 1, her: true }], 'Nulidade')).toBe(5);       // Deformadora → Primordial: 2 passos
    // D-50: nascido Titânico compra qualquer outra aura por 4 PP; Ícor e Titânica seguem só de nascença
    const tit = [{ n: 'Titânica', lv: 1, her: true }];
    expect(['Fogo', 'Luz', 'Corrente', 'Raksasha'].map(n => newAuraCost(tit, n))).toEqual([4, 4, 4, 4]);
    expect(newAuraCost(tit, 'Aura Própria')).toBeNull();
    expect(auraSpent({ n: 'Titânica', lv: 3, her: true })).toBe(18); // 8 + 10
  });

  test('custo de subir aura e Despertar sem PP (D-47)', () => {
    expect(auraSpent({ n: 'Fogo', lv: 3, her: true })).toBe(18);
    expect(auraSpent({ n: 'Fogo', lv: 4, her: true })).toBe(18);
    expect(auraSpent({ n: 'Terra', lv: 2, her: false, pago: 3 })).toBe(11);
  });

  test('panteão e Despertar (D-49, D-56, D-59)', () => {
    expect(Object.keys(PANTHEON)).toEqual(['Primordial', 'Emissora', 'Criadora', 'Ícor', 'Deformadora', 'Mental']);
    expect(Object.values(PANTHEON).flat()).toHaveLength(16);
    expect(PANTHEON['Ícor'].map(g => g.n)).toEqual(['Prometeu']);
    expect(PANTHEON.Primordial.map(g => g.n)).toEqual(['Nun', 'Pangu', 'Ymir']);
    expect(PANTHEON.Emissora[1].d).toMatch(/teto de dados do nível/); // Agni (D-59)
    expect(awakenedAura([{ n: 'Fogo', lv: 4 }, { n: 'Terra', lv: 3 }]).n).toBe('Fogo');
    expect(awakenedAura([{ n: 'Fogo', lv: 3 }])).toBeUndefined();
    // D-62: nascido Titânico não desperta nenhuma aura; D-61: hereditária Primordial é aviso, não bloqueio
    expect(titanicBorn([{ n: 'Titânica', lv: 3, her: true }, { n: 'Fogo', lv: 3, her: false, pago: 4 }])).toBe(true);
    expect(titanicBorn([{ n: 'Fogo', lv: 3, her: true }, { n: 'Dreno', lv: 1, her: false, pago: 4 }])).toBe(false);
    expect(rareHereditary('Nulidade')).toBe(true);
    expect(rareHereditary('Fogo')).toBe(false);
  });

  test('compras definitivas (D-53)', () => {
    const s = { attrUps: { FOR: 2 }, auras: [{ n: 'Fogo', lv: 3, her: true }, { n: 'Terra', lv: 1, her: false, pago: 3 }], ppConf: null };
    expect(ppPending(s)).toBe(2 + 2 + 1); // FOR +2; Fogo 1→3; Terra comprada
    const c = { ...s, ppConf: ppConfirmState(s) };
    expect(ppPending(c)).toBe(0);
    expect(attrConfirmed(c, 'FOR')).toBe(2);
    expect(auraConfirmed(c, c.auras[1])).toBe(1);
    expect(auraConfirmed(s, s.auras[1])).toBe(0); // comprada e não confirmada: pode ser desfeita
    expect(ppPending({ ...c, attrUps: { FOR: 3 } })).toBe(1);
  });

  test('teto de dados das técnicas criadas (PR5-07) e Projetar a cada disparo', () => {
    expect([3, 12, 13, 15].map(techDiceCap)).toEqual([5, 5, 6, 6]);
    expect(GENERIC_TECHS[0].extra).toMatch(/a cada disparo/);
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
