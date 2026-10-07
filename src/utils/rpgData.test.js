import {
  SKILLS, AURA_GROUPS, AURA_DETAILS, RACES_DATA, XP_TABLE, ppAtLevel, profRuler, convertOldPP, heritageLocked, hitDieHeal, restGain, raceBonus, sheetReminders, scalesAvailable, hachimanBonus, TOOLS, ARMORS,
  pointBuyCost, profBonus, ppAttrCost, ppEarned, areaDistance, newAuraCost, auraSpent, attrUpsSpent, fortTotal,
  PANTHEON, GENERIC_TECHS, PROFESSIONS_DATA, skillProfMult, saveBonus, armorWithoutProf, hitDiceLeft, hitDicePerRest, corpoRenovado, XP_SESSION, auraLicense, ATTR_FULL, ppConfirmState, ppPending, attrConfirmed, auraConfirmed, awakenedAura, techDiceCap, titanicBorn, rareHereditary,
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

  test('compra de pontos: base 8, acima de 14 custa 2, compra sem bônus (C-08, P-079)', () => {
    expect(pointBuyCost(8, 15)).toBe(8);
    expect(pointBuyCost(8, 18)).toBe(14);
    // 18/14/14/12/10/10/9 = 14 + 6 + 6 + 4 + 2 + 2 + 1 = 35
    expect([18, 14, 14, 12, 10, 10, 9].reduce((s, v) => s + pointBuyCost(8, v), 0)).toBe(35);
  });

  test('proficiência escalonada (PB-1)', () => {
    expect([3, 6, 7, 10, 11, 14, 15].map(profBonus)).toEqual([2, 2, 3, 3, 4, 4, 5]);
  });

  test('XP: soma da tabela', () => {
    expect(XP_TABLE.slice(2, 14).reduce((a, b) => a + b, 0)).toBe(35600);
  });

  test('Pontos de Progressão (D-89, R13-1)', () => {
    expect([3, 4, 5, 9, 10, 15].map(ppEarned)).toEqual([0, 1, 3, 7, 9, 15]);
    expect([4, 5, 6, 10, 11, 15].map(ppAtLevel)).toEqual([1, 2, 1, 2, 1, 2]);
    // faixa pelo valor comprado antes do +1 (sem raça/profissão): até 18 = 1; 19→20 = 2
    expect([14, 16, 18, 19].map(ppAttrCost)).toEqual([1, 1, 1, 2]);
    expect(attrUpsSpent(16, 1)).toBe(1);  // exemplo do livro: FOR comprada 16 (18 com bônus) → +1 = 1 PP
    expect(attrUpsSpent(16, 4)).toBe(1 + 1 + 1 + 2); // 16 → 20 comprado
  });

  test('aura nova pela distância a partir da hereditária; Titânica e Ícor só de nascença', () => {
    const fogo = [{ n: 'Fogo', lv: 1, her: true }];
    expect(newAuraCost(fogo, 'Terra')).toBe(1);
    expect(newAuraCost(fogo, 'Naturae')).toBe(2);
    expect(newAuraCost(fogo, 'Raksasha')).toBe(2);
    expect(newAuraCost(fogo, 'Luz')).toBe(3);
    expect(newAuraCost(fogo, 'Aura Própria')).toBeNull();
    expect(newAuraCost(fogo, 'Titânica')).toBeNull();
    expect(newAuraCost(fogo, 'Selamento')).toBe(2);  // Emissora → Primordial: vizinha (D-55)
    expect(newAuraCost([{ n: 'Aura Própria', lv: 1, her: true }], 'Fogo')).toBe(2);
    expect(newAuraCost([{ n: 'Aura Própria', lv: 1, her: true }], 'Dreno')).toBe(3); // Ícor ↔ Primordial: oposta
    expect(newAuraCost([{ n: 'Luz', lv: 1, her: true }], 'Nulidade')).toBe(2);       // Deformadora → Primordial: 2 passos
    // R13-1: nascido Titânico compra qualquer outra aura por 2 PP e sobe a Titânica por 3 e 4
    const tit = [{ n: 'Titânica', lv: 1, her: true }];
    expect(['Fogo', 'Luz', 'Corrente', 'Raksasha'].map(n => newAuraCost(tit, n))).toEqual([2, 2, 2, 2]);
    expect(newAuraCost(tit, 'Aura Própria')).toBeNull();
    expect(auraSpent({ n: 'Titânica', lv: 3, her: true })).toBe(7); // 3 + 4
  });

  test('custo de subir aura e Despertar sem PP (D-47)', () => {
    expect(auraSpent({ n: 'Fogo', lv: 3, her: true })).toBe(7);  // ritmo do livro: nv 2 no nv 5 (3 PP), nv 3 no nv 9 (+4)
    expect(auraSpent({ n: 'Fogo', lv: 4, her: true })).toBe(7);
    expect(auraSpent({ n: 'Terra', lv: 2, her: false, pago: 1 })).toBe(4);
    // duas auras no nv 3 só no nv 15, com a segunda da mesma Área: 7 + 1 + 7 = 15
    expect(auraSpent({ n: 'Fogo', lv: 3, her: true }) + auraSpent({ n: 'Terra', lv: 3, her: false, pago: 1 })).toBe(ppEarned(15));
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

  test('teto de dados 5d8 fixo (R13-2) e Projetar a cada disparo', () => {
    expect([3, 12, 13, 15].map(techDiceCap)).toEqual([5, 5, 5, 5]);
    expect(GENERIC_TECHS[0].extra).toMatch(/a cada disparo/);
    expect(GENERIC_TECHS[0].dmg).not.toMatch(/6d8/);
    expect(GENERIC_TECHS[0].extra).toMatch(/Nebulosa = −2 no próximo ataque/); // D-87
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

  test("rodada 8: profissões (P-060, P-049, R10-5, R9-1, D-65, D-73, P-040)", () => {
    expect(Object.keys(PROFESSIONS_DATA)).toEqual(["Guerreiro", "Explorador", "Estudioso", "Diplomata", "Canalizador", "Guardião", "Curandeiro"]);
    expect(Object.values(PROFESSIONS_DATA).every(p => p.per.length === 8 && p.res.length === 2)).toBe(true);
    expect(Object.values(PROFESSIONS_DATA).map(p => p.co)).toEqual([100, 95, 120, 140, 90, 80, 110]);
    expect(PROFESSIONS_DATA["Guardião"].mp).toBe("1d4");
    expect(ATTR_FULL.DOM).toBe("Domínio");
    expect(PROFESSIONS_DATA.Explorador.ex[0][1]).toMatch(/Percepção/); // D-77
  });

  test("rodada 8: Especialista, resistências e armadura sem proficiência", () => {
    const d = { prof: "Diplomata", proficiencies: ["Enganação"], especialista: "Enganação" };
    expect(["Persuasão", "Enganação", "Intuição", "Barganha"].map(n => skillProfMult(d, n))).toEqual([2, 2, 0, 0]);
    expect(skillProfMult({ prof: "Guerreiro", proficiencies: ["Atletismo"] }, "Atletismo")).toBe(1);
    // Anão Guardião, CON 11 (mod 0), prof +2: 0 + 2 + 2 (raça) = 4; DEX sem proficiência
    expect(saveBonus(PROFESSIONS_DATA["Guardião"], "Anão", "CON", 0, 2)).toBe(4);
    expect(saveBonus(PROFESSIONS_DATA["Guardião"], "Anão", "DEX", -2, 2)).toBe(-2);
    expect(armorWithoutProf("Estudioso", PROFESSIONS_DATA.Estudioso, "Cota de malha", true)).toBe("armadura média e escudo");
    expect(armorWithoutProf("Curandeiro", PROFESSIONS_DATA.Curandeiro, "Cota de malha", true)).toBe("");
  });

  test("rodada 8: dados de vida, Corpo Renovado, XP por sessão, licenças", () => {
    expect([hitDiceLeft(3, 0), hitDicePerRest(3), hitDicePerRest(7), hitDiceLeft(7, 4)]).toEqual([3, 2, 4, 3]);
    expect(corpoRenovado([{ n: "Rejuvenescimento", lv: 3 }])).toBe(true);
    expect(corpoRenovado([{ n: "Rejuvenescimento", lv: 2 }])).toBe(false);
    expect(XP_SESSION[3]).toEqual([130, 160, 190]);
    expect(XP_SESSION[15]).toBeUndefined();
    expect([auraLicense(1), auraLicense(2), auraLicense(3)]).toEqual(["", "Intermediária", "Avançada"]);
  });

  test("fortalecimentos somam e multiplicam; sem Legado (P-015, R13-6)", () => {
    const r = fortTotal([true, false, false, false, false, true], {}, false); // Sinais +25 + Votos +100
    expect([r.total, r.mult]).toEqual([125, 2.25]);
    expect(fortTotal([false, false, true, false, false, false, false, true], { 2: 2, 7: 2 }, false, true).total).toBe(300);
  });

  test("rodada 9: profissão montada (P-094)", () => {
    const g = PROFESSIONS_DATA.Guerreiro;
    expect(profRuler({ ...g, pac: 'Guerreiro' })).toEqual([]);
    Object.entries(PROFESSIONS_DATA).forEach(([k, p]) => expect(profRuler({ ...p, pac: k, exc: !!p.ex })).toEqual([])); // as 7 cabem na régua
    expect(profRuler({ m: { DOM: 4, FOR: -4 }, hp: '1d12', mp: '1d12', per: ['Atletismo'], res: ['FOR', 'DOM'], pac: 'Guerreiro' })).toHaveLength(4);
    expect(armorWithoutProf('custom', { pac: 'Estudioso' }, 'Placas completas', false)).toBe('armadura pesada');
    expect(armorWithoutProf('custom', {}, 'Placas completas', false)).toBe('');
  });

  test("rodada 9: conversão da economia antiga, aura de nascença fixa, descanso, raças, passivos", () => {
    const old = { level: 9, attrUps: { INT: 2, DOM: 1 }, auras: [{ n: 'Ilusão', lv: 3, her: true }, { n: 'Raksasha', lv: 1, her: false, pago: 3 }], ppConf: { attrUps: { INT: 2 }, auras: { 'Ilusão': 3 } } };
    const c = convertOldPP(old);
    expect(c.auras).toEqual([{ n: 'Ilusão', lv: 1, her: true }]);
    expect(Object.values(c.attrUps).every(v => v === 0)).toBe(true);
    expect(c.ppAntigo).toMatch(/Raksasha/);
    expect(convertOldPP({ ...old, ...c })).toBeNull();
    expect(convertOldPP({ auras: [{ n: 'Fogo', lv: 1, her: true }] })).toEqual({ ppEco: 2 });
    expect(heritageLocked({ ...old, ...c })).toBe(true);
    expect(heritageLocked({ ...old, ...c, herLivre: true })).toBe(false);
    expect(heritageLocked({ auras: [{ n: 'Fogo', lv: 1, her: true }], ppConf: null })).toBe(false);
    expect([hitDieHeal(1, -1), hitDieHeal(6, 2)]).toEqual([1, 8]); // P-091
    expect([restGain(0, 40, 40, true), restGain(30, 40, 20, false), restGain(30, 40, 20, true)]).toEqual([30, 10, 7]); // P-089
    expect(raceBonus({ race: 'Humano', humAttr: 'CON' }, 'CON')).toBe(1);
    expect(raceBonus({ race: 'Elfo', humAttr: 'CON' }, 'CON')).toBe(0);
    expect(RACES_DATA['Demônio'].ab).toMatch(/Fúria Ancestral/);
    expect(RACES_DATA['Demônio'].ab).not.toMatch(/\+3 dano/);
    expect(RACES_DATA.Anjo.ab).toMatch(/Planagem/);
    expect(ARMORS.filter(a => a.t === 'P').map(a => a.mv)).toEqual([-1, -1, -2, -2]); // P-073
    expect(scalesAvailable([{ n: 'Animalesca', lv: 2 }])).toBe(true);
    expect(hachimanBonus([{ n: 'Luz', lv: 4, deus: 'Hachiman' }])).toBe(10);
    expect(sheetReminders({ race: 'Anjo', auras: [{ n: 'Luz', lv: 3 }] }).length).toBe(2);
    expect(TOOLS).toHaveLength(8);
    expect(PROFESSIONS_DATA.Explorador.armas).toMatch(/arco longo, besta pesada, tridente/); // P-085
  });
});
