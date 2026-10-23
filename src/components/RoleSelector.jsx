import { useEffect, useState } from 'react';
import { useRole } from '../hooks/useRole';
import { api } from '../sync/client';

// Tela de entrada. Quem é Mestre ou jogador é decidido pelo servidor, pela conta.
export default function RoleSelector() {
  const { setupGM, registerPlayer, loginPlayer } = useRole();

  const [status,    setStatus]    = useState(null);   // { needsSetup, canSetup } | { error }
  const [mode,      setMode]      = useState('login'); // login | register | setup
  const [nameInput, setNameInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [pass2,     setPass2]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [notice,    setNotice]    = useState('');

  useEffect(() => {
    api.status().then(r => {
      if (!r.ok) { setStatus({ error: r.error }); return; }
      setStatus(r);
      if (r.needsSetup && r.canSetup) setMode('setup');
    });
  }, []);

  async function handleConfirm() {
    setError(''); setNotice('');
    const name = nameInput.trim();
    if (!name) { setError('Digite seu nome.'); return; }
    if (!passInput) { setError('Digite a senha.'); return; }
    if (mode !== 'login') {
      if (passInput.length < 6) { setError('A senha precisa ter ao menos 6 caracteres.'); return; }
      if (passInput !== pass2) { setError('As senhas não conferem.'); return; }
    }
    setLoading(true);
    let r;
    if (mode === 'setup') r = await setupGM(name, passInput);
    else if (mode === 'register') r = await registerPlayer(name, passInput);
    else r = await loginPlayer(name, passInput);
    setLoading(false);
    if (!r.ok) { setError(r.error ?? 'Erro desconhecido.'); return; }
    if (r.pending) {
      setMode('login'); setPassInput(''); setPass2('');
      setNotice('Conta criada! Peça ao Mestre para aprová-la e depois entre com seu nome e senha.');
    }
  }

  const tab = (id, label) => (
    <button
      className="tbtn"
      onClick={() => { setMode(id); setError(''); setNotice(''); }}
      style={{
        flex: 1, fontSize: 11,
        borderColor: mode === id ? 'var(--gold)' : 'var(--border)',
        color: mode === id ? 'var(--gold)' : 'var(--sub)',
      }}
    >{label}</button>
  );

  const blocked = status && (status.error || (status.needsSetup && !status.canSetup));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.08em', fontStyle: 'italic', marginBottom: 6 }}>
          ⚔ Crepúsculo dos Reinos
        </div>
        <div style={{ fontSize: 13, color: 'var(--sub)', letterSpacing: '0.04em' }}>Mesa Virtual</div>
      </div>

      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10,
        padding: '28px 32px', maxWidth: 400, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
      }}>
        {!status && <div style={{ fontSize: 13, color: 'var(--sub)', textAlign: 'center' }}>Conectando à mesa…</div>}

        {status?.error && (
          <div style={{ fontSize: 12, color: '#e05555', textAlign: 'center', lineHeight: 1.6 }}>{status.error}</div>
        )}
        {status && !status.error && status.needsSetup && !status.canSetup && (
          <div style={{ fontSize: 12, color: 'var(--sub)', textAlign: 'center', lineHeight: 1.6 }}>
            O Mestre ainda não preparou a mesa. A conta do Mestre é criada no computador do servidor.
          </div>
        )}

        {status && !blocked && (
          <>
            {mode === 'setup' ? (
              <div style={{ fontSize: 12, color: 'var(--gold)', textAlign: 'center', marginBottom: 14, lineHeight: 1.6 }}>
                🎭 Primeira vez: crie a conta do <b>Mestre</b>.<br />
                <span style={{ color: 'var(--sub)' }}>Guarde bem a senha; ela protege a mesa inteira.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {tab('login', 'Entrar')}
                {tab('register', 'Criar conta de jogador')}
              </div>
            )}

            <input
              autoFocus className="vtt-input" placeholder="Seu nome..." value={nameInput} autoComplete="username"
              onChange={e => { setNameInput(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
              style={{ marginBottom: 6 }}
            />
            <input
              className="vtt-input" type="password" value={passInput}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={mode === 'login' ? 'Senha...' : 'Criar senha (mín. 6 caracteres)...'}
              onChange={e => { setPassInput(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
              style={{ marginBottom: 6 }}
            />
            {mode !== 'login' && (
              <input
                className="vtt-input" type="password" value={pass2} autoComplete="new-password" placeholder="Repita a senha..."
                onChange={e => { setPass2(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
                style={{ marginBottom: 6 }}
              />
            )}
            {mode === 'register' && (
              <div style={{ fontSize: 10, color: 'var(--sub)', lineHeight: 1.5 }}>
                A conta só funciona depois que o Mestre aprovar.
              </div>
            )}
            {error && <div style={{ fontSize: 11, color: '#e05555', marginTop: 6 }}>{error}</div>}
            {notice && <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 6, lineHeight: 1.5 }}>{notice}</div>}

            <button
              className="tbtn" disabled={loading} onClick={handleConfirm}
              style={{ width: '100%', marginTop: 16, padding: '9px 0', fontSize: 13, fontWeight: 600,
                letterSpacing: '0.04em', borderColor: 'var(--gold)', color: 'var(--gold)' }}
            >
              {loading ? 'Verificando...' : mode === 'setup' ? 'Criar Mestre e Entrar' : mode === 'register' ? 'Criar conta' : 'Entrar'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
