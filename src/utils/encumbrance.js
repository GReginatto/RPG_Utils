export const BACKPACK_OPTIONS = [
  { value: 'none',   label: 'Sem Mochila',   bonus: 0  },
  { value: 'common', label: 'Mochila Comum', bonus: 15 },
  { value: 'large',  label: 'Mochila Grande',bonus: 25 },
  { value: 'magic',  label: 'Mochila Mágica',bonus: 50 },
  { value: 'custom', label: 'Personalizada', bonus: 0  },
];

export function calcEncumbrance(token) {
  const forStr = token.attributes?.FOR ?? 10;
  const bp = token.backpackType ?? 'common';
  const bpOption = BACKPACK_OPTIONS.find(o => o.value === bp) ?? BACKPACK_OPTIONS[1];
  const bpBonus = bp === 'custom' ? (token.backpackBonus ?? 0) : bpOption.bonus;
  const capacity = forStr * 7.5 + bpBonus;

  const inventory = token.inventory ?? [];
  const itemWeight = inventory.reduce((sum, item) => {
    const w = parseFloat(item.weight) || 0;
    const q = parseInt(item.qty, 10) || 0;
    return sum + w * q;
  }, 0);

  const totalCoins = (token.gold ?? 0) + (token.silver ?? 0) + (token.copper ?? 0);
  const coinWeight = Math.floor(totalCoins / 100) * 0.5;
  const totalWeight = itemWeight + coinWeight;
  const pct = capacity > 0 ? totalWeight / capacity : 0;

  let level, status, statusIcon, statusEffect, barColor;
  if (pct > 1) {
    level = 'overloaded'; status = 'Sobrecarregado'; statusIcon = '❌';
    statusEffect = 'Movimento: 1m, desvantagem em TUDO';
    barColor = '#c43030';
  } else if (pct > 0.75) {
    level = 'heavy'; status = 'Pesado'; statusIcon = '⚠️';
    statusEffect = '-3m de movimento, desvantagem em DEX';
    barColor = '#e07020';
  } else if (pct > 0.5) {
    level = 'moderate'; status = 'Moderado'; statusIcon = '⚠️';
    statusEffect = '-1m de movimento';
    barColor = '#c9a96e';
  } else {
    level = 'light'; status = 'Leve'; statusIcon = '✅';
    statusEffect = 'Sem penalidades';
    barColor = '#3a8a4a';
  }

  return { level, capacity, itemWeight, coinWeight, totalWeight, pct, status, statusIcon, statusEffect, barColor };
}
