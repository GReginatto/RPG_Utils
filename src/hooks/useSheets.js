import { useState, useRef, useEffect, useCallback } from 'react';
import { RACES, PROFESSIONS } from '../utils/constants';

export function makeSheet(overrides = {}) {
  // eslint-disable-next-line no-unused-vars
  const { id: _drop, ...rest } = overrides;
  const id = `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    linkedTokenId: null,
    category: 'pc',      // 'pc' | 'extra' | 'npc'
    owner: null,          // player name or null (GM-owned)
    isPublic: false,
    // Character info
    name: 'Personagem',
    race: RACES[0],
    profession: PROFESSIONS[0],
    level: 1,
    xp: 0,
    image: null,
    color: '#c9a96e',
    // Resources
    hp: 10, maxHp: 10,
    mp: 0, maxMp: 0,
    // Attributes
    attributes: { FOR: 10, DEX: 10, CON: 10, INT: 10, SAB: 10, CAR: 10, DOM: 10 },
    // Combat
    ac: 10, movement: 9, profBonus: 2, weaponDice: '1d8', initiative: 0,
    conditions: [],
    // Aura & techniques
    aura: '', techniques: [],
    // Proficiencies
    proficiencies: [],
    // Inventory
    inventory: [], gold: 0,
    // Notes
    notes: '', backstory: '',
    // Sharing
    sharedWith: [],
    // Dynamic lists
    attacks: [], quickRolls: [],
    ...rest,
  };
}

export function useSheets(initial = []) {
  const [sheets, setSheets] = useState(initial);
  const sheetsRef = useRef(sheets);
  useEffect(() => { sheetsRef.current = sheets; }, [sheets]);

  const addSheet = useCallback((overrides = {}) => {
    const sheet = makeSheet(overrides);
    setSheets(prev => [...prev, sheet]);
    return sheet;
  }, []);

  const updateSheet = useCallback((id, changes) => {
    setSheets(prev => prev.map(s => s.id === id ? { ...s, ...changes } : s));
  }, []);

  const deleteSheet = useCallback((id) => {
    setSheets(prev => prev.filter(s => s.id !== id));
  }, []);

  const duplicateSheet = useCallback((id) => {
    const src = sheetsRef.current.find(s => s.id === id);
    if (!src) return null;
    const copy = makeSheet({ ...src, name: `${src.name} (cópia)`, linkedTokenId: null });
    setSheets(prev => [...prev, copy]);
    return copy;
  }, []);

  const loadSheets = useCallback((newSheets) => {
    setSheets(newSheets ?? []);
  }, []);

  const getSheetForToken = useCallback((tokenId) => {
    return sheetsRef.current.find(s => s.linkedTokenId === tokenId) ?? null;
  }, []);

  const canViewSheet = useCallback((sheet, isGM, playerName) => {
    if (isGM) return true;
    if (sheet.isPublic) return true;
    if (sheet.owner === playerName) return true;
    return (sheet.sharedWith ?? []).includes(playerName);
  }, []);

  const canEditSheet = useCallback((sheet, isGM, playerName) => {
    if (isGM) return true;
    return sheet.owner === playerName;
  }, []);

  return {
    sheets, sheetsRef,
    addSheet, updateSheet, deleteSheet, duplicateSheet, loadSheets,
    getSheetForToken, canViewSheet, canEditSheet,
  };
}
