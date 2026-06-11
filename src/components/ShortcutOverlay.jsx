const SECTIONS = [
  {
    title: 'Navegação & Ferramentas',
    shortcuts: [
      { key: 'G',              desc: 'Liga/desliga grade' },
      { key: 'F',              desc: 'Liga/desliga névoa' },
      { key: 'Home',           desc: 'Centralizar e resetar zoom' },
      { key: 'T',              desc: 'Ferramenta seleção' },
      { key: 'M',              desc: 'Ferramenta medida' },
      { key: 'K',              desc: 'Ferramenta marcador (📌)' },
      { key: 'J',              desc: 'Ferramenta pintura (🎨)' },
      { key: 'B',              desc: 'Ferramenta paredes 🧱 (clique em interseções para desenhar)' },
      { key: 'C',              desc: 'Abrir ficha do token selecionado' },
      { key: 'V',              desc: 'Ver como jogador (cicla jogadores; última posição volta à visão de Mestre)' },
      { key: 'H',              desc: 'Mostrar/ocultar painel lateral' },
      { key: 'Espaço+Arrastar', desc: 'Mover câmera' },
      { key: 'Scroll',         desc: 'Zoom in/out' },
    ],
  },
  {
    title: 'Tokens',
    shortcuts: [
      { key: 'WASD / Setas',        desc: 'Mover token 1 célula — bloqueado por paredes' },
      { key: 'Shift+WASD / Setas',  desc: 'Mover token 2 células (sprint) — recua 1 se 2ª célula bloqueada' },
      { key: 'Ctrl+WASD / Setas',   desc: 'Mover ignorando paredes (apenas Mestre)' },
      { key: 'Arrastar token',       desc: 'Arrastar — linha verde/vermelha indica caminho; parede bloqueia' },
      { key: 'Ctrl+Arrastar',        desc: 'Arrastar ignorando paredes (apenas Mestre)' },
      { key: 'Tab',                  desc: 'Próximo token' },
      { key: 'Shift+Tab',            desc: 'Token anterior' },
      { key: 'Y',                    desc: 'Entrar em modo mira' },
      { key: 'Shift+Clique Mapa',    desc: 'Mover grupo (membro de grupo) ou iniciar rota de waypoints (outro token)' },
      { key: 'P',                   desc: 'Ativar/cancelar modo de rota (waypoints)' },
      { key: 'Delete',               desc: 'Remover token ou parede selecionada' },
      { key: 'Escape',               desc: 'Desselecionar / cancelar ação' },
    ],
  },
  {
    title: 'Pintura de Mapa',
    shortcuts: [
      { key: 'J',          desc: 'Ativar ferramenta pintura' },
      { key: 'Clique',     desc: 'Pintar célula com cor atual' },
      { key: 'Arrastar',   desc: 'Pintar múltiplas células' },
      { key: 'Clique Dir', desc: 'Apagar célula pintada' },
      { key: 'Ctrl+Z',     desc: 'Desfazer pintura (20 passos)' },
    ],
  },
  {
    title: 'Combate',
    shortcuts: [
      { key: 'N',      desc: 'Próximo turno' },
      { key: 'R',      desc: 'Rolar iniciativa (token selecionado)' },
      { key: 'Ctrl+R', desc: 'Iniciar/reiniciar combate' },
      { key: 'Q',      desc: 'Ataque rápido (1d20 + DOM)' },
    ],
  },
  {
    title: 'Dados Rápidos',
    shortcuts: [
      { key: 'F1', desc: 'Rolar 1d20' },
      { key: 'F2', desc: 'Rolar 1d6'  },
      { key: 'F3', desc: 'Rolar 2d6'  },
      { key: 'F4', desc: 'Rolar 3d8'  },
      { key: 'F5', desc: 'Rolar 1d100' },
    ],
  },
  {
    title: 'Painéis',
    shortcuts: [
      { key: '1',  desc: 'Aba 🎭 Tokens'  },
      { key: '2',  desc: 'Aba ⚔ Combate'  },
      { key: '3',  desc: 'Aba 🎲 Dados'   },
      { key: '4',  desc: 'Aba 🔊 Áudio'   },
      { key: '5',  desc: 'Aba 💬 Chat'    },
      { key: '6',  desc: 'Aba 📋 Fichas'  },
      { key: 'P',              desc: 'Com token: modo waypoint de rota — Sem token: overlay do grupo' },
      { key: '?',              desc: 'Mostrar/ocultar atalhos' },
      { key: 'Ctrl+Shift+F',  desc: 'Abrir/fechar Ficha Companion (📋)' },
      { key: 'Ctrl+Shift+M',  desc: 'Abrir/fechar Painel do Mestre 🎭 (apenas Mestre)' },
    ],
  },
  {
    title: 'Cenas',
    shortcuts: [
      { key: 'Ctrl+←',  desc: 'Cena anterior' },
      { key: 'Ctrl+→',  desc: 'Próxima cena'  },
      { key: '+ (barra de cenas)', desc: 'Nova cena (escolha de modelo)' },
      { key: 'Duplo clique na aba', desc: 'Renomear cena' },
      { key: 'Clique Dir na aba',   desc: 'Menu: duplicar / configurar grade / deletar' },
      { key: '📝 (barra de cenas)', desc: 'Notas GM desta cena' },
    ],
  },
];

export default function ShortcutOverlay({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={onClose}
    >
      <div
        style={{
          background: 'var(--panel)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '20px 24px',
          maxWidth: 600, width: '90vw', maxHeight: '82vh', overflowY: 'auto',
          boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div style={{
          color: 'var(--gold)', fontSize: 15, fontWeight: 700,
          letterSpacing: '0.06em', marginBottom: 16, textAlign: 'center',
        }}>
          Atalhos de Teclado
        </div>

        {SECTIONS.map(section => (
          <div key={section.title} style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--gold-dim)', marginBottom: 5,
            }}>
              {section.title}
            </div>
            <div style={{
              background: 'var(--card)', borderRadius: 4,
              border: '1px solid var(--border)', overflow: 'hidden',
            }}>
              {section.shortcuts.map((s, i) => (
                <div key={s.key} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '5px 10px', fontSize: 12,
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                }}>
                  <kbd style={{
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 3, padding: '2px 7px', fontSize: 11,
                    fontFamily: 'monospace', color: 'var(--gold)',
                    flexShrink: 0, whiteSpace: 'nowrap',
                    letterSpacing: '0.02em',
                  }}>
                    {s.key}
                  </kbd>
                  <span style={{ color: 'var(--sub)' }}>{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="tbtn" onClick={onClose} style={{ fontSize: 11, padding: '4px 18px' }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
