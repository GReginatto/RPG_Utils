import { useState } from 'react';
import { rollDice } from '../utils/dice';
import TokenList from './TokenList';
import TokenDetails from './TokenDetails';
import CombatTracker from './CombatTracker';
import DiceRoller from './DiceRoller';
import AudioManager from './AudioManager';
import PartyPanel from './PartyPanel';
import ChatPanel from './ChatPanel';
import SheetManager from './SheetManager';
import JournalPanel from './JournalPanel';
import Compendium from './Compendium';
import RollableTable from './RollableTable';
import { useRole } from '../hooks/useRole';
import { CONDITION_META } from '../utils/constants';

const TABS = [
  { id: 'tokens',    icon: '🎭', label: 'Tokens',    gmOnly: false },
  { id: 'combat',    icon: '⚔',  label: 'Combate',   gmOnly: false },
  { id: 'dice',      icon: '🎲', label: 'Dados',      gmOnly: false },
  { id: 'chat',      icon: '💬', label: 'Chat',       gmOnly: false },
  { id: 'fichas',    icon: '📋', label: 'Fichas',     gmOnly: false },
  { id: 'diary',     icon: '📓', label: 'Diário',     gmOnly: false },
  { id: 'compendio', icon: '📚', label: 'Compêndio',  gmOnly: true  },
  { id: 'audio',     icon: '🔊', label: 'Áudio',      gmOnly: true  },
];

export default function Sidebar({
  tokenState,
  onSelectToken,
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
  combatActive, setCombatActive,
  currentRound, setCurrentRound,
  currentTurnIndex, setCurrentTurnIndex,
  initiativeOrder, setInitiativeOrder,
  advanceTurn,
  addLog,
  playSfx,
  log,
  clearLog,
  chatMessages,
  addChatMessage,
  clearChat,
  audioManagerRef,
  targetId,
  setTargetId,
  // Party
  partyOrder,
  isMember,
  addMember,
  removeMember,
  reorderMembers,
  partyFull,
  sharedGold,
  setSharedGold,
  onShortRest,
  onLongRest,
  onDivideGold,
  combatTurnTokenId,
  // Fichas
  sheetState,
  onOpenSheet,
  onOpenSheetById,
  // Conditions
  customConditions = [],
  onUpdateCustomConditions,
  // Player management
  onRemovePlayer,
  // Groups
  tokenGroups = [],
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onBulkCreateTokens,
  // Journal
  journalEntries = [],
  onAddJournal,
  onUpdateJournal,
  onDeleteJournal,
  // Compendium
  compendiumEntries = [],
  onAddCompendium,
  onUpdateCompendium,
  onDeleteCompendium,
  onCreateTokenFromCompendium,
  // Rollable tables
  rollableTables = [],
  onAddTable,
  onUpdateTable,
  onDeleteTable,
  // Timer settings
  timerEnabled, setTimerEnabled,
  timerDuration, setTimerDuration,
  timerSoundEnabled, setTimerSoundEnabled,
  // Active effects
  onAddEffect,
  onUpdateEffect,
  onRemoveEffect,
}) {
  const { isGM, playerName, players, canSeeToken, canEditToken } = useRole();
  const { tokens, selectedId, updateToken, deleteToken, adjustHp } = tokenState;
  const visibleTabs = TABS.filter(t => !t.gmOnly || isGM);
  // Players only see tokens they're allowed to see
  const visibleTokens = isGM ? tokens : tokens.filter(t => canSeeToken(t));
  const selectedToken = visibleTokens.find(t => t.id === selectedId) ?? null;
  const targetToken   = targetId ? visibleTokens.find(t => t.id === targetId) ?? null : null;
  const selectedTokenEditable = selectedToken ? canEditToken(selectedToken) : false;

  const [attackResult, setAttackResult] = useState(null);
  const [targetDmg,    setTargetDmg]    = useState('');
  const [showCondMgr,  setShowCondMgr]  = useState(false);
  const [newCondName,  setNewCondName]  = useState('');
  const [newCondIcon,  setNewCondIcon]  = useState('✨');
  const [newCondColor, setNewCondColor] = useState('#c9a96e');
  const [newCondDesc,  setNewCondDesc]  = useState('');

  const handleDelete = (id) => {
    const token = tokens.find(t => t.id === id);
    deleteToken(id);
    if (token) addLog(`${token.name} removido.`, 'system');
  };

  // ── Target panel actions ───────────────────────────────────────────────────
  function rollAttack() {
    if (!selectedToken || !targetToken) return;
    const dom = selectedToken.attributes?.DOM ?? 10;
    const mod = Math.floor((dom - 10) / 2);
    const r = rollDice(1, 20, mod);
    const hit = r.total >= targetToken.ac;
    setAttackResult({ hit, roll: r.rolls[0], mod, total: r.total });
    const sign = mod >= 0 ? `+${mod}` : `${mod}`;
    addLog(
      `⚔ ${selectedToken.name} ataca ${targetToken.name}: [${r.rolls[0]}]${mod !== 0 ? sign : ''} = ${r.total} vs CA ${targetToken.ac} — ${hit ? '✅ ACERTOU!' : '❌ ERROU!'}`,
      hit ? 'damage' : 'system',
    );
    playSfx?.('dice');
  }

  function applyTargetDamage() {
    const val = parseInt(targetDmg, 10);
    if (!targetToken || isNaN(val) || val <= 0) return;
    const newHp = Math.max(0, targetToken.hp - val);
    adjustHp(targetToken.id, -val);
    addLog(`${targetToken.name} sofreu ${val} de dano. (HP: ${newHp}/${targetToken.maxHp})`, 'damage');
    if (newHp === 0) { addLog(`💀 ${targetToken.name} caiu!`, 'damage'); playSfx?.('death'); }
    else playSfx?.('hit');
    setTargetDmg('');
  }

  // ── HP color helper ────────────────────────────────────────────────────────
  function hpColor(hp, max) {
    const p = max > 0 ? hp / max : 0;
    return p > 0.5 ? '#4a9a5a' : p > 0.2 ? '#c47830' : '#c43030';
  }

  return (
    <div style={{
      width: 320, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--panel)', borderLeft: '1px solid var(--border)',
      position: 'relative', height: '100%', overflow: 'hidden',
    }}>
      {/* Collapse button */}
      <button
        onClick={() => setSidebarOpen(false)}
        title="Recolher painel"
        style={{
          position: 'absolute', left: -14, top: '50%', transform: 'translateY(-50%)',
          width: 14, height: 40, background: 'var(--panel)',
          border: '1px solid var(--border)', borderRight: 'none',
          borderRadius: '4px 0 0 4px', color: 'var(--sub)', cursor: 'pointer',
          fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
        }}
      >▶</button>

      {/* Party panel (always visible when party has members) */}
      <PartyPanel
        partyOrder={partyOrder}
        tokens={tokens}
        selectedId={selectedId}
        combatTurnTokenId={combatTurnTokenId}
        onSelectToken={onSelectToken}
        onReorder={isGM ? reorderMembers : undefined}
        sharedGold={sharedGold}
        setSharedGold={isGM ? setSharedGold : undefined}
        onDivideGold={isGM ? onDivideGold : undefined}
        onShortRest={isGM ? onShortRest : undefined}
        onLongRest={isGM ? onLongRest : undefined}
      />

      {/* Tab bar — icon-only */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 2,
        padding: '4px 8px', flexShrink: 0,
        background: '#0d0d17', borderBottom: '1px solid var(--border)',
      }}>
        {visibleTabs.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              title={tab.label}
              onClick={() => setActiveTab(tab.id)}
              style={{
                width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, background: active ? 'rgba(201,169,110,0.12)' : 'transparent',
                border: 'none', borderBottom: `2px solid ${active ? '#c9a96e' : 'transparent'}`,
                color: active ? '#c9a96e' : '#6a6460',
                cursor: 'pointer', transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#c9a96e'; e.currentTarget.style.background = 'rgba(201,169,110,0.07)'; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#6a6460'; e.currentTarget.style.background = 'transparent'; } }}
            >
              {tab.icon}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ── Tokens tab ── */}
        {activeTab === 'tokens' && (
          <>
            <div style={{
              flexShrink: 0,
              maxHeight: selectedToken || targetToken ? 200 : undefined,
              flex: (!selectedToken && !targetToken) ? 1 : undefined,
              overflowY: 'auto',
            }}>
              <TokenList
                tokens={visibleTokens}
                selectedId={selectedId}
                onSelect={onSelectToken}
                onDelete={isGM ? handleDelete : undefined}
                isGM={isGM}
                tokenGroups={tokenGroups}
                onCreateGroup={onCreateGroup}
                onUpdateGroup={onUpdateGroup}
                onDeleteGroup={onDeleteGroup}
                onBulkCreateTokens={onBulkCreateTokens}
              />
            </div>

            {selectedToken && (
              <div style={{ flex: targetToken ? undefined : 1, overflowY: 'auto', borderTop: '1px solid var(--border)', maxHeight: targetToken ? 220 : undefined }}>
                <TokenDetails
                  token={selectedToken}
                  onUpdate={selectedTokenEditable ? updateToken : () => {}}
                  isMember={isMember(selectedToken.id)}
                  partyFull={partyFull}
                  onToggleParty={isGM ? (id, join) => join ? addMember(id) : removeMember(id) : undefined}
                  readOnly={!selectedTokenEditable}
                  onOpenSheet={onOpenSheet ? () => onOpenSheet(selectedToken.id) : undefined}
                  customConditions={customConditions}
                  combatActive={combatActive}
                  addLog={addLog}
                  playSfx={playSfx}
                  onAddEffect={onAddEffect}
                  onUpdateEffect={onUpdateEffect}
                  onRemoveEffect={onRemoveEffect}
                  currentRound={currentRound}
                />
              </div>
            )}

            {/* ── Condition Manager (GM only) ── */}
            {isGM && (
              <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '6px 10px' }}>
                <button
                  className="tbtn"
                  onClick={() => setShowCondMgr(v => !v)}
                  style={{ width: '100%', fontSize: 11 }}
                >
                  ⚙ Gerenciar Condições
                </button>
                {showCondMgr && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Condições Padrão
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                      {CONDITION_META.map(c => (
                        <div key={c.name} title={c.description} style={{
                          fontSize: 11, padding: '2px 7px', borderRadius: 10,
                          border: `1px solid ${c.color}55`, background: `${c.color}18`,
                          color: c.color, whiteSpace: 'nowrap',
                        }}>
                          {c.icon} {c.name}
                        </div>
                      ))}
                    </div>

                    {customConditions.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          Condições Personalizadas
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                          {customConditions.map(c => (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <div title={c.description} style={{
                                fontSize: 11, padding: '2px 7px', borderRadius: 10,
                                border: `1px solid ${c.color}55`, background: `${c.color}18`,
                                color: c.color, whiteSpace: 'nowrap',
                              }}>
                                {c.icon} {c.name}
                              </div>
                              <button
                                onClick={() => onUpdateCustomConditions(prev => prev.filter(x => x.id !== c.id))}
                                style={{ background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: 11, padding: 0 }}
                                title="Remover condição"
                              >✕</button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Nova Condição
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      <input
                        className="vtt-input"
                        placeholder="Ícone (emoji)"
                        value={newCondIcon}
                        onChange={e => setNewCondIcon(e.target.value)}
                        style={{ width: 56 }}
                      />
                      <input
                        className="vtt-input"
                        placeholder="Nome"
                        value={newCondName}
                        onChange={e => setNewCondName(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="color"
                        value={newCondColor}
                        onChange={e => setNewCondColor(e.target.value)}
                        style={{ width: 32, height: 28, padding: 2, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                        title="Cor"
                      />
                    </div>
                    <input
                      className="vtt-input"
                      placeholder="Descrição (opcional)"
                      value={newCondDesc}
                      onChange={e => setNewCondDesc(e.target.value)}
                      style={{ width: '100%', marginBottom: 4 }}
                    />
                    <button
                      className="tbtn"
                      onClick={() => {
                        const name = newCondName.trim();
                        if (!name) return;
                        const newCond = {
                          id: `cond-${Date.now()}`,
                          name,
                          icon: newCondIcon.trim() || '✨',
                          color: newCondColor,
                          description: newCondDesc.trim(),
                          isCustom: true,
                          createdBy: 'gm',
                        };
                        onUpdateCustomConditions(prev => [...prev, newCond]);
                        setNewCondName(''); setNewCondIcon('✨'); setNewCondColor('#c9a96e'); setNewCondDesc('');
                      }}
                      style={{ width: '100%', fontSize: 11 }}
                    >
                      + Adicionar Condição
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Target panel ── */}
            {targetToken && (
              <div style={{
                flexShrink: 0, borderTop: '1px solid var(--border)',
                padding: '10px 12px', background: 'rgba(201,169,110,0.05)',
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--gold-dim)', marginBottom: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>🎯 Alvo: {targetToken.name}</span>
                  <button
                    onClick={() => { setTargetId(null); setAttackResult(null); }}
                    style={{ background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: 12 }}
                  >✕</button>
                </div>

                {/* Target HP bar */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: 'var(--sub)' }}>HP</span>
                    <span style={{ color: hpColor(targetToken.hp, targetToken.maxHp), fontWeight: 700 }}>
                      {targetToken.hp}/{targetToken.maxHp}
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'var(--card)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${targetToken.maxHp > 0 ? (targetToken.hp / targetToken.maxHp) * 100 : 0}%`,
                      background: hpColor(targetToken.hp, targetToken.maxHp),
                      transition: 'width 0.25s',
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--sub)', marginTop: 3 }}>
                    CA {targetToken.ac}
                    {targetToken.conditions.length > 0 && ` · ${targetToken.conditions.join(', ')}`}
                  </div>
                </div>

                {/* Attack roll result */}
                {attackResult && (
                  <div style={{
                    textAlign: 'center', marginBottom: 8,
                    padding: '4px 8px', borderRadius: 4,
                    background: attackResult.hit ? 'rgba(74,154,90,0.15)' : 'rgba(224,85,85,0.12)',
                    border: `1px solid ${attackResult.hit ? '#4a9a5a44' : '#e0555544'}`,
                  }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: attackResult.hit ? '#4a9a5a' : '#e05555',
                    }}>
                      {attackResult.hit ? '✅ ACERTOU!' : '❌ ERROU!'}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--sub)', marginLeft: 6 }}>
                      [{attackResult.roll}]{attackResult.mod !== 0 ? (attackResult.mod > 0 ? `+${attackResult.mod}` : attackResult.mod) : ''} = {attackResult.total}
                    </span>
                  </div>
                )}

                {/* Action buttons — roll is ok for all, damage application is GM only */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <button className="tbtn" onClick={rollAttack} style={{ flex: 1, fontSize: 11 }}>
                    ⚔ Atacar (1d20)
                  </button>
                </div>
                {isGM && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="vtt-input"
                      type="number" min="1" placeholder="Dano"
                      value={targetDmg}
                      onChange={e => setTargetDmg(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') applyTargetDamage(); }}
                      style={{ width: 70 }}
                    />
                    <button className="tbtn" onClick={applyTargetDamage} style={{ flex: 1, fontSize: 11 }}>
                      💥 Aplicar Dano
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'combat' && (
          <CombatTracker
            tokenState={tokenState}
            combatActive={combatActive}
            setCombatActive={setCombatActive}
            currentRound={currentRound}
            setCurrentRound={setCurrentRound}
            currentTurnIndex={currentTurnIndex}
            setCurrentTurnIndex={setCurrentTurnIndex}
            initiativeOrder={initiativeOrder}
            setInitiativeOrder={setInitiativeOrder}
            advanceTurn={advanceTurn}
            addLog={addLog}
            playSfx={playSfx}
            isGM={isGM}
            timerEnabled={timerEnabled}
            setTimerEnabled={setTimerEnabled}
            timerDuration={timerDuration}
            setTimerDuration={setTimerDuration}
            timerSoundEnabled={timerSoundEnabled}
            setTimerSoundEnabled={setTimerSoundEnabled}
          />
        )}

        {activeTab === 'dice' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <DiceRoller
              addLog={addLog}
              playSfx={playSfx}
              quickRolls={selectedToken ? (selectedToken.quickRolls ?? []) : null}
              onUpdateQuickRolls={selectedToken ? (qr) => updateToken(selectedToken.id, { quickRolls: qr }) : null}
              charName={selectedToken?.name ?? ''}
            />
            <div style={{ padding: '0 10px 12px' }}>
              <RollableTable
                tables={rollableTables}
                onAdd={onAddTable}
                onUpdate={onUpdateTable}
                onDelete={onDeleteTable}
                addLog={addLog}
                addChatMessage={addChatMessage}
                isGM={isGM}
              />
            </div>
          </div>
        )}
        {activeTab === 'chat' && (
          <ChatPanel
            messages={chatMessages}
            addMessage={addChatMessage}
            clearChat={clearChat}
            playSfx={playSfx}
          />
        )}

        {activeTab === 'fichas' && sheetState && (
          <SheetManager
            sheetState={sheetState}
            tokens={tokens}
            onOpenSheet={onOpenSheetById ?? onOpenSheet}
            isGM={isGM}
            playerName={playerName}
            players={players}
            onRemovePlayer={onRemovePlayer}
          />
        )}

        {/* ── Journal tab ── */}
        {activeTab === 'diary' && (
          <JournalPanel
            entries={journalEntries}
            onAdd={onAddJournal}
            onUpdate={onUpdateJournal}
            onDelete={onDeleteJournal}
            addChatMessage={addChatMessage}
          />
        )}

        {/* ── Compendium tab (GM only) ── */}
        {activeTab === 'compendio' && isGM && (
          <Compendium
            entries={compendiumEntries}
            onAdd={onAddCompendium}
            onUpdate={onUpdateCompendium}
            onDelete={onDeleteCompendium}
            onCreateToken={onCreateTokenFromCompendium}
          />
        )}

        {/* AudioManager always mounted, shown only on audio tab */}
        <AudioManager ref={audioManagerRef} active={activeTab === 'audio'} />
      </div>
    </div>
  );
}
