// Hexagrama da imagem auras.png (D-32, D-35, D-40): mesma ordem do anel usada em rpgData.js
export { AURA_GROUPS } from './rpgData';

function devTechToVTT(dt, idx) {
  return {
    id: `comp-${dt.id ?? idx}`,
    name: dt.name ?? '',
    tier: '',
    mpCost: parseInt(dt.cost) || 0,
    dice: dt.dmg ?? '',
    attackAttr: 'DOM',
    description: dt.desc ?? '',
    effectText: dt.desc ?? '',
    range: dt.range ?? '',
    duration: '',
    damageType: dt.aura ?? '',
  };
}

function vttTechToCompanion(tech, idx) {
  return {
    id: idx + 1,
    name: tech.name ?? '',
    cost: String(tech.mpCost ?? 0),
    dmg: tech.dice ?? '',
    range: tech.range ?? '',
    action: 'Padrão',
    aura: tech.damageType ?? '',
    fluxo: 'Não',
    desc: tech.effectText || tech.description || '',
    forts: [],
    notes: '',
  };
}

// Companion state S → VTT token patch
export function companionToVTT(S) {
  return {
    name: S.name ?? '',
    race: S.race ?? '',
    profession: S.prof !== 'custom' ? (S.prof ?? '') : (S.customProf?.name ?? ''),
    level: S.level ?? 3,
    attributes: { ...(S.attrs ?? {}) },
    hp: S.curHP ?? 0,
    maxHp: S.maxHP ?? 0,
    mp: S.curMP ?? 0,
    maxMp: S.maxMP ?? 0,
    aura: S.auraInit ?? '',
    notes: S.notes ?? '',
    gold: S.gold ?? 0,
    xp: S.xp ?? 0,
    techniques: (S.devTechs ?? []).map(devTechToVTT),
    proficiencies: (S.proficiencies ?? []).map((p, i) => ({
      id: `comp-prof-${i}`,
      name: p.n ?? p.name ?? String(p),
      attr: p.a ?? p.attr ?? 'FOR',
    })),
    inventory: (S.inventory ?? []).map((item, i) => ({
      id: item.id ?? `comp-item-${i}`,
      name: item.name ?? item.n ?? '',
      qty: item.qty ?? item.amount ?? 1,
      weight: String(item.weight ?? item.w ?? ''),
      notes: item.notes ?? '',
    })),
    _companionRaw: { ...S },
  };
}

// VTT token → companion state patch (for lS() in ficha-jogador.html)
export function vttToCompanion(token) {
  const raw = token._companionRaw ?? {};
  return {
    ...raw,
    name: token.name ?? raw.name ?? '',
    race: token.race ?? raw.race ?? 'Humano',
    level: token.level ?? raw.level ?? 3,
    xp: token.xp ?? raw.xp ?? 0,
    attrs: token.attributes ?? raw.attrs ?? {},
    curHP: token.hp ?? raw.curHP ?? 0,
    maxHP: token.maxHp ?? raw.maxHP ?? 0,
    curMP: token.mp ?? raw.curMP ?? 0,
    maxMP: token.maxMp ?? raw.maxMP ?? 0,
    gold: token.gold ?? raw.gold ?? 0,
    auraInit: token.aura ?? raw.auraInit ?? '',
    notes: token.notes ?? raw.notes ?? '',
    devTechs: (token.techniques ?? []).map(vttTechToCompanion),
    // A ficha guarda perícias como nomes (strings) e itens como { id, n, w, s, no }
    proficiencies: (token.proficiencies ?? []).map(p => p.name ?? p.n ?? String(p)),
    inventory: (token.inventory ?? []).map((item, i) => ({
      id: item.id ?? Date.now() + i,
      n: item.n ?? item.name ?? '',
      w: parseFloat(item.w ?? item.weight) || 0,
      s: item.s ?? 'carried',
      no: item.no ?? item.notes ?? '',
    })),
  };
}
