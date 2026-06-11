import { useEffect, useRef, useState } from 'react';
import IframeModal from './IframeModal';
import { vttToCompanion, companionToVTT } from '../utils/sheetBridge';

export default function PlayerCompanion({
  onClose, zIndex, onFocus,
  sheet,          // current sheet being shown (null → Workflow B new character)
  linkedToken,    // live token linked to sheet (null if no linkedTokenId)
  onUpdate,       // (sheetId, vttData) → update existing sheet/token
  onCreateCharacter, // (vttData) → create new sheet + token (Workflow B)
}) {
  const iframeRef   = useRef(null);
  const [iframeReady, setIframeReady] = useState(false);

  // Refs for stale-closure safety inside effects
  const sheetRef       = useRef(sheet);
  const linkedTokenRef = useRef(linkedToken);
  // Anti-loop: set before sending VTT_UPDATE_FIELD to suppress the hp/mp
  // useEffects that would fire again when onUpdate mutates the token.
  const suppressHpMpRef = useRef(false);

  useEffect(() => { sheetRef.current = sheet; }, [sheet]);
  useEffect(() => { linkedTokenRef.current = linkedToken; }, [linkedToken]);

  // ── Message listener (companion → VTT) ────────────────────────────────────
  useEffect(() => {
    function onMsg(e) {
      if (!e.data?.type) return;

      // eslint-disable-next-line default-case
      switch (e.data.type) {
        case 'COMPANION_READY':
          setIframeReady(true);
          // Workflow A / E: load current sheet into companion on first connect
          if (sheetRef.current) {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'VTT_LOAD_STATE', payload: vttToCompanion(sheetRef.current) }, '*'
            );
          }
          break;

        case 'COMPANION_STATE_UPDATE': {
          if (!e.data.payload) return;
          // Anti-loop: ignore the echo triggered by our own VTT_UPDATE_FIELD
          if (suppressHpMpRef.current) { suppressHpMpRef.current = false; return; }
          const vttData = companionToVTT(e.data.payload);
          if (!sheetRef.current) {
            // Workflow B: no sheet yet → create character
            onCreateCharacter?.(vttData);
          } else {
            // Workflow A / C / D: update existing sheet + linked token
            onUpdate?.(sheetRef.current.id, vttData);
          }
          break;
        }
      }
    }

    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onUpdate, onCreateCharacter]); // stable memoised callbacks

  // ── Workflow F: sheet switch — push new data without remounting iframe ─────
  useEffect(() => {
    if (!iframeReady || !sheet) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'VTT_LOAD_STATE', payload: vttToCompanion(sheet) }, '*'
    );
  // sheet.id change drives the switch; iframeReady gates it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.id, iframeReady]);

  // ── Workflow C: push HP changes from VTT combat → companion ──────────────
  useEffect(() => {
    if (!iframeReady || !linkedToken) return;
    suppressHpMpRef.current = true;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'VTT_UPDATE_FIELD', field: 'curHP', value: linkedToken.hp ?? 0 }, '*'
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedToken?.hp, iframeReady]);

  // ── Workflow C: push MP changes from VTT combat → companion ──────────────
  useEffect(() => {
    if (!iframeReady || !linkedToken) return;
    suppressHpMpRef.current = true;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'VTT_UPDATE_FIELD', field: 'curMP', value: linkedToken.mp ?? 0 }, '*'
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedToken?.mp, iframeReady]);

  const charName = sheet?.name || 'Personagem';
  const titleExtra = iframeReady
    ? <span style={{ color: '#3a8a4a', fontSize: 10, marginLeft: 8 }}>● Sincronizado</span>
    : <span style={{ color: '#c9a96e', fontSize: 10, marginLeft: 8 }}>○ Conectando...</span>;

  return (
    <IframeModal
      src="/ficha-jogador.html"
      title={`📋 Ficha — ${charName}`}
      titleExtra={titleExtra}
      onClose={onClose}
      zIndex={zIndex}
      onFocus={onFocus}
      iframeRef={iframeRef}
    />
  );
}
