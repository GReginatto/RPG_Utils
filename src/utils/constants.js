export const COLORS = {
  bg: '#0a0a10',
  panel: '#12121c',
  card: '#1a1a28',
  border: '#2a2a3a',
  gold: '#c9a96e',
  goldDim: '#8a7a50',
  text: '#d8d0c4',
  sub: '#7a7468',
  hp: '#c43030',
  mp: '#3468c4',
  player: '#4a9a5a',
  npc: '#aa4a3a',
  ally: '#4a7aba',
};

export const RACES = ['Humano', 'Elfo', 'Anão', 'Anjo', 'Demônio'];

export const PROFESSIONS = [
  'Guerreiro', 'Explorador', 'Estudioso', 'Diplomata',
  'Arkano', 'Guardião', 'Curandeiro',
];

export const CONDITIONS = [
  'Queimadura', 'Encharcado', 'Enraizado', 'Atordoado',
  'Cego', 'Amedrontado', 'Envenenado',
  'Exaustão 1', 'Exaustão 2', 'Exaustão 3', 'Exaustão 4', 'Exaustão 5',
];

export const CONDITION_META = [
  { name: 'Queimadura', icon: '🔥', color: '#c43030', description: 'Sofre dano de fogo por turno.' },
  { name: 'Encharcado', icon: '💧', color: '#3468c4', description: 'Vulnerável a dano elétrico.' },
  { name: 'Enraizado',  icon: '🌿', color: '#4a9a5a', description: 'Não pode se mover.' },
  { name: 'Atordoado',  icon: '⚡', color: '#c9a96e', description: 'Não pode agir.' },
  { name: 'Cego',       icon: '👁',  color: '#555566', description: 'Não pode ver.' },
  { name: 'Amedrontado',icon: '💀', color: '#8a4abd', description: 'Desvantagem contra a fonte do medo.' },
  { name: 'Envenenado', icon: '☠',  color: '#4a8a3a', description: 'Sofre dano de veneno por turno.' },
  { name: 'Exaustão 1', icon: '💤', color: '#c47830', description: 'Desvantagem em testes de habilidade.' },
  { name: 'Exaustão 2', icon: '💤', color: '#a86020', description: 'Velocidade reduzida à metade.' },
  { name: 'Exaustão 3', icon: '💤', color: '#904010', description: 'Desvantagem em ataques e salvaguardas.' },
  { name: 'Exaustão 4', icon: '💤', color: '#782000', description: 'HP máximo reduzido à metade.' },
  { name: 'Exaustão 5', icon: '💤', color: '#601000', description: 'Velocidade reduzida a 0.' },
];

export const GRID = { cellSize: 40, cols: 30, rows: 20 };

export const MOVEMENT = { default: 9, dwarf: 7, metersPerCell: 1.5 };

// Internal layout constants shared between hooks/components
export const LABEL_W = 28;
export const LABEL_H = 18;
