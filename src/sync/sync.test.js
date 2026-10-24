import { diff, apply, equal } from './jsonPatch.mjs';
import { viewFor, playerOpAllowed } from './rules.mjs';

const roundTrip = (a, b) => expect(apply(a, diff(a, b))).toEqual(b);

describe('jsonPatch', () => {
  test('objetos e valores simples', () => {
    roundTrip({ a: 1, b: { c: 2 } }, { a: 2, b: { c: 2, d: 3 } });
    roundTrip({ a: 1, x: 'y' }, { a: 1 });
  });

  test('listas com id: só o item alterado viaja', () => {
    const a = { tokens: [{ id: 't1', x: 1, hp: 10 }, { id: 't2', x: 5 }] };
    const b = { tokens: [{ id: 't1', x: 2, hp: 10 }, { id: 't2', x: 5 }] };
    const ops = diff(a, b);
    expect(ops).toEqual([{ op: 'set', path: ['tokens', { id: 't1' }, 'x'], value: 2 }]);
    roundTrip(a, b);
  });

  test('inserir, remover e reordenar itens', () => {
    const a = { l: [{ id: 1 }, { id: 2 }, { id: 3 }] };
    roundTrip(a, { l: [{ id: 3 }, { id: 1 }, { id: 4 }] });
    roundTrip(a, { l: [] });
    roundTrip({ l: [] }, a);
  });

  test('conjuntos grandes de primitivos mandam só o que mudou', () => {
    const cells = Array.from({ length: 50 }, (_, i) => `c${i}`);
    const a = { fog: { revealedCells: cells } };
    const b = { fog: { revealedCells: [...cells, 'c99'] } };
    expect(diff(a, b)).toEqual([{ op: 'sadd', path: ['fog', 'revealedCells'], values: ['c99'] }]);
    roundTrip(a, b);
  });

  test('aplicar não altera o objeto original', () => {
    const a = { tokens: [{ id: 't1', x: 1 }] };
    const copy = JSON.parse(JSON.stringify(a));
    apply(a, [{ op: 'set', path: ['tokens', { id: 't1' }, 'x'], value: 9 }]);
    expect(a).toEqual(copy);
  });

  test('reordenar com visão parcial mantém os itens escondidos no lugar', () => {
    const master = { l: [{ id: 'a' }, { id: 'h' }, { id: 'b' }] };
    const out = apply(master, [{ op: 'order', path: ['l'], ids: ['b', 'a'] }]);
    expect(out.l.map(x => x.id)).toEqual(['b', 'h', 'a']);
  });

  test('igualdade profunda', () => {
    expect(equal({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(equal({ a: [1] }, { a: [2] })).toBe(false);
  });
});

const state = {
  activeSceneId: 's1',
  scenes: [
    { id: 's1', name: 'Taverna', notes: 'segredo do mestre', walls: [{ id: 'w1' }, { id: 'w2', secret: true }],
      tokens: [{ id: 't1', owner: 'Ana', name: 'Lyra' }, { id: 't2', name: 'Orc', hidden: true }, { id: 't3', name: 'Guarda' }] },
    { id: 's2', name: 'Masmorra', notes: 'chefe', tokens: [{ id: 't9', name: 'Dragão' }], mapImage: '/uploads/x.png' },
  ],
  partyTokens: [],
  sheets: [{ id: 'a', owner: 'Ana' }, { id: 'b', owner: 'Bia' }, { id: 'c', owner: null, isPublic: true }],
  chatMessages: [
    { id: 'm1', type: 'chat', content: 'oi' },
    { id: 'm2', type: 'whisper', whisperTarget: 'Bia', authorAccount: 'Mestre', content: 'só pra Bia' },
    { id: 'm3', type: 'whisper', whisperTarget: 'Lyra', authorAccount: 'Mestre', content: 'pra Lyra' },
  ],
  compendiumEntries: [{ id: 'x', title: 'bestiário' }],
};
const ana = { name: 'Ana', role: 'player' };

describe('rules: visão do jogador', () => {
  const v = viewFor(state, ana);
  test('esconde tokens ocultos, paredes secretas e notas', () => {
    const s1 = v.scenes.find(s => s.id === 's1');
    expect(s1.tokens.map(t => t.id)).toEqual(['t1', 't3']);
    expect(s1.walls.map(w => w.id)).toEqual(['w1']);
    expect(s1.notes).toBe('');
  });
  test('outras cenas chegam vazias', () => {
    const s2 = v.scenes.find(s => s.id === 's2');
    expect(s2.tokens).toEqual([]);
    expect(s2.mapImage).toBeNull();
    expect(s2.notes).toBe('');
  });
  test('fichas, sussurros e compêndio', () => {
    expect(v.sheets.map(s => s.id)).toEqual(['a', 'c']);
    expect(v.chatMessages.map(m => m.id)).toEqual(['m1', 'm3']);
    expect(v.compendiumEntries).toEqual([]);
  });
  test('o Mestre vê tudo', () => {
    expect(viewFor(state, { name: 'Mestre', role: 'gm' })).toBe(state);
  });
});

describe('rules: o que o jogador pode alterar', () => {
  const ok = (op) => playerOpAllowed(op, state, 'Ana');
  test('mover o próprio token, não o dos outros', () => {
    expect(ok({ op: 'set', path: ['scenes', { id: 's1' }, 'tokens', { id: 't1' }, 'x'], value: 3 })).toBe(true);
    expect(ok({ op: 'set', path: ['scenes', { id: 's1' }, 'tokens', { id: 't3' }, 'x'], value: 3 })).toBe(false);
  });
  test('não pode mudar dono nem esconder', () => {
    expect(ok({ op: 'set', path: ['scenes', { id: 's1' }, 'tokens', { id: 't1' }, 'owner'], value: 'Bia' })).toBe(false);
    expect(ok({ op: 'set', path: ['scenes', { id: 's1' }, 'tokens', { id: 't1' }, 'hidden'], value: true })).toBe(false);
  });
  test('não mexe em cena inativa, paredes, notas ou cena ativa', () => {
    expect(ok({ op: 'set', path: ['scenes', { id: 's2' }, 'tokens', { id: 't9' }, 'x'], value: 1 })).toBe(false);
    expect(ok({ op: 'remove', path: ['scenes', { id: 's1' }, 'walls'], id: 'w1' })).toBe(false);
    expect(ok({ op: 'set', path: ['scenes', { id: 's1' }, 'notes'], value: 'x' })).toBe(false);
    expect(ok({ op: 'set', path: ['activeSceneId'], value: 's2' })).toBe(false);
  });
  test('fichas: só a própria', () => {
    expect(ok({ op: 'set', path: ['sheets', { id: 'a' }, 'hp'], value: 5 })).toBe(true);
    expect(ok({ op: 'set', path: ['sheets', { id: 'b' }, 'hp'], value: 5 })).toBe(false);
    expect(ok({ op: 'set', path: ['sheets', { id: 'a' }, 'owner'], value: 'Bia' })).toBe(false);
  });
  test('chat: manda mensagem nova, não edita a dos outros', () => {
    expect(ok({ op: 'upsert', path: ['chatMessages'], value: { id: 'novo', content: 'olá' } })).toBe(true);
    expect(ok({ op: 'upsert', path: ['chatMessages'], value: { id: 'm2', content: 'hack' } })).toBe(false);
    expect(ok({ op: 'remove', path: ['chatMessages'], id: 'm2' })).toBe(false);
  });
  test('áudio da mesa é só do Mestre', () => {
    expect(ok({ op: 'set', path: ['audio', 'playing'], value: true })).toBe(false);
    expect(ok({ op: 'set', path: ['audio'], value: { playlist: [] } })).toBe(false);
  });
  test('desenhos e combate liberados; compêndio e mapa não', () => {
    expect(ok({ op: 'upsert', path: ['scenes', { id: 's1' }, 'drawings'], value: { id: 'd1' } })).toBe(true);
    expect(ok({ op: 'set', path: ['currentTurnIndex'], value: 2 })).toBe(true);
    expect(ok({ op: 'set', path: ['compendiumEntries'], value: [] })).toBe(false);
    expect(ok({ op: 'set', path: ['scenes', { id: 's1' }, 'mapImage'], value: 'x' })).toBe(false);
  });
});
