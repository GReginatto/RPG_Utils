export function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(count, sides, modifier = 0) {
  const rolls = Array.from({ length: count }, () => rollDie(sides));
  return {
    rolls,
    total: rolls.reduce((sum, r) => sum + r, 0) + modifier,
    modifier,
  };
}

export function parseDiceNotation(notation) {
  const match = notation.trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  return {
    count: parseInt(match[1] || '1', 10),
    sides: parseInt(match[2], 10),
    modifier: parseInt(match[3] || '0', 10),
  };
}
