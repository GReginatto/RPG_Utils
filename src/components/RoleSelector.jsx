import { useState } from 'react';
import { useRole } from '../hooks/useRole';

export default function RoleSelector() {
  const { enterGM, registerPlayer, loginPlayer, playerRecords } = useRole();

  const [selected,   setSelected]   = useState(null); // 'gm' | 'player'
  const [loginMode,  setLoginMode]  = useState(true); // true = login, false = register
  const [nameInput,  setNameInput]  = useState('');
  const [passInput,  setPassInput]  = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const knownPlayer = playerRecords.some(
    r => r.name.toLowerCase() === nameInput.trim().toLowerCase()
  );

  async function handleConfirm() {
    if (selected === 'gm') { enterGM(); return; }
    if (selected === 'player') {
      if (!nameInput.trim()) { setError('Digite seu nome para continuar.'); return; }
      if (!passInput) { setError('Digite sua senha.'); return; }
      setLoading(true);
      setError('');
      let result;
      if (loginMode) {
        result = await loginPlayer(nameInput.trim(), passInput);
      } else {
        if (passInput.length < 4) { setError('Senha deve ter ao menos 4 caracteres.'); setLoading(false); return; }
        result = await registerPlayer(nameInput.trim(), passInput);
      }
      setLoading(false);
      if (!result.ok) setError(result.error ?? 'Erro desconhecido.');
    }
  }

  const cardBase = {
    border: '1px solid var(--border)',
    borderRadius: 8, padding: '16px 18px', cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    userSelect: 'none',
  };

  const isRegister = selected === 'player' && !loginMode;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          fontSize: 22, fontWeight: 700, color: 'var(--gold)',
          letterSpacing: '0.08em', fontStyle: 'italic', marginBottom: 6,
        }}>
          ⚔ Crepúsculo dos Reinos
        </div>
        <div style={{ fontSize: 13, color: 'var(--sub)', letterSpacing: '0.04em' }}>
          Mesa Virtual
        </div>
      </div>

      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '28px 32px', maxWidth: 400, width: '100%',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
      }}>
        <div style={{
          fontSize: 13, color: 'var(--sub)', textAlign: 'center',
          marginBottom: 20, letterSpacing: '0.03em',
        }}>
          Como você quer entrar?
        </div>

        {/* GM card */}
        <div
          onClick={() => { setSelected('gm'); setError(''); }}
          style={{
            ...cardBase,
            marginBottom: 12,
            borderColor: selected === 'gm' ? 'var(--gold)' : 'var(--border)',
            background: selected === 'gm' ? 'rgba(201,169,110,0.08)' : 'var(--card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>🎭</span>
            <span style={{
              fontSize: 14, fontWeight: 700, color: 'var(--gold)',
              letterSpacing: '0.06em',
            }}>
              MESTRE
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.6, paddingLeft: 28 }}>
            Controle total do jogo. Mapas, NPCs, combate, regras e narrativa.
          </div>
        </div>

        {/* Player card */}
        <div
          onClick={() => { setSelected('player'); setError(''); }}
          style={{
            ...cardBase,
            borderColor: selected === 'player' ? 'var(--gold)' : 'var(--border)',
            background: selected === 'player' ? 'rgba(201,169,110,0.08)' : 'var(--card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>⚔</span>
            <span style={{
              fontSize: 14, fontWeight: 700, color: 'var(--text)',
              letterSpacing: '0.06em',
            }}>
              JOGADOR
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5, paddingLeft: 28, marginBottom: selected === 'player' ? 10 : 0 }}>
            Controle seu personagem. Ficha, dados e combate.
          </div>

          {selected === 'player' && (
            <div style={{ paddingLeft: 28 }} onClick={e => e.stopPropagation()}>
              {/* Login / Register toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button
                  className="tbtn"
                  onClick={() => { setLoginMode(true); setError(''); }}
                  style={{
                    flex: 1, fontSize: 11,
                    borderColor: loginMode ? 'var(--gold)' : 'var(--border)',
                    color: loginMode ? 'var(--gold)' : 'var(--sub)',
                  }}
                >
                  Entrar
                </button>
                <button
                  className="tbtn"
                  onClick={() => { setLoginMode(false); setError(''); }}
                  style={{
                    flex: 1, fontSize: 11,
                    borderColor: !loginMode ? 'var(--gold)' : 'var(--border)',
                    color: !loginMode ? 'var(--gold)' : 'var(--sub)',
                  }}
                >
                  Criar Personagem
                </button>
              </div>

              <input
                autoFocus
                className="vtt-input"
                placeholder="Seu nome..."
                value={nameInput}
                onChange={e => {
                  setNameInput(e.target.value);
                  setError('');
                  if (playerRecords.some(r => r.name.toLowerCase() === e.target.value.trim().toLowerCase())) {
                    setLoginMode(true);
                  }
                }}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
                style={{ marginTop: 2, marginBottom: 6 }}
              />

              <input
                className="vtt-input"
                type="password"
                placeholder={isRegister ? 'Criar senha (mín. 4 caracteres)...' : 'Senha...'}
                value={passInput}
                onChange={e => { setPassInput(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
                style={{ marginBottom: 2 }}
              />

              {knownPlayer && !loginMode && (
                <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 3 }}>
                  Nome já cadastrado — modo alterado para login.
                </div>
              )}

              {error && (
                <div style={{ fontSize: 10, color: '#e05555', marginTop: 4 }}>{error}</div>
              )}
            </div>
          )}
        </div>

        {/* Confirm button */}
        <button
          className="tbtn"
          disabled={!selected || loading}
          onClick={handleConfirm}
          style={{
            width: '100%', marginTop: 20, padding: '9px 0',
            fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
            borderColor: selected ? 'var(--gold)' : 'var(--border)',
            color: selected ? 'var(--gold)' : 'var(--sub)',
            cursor: selected ? 'pointer' : 'not-allowed',
            opacity: selected ? 1 : 0.5,
          }}
        >
          {loading ? 'Verificando...' : (isRegister ? 'Criar e Entrar' : 'Entrar')}
        </button>
      </div>
    </div>
  );
}
