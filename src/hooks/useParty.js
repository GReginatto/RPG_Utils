import { useState, useCallback } from 'react';

const PARTY_KEY = 'crepusculo-vtt-party';
export const MAX_PARTY = 6;

function defaults() {
  return { order: [], sharedGold: 0, sharedInventory: [] };
}

function loadParty() {
  try {
    const raw = localStorage.getItem(PARTY_KEY);
    return raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
  } catch { return defaults(); }
}

export function useParty() {
  const [data, setData] = useState(loadParty);
  const { order, sharedGold, sharedInventory } = data;

  const commit = useCallback((next) => {
    try { localStorage.setItem(PARTY_KEY, JSON.stringify(next)); } catch { /* quota */ }
    return next;
  }, []);

  const mutate = useCallback((fn) => {
    setData(prev => commit(fn(prev)));
  }, [commit]);

  const isMember = useCallback((id) => order.includes(id), [order]);

  const addMember = useCallback((id) => {
    mutate(prev => {
      if (prev.order.includes(id) || prev.order.length >= MAX_PARTY) return prev;
      return { ...prev, order: [...prev.order, id] };
    });
  }, [mutate]);

  const removeMember = useCallback((id) => {
    mutate(prev => ({ ...prev, order: prev.order.filter(x => x !== id) }));
  }, [mutate]);

  const reorderMembers = useCallback((newOrder) => {
    mutate(prev => ({ ...prev, order: newOrder }));
  }, [mutate]);

  const setSharedGold = useCallback((gold) => {
    mutate(prev => ({ ...prev, sharedGold: Math.max(0, Math.floor(gold)) }));
  }, [mutate]);

  const addInventoryItem = useCallback((name, qty = 1, notes = '') => {
    mutate(prev => ({
      ...prev,
      sharedInventory: [
        ...prev.sharedInventory,
        { id: `itm-${Date.now()}-${Math.random().toString(36).slice(2)}`, name, qty, notes },
      ],
    }));
  }, [mutate]);

  const removeInventoryItem = useCallback((itemId) => {
    mutate(prev => ({ ...prev, sharedInventory: prev.sharedInventory.filter(i => i.id !== itemId) }));
  }, [mutate]);

  const updateInventoryItem = useCallback((itemId, changes) => {
    mutate(prev => ({
      ...prev,
      sharedInventory: prev.sharedInventory.map(i => i.id === itemId ? { ...i, ...changes } : i),
    }));
  }, [mutate]);

  // Remove IDs that no longer exist in the token list
  const syncMembers = useCallback((existingIds) => {
    setData(prev => {
      const next = { ...prev, order: prev.order.filter(id => existingIds.includes(id)) };
      if (next.order.length === prev.order.length) return prev;
      commit(next);
      return next;
    });
  }, [commit]);

  // Restore from a session save file
  const loadFromSave = useCallback((saved) => {
    if (!saved) return;
    const next = { ...defaults(), ...saved };
    setData(next);
    commit(next);
  }, [commit]);

  // Reset to empty party
  const resetParty = useCallback(() => {
    const next = defaults();
    setData(next);
    commit(next);
  }, [commit]);

  return {
    order, sharedGold, sharedInventory,
    isMember, addMember, removeMember, reorderMembers,
    setSharedGold, addInventoryItem, removeInventoryItem, updateInventoryItem,
    syncMembers, loadFromSave, resetParty,
    partyData: data,
  };
}
