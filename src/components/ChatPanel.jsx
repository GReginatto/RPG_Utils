import { useState, useEffect, useRef, useCallback } from 'react';

const IDENTITY_KEY = 'vtt-chat-identity';

const TYPE_BORDER = {
  player:    '#c9a96e',
  gm:        '#8a4abd',
  dice:      '#3a6abf',
  system:    '#2a3a4e',
  whisper:   '#7a4a9a',
  emote:     '#c9a96e',
  narration: '#c9a96e',
};

function evalDiceExpr(expr) {
  const cleaned = expr.replace(/\s+/g, '');
  const parts = cleaned.match(/[+-]?[^+-]+/g) ?? [];
  let total = 0;
  const rolls = [];
  for (const part of parts) {
    const sign = part.startsWith('-') ? -1 : 1;
    const raw = part.replace(/^[+-]/, '');
    const m = raw.match(/^(\d*)d(\d+)$/i);
    if (m) {
      const count = Math.min(parseInt(m[1] || '1', 10), 100);
      const sides = parseInt(m[2], 10);
      if (sides < 2) continue;
      const rolled = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
      rolls.push(...rolled);
      total += sign * rolled.reduce((s, r) => s + r, 0);
    } else {
      const n = parseInt(raw, 10);
      if (!isNaN(n)) total += sign * n;
    }
  }
  return { total, rolls, expr };
}

function processInlineDice(text) {
  const segments = [];
  let last = 0;
  const re = /\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'text', content: text.slice(last, m.index) });
    const rolled = evalDiceExpr(m[1]);
    segments.push({ type: 'dice', expr: m[1], total: rolled.total, rolls: rolled.rolls });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', content: text.slice(last) });
  return segments;
}

function parseCommand(input, identity) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const id = `msg-${Date.now()}-${Math.random()}`;
  const timestamp = Date.now();
  const sender = identity;

  // /r or /roll
  if (/^\/r(oll)?\s+/i.test(trimmed)) {
    const expr = trimmed.replace(/^\/r(oll)?\s+/i, '').trim();
    if (!expr) return null;
    const result = evalDiceExpr(expr);
    let isCrit = false, isFail = false;
    if (result.rolls.length === 1 && /^1?d20$/i.test(expr)) {
      if (result.rolls[0] === 20) isCrit = true;
      if (result.rolls[0] === 1)  isFail = true;
    }
    return { id, type: 'dice', sender, content: expr, timestamp, tokenColor: null,
      diceResult: { ...result, isCrit, isFail } };
  }

  // /w name message
  if (/^\/w\s+/i.test(trimmed)) {
    const rest = trimmed.replace(/^\/w\s+/i, '');
    const spaceIdx = rest.indexOf(' ');
    if (spaceIdx === -1) return null;
    const target = rest.slice(0, spaceIdx);
    const msg = rest.slice(spaceIdx + 1);
    return { id, type: 'whisper', sender, content: msg, whisperTarget: target,
      timestamp, tokenColor: null, diceResult: null };
  }

  // /me
  if (/^\/me\s+/i.test(trimmed)) {
    const action = trimmed.replace(/^\/me\s+/i, '');
    return { id, type: 'emote', sender, content: action, timestamp, tokenColor: null, diceResult: null };
  }

  // /narrar
  if (/^\/narrar\s+/i.test(trimmed)) {
    const text = trimmed.replace(/^\/narrar\s+/i, '');
    return { id, type: 'narration', sender, content: text, timestamp, tokenColor: null, diceResult: null };
  }

  // normal message
  const ident = identity.toLowerCase();
  const type = (ident === 'mestre' || ident === 'gm' || ident === 'narrador') ? 'gm' : 'player';
  return { id, type, sender, content: trimmed, timestamp, tokenColor: null, diceResult: null };
}

function MessageRow({ msg }) {
  const border = TYPE_BORDER[msg.type] ?? '#2a3a4e';
  const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const base = {
    borderLeft: `3px solid ${border}`,
    padding: '4px 8px',
    marginBottom: 1,
    fontSize: 12,
    lineHeight: 1.5,
    wordBreak: 'break-word',
  };

  if (msg.type === 'system') {
    return (
      <div style={{ ...base, color: 'var(--sub)', fontStyle: 'italic' }}>
        <span style={{ fontSize: 10, opacity: 0.5, marginRight: 5 }}>{time}</span>
        {msg.content}
      </div>
    );
  }

  if (msg.type === 'emote') {
    return (
      <div style={{ ...base, color: 'var(--gold)', fontStyle: 'italic', textAlign: 'center' }}>
        <span style={{ opacity: 0.5, marginRight: 4 }}>✦</span>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{msg.sender}</span>
        {' '}{msg.content}
        <span style={{ opacity: 0.5, marginLeft: 4 }}>✦</span>
      </div>
    );
  }

  if (msg.type === 'narration') {
    return (
      <div style={{
        margin: '6px 4px', padding: '7px 12px',
        borderLeft: '3px solid var(--gold)',
        borderRight: '3px solid var(--gold)',
        background: 'rgba(201,169,110,0.06)',
        color: 'var(--gold)', fontStyle: 'italic', fontSize: 13,
        textAlign: 'center', lineHeight: 1.6,
      }}>
        {msg.content}
      </div>
    );
  }

  if (msg.type === 'whisper') {
    return (
      <div style={{ ...base, color: '#b08ad0', fontStyle: 'italic' }}>
        <span style={{ fontSize: 10, opacity: 0.5, marginRight: 5 }}>{time}</span>
        <span style={{ marginRight: 4 }}>🔒</span>
        <span style={{ fontWeight: 600, color: '#c0a0e0' }}>{msg.sender}</span>
        <span style={{ color: 'var(--sub)', margin: '0 4px' }}>→</span>
        <span style={{ fontWeight: 600, color: '#c0a0e0' }}>{msg.whisperTarget}</span>
        <span style={{ color: 'var(--sub)', marginRight: 4 }}>:</span>
        {msg.content}
      </div>
    );
  }

  if (msg.type === 'dice') {
    const dr = msg.diceResult;
    return (
      <div style={{ ...base }}>
        <span style={{ fontSize: 10, opacity: 0.5, marginRight: 5 }}>{time}</span>
        <span style={{ color: '#6a9ae0', fontWeight: 600 }}>{msg.sender}</span>
        <span style={{ color: 'var(--sub)', margin: '0 4px' }}>🎲</span>
        <span style={{ color: 'var(--sub)' }}>{dr?.expr}: </span>
        <span style={{
          fontWeight: 700, fontSize: 14,
          color: dr?.isCrit ? '#4db870' : dr?.isFail ? '#e05555' : 'var(--gold)',
        }}>
          {dr?.total}
        </span>
        {dr?.rolls.length > 1 && (
          <span style={{ color: 'var(--sub)', fontSize: 10, marginLeft: 4 }}>
            [{dr.rolls.join(', ')}]
          </span>
        )}
        {dr?.isCrit && <span style={{ color: '#4db870', fontWeight: 700, marginLeft: 8 }}>CRÍTICO!</span>}
        {dr?.isFail && <span style={{ color: '#e05555', fontWeight: 700, marginLeft: 8 }}>FALHA CRÍTICA!</span>}
      </div>
    );
  }

  // player or gm
  const senderColor = msg.type === 'gm' ? '#b080e0' : 'var(--gold)';
  const segments = processInlineDice(msg.content);
  return (
    <div style={{ ...base }}>
      <span style={{ fontSize: 10, opacity: 0.5, marginRight: 5 }}>{time}</span>
      <span style={{ color: senderColor, fontWeight: 600 }}>{msg.sender}</span>
      <span style={{ color: 'var(--sub)', marginRight: 4 }}>:</span>
      {segments.map((seg, i) =>
        seg.type === 'text'
          ? <span key={i} style={{ color: 'var(--text)' }}>{seg.content}</span>
          : <span key={i} style={{ color: 'var(--gold)', fontWeight: 700 }}
              title={`[${seg.rolls.join(', ')}]`}>{seg.total}</span>
      )}
    </div>
  );
}

export default function ChatPanel({ messages, addMessage, clearChat, playSfx }) {
  const [input, setInput] = useState('');
  const [identity, setIdentity] = useState(() => localStorage.getItem(IDENTITY_KEY) ?? 'Jogador');
  const [editingId, setEditingId] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  const saveIdentity = useCallback((val) => {
    const v = val.trim() || 'Jogador';
    setIdentity(v);
    localStorage.setItem(IDENTITY_KEY, v);
    setEditingId(false);
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const msg = parseCommand(trimmed, identity);
    if (!msg) return;
    addMessage(msg);
    if (msg.type === 'dice') playSfx?.('dice');
    setInput('');
  }, [input, identity, addMessage, playSfx]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const confirmClear = useCallback(() => {
    if (window.confirm('Limpar todas as mensagens do chat?')) clearChat();
  }, [clearChat]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Identity bar */}
      <div style={{
        padding: '5px 10px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: 'var(--sub)', flexShrink: 0 }}>Você é:</span>
        {editingId ? (
          <input
            autoFocus
            className="vtt-input"
            defaultValue={identity}
            style={{ flex: 1, fontSize: 11 }}
            onBlur={e => saveIdentity(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveIdentity(e.target.value);
              if (e.key === 'Escape') setEditingId(false);
            }}
          />
        ) : (
          <span
            style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flex: 1 }}
            onClick={() => setEditingId(true)}
            title="Clique para editar identidade"
          >
            {identity}
          </span>
        )}
        <button
          className="tbtn"
          onClick={confirmClear}
          style={{ padding: '1px 7px', fontSize: 10, flexShrink: 0 }}
        >Limpar</button>
      </div>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {messages.length === 0 && (
          <div style={{
            color: 'var(--sub)', fontSize: 11, textAlign: 'center',
            marginTop: 28, lineHeight: 2, fontStyle: 'italic',
          }}>
            Nenhuma mensagem.<br />
            <span style={{ fontSize: 10 }}>
              /r 2d6+3 · /me ação · /w nome msg · /narrar texto
            </span>
          </div>
        )}
        {messages.map(msg => <MessageRow key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div style={{
        borderTop: '1px solid var(--border)', padding: '6px 8px',
        display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center',
      }}>
        <input
          className="vtt-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="/r 1d20 · /me · /w · /narrar"
          style={{ flex: 1, fontSize: 11 }}
        />
        <button className="tbtn" onClick={handleSend} style={{ padding: '3px 10px', fontSize: 11, flexShrink: 0 }}>
          ↵
        </button>
      </div>
    </div>
  );
}
