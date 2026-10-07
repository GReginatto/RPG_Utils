import { useState, useEffect, useRef } from 'react';
import { rollDice } from '../utils/dice';
import { resizeImage } from '../utils/imageUtils';
import {
  ATTRS, ATTR_FULL, RACES_DATA, PROFESSIONS_DATA, SKILLS, SKILLS_AT_CREATION, FREE_TOOL_PROFS, SKILL_RENAMES,
  AURA_GROUPS, AURA_DETAILS, PANTHEON, XP_TABLE, LV_MIN, LV_MAX, GENERIC_TECHS,
  FORT_ELEMENTS, FORT_VARIANTS, EXH_DESC, TRAINING_TIERS, ARMORS,
  PB_BASE, PB_TOTAL, PB_MAX, PB_DOUBLE, pointBuyCost, profBonus, attrMod,
  ppAtLevel, PP_AURA_UP, PP_NEW_AURA, PP_NEW_AURA_TITANIC, ATTR_CAP, ppAttrCost, ppEarned, areaDistance, auraArea,
  hereditaryAura, titanicBorn, rareHereditary, newAuraCost, auraSpent, attrUpsSpent, fortTotal,
  ppConfirmState, attrConfirmed, auraConfirmed, ppPending, awakenedAura, techDiceCap,
  SKILLS_FROM_PROF, PROF_RENAMES, ARMOR_CAT, skillProficient, skillProfMult, saveProficient, saveBonus, armorWithoutProf,
  hitDiceLeft, hitDicePerRest, corpoRenovado, LEGENDARY_MAX, XP_SESSION, auraLicense,
  TOOLS, hitDieHeal, restGain, raceBonus, PROF_DICE, profRuler, heritageLocked, SIGNATURE_MAX, convertOldPP,
  sheetReminders, scalesAvailable, hachimanBonus,
} from '../utils/rpgData';

// ── helpers ───────────────────────────────────────────────────────────────────
// P-040: fichas antigas com "Arkano" usam o Canalizador
function profKey(sheet) { return PROF_RENAMES[sheet.prof] || sheet.prof; }
function getProf(sheet) {
  const k = profKey(sheet);
  return k === 'custom'
    ? (sheet.customProf || { name: 'Profissão montada', m: {}, hp: '1d8', mp: '1d8', sk: '', per: [], res: [], pac: '', exc: false, exd: '', co: 0 })
    : (PROFESSIONS_DATA[k] || { m: {}, hp: '1d8', mp: '1d8', sk: '' });
}
// Valor sem os aumentos de PP (compra + profissão + raça, com o +1 do Humano)
function baseFinalAttr(sheet, a) {
  const p = getProf(sheet);
  return (sheet.attrs?.[a] ?? PB_BASE) + (p.m?.[a] ?? 0) + raceBonus(sheet, a);
}
function finalAttr(sheet, a) { return baseFinalAttr(sheet, a) + (sheet.attrUps?.[a] ?? 0); }
const amod = attrMod;
function mstr(v) { const m = amod(v); return m >= 0 ? `+${m}` : `${m}`; }
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function sheetLevel(sheet) { return Math.max(LV_MIN, Math.min(LV_MAX, sheet.level || LV_MIN)); }
function ppSpent(sheet) {
  let c = 0;
  ATTRS.forEach(a => { c += attrUpsSpent(sheet.attrs?.[a] ?? PB_BASE, sheet.attrUps?.[a] ?? 0); }); // D-52: valor comprado
  (sheet.auras || []).forEach(x => { c += auraSpent(x); });
  return c;
}
function ppLeft(sheet) { return ppEarned(sheetLevel(sheet)) - ppSpent(sheet); }
// HP = Σ(dado + mod CON), MP = Σ(dado + mod DOM), mínimo 1 por nível (cap. 13, PB-8)
function calcHPMP(sheet) {
  const conMod = amod(finalAttr(sheet, 'CON')), domMod = amod(finalAttr(sheet, 'DOM'));
  // Corpo Renovado (Rejuvenescimento 3, R9-3): +1 HP máximo por nível de personagem
  const crn = corpoRenovado(sheet.auras) && (sheet.hpDice || []).length ? sheetLevel(sheet) : 0;
  const hp = (sheet.hpDice || []).reduce((s, d) => s + Math.max(1, d + conMod), 0) + crn;
  const mp = (sheet.mpDice || []).reduce((s, d) => s + Math.max(1, d + domMod), 0);
  return { hp, mp, conMod, domMod, crn };
}
function calcDefense(sheet) {
  const dexMod = amod(finalAttr(sheet, 'DEX'));
  const ar = ARMORS.find(x => x.n === sheet.armor) || ARMORS[0];
  let ca = ar.t === 'P' ? ar.ca : ar.t === 'M' ? ar.ca + Math.min(2, dexMod) : ar.ca + dexMod;
  if (sheet.shield) ca += 2;
  const esc = scalesAvailable(sheet.auras) && sheet.escamas; if (esc) ca += 2;    // P-095: escamas da Animalesca 2+
  const hach = hachimanBonus(sheet.auras);                                          // P-095: Dom de Hachiman
  const mv = (RACES_DATA[sheet.race]?.mv ?? 9) + (ar.mv || 0) + hach;              // P-073: armadura pesada −1/−2 m
  return { ca, mv, ar, esc, hach };
}
function PPBar({ sheet, onUpdate, isReadOnly }) {
  const e = ppEarned(sheetLevel(sheet)), g = ppSpent(sheet), l = e - g, pend = ppPending(sheet);
  // Compras definitivas (D-53): confirmar trava o estado atual; depois, sem reembolso
  function confirmar() {
    if (!window.confirm('Confirmar as compras com PP? Depois de confirmadas, não podem ser desfeitas nem reembolsadas (D-53).')) return;
    onUpdate({ ppConf: ppConfirmState(sheet), herLivre: false }); // P-097: confirmar trava a aura de nascença
  }
  return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:10,flexWrap:'wrap',padding:'5px 14px',borderRadius:5,marginBottom:8,border:'1px solid rgba(201,169,110,.15)' }}>
      {sheet.ppAntigo&&<div style={{flexBasis:'100%',fontSize:10,color:'#d4a017',lineHeight:1.5,border:'1px solid rgba(212,160,23,.35)',borderRadius:4,padding:'5px 8px'}}>⚠ <b>Reforma da progressão (D-89).</b> {sheet.ppAntigo} {onUpdate&&!isReadOnly&&<button className="tbtn" style={{fontSize:9,padding:'1px 6px'}} onClick={()=>onUpdate({ppAntigo:''})}>Entendi</button>}</div>}
      <span style={{fontSize:11,color:'var(--sub)'}}>Pontos de Progressão:</span>
      <span style={{fontSize:20,fontWeight:700,fontFamily:"'Cinzel',serif",color:l<0?'#b83030':'var(--gold)'}}>{l}</span>
      <span style={{fontSize:10,color:'var(--sub)'}}>disponíveis · {e} ganhos (1 por nível do 4 ao 15, +1 nos níveis 5, 10 e 15; 15 no total) · {g} gastos{l<0&&<b style={{color:'#b83030'}}> · gasto acima do ganho</b>}</span>
      {pend>0&&onUpdate&&!isReadOnly
        ? <button className="tbtn" title="Compras pendentes podem ser desfeitas até confirmar; depois, sem reembolso (D-53)" onClick={confirmar}>✔ Confirmar compras ({pend})</button>
        : <span style={{fontSize:9,color:'var(--sub)'}}>compras confirmadas não são reembolsadas (D-53)</span>}
    </div>
  );
}

// ── shared UI ─────────────────────────────────────────────────────────────────
const NB = { width: 21, height: 21, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--sub)', cursor: 'pointer', borderRadius: 3, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' };

function St({ children, style }) {
  return <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 7, marginTop: 14, paddingBottom: 4, borderBottom: '1px solid var(--border)', ...style }}>{children}</div>;
}
function Lb({ children }) {
  return <div style={{ fontFamily: "'Cinzel',serif", fontSize: 8, fontWeight: 600, color: 'var(--sub)', letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 3 }}>{children}</div>;
}
function Nc({ value, onDec, onInc, color }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <button style={NB} onClick={onDec}>−</button>
      <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700, fontSize: 14, fontFamily: "'Cinzel',serif", color: color || 'var(--text)' }}>{value}</span>
      <button style={NB} onClick={onInc}>+</button>
    </span>
  );
}
function Sb({ label, value, sub, color }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 10px', textAlign: 'center', minWidth: 58 }}>
      <div style={{ fontSize: 8, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '.12em', fontFamily: "'Cinzel',serif", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Cinzel',serif", color: color || 'var(--gold)' }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--sub)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
function Bar({ value, max, color }) {
  const pct = max > 0 ? Math.min(1, value / max) * 100 : 0;
  return <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .3s' }} /></div>;
}
function RBtn({ onClick, children, title, style }) {
  return <button className="tbtn" onClick={onClick} title={title} style={{ fontSize: 10, padding: '2px 8px', flexShrink: 0, ...style }}>{children}</button>;
}
function Acc({ title, children, open: defOpen = false }) {
  const [open, setOpen] = useState(defOpen);
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 5, marginBottom: 7, overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: "'Cinzel',serif", fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: '.06em' }}>
        <span>{title}</span>
        <span style={{ fontSize: 8, color: 'var(--sub)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>▶</span>
      </div>
      {open && <div style={{ padding: '0 12px 12px', fontSize: 12, lineHeight: 1.5 }}>{children}</div>}
    </div>
  );
}

// ── PerfilTab ─────────────────────────────────────────────────────────────────
function PerfilTab({ sheet, onUpdate, isReadOnly }) {
  const u = onUpdate;
  const race = sheet.race || 'Humano';
  const p = getProf(sheet);
  const rc = RACES_DATA[race];

  return (
    <div>
      <St>Identidade</St>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
        {[['Nome','name','Nome do personagem...'],['Jogador','player','Seu nome...'],['Idade','age','Ex: 25'],['Gênero','gender',''],['Região','origin','Ex: Aldwynn'],['Alinhamento','alignment','Ex: Neutro Bom']].map(([lbl, f, ph]) => (
          <div key={f}><Lb>{lbl}</Lb><input className="vtt-input" placeholder={ph} value={sheet[f]||''} readOnly={isReadOnly} onChange={e => u({[f]:e.target.value})} /></div>
        ))}
      </div>

      <St>Raça</St>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
        {Object.keys(RACES_DATA).map(r => {
          const on = race === r;
          return <button key={r} onClick={() => !isReadOnly && u({race:r})} style={{ padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: isReadOnly?'default':'pointer', border: `1px solid ${on?RACES_DATA[r].c:'var(--border)'}`, background: on?RACES_DATA[r].c+'20':'transparent', color: on?RACES_DATA[r].c:'var(--sub)', fontFamily: 'inherit' }}>{r}</button>;
        })}
      </div>
      {rc && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeft: `3px solid ${rc.c}`, borderRadius: 4, padding: '8px 10px', fontSize: 11, color: 'var(--sub)', marginBottom: 10 }}>
          <span style={{fontStyle:'italic'}}>{rc.ab}</span><br/>
          Movimento: {rc.mv} m · {rc.af ? `Afinidade de Arka: Área ${rc.af} (+2 nos testes de treino, −10% de MP nas auras dessa Área)` : 'Sem afinidade de Arka'}
          {race==='Humano'&&<div style={{display:'flex',alignItems:'center',gap:6,marginTop:5}}>+1 em:
            <select className="vtt-select" value={sheet.humAttr||''} disabled={isReadOnly} onChange={e=>u({humAttr:e.target.value})} style={{width:160}}>
              <option value="">— atributo —</option>{ATTRS.map(a=><option key={a} value={a}>{ATTR_FULL[a]}</option>)}
            </select></div>}
        </div>
      )}

      <St>Profissão</St>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
        {[...Object.keys(PROFESSIONS_DATA),'custom'].map(key => {
          const on = (profKey(sheet)||'custom') === key;
          return <button key={key} onClick={() => !isReadOnly && u({prof:key})} style={{ padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: isReadOnly?'default':'pointer', border: `1px solid ${on?'var(--gold-dim)':'var(--border)'}`, background: on?'rgba(201,169,110,.1)':'transparent', color: on?'var(--gold)':'var(--sub)', fontFamily: 'inherit' }}>{key==='custom'?'✎ Montada (com o Mestre)':key}</button>;
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--sub)', marginBottom: 8, lineHeight: 1.5 }}>
        {profKey(sheet)!=='custom' && p.per ? (<>
          <b style={{color:'var(--text)'}}>HP:</b> {p.hp}+CON · <b style={{color:'var(--text)'}}>MP:</b> {p.mp}+DOM <span style={{opacity:.7}}>(por nível, mín. 1)</span><br/>
          <b style={{color:'var(--text)'}}>Perícias (escolha 4):</b> {p.per.join(', ')}<br/>
          <b style={{color:'var(--text)'}}>Armaduras:</b> {p.arm.map(t=>ARMOR_CAT[t]).join(', ')}{p.esc?' e escudo':''} · <b style={{color:'var(--text)'}}>Armas:</b> {p.armas}<br/>
          <b style={{color:'var(--text)'}}>Testes de resistência:</b> {p.res.join(' e ')} · <b style={{color:'var(--text)'}}>Riqueza inicial:</b> {p.co} CO
          {!isReadOnly&&<button className="tbtn" style={{fontSize:9,padding:'1px 6px',marginLeft:4}} onClick={()=>{ if((sheet.gold||0)&&!window.confirm(`Trocar as ${sheet.gold} CO atuais pela riqueza inicial (${p.co} CO)?`))return; u({gold:p.co}); }}>receber</button>}
          <span style={{opacity:.7}}> (+ kit básico de viagem grátis)</span>
          {(p.ex||[]).map(([n,t])=><div key={n}><b style={{color:'var(--gold)'}}>{n}:</b> {t}</div>)}
        </>) : <MontadaInfo sheet={sheet} onUpdate={u} isReadOnly={isReadOnly}/>}
      </div>
      {profKey(sheet)==='custom' && !isReadOnly && <MontadaEditor sheet={sheet} onUpdate={u}/>}

      <St>Aparência & Personalidade</St>
      {[['Aparência','appearance','Descrição física...',2],['Personalidade','personality','Traços, ideais, defeitos...',2],['História','background','Background...',3],['Motivação','motivation','Motivação?',2],['Notas','notes','Anotações...',2]].map(([lbl,f,ph,rows]) => (
        <div key={f} style={{marginBottom:8}}><Lb>{lbl}</Lb><textarea className="vtt-input" rows={rows} placeholder={ph} readOnly={isReadOnly} value={sheet[f]||''} onChange={e=>u({[f]:e.target.value})} style={{resize:'vertical',lineHeight:1.5}} /></div>
      ))}
    </div>
  );
}

// ── Profissão montada com o Mestre (D-84, D-85, D-88; régua P-094): a ficha avisa, não bloqueia ──
function MontadaInfo({ sheet, onUpdate, isReadOnly }) {
  const p = getProf(sheet), pk = PROFESSIONS_DATA[p.pac], w = profRuler(p);
  return (<>
    <b style={{color:'var(--text)'}}>Profissão montada com o Mestre</b> (profissões são modelos, D-84; régua P-094). Nenhum item se liga a aura.<br/>
    <b style={{color:'var(--text)'}}>Ofício/background:</b> {p.sk||'—'} · <b style={{color:'var(--text)'}}>HP:</b> {p.hp||'1d8'}+CON · <b style={{color:'var(--text)'}}>MP:</b> {p.mp||'1d8'}+DOM <span style={{opacity:.7}}>(por nível, mín. 1)</span><br/>
    <b style={{color:'var(--text)'}}>Perícias (escolha 4):</b> {(p.per||[]).join(', ')||'—'}<br/>
    <b style={{color:'var(--text)'}}>Armaduras e armas:</b> {pk?`pacote de ${p.pac} — ${pk.arm.map(t=>ARMOR_CAT[t]).join(', ')}${pk.esc?' e escudo':''} · ${pk.armas}`:'—'}<br/>
    <b style={{color:'var(--text)'}}>Testes de resistência:</b> {(p.res||[]).join(' e ')||'—'} · <b style={{color:'var(--text)'}}>Riqueza inicial:</b> {p.co?`${p.co} CO`:'definida pelo Mestre'}
    {p.co>0&&!isReadOnly&&<button className="tbtn" style={{fontSize:9,padding:'1px 6px',marginLeft:4}} onClick={()=>{ if((sheet.gold||0)&&!window.confirm(`Trocar as ${sheet.gold} CO atuais pela riqueza inicial (${p.co} CO)?`))return; onUpdate({gold:p.co}); }}>receber</button>}
    <span style={{opacity:.7}}> (D-85; + kit básico de viagem grátis)</span>
    {p.exc&&<div><b style={{color:'var(--gold)'}}>Exclusiva (aprovada pelo Mestre):</b> {p.exd||'—'}</div>}
    <div style={{marginTop:5,color:w.length?'#d4a017':'#3a7a4c'}}>{w.length?<>⚠ Fora da régua da profissão montada (P-094) — confirme com o Mestre:{w.map(x=><div key={x}>• {x}</div>)}</>:'✔ Dentro da régua da profissão montada (P-094).'}</div>
  </>);
}
function MontadaEditor({ sheet, onUpdate }) {
  const cp = getProf(sheet), set = ch => onUpdate({ customProf: { ...cp, ...ch } });
  const chip = (on, label, onClick) => <button key={label} onClick={onClick} style={{ padding:'2px 7px', borderRadius:16, fontSize:10, cursor:'pointer', border:`1px solid ${on?'var(--gold-dim)':'var(--border)'}`, background:on?'rgba(201,169,110,.1)':'transparent', color:on?'var(--gold)':'var(--sub)', fontFamily:'inherit' }}>{label}</button>;
  const dsel = k => <select className="vtt-select" value={cp[k]||'1d8'} onChange={e=>set({[k]:e.target.value})}>{[...new Set([...PROF_DICE, cp[k]||'1d8'])].map(d=><option key={d} value={d}>{d}</option>)}</select>;
  const per = cp.per||[], res = cp.res||[];
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 5, padding: '10px 12px', marginBottom: 10 }}>
      <St style={{marginTop:0}}>Profissão montada (com o Mestre)</St>
      <div style={{fontSize:10,color:'var(--sub)',marginBottom:8,lineHeight:1.5}}>Régua (P-094): atributos +3/−3 (bônus em até 2) ou +5/−5 (bônus em até 3), nenhum além de ±3; dados de HP e MP somam 4 degraus com +3/−3 ou 4–5 com +5/−5 (d4 = 0, d6 = 1, d8 = 2, d10 = 3, d12 = 4), ou 3 com uma exclusiva do tamanho do Olho de Falcão; 8 perícias (o jogador escolhe 4); 2 resistências de atributos diferentes; armaduras e armas de uma das 7; riqueza inicial definida pelo Mestre (D-85). A ficha só avisa: quem aprova é o Mestre.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div><Lb>Nome</Lb><input className="vtt-input" value={cp.name||''} onChange={e=>set({name:e.target.value})}/></div>
        <div><Lb>Ofício / background</Lb><input className="vtt-input" value={cp.sk||''} onChange={e=>set({sk:e.target.value})}/></div>
        <div><Lb>Dado de HP</Lb>{dsel('hp')}</div>
        <div><Lb>Dado de MP</Lb>{dsel('mp')}</div>
      </div>
      <Lb>Modificadores</Lb>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '4px 0 8px' }}>
        {ATTRS.map(a => { const v = cp.m?.[a]??0; return (
          <div key={a} style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{fontSize:10,color:'var(--sub)',width:28}}>{a}</span>
            <Nc value={(v>=0?'+':'')+v} color={v>0?'#3a7a4c':v<0?'#b83030':'var(--text)'} onDec={()=>set({m:{...(cp.m||{}),[a]:v-1}})} onInc={()=>set({m:{...(cp.m||{}),[a]:v+1}})} />
          </div>); })}
      </div>
      <Lb>Perícias da profissão ({per.length}/8)</Lb>
      <div style={{display:'flex',flexWrap:'wrap',gap:4,margin:'4px 0 8px'}}>{SKILLS.map(s=>chip(per.includes(s.n), s.n, ()=>{ if(per.includes(s.n)) set({per:per.filter(x=>x!==s.n)}); else if(per.length<8) set({per:[...per,s.n]}); }))}</div>
      <Lb>Testes de resistência ({res.length}/2)</Lb>
      <div style={{display:'flex',flexWrap:'wrap',gap:4,margin:'4px 0 8px'}}>{ATTRS.map(a=>chip(res.includes(a), a, ()=>{ if(res.includes(a)) set({res:res.filter(x=>x!==a)}); else if(res.length<2) set({res:[...res,a]}); }))}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div><Lb>Armaduras e armas (pacote de)</Lb><select className="vtt-select" value={cp.pac||''} onChange={e=>set({pac:e.target.value})}><option value="">— uma das 7 —</option>{Object.keys(PROFESSIONS_DATA).map(k=><option key={k} value={k}>{k}</option>)}</select></div>
        <div><Lb>Riqueza inicial (CO, pelo Mestre)</Lb><input className="vtt-input" type="number" min={0} value={cp.co||0} onChange={e=>set({co:Math.max(0,parseInt(e.target.value,10)||0)})}/></div>
      </div>
      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,marginBottom:4}}><input type="checkbox" checked={!!cp.exc} onChange={e=>set({exc:e.target.checked})}/>Capacidade exclusiva aprovada pelo Mestre (dados somam 3 degraus)</label>
      {cp.exc&&<input className="vtt-input" placeholder="Descreva a exclusiva..." value={cp.exd||''} onChange={e=>set({exd:e.target.value})}/>}
    </div>
  );
}

// ── AtributosTab ──────────────────────────────────────────────────────────────
function AtributosTab({ sheet, onUpdate, isReadOnly, addLog, playSfx, targetToken, combatActive }) {
  const u = onUpdate;
  const p = getProf(sheet);
  const lv = sheetLevel(sheet);
  const prof = profBonus(lv);

  const dexFin = finalAttr(sheet,'DEX');
  const dexMod = amod(dexFin);
  const { hp: calcMaxHP, mp: calcMaxMP, conMod, domMod } = calcHPMP(sheet);
  const { ca, mv, ar, esc, hach } = calcDefense(sheet);

  const hDie = (p.hp||'1d8').match(/(\d+)d(\d+)/);
  const hN=hDie?+hDie[1]:1, hS=hDie?+hDie[2]:8;
  const mDie = (p.mp||'1d8').match(/(\d+)d(\d+)/);
  const mN=mDie?+mDie[1]:1, mS=mDie?+mDie[2]:8;

  // Compra de pontos (C-08, P-079): custo sobre o valor comprado, sem raça e profissão
  const usedPts = ATTRS.reduce((s,a)=>s+pointBuyCost(PB_BASE,sheet.attrs?.[a]??PB_BASE),0);
  const leftPts = PB_TOTAL-usedPts;
  const ptColor = leftPts<0?'#b83030':leftPts===0?'#3a7a4c':'var(--gold)';

  const curHP = sheet.curHP??0, maxHP = sheet.maxHP||calcMaxHP;
  const curMP = sheet.curMP??0, maxMP = sheet.maxMP||calcMaxMP;
  const hpPct = maxHP>0?curHP/maxHP:0;
  const hpColor = hpPct>0.5?'#4a9a5a':hpPct>0.2?'#c47830':'#b83030';
  const hpDice = sheet.hpDice||[], mpDice = sheet.mpDice||[];
  const legacyRolls = !hpDice.length && (sheet.hpRolls?.length??0)>0;

  function emit(text) { addLog?.(text,'dice'); playSfx?.('dice'); }

  // Atualiza atributos e recalcula HP/MP máximos (mod CON/DOM podem mudar)
  function setAttrs(changes) {
    const next = { ...sheet, ...changes };
    const r = calcHPMP(next);
    const extra = (next.hpDice||[]).length ? { maxHP: r.hp, maxMP: r.mp, curHP: Math.min(next.curHP??0, r.hp), curMP: Math.min(next.curMP??0, r.mp) } : {};
    u({ ...changes, ...extra });
  }
  function adjBuy(a, d) {
    const v = (sheet.attrs?.[a]??PB_BASE)+d;
    if (v < PB_BASE) return;
    if (d>0 && v>PB_MAX) { addLog?.(`Compra até ${PB_MAX}, sem os bônus de raça e de profissão (P-079)`,'system'); return; }
    if (d>0 && finalAttr(sheet,a)+1>ATTR_CAP) { addLog?.(`Valor final acima de ${ATTR_CAP} com raça e profissão (P-079)`,'system'); return; }
    setAttrs({ attrs: { ...(sheet.attrs||{}), [a]: v } });
  }
  function adjUp(a, d) {
    const n = sheet.attrUps?.[a]??0;
    if (d<0) {
      if (n <= attrConfirmed(sheet,a)) { addLog?.(n?`${a}: compra já confirmada, sem reembolso (D-53)`:`${a}: nenhum aumento com PP`,'system'); return; }
      setAttrs({ attrUps: { ...(sheet.attrUps||{}), [a]: n-1 } }); return;
    }
    const v = finalAttr(sheet,a)+1;
    if (v > ATTR_CAP) { addLog?.(`Teto do atributo: ${ATTR_CAP} no valor final, com raça e profissão (D-60)`,'system'); return; }
    const bought = (sheet.attrs?.[a] ?? PB_BASE) + n, c = ppAttrCost(bought); // D-52, D-60: faixa pelo valor comprado antes do +1
    if (ppLeft(sheet) < c) { addLog?.(`PP insuficientes: +1 em ${a} (comprado ${bought}) custa ${c} PP`,'system'); return; }
    setAttrs({ attrUps: { ...(sheet.attrUps||{}), [a]: n+1 } });
  }

  function rollLevelUp() {
    if (hpDice.length >= LV_MAX) return;
    const n = hpDice.length < LV_MIN ? LV_MIN - hpDice.length : 1;
    const hd=[...hpDice], md=[...mpDice], hr=[], mr=[];
    for (let i=0;i<n;i++){ const h=rollDice(hN,hS,0).total, m=rollDice(mN,mS,0).total; hd.push(h); md.push(m); hr.push(h); mr.push(m); }
    const r = calcHPMP({ ...sheet, hpDice: hd, mpDice: md });
    const newLv = hd.length;
    u({ hpDice: hd, mpDice: md, maxHP: r.hp, maxMP: r.mp, curHP: r.hp, curMP: r.mp, ...(newLv>=LV_MIN?{level:newLv}:{}) });
    emit(`🎲 ${n>1?`Criação (nível ${newLv})`:`Nível ${newLv}`}! HP [${hr.join(',')}] ${conMod>=0?'+':''}${conMod}/nível · MP [${mr.join(',')}] ${domMod>=0?'+':''}${domMod}/nível`);
  }
  function undoRoll() {
    const hd=hpDice.slice(0,-1), md=mpDice.slice(0,-1);
    const r = calcHPMP({ ...sheet, hpDice: hd, mpDice: md });
    u({ hpDice: hd, mpDice: md, maxHP: r.hp, maxMP: r.mp, curHP: Math.min(curHP, r.hp), curMP: Math.min(curMP, r.mp) });
  }
  // Fichas antigas: nível 1 = dado máximo; hpRolls/mpRolls com o modificador já somado (MP com INT)
  function migrateRolls() {
    const intMod = amod(finalAttr(sheet,'INT'));
    const cl = (v,mx) => Math.max(1,Math.min(mx,v));
    const hd = [hS, ...(sheet.hpRolls||[]).map(g=>cl(g-conMod,hS))];
    const md = [mS, ...(sheet.mpRolls||[]).map(g=>cl(g-intMod,mS))];
    const r = calcHPMP({ ...sheet, hpDice: hd, mpDice: md });
    u({ hpDice: hd, mpDice: md, maxHP: r.hp, maxMP: r.mp, curHP: r.hp, curMP: r.mp, level: Math.max(LV_MIN, hd.length) });
  }

  // Dados de vida (P-029, D-66, D-71): estoque = nível; até metade do nível (para cima) por descanso curto; cada dado = resultado + mod CON
  const hdLeft = hitDiceLeft(lv, sheet.hdUsed), hdRest = hitDicePerRest(lv);
  function doRest(type) {
    if (type==='short') {
      if ((sheet.shortRests??0) >= 2) { addLog?.('Máximo de 2 descansos curtos entre descansos longos','system'); return; }
      const mx=Math.min(hdLeft,hdRest); let n=0;
      if (mx>0) { const r=window.prompt(`Quantos dados de vida (${p.hp||'1d8'} + mod CON) gastar? 0 a ${mx} (restam ${hdLeft} de ${lv})`, String(mx)); if (r===null) return; n=Math.max(0,Math.min(mx,parseInt(r,10)||0)); }
      const rolls=[]; let cura=0;
      for (let i=0;i<n;i++){ const d=rollDice(1,hS,0).total; rolls.push(d); cura+=hitDieHeal(d,conMod); } // P-091: mín. 1 por dado
      const vest=!!sheet.vestigar; // P-089: Vestigar recupera 75%
      const newMp=curMP+restGain(curMP,maxMP,Math.floor(maxMP*0.5),vest), newHp=curHP+restGain(curHP,maxHP,cura,vest);
      u({curMP:newMp, curHP:newHp, hdUsed:(sheet.hdUsed??0)+n, shortRests:(sheet.shortRests??0)+1, furiaUsada:false});
      addLog?.(`☕ ${sheet.name} descanso curto (${(sheet.shortRests??0)+1}/2)${vest?' em Vestigar (75%)':''}. MP: ${curMP}→${newMp}${n?` · ${n} dado(s) de vida [${rolls.join(',')}] ${conMod>=0?'+':''}${conMod} CON cada (mín. 1): HP ${curHP}→${newHp}`:''}`,'heal');
    } else {
      const vest=!!sheet.vestigar, nh=curHP+restGain(curHP,maxHP,maxHP,vest), nm=curMP+restGain(curMP,maxMP,maxMP,vest);
      u({curHP:nh,curMP:nm,shortRests:0,hdUsed:0,falls:0,furiaUsada:false,adaptUsos:0,tonicoUsado:false,exTreino:Math.max(0,(sheet.exTreino??0)-1)});
      addLog?.(`🛏 ${sheet.name} descanso longo. ${vest?`HP ${nh}/${maxHP} e MP ${nm}/${maxMP} (Vestigar, 75%)`:'HP/MP cheios'}, dados de vida recuperados, Quedas zeradas, −1 Exaustão de Arka.`,'heal');
    }
    playSfx?.('heal');
  }
  function rollReaction(a, nm) {
    const m=amod(finalAttr(sheet,a)), r=rollDice(1,20,m);
    addLog?.(`🛡 ${sheet.name||'Personagem'} — ${nm} (${a}): [${r.rolls[0]}]${m>=0?'+':''}${m} = ${r.total}${nm==='Aparar'&&r.rolls[0]===20?' · 20 natural: vantagem no próximo ataque contra o atacante':''}`,'dice');
    playSfx?.('dice');
  }
  const awakened = awakenedAura(sheet.auras), alUsed = sheet.acaoLend ?? 0;

  return (
    <div>
      {/* Point buy indicator */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:10,flexWrap:'wrap',padding:'7px 14px',borderRadius:5,marginBottom:6, background:leftPts<0?'rgba(184,48,48,.06)':'rgba(201,169,110,.04)', border:`1px solid ${leftPts<0?'rgba(184,48,48,.2)':'rgba(201,169,110,.15)'}` }}>
        <span style={{fontSize:11,color:'var(--sub)'}}>Pontos:</span>
        <span style={{fontSize:22,fontWeight:700,fontFamily:"'Cinzel',serif",color:ptColor}}>{leftPts}</span>
        <span style={{fontSize:10,color:'var(--sub)'}}>/ {PB_TOTAL} · base {PB_BASE}, máx. {PB_MAX}, acima de {PB_DOUBLE} custa 2</span>
      </div>
      <PPBar sheet={sheet} onUpdate={u} isReadOnly={isReadOnly}/>
      <div style={{fontSize:10,color:'var(--sub)',textAlign:'center',marginBottom:10}}>Compra (−/+ de cima): só na criação, de 8 a 18 <b>sem bônus</b>; depois somam-se raça e profissão, e o valor final vai de 5 a 20 (P-079). Depois, +1 atributo com PP (−/+ de baixo): <b>1 PP</b> até o valor comprado 18 e <b>2 PP</b> de 19 para 20, pela faixa do valor <b>comprado antes do +1</b>, sem raça e profissão (R13-1; FOR comprada 16, 18 com bônus, paga 1 PP); teto 20 no valor final, com raça e profissão (D-60). Uma compra com PP só pode ser desfeita antes de confirmada (D-53).</div>

      {/* Attribute boxes */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:12 }}>
        {ATTRS.map(a => {
          const base=sheet.attrs?.[a]??PB_BASE, fin=finalAttr(sheet,a), mod=amod(fin);
          const pm=p.m?.[a]??0, rm=raceBonus(sheet,a), ups=sheet.attrUps?.[a]??0;
          return (
            <div key={a} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:5,padding:'6px 3px',textAlign:'center'}}>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:'var(--gold)',fontWeight:700,letterSpacing:'.12em',marginBottom:3}}>{a}</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:2}}>
                {!isReadOnly&&<button style={NB} onClick={()=>adjBuy(a,-1)}>−</button>}
                <span style={{minWidth:20,textAlign:'center',fontWeight:700,fontSize:13}}>{base}</span>
                {!isReadOnly&&<button style={NB} onClick={()=>adjBuy(a,1)}>+</button>}
              </div>
              {(pm!==0||rm!==0)&&<div style={{fontSize:7,color:'var(--sub)',marginTop:2}}>{pm!==0&&<span style={{color:pm>0?'#3a7a4c':'#b83030'}}>P{pm>0?'+':''}{pm}</span>}{rm!==0&&<span style={{color:'#3a7a4c',marginLeft:2}}>R+{rm}</span>}</div>}
              <div style={{fontSize:17,fontWeight:700,fontFamily:"'Cinzel',serif",marginTop:2,color:fin>ATTR_CAP?'#b83030':undefined}} title={fin>ATTR_CAP?'Acima de 20: o valor final não passa de 20 (P-079)':undefined}>{fin}</div>
              <div style={{fontSize:9,color:mod>=0?'#3a7a4c':'#b83030'}}>mod {mod>=0?'+':''}{mod}</div>
              <div style={{fontSize:7,color:'var(--sub)'}}>custo {pointBuyCost(PB_BASE,base)}</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:2,marginTop:3,fontSize:8,color:'var(--sub)'}}>
                PP{!isReadOnly&&<button style={{...NB,width:15,height:15,fontSize:9}} onClick={()=>adjUp(a,-1)}>−</button>}
                <span style={{color:'var(--gold)',fontWeight:700}}>+{ups}</span>
                {!isReadOnly&&<button style={{...NB,width:15,height:15,fontSize:9}} onClick={()=>adjUp(a,1)}>+</button>}
              </div>
              <div style={{fontSize:7,color:'var(--sub)'}}>próx. {ppAttrCost(base+ups)} PP</div>
            </div>
          );
        })}
      </div>

      {/* Derived stats */}
      <St>Derivados</St>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
        <Sb label="HP Máx." value={calcMaxHP} sub={`${hpDice.length}×(${p.hp||'1d8'}${conMod>=0?'+':''}${conMod})${calcHPMP(sheet).crn?` +${calcHPMP(sheet).crn} Corpo Renovado`:''}`} color="#b83030"/>
        <Sb label="MP Máx." value={calcMaxMP} sub={`${mpDice.length}×(${p.mp||'1d8'}${domMod>=0?'+':''}${domMod} DOM)`} color="#3a6aaa"/>
        <Sb label="CA" value={ca} sub={`${ar.t==='P'?'pesada':ar.t==='M'?`${ar.ca}+DEX(máx 2)`:`${ar.ca}+DEX`}${sheet.shield?'+2':''}${esc?'+2 escamas':''}`}/>
        <Sb label="Movimento" value={`${mv}m`} sub={`${sheet.race||'Humano'}${ar.mv?` ${ar.mv} m armadura`:''}${hach?` +${hach} Hachiman`:''}`} color="#3a7a4c"/>
        <Sb label="Iniciativa" value={`3d8${mstr(dexFin)}`} sub="3d8+mod DEX"/>
        <Sb label="Proficiência" value={`+${prof}`} sub={`nível ${lv}`}/>
      </div>
      {(()=>{ const w=armorWithoutProf(profKey(sheet), p, ar.n, sheet.shield); return w ? <div style={{fontSize:10,color:'#b83030',marginBottom:6}}>Sem proficiência em {w}: desvantagem nos ataques (inclusive de Arka) e nos testes de FOR e DEX (P-049).</div> : null; })()}
      {scalesAvailable(sheet.auras)&&<label style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'var(--sub)',marginBottom:6}}><input type="checkbox" checked={!!sheet.escamas} disabled={isReadOnly} onChange={e=>u({escamas:e.target.checked})}/>Escamas ativas (Animalesca 2: +2 de CA; desligue na Forma de Besta Lendária) (P-095)</label>}
      {(()=>{ const l=sheetReminders(sheet); return l.length ? <div style={{fontSize:10,color:'var(--sub)',lineHeight:1.5,marginBottom:6}}><b style={{color:'var(--gold)'}}>Lembretes</b> (P-095, não entram nos números): {l.join(' · ')}</div> : null; })()}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:12}}>
        <span style={{fontSize:10,color:'var(--sub)'}}>Armadura</span>
        <select className="vtt-select" value={ar.n} disabled={isReadOnly} onChange={e=>u({armor:e.target.value})} style={{width:220}}>
          {ARMORS.map(a=><option key={a.n} value={a.n}>{a.n} ({a.t==='P'?`CA ${a.ca}`:a.t==='M'?`CA ${a.ca}+DEX máx. 2`:`CA ${a.ca}+DEX`})</option>)}
        </select>
        <label style={{display:'flex',alignItems:'center',gap:4,fontSize:11}}><input type="checkbox" checked={!!sheet.shield} disabled={isReadOnly} onChange={e=>u({shield:e.target.checked})}/>Escudo (+2)</label>
      </div>

      {/* HP/MP */}
      <St>Vida & Mana</St>
      <div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:10}}>
        {[{lbl:'HP',cur:curHP,max:maxHP,color:hpColor,cf:'curHP',mf:'maxHP'},{lbl:'MP',cur:curMP,max:maxMP,color:'#3a6aaa',cf:'curMP',mf:'maxMP'}].map(({lbl,cur,max,color,cf,mf})=>(
          <div key={lbl} style={{flex:1,minWidth:160}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
              <span style={{fontFamily:"'Cinzel',serif",fontSize:9,color,letterSpacing:'.1em'}}>{lbl}</span>
              <div style={{display:'flex',alignItems:'center',gap:4}}>
                <button style={NB} onClick={()=>u({[cf]:Math.max(0,cur-1)})}>−</button>
                <span style={{fontWeight:700,fontFamily:"'Cinzel',serif",color,minWidth:30,textAlign:'center'}}>{cur}</span>
                <span style={{color:'var(--sub)',fontSize:10}}>/</span>
                <span style={{fontFamily:"'Cinzel',serif",color:'var(--sub)',fontSize:11}}>{max}</span>
                <button style={NB} onClick={()=>u({[cf]:Math.min(max,cur+1)})}>+</button>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <Bar value={cur} max={max} color={color}/>
              {!isReadOnly&&<input type="number" className="vtt-input" min={1} value={max} onChange={e=>u({[mf]:Math.max(1,parseInt(e.target.value,10)||1)})} style={{width:52,textAlign:'center',fontSize:11}} title={`Máx ${lbl}`}/>}
            </div>
          </div>
        ))}
      </div>

      {/* Level up rolls */}
      <St>Rolagens de HP e MP</St>
      <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:5,padding:'10px 12px',marginBottom:10}}>
        <div style={{fontSize:11,color:'var(--sub)',marginBottom:6}}>Criação (nível 3): role 3 vezes o dado de HP e o de MP. A cada nível seguinte, role mais 1 vez. Cada nível rende dado + mod CON (HP) e dado + mod DOM (MP), com mínimo de 1 por nível.</div>
        {!isReadOnly&&(
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
            <RBtn onClick={rollLevelUp}>{hpDice.length<LV_MIN?'🎲 Rolar criação (nível 3)':hpDice.length>=LV_MAX?'Nível máximo':`🎲 Rolar nível ${hpDice.length+1}`}</RBtn>
            <RBtn onClick={undoRoll}>↩ Desfazer</RBtn>
            <RBtn onClick={()=>u({hpDice:[],mpDice:[],hpRolls:[],mpRolls:[]})}>Resetar</RBtn>
            {legacyRolls&&<RBtn onClick={migrateRolls} title="Converte as rolagens do formato antigo (nível 1 = dado máximo, MP com INT)">Converter rolagens antigas</RBtn>}
          </div>
        )}
        {hpDice.length>0?(
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {hpDice.map((v,i)=>(
              <div key={i} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:4,padding:'3px 7px',fontSize:10,textAlign:'center'}}>
                <div style={{fontSize:8,color:'var(--sub)'}}>Nv.{i+1}</div>
                <span style={{color:'#b83030',fontWeight:700}}>+{Math.max(1,v+conMod)}</span><span style={{color:'var(--sub)'}}> / </span><span style={{color:'#3a6aaa',fontWeight:700}}>+{Math.max(1,(mpDice[i]??0)+domMod)}</span>
              </div>
            ))}
          </div>
        ):(
          <div style={{fontSize:10,color:'var(--sub)',fontStyle:'italic'}}>Nenhuma rolagem. Role a criação: 3 rolagens de HP e de MP (nível 3).</div>
        )}
      </div>

      {/* Combat stats (VTT token) */}
      <St>Combate (token)</St>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:6}}>
        {[['CA','ac',10],['Movimento (m)','movement',9]].map(([lbl,f,def])=>(
          <div key={f}><Lb>{lbl}</Lb><input className="vtt-input" type="number" min={0} value={sheet[f]??def} readOnly={isReadOnly} onChange={e=>u({[f]:Math.max(0,parseInt(e.target.value,10)||0)})} style={{textAlign:'center'}}/></div>
        ))}
      </div>
      {!isReadOnly&&<div style={{marginBottom:8}}><RBtn onClick={()=>u({ac:ca,movement:mv,profBonus:prof})}>Usar valores calculados (CA {ca}, {mv} m, prof. +{prof})</RBtn></div>}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:targetToken?4:10}}>
        <span style={{fontSize:11,color:'var(--sub)',width:80}}>Iniciativa</span>
        <span style={{color:'var(--gold)',fontWeight:700}}>3d8{mstr(dexFin)}</span>
        <RBtn onClick={()=>{const r=rollDice(3,8,dexMod);emit(`⚡ ${sheet.name||'Personagem'} iniciativa: [${r.rolls.join('+')}]${mstr(dexFin)} = ${r.total}`);}}>Rolar</RBtn>
      </div>
      {targetToken&&<div style={{fontSize:10,color:'var(--sub)',marginBottom:10}}>Alvo: <span style={{color:'var(--gold)'}}>{targetToken.name}</span> (CA {targetToken.ac})</div>}

      {/* Falls */}
      <St>Quedas</St>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4,flexWrap:'wrap'}}>
        <Nc value={sheet.falls??0} color="#b83030" onDec={()=>u({falls:Math.max(0,(sheet.falls??0)-1)})} onInc={()=>u({falls:Math.min(4,(sheet.falls??0)+1)})}/>
        <span style={{fontSize:10,color:'var(--sub)'}}>/4</span>
        <RBtn onClick={()=>u({falls:0})}>Reset</RBtn>
        <RBtn onClick={()=>{const cf=finalAttr(sheet,'CON');const r=rollDice(1,20,amod(cf));const d=r.rolls[0];emit(`💀 ${sheet.name||'Personagem'} teste contra a morte: [${d}]${mstr(cf)} = ${r.total} (CD 10) ${d===20?'— 20 natural: levanta com 1 HP':d===1?'— 1 natural: 2 falhas':r.total>=10?'— sucesso':'— falha'}`);}}>Teste contra a morte</RBtn>
      </div>
      <div style={{fontSize:10,color:(sheet.falls??0)>=4?'#b83030':'var(--sub)',marginBottom:10}}>
        {(sheet.falls??0)>=4?'4ª Queda: o personagem morre.':'Cair a 0 HP marca 1 Queda. Na 4ª Queda o personagem morre. Teste contra a morte: 1d20 + mod CON, CD 10. Medicina (SAB) CD 10 estabiliza com 1 HP. As Quedas zeram no descanso longo. Opcional: sobredano de 75% do HP máximo = morte (D-27).'}
      </div>

      {/* Rest */}
      <St>Descanso</St>
      <div style={{fontSize:10,color:'var(--sub)',marginBottom:6}}>Curto (10 min): +50% do MP máximo e gasto de dados de vida: estoque = nível; até metade do nível (para cima) por descanso curto, cada dado = resultado + mod CON, no mínimo 1 HP por dado (P-029, D-71, P-091). No máximo 2 entre descansos longos ({sheet.shortRests??0}/2). Dados de vida: {hdLeft}/{lv} (até {hdRest} por descanso curto). Longo (8 h): 100% de HP e MP, devolve os dados de vida, −1 Exaustão de Arka, zera as Quedas e os descansos curtos.</div>
      <div style={{display:'flex',gap:8}}>
        {[['☕ Descanso Curto','short','Recupera 50% do MP máximo (10 min)'],['🛏 Descanso Longo','long','Recupera 100% HP e MP (8h)']].map(([lbl,type,title])=>(
          <button key={type} className="tbtn" disabled={!!combatActive} title={combatActive?'Indisponível em combate':title}
            onClick={()=>window.confirm(`${title}. Confirmar?`)&&doRest(type)}
            style={{flex:1,fontSize:11,opacity:combatActive?0.4:1}}>{lbl}</button>
        ))}
      </div>
      <label style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'var(--sub)',marginTop:4}} title="P-089: em Vestigar, os descansos recuperam só 75% do HP e do MP que recuperariam (arredondado para baixo); dados de vida, Exaustão e Quedas seguem normais"><input type="checkbox" checked={!!sheet.vestigar} disabled={isReadOnly} onChange={e=>u({vestigar:e.target.checked})}/>Em Vestigar (descansos a 75%)</label>

      {/* Reações e combate (cap. 13; R10-3, D-78, P-030, D-68, R11-2) */}
      <St>Reações e Combate</St>
      <div style={{fontSize:11,color:'var(--sub)',lineHeight:1.5}}>
        <div style={{marginBottom:4}}>Uma reação por rodada: Proteger, ataque de oportunidade, Esquiva, Aparar e Contra-Ataque disputam a mesma. Esquiva, Aparar e Contra-Ataque valem só contra ataques com arma; contra técnicas, use o Proteger.</div>
        <div><b style={{color:'var(--text)'}}>Esquiva</b> (reação): contra ataque com arma que acertou, antes do dano: 1d20 + mod DEX contra o total do ataque; igualou ou superou, não sofre dano. <RBtn onClick={()=>rollReaction('DEX','Esquiva')}>1d20</RBtn></div>
        <div><b style={{color:'var(--text)'}}>Aparar</b> (reação): só contra corpo a corpo, empunhando arma corpo a corpo: 1d20 + mod FOR contra o total do ataque; 20 natural = vantagem no próximo ataque contra o atacante. <RBtn onClick={()=>rollReaction('FOR','Aparar')}>1d20</RBtn></div>
        <div><b style={{color:'var(--text)'}}>Contra-Ataque</b> (reação): acertado em corpo a corpo, empunhando arma corpo a corpo, recebe o dano inteiro e faz 1 ataque com arma contra o atacante, com desvantagem.</div>
        <div><b style={{color:'var(--text)'}}>Ataque de oportunidade</b> (reação, P-067): quando uma criatura hostil que você vê sai do seu alcance corpo a corpo sem Desengajar, 1 ataque com arma corpo a corpo contra ela.</div>
        <div><b style={{color:'var(--text)'}}>Desengajar</b> (ação): afasta-se sem provocar ataque de oportunidade. <b style={{color:'var(--text)'}}>Flanquear</b>: vantagem no corpo a corpo com aliado do lado oposto do alvo, a até 1,5 m.</div>
        <div><b style={{color:'var(--text)'}}>Agarrar</b> (ação, P-074): Atletismo contra Atletismo ou Acrobacia do alvo; com sucesso, ele fica Agarrado (movimento 0). Termina se você ficar Incapacitado ou se o alvo for afastado do seu alcance; para escapar, o agarrado gasta a Ação e repete o teste.</div>
        <div><b style={{color:'var(--text)'}}>Ataque desarmado</b> (P-075): {1+amod(finalAttr(sheet,'FOR'))} (1 {amod(finalAttr(sheet,'FOR'))>=0?'+':'−'} {Math.abs(amod(finalAttr(sheet,'FOR')))} FOR) de concussão; todos são proficientes.</div>
        <div><b style={{color:'var(--text)'}}>Meditação</b> (P-071): custa a Ação e a Ação Bônus do turno (pode se mover); recupera 2d8 + mod DOM de MP; requer 1 turno sem receber dano. {!isReadOnly&&<RBtn onClick={()=>{const r=rollDice(2,8,domMod),g=Math.max(0,r.total),nm=Math.min(maxMP,curMP+g);u({curMP:nm});emit(`🧘 ${sheet.name||'Personagem'} medita: [${r.rolls.join('+')}]${domMod>=0?'+':''}${domMod} DOM = +${g} MP (Ação + Ação Bônus)`);}}>Meditar</RBtn>} <b style={{color:'var(--text)'}}>Regeneração passiva:</b> no início de cada turno, mod INT de MP (mínimo 1).</div>
        <div style={{marginTop:4}}><b style={{color:'var(--text)'}}>Armas</b> (P-069): <b>Acuidade</b> FOR ou DEX no ataque e no dano · <b>Versátil</b> dado entre parênteses com as duas mãos · <b>Arremesso</b> ataque à distância com o atributo do corpo a corpo · <b>Pesado</b> exige FOR 13 (abaixo, desvantagem) · <b>Duas mãos</b> · <b>Alcance 3 m</b> corpo a corpo até 3 m · <b>Recarga</b> 1 disparo por Ação · <b>Leve</b> com uma leve em cada mão, depois de atacar com a Ação, ataca com a outra como Ação Bônus, sem somar o modificador ao dano. <b style={{color:'var(--text)'}}>Alcance com dois números</b> (ex.: 12/36 m, E15-01): até o 1º, normal; entre os dois, desvantagem; além do 2º, impossível.</div>
        {sheet.race==='Demônio'&&<div style={{marginTop:4}}><b style={{color:'#c43030'}}>Fúria Ancestral</b> (R13-5): 1×/descanso curto, ação bônus, 3 rodadas; o primeiro acerto em cada turno, com arma ou técnica, causa +1d6 de dano a um alvo, do mesmo tipo do ataque. {sheet.furiaUsada?<span style={{color:'#b83030'}}>Usada — volta no descanso curto ou longo.</span>:!isReadOnly&&<RBtn onClick={()=>{u({furiaUsada:true});addLog?.(`🔥 ${sheet.name||'Personagem'} desperta a Fúria Ancestral (3 rodadas)`,'system');}}>Despertar a fúria</RBtn>} <RBtn onClick={()=>{const r=rollDice(1,6,0);emit(`🔥 Fúria Ancestral: +${r.total} de dano (1d6)`);}}>+1d6</RBtn></div>}
        {sheet.race==='Humano'&&<div style={{marginTop:4}}><b style={{color:'#c9a96e'}}>Adaptação</b> (P-083): 2×/dia, rerrola um teste de atributo, de perícia ou de resistência (não ataques nem treino) e fica com o novo resultado. Usos: <b style={{color:'var(--text)'}}>{sheet.adaptUsos??0}/2</b> {!isReadOnly&&<RBtn onClick={()=>{ if((sheet.adaptUsos??0)>=2){addLog?.('Adaptação: 2 usos por dia','system');return;} u({adaptUsos:(sheet.adaptUsos??0)+1}); }}>Usar</RBtn>} <span style={{opacity:.7}}>(zera no descanso longo)</span></div>}
        {sheet.race==='Anjo'&&<div style={{marginTop:4}}><b style={{color:'#f0e68c'}}>Planagem</b> (P-084): se puder abrir as asas, não sofre dano de queda e avança 1 m na horizontal a cada 1 m de queda; não ganha altura.</div>}
        <div style={{marginTop:4}}><b style={{color:'var(--text)'}}>Cobertura</b> (D-78): meia +2 de CA; três quartos +5; total = não pode ser alvo direto. <b style={{color:'var(--text)'}}>Dificuldades</b> (P-030): fácil 10 · média 14 · difícil 18 · muito difícil 22. <b style={{color:'var(--text)'}}>Rodada</b> = 6 s.</div>
        <div style={{marginTop:6}}>
          {awakened ? (<>
            <b style={{color:'#f4d03f'}}>✦ Ação Lendária</b> ({awakened.n} desperta): 1 por rodada, no fim do turno de outra criatura; 1 ataque ou 1 Projetar Básico (até 12 MP, pago normalmente); não gasta a reação. Usadas neste combate: <b style={{color:'var(--text)'}}>{alUsed}/{LEGENDARY_MAX}</b>
            {!isReadOnly&&<> <RBtn onClick={()=>{ if(alUsed>=LEGENDARY_MAX){addLog?.(`Máximo de ${LEGENDARY_MAX} Ações Lendárias por combate (R11-2)`,'system');return;} u({acaoLend:alUsed+1}); }}>Usar</RBtn> <RBtn onClick={()=>u({acaoLend:0})}>Novo combate</RBtn></>}
          </>) : <><b style={{color:'var(--text)'}}>Ação Lendária</b>: só para quem fez o Despertar Divino (1 por rodada, máx. 2 por combate).</>}
        </div>
      </div>
    </div>
  );
}

// ── PericiasTab ───────────────────────────────────────────────────────────────
function PericiasTab({ sheet, onUpdate, isReadOnly, addLog, playSfx }) {
  const u = onUpdate;
  const profs = (sheet.proficiencies||[]).map(n => SKILL_RENAMES[n] || n);
  const sh = { ...sheet, prof: profKey(sheet), proficiencies: profs };
  const P = getProf(sheet), lista = P.per || [];
  const PK = profKey(sheet)==='custom' ? PROFESSIONS_DATA[P.pac] : P; // pacote de armaduras/armas (profissão montada: P-094)
  const custom = sheet.customProfs||[];
  const tools = sheet.toolProfs||['',''];
  const pb = profBonus(sheetLevel(sheet));
  const [form,setForm] = useState({n:'',a:'DEX'});

  function toggle(name) {
    if(isReadOnly)return;
    u({proficiencies:profs.includes(name)?profs.filter(x=>x!==name):[...profs,name]});
  }
  function rollSkill(name,attr) {
    const mu=skillProfMult(sh,name);
    const fin=finalAttr(sheet,attr), mod=amod(fin)+mu*pb;
    const r=rollDice(1,20,mod);
    addLog?.(`🎯 ${sheet.name||'Personagem'} — ${name} (${attr}${mu?`+${mu*pb}`:''}): [${r.rolls[0]}]${mod>=0?'+':''}${mod} = ${r.total}`,'dice');
    playSfx?.('dice');
  }
  // Testes de resistência (P-030, R10-5): d20 + mod + prof se proficiente; Anão +2 em CON
  function saveVal(a) { return saveBonus(P, sheet.race, a, amod(finalAttr(sheet,a)), pb); }
  function rollSave(a) {
    const m=saveVal(a), r=rollDice(1,20,m);
    addLog?.(`🛡 ${sheet.name||'Personagem'} — resistência de ${a}: [${r.rolls[0]}]${m>=0?'+':''}${m} = ${r.total}`,'dice');
    playSfx?.('dice');
  }
  function toggleCustomSave(a) {
    if(isReadOnly||profKey(sheet)!=='custom')return;
    const cur=sheet.customProf?.res||[];
    if(!cur.includes(a)&&cur.length>=2){ addLog?.('Cada profissão é proficiente em 2 testes de resistência, de atributos diferentes','system'); return; }
    u({customProf:{...(sheet.customProf||{}),res:cur.includes(a)?cur.filter(x=>x!==a):[...cur,a]}});
  }
  function addCustom() {
    if(!form.n.trim())return;
    u({customProfs:[...custom,{n:form.n.trim(),a:form.a}]});
    setForm({n:'',a:'DEX'});
  }

  const allSkills=[...SKILLS,...custom.map(p=>({n:p.n,a:p.a}))];
  const marked=SKILLS.filter(s=>profs.includes(s.n)).length;
  const fromList=SKILLS.filter(s=>profs.includes(s.n)&&lista.includes(s.n)).length;
  const isDipl=profKey(sheet)==='Diplomata', isExpl=profKey(sheet)==='Explorador';

  return (
    <div>
      <St>Testes de Resistência</St>
      <div style={{fontSize:11,color:'var(--sub)',marginBottom:6}}>1d20 + mod do atributo + proficiência, se proficiente. Cada profissão é proficiente em 2 (R10-5); Anão: +2 em CON. Veneno e doença: CON; explosões e armadilhas: DEX; empurrões e agarrões: FOR; medo e efeitos mentais: SAB (Vontade fica para fora de combate, D-83).{profKey(sheet)==='custom'&&' Profissão montada: clique para marcar.'}</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:4}}>
        {ATTRS.map(a=>{ const on=saveProficient(P,a), v=saveVal(a); return (
          <div key={a} onClick={()=>toggleCustomSave(a)} style={{background:'var(--card)',border:`1px solid ${on?'var(--gold-dim)':'var(--border)'}`,borderRadius:5,padding:'4px 8px',textAlign:'center',minWidth:58,cursor:profKey(sheet)==='custom'&&!isReadOnly?'pointer':'default'}}>
            <div style={{fontSize:8,color:'var(--sub)',fontFamily:"'Cinzel',serif",letterSpacing:'.1em'}}>{a}{on?' ●':''}</div>
            <div style={{fontSize:15,fontWeight:700,fontFamily:"'Cinzel',serif",color:v>=0?'#3a7a4c':'#b83030'}}>{v>=0?'+':''}{v}</div>
            <RBtn onClick={e=>{e.stopPropagation();rollSave(a);}} style={{fontSize:8,padding:'0 5px'}}>1d20</RBtn>
          </div>); })}
      </div>
      <St>Perícias</St>
      <div style={{fontSize:11,color:'var(--sub)',marginBottom:6}}>Clique no círculo para marcar proficiência. Bônus = mod do atributo + proficiência (+2 nv 3–6, +3 nv 7–10, +4 nv 11–14, +5 nv 15). ◆ = perícia da lista da profissão.</div>
      <div style={{fontSize:11,color:'var(--sub)',marginBottom:10}}><b style={{color:'var(--text)'}}>Na criação:</b> 4 perícias da lista da profissão + 2 livres, de qualquer atributo (P-060). Marcadas: <b style={{color:marked>SKILLS_AT_CREATION?'#b83030':'var(--gold)'}}>{marked}/{SKILLS_AT_CREATION}</b>{lista.length>0&&<> · da lista da profissão: <b style={{color:marked>=SKILLS_AT_CREATION&&fromList<SKILLS_FROM_PROF?'#b83030':'var(--gold)'}}>{fromList}</b> (mín. {SKILLS_FROM_PROF})</>}</div>
      {isDipl&&(
        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',fontSize:11,marginBottom:8}}>
          <span style={{color:'var(--gold)'}}>Especialista (Diplomata):</span><span style={{color:'var(--sub)'}}>Persuasão e</span>
          <select className="vtt-select" value={sheet.especialista||''} disabled={isReadOnly} onChange={e=>u({especialista:e.target.value})} style={{width:190}}>
            <option value="">— 1 perícia da lista —</option>
            {lista.filter(n=>n!=='Persuasão').map(n=><option key={n} value={n}>{n}</option>)}
          </select>
          <span style={{color:'var(--sub)',fontSize:10}}>proficiência dobrada (precisa ser proficiente)</span>
        </div>
      )}
      {allSkills.map((sk,i)=>{
        const isC=i>=SKILLS.length, on=skillProficient(sh,sk.n), mu=skillProfMult(sh,sk.n);
        const fin=finalAttr(sheet,sk.a), mod=amod(fin), total=mod+mu*pb;
        // Olho de Falcão (Explorador, D-77): proficiência dobrada em Percepção fora de combate
        const falcao = isExpl && sk.n==='Percepção' && on;
        const head = !isC && (i===0 || SKILLS[i-1].a!==sk.a);
        return (
          <div key={sk.n}>
            {head&&<div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:'var(--gold)',letterSpacing:'.1em',margin:'6px 0 2px'}}>{(ATTR_FULL[sk.a]||sk.a).toUpperCase()}</div>}
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 6px',borderRadius:4}}>
              <div onClick={()=>toggle(sk.n)} style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${on?'var(--gold)':'var(--border)'}`,background:on?'var(--gold)':'transparent',cursor:isReadOnly?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'.2s'}}>
                {on&&<span style={{fontSize:9,color:'var(--bg)',fontWeight:700}}>✓</span>}
              </div>
              <span style={{fontSize:12,flex:1}}>{!isC&&lista.includes(sk.n)&&<span style={{color:'var(--gold)',fontSize:9}}>◆ </span>}{sk.n}{mu===2&&<span style={{fontSize:9,color:'var(--gold)'}}> ×2</span>}{on&&!profs.includes(sk.n)&&<span style={{fontSize:9,color:'var(--gold)'}}> (Especialista)</span>}{falcao&&<span style={{fontSize:9,color:'var(--gold)'}} title="Olho de Falcão"> fora de combate: {total+pb>=0?'+':''}{total+pb}</span>}{isC&&<span style={{fontSize:9,color:'var(--sub)',marginLeft:4}}>(custom)</span>}</span>
              <span style={{fontSize:9,color:'var(--sub)',fontFamily:"'Cinzel',serif",width:28,textAlign:'center'}}>{sk.a}</span>
              <span style={{fontSize:13,fontWeight:700,fontFamily:"'Cinzel',serif",width:28,textAlign:'center',color:total>=0?'#3a7a4c':'#b83030'}}>{total>=0?'+':''}{total}</span>
              <RBtn onClick={()=>rollSkill(sk.n,sk.a)}>1d20</RBtn>
              {isC&&!isReadOnly&&<button onClick={()=>{const nm=custom[i-SKILLS.length].n;u({customProfs:custom.filter((_,j)=>j!==i-SKILLS.length),proficiencies:profs.filter(x=>x!==nm)});}} style={{background:'none',border:'none',color:'var(--sub)',cursor:'pointer',fontSize:12}}>✕</button>}
            </div>
          </div>
        );
      })}
      {!isReadOnly&&(
        <div style={{display:'flex',gap:6,alignItems:'flex-end',marginTop:10}}>
          <input className="vtt-input" placeholder="Nova perícia..." value={form.n} onChange={e=>setForm(f=>({...f,n:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addCustom()} style={{flex:1}}/>
          <select className="vtt-select" value={form.a} onChange={e=>setForm(f=>({...f,a:e.target.value}))} style={{width:70}}>
            {ATTRS.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <RBtn onClick={addCustom}>+ Add</RBtn>
        </div>
      )}

      <St>Proficiências de Arma ou Ferramenta</St>
      <div style={{fontSize:11,color:'var(--sub)',marginBottom:6}}>{PK?.armas&&<><b style={{color:'var(--text)'}}>Da profissão:</b> armas {PK.armas.toLowerCase()}; armaduras {PK.arm.map(t=>ARMOR_CAT[t]).join(', ')}{PK.esc?' e escudo':''} (P-049). </>}Mais {FREE_TOOL_PROFS} livres de arma ou ferramenta, nunca categoria de armadura (D-45). Arma sem proficiência: não soma a proficiência ao ataque. Armadura sem proficiência: desvantagem nos ataques (inclusive de Arka) e nos testes de FOR e DEX.<br/><b style={{color:'var(--text)'}}>Ferramentas</b> (P-080): {TOOLS.join(', ')}. Proficiente na ferramenta: soma a proficiência ao teste feito com ela. Perícia e ferramenta do mesmo teste: vantagem, sem somar a proficiência duas vezes.</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {Array.from({length:FREE_TOOL_PROFS},(_,i)=>(
          <input key={i} className="vtt-input" list="vtt-tools" style={{flex:1,minWidth:140}} placeholder={`Arma ou ferramenta ${i+1}...`} readOnly={isReadOnly} value={tools[i]||''} onChange={e=>{const t=[...tools];t[i]=e.target.value;u({toolProfs:t});}}/>
        ))}
        <datalist id="vtt-tools">{TOOLS.map(t=><option key={t} value={t}/>)}</datalist>
      </div>
    </div>
  );
}

// ── InventarioTab ─────────────────────────────────────────────────────────────
function InventarioTab({ sheet, onUpdate, isReadOnly }) {
  const u = onUpdate;
  const inventory = sheet.inventory||[];
  const [filter,setFilter] = useState('all');
  const [form,setForm] = useState({n:'',w:0.5,s:'carried',no:''});

  const forFin=finalAttr(sheet,'FOR'), capacity=forFin*7;
  const carried=inventory.filter(i=>i.s!=='stored').reduce((s,i)=>s+(parseFloat(i.w)||0),0);
  const pct=capacity>0?Math.min(1,carried/capacity):0;
  const barColor=pct>1?'#b83030':pct>0.75?'#c9a96e':'#3a7a4c';
  const note=pct>1?'⚠ Sobrecarga!':pct>0.75?'⚠ Pesada: −4m, desvantagem':pct>0.5?'Leve: −2m':`FOR(${forFin})×7 = ${capacity}kg`;

  const SL={equipped:'⚔ Equipado',carried:'🎒 Carregando',stored:'📦 Guardado'};
  const SC={equipped:'var(--gold)',carried:'var(--border)',stored:'var(--sub)'};
  const filtered=filter==='all'?inventory:inventory.filter(i=>i.s===filter);

  function addItem(){
    if(!form.n.trim())return;
    u({inventory:[...inventory,{id:uid(),...form,n:form.n.trim()}]});
    setForm({n:'',w:0.5,s:'carried',no:''});
  }

  return (
    <div>
      <St>Capacidade de Carga</St>
      <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:12}}>
        <Sb label="Peso" value={carried.toFixed(1)} sub="kg"/>
        <div style={{flex:1,minWidth:140}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--sub)',marginBottom:3}}><span>Carga</span><span>{carried.toFixed(1)}/{capacity} kg</span></div>
          <div style={{height:8,background:'var(--bg)',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${pct*100}%`,background:barColor,borderRadius:4,transition:'width .3s'}}/></div>
          <div style={{fontSize:9,color:barColor,marginTop:2}}>{note}</div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
        {[['copper','FC (Fagulha de Cobre)','#b87333'],['silver','LP (Lâmina de Prata)','#aaa'],['gold','CO (Coroa de Ouro)','#c9a96e']].map(([key,lbl,color])=>(
          <div key={key} style={{textAlign:'center'}}><Lb><span style={{color}}>{lbl}</span></Lb><input className="vtt-input" type="number" min={0} value={sheet[key]??0} readOnly={isReadOnly} onChange={e=>u({[key]:Math.max(0,parseInt(e.target.value,10)||0)})} style={{textAlign:'center',fontWeight:700}}/></div>
        ))}
      </div>

      <St>Itens <span style={{color:'var(--sub)',fontWeight:400}}>({inventory.length})</span></St>
      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
        {[['all','Todos'],['equipped','⚔ Equip'],['carried','🎒 Carreg'],['stored','📦 Guard']].map(([f,lbl])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{padding:'4px 10px',borderRadius:16,fontSize:11,cursor:'pointer',border:`1px solid ${filter===f?'var(--gold-dim)':'var(--border)'}`,background:filter===f?'rgba(201,169,110,.1)':'transparent',color:filter===f?'var(--gold)':'var(--sub)',fontFamily:'inherit'}}>{lbl}</button>
        ))}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:5}}>
        {!filtered.length&&<div style={{textAlign:'center',padding:20,color:'var(--sub)',fontStyle:'italic',fontSize:11}}>{inventory.length?'Nenhum neste filtro':'Vazio'}</div>}
        {filtered.map(item=>(
          <div key={item.id} style={{display:'flex',alignItems:'center',gap:7,padding:'7px 9px',background:'var(--card)',border:`1px solid var(--border)`,borderLeft:`3px solid ${SC[item.s]||'var(--border)'}`,borderRadius:5}}>
            <button onClick={()=>!isReadOnly&&u({inventory:inventory.map(i=>i.id===item.id?{...i,s:{equipped:'carried',carried:'stored',stored:'equipped'}[i.s]||'carried'}:i)})} style={{fontSize:8,padding:'2px 7px',borderRadius:10,fontFamily:"'Cinzel',serif",fontWeight:600,cursor:isReadOnly?'default':'pointer',border:'1px solid var(--border)',background:'rgba(201,169,110,.08)',color:'var(--sub)',textTransform:'uppercase',whiteSpace:'nowrap'}}>{SL[item.s]||item.s}</button>
            <div style={{flex:1,minWidth:60}}><div style={{fontSize:12,fontWeight:600}}>{item.n}</div>{item.no&&<div style={{fontSize:9,color:'var(--sub)'}}>{item.no}</div>}</div>
            <div style={{fontSize:10,color:'var(--sub)',fontFamily:"'Cinzel',serif",minWidth:34,textAlign:'right'}}>{parseFloat(item.w||0).toFixed(1)}</div>
            {!isReadOnly&&<button onClick={()=>u({inventory:inventory.filter(i=>i.id!==item.id)})} style={{width:18,height:18,borderRadius:3,border:'1px solid var(--border)',background:'none',color:'#b83030',cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>}
          </div>
        ))}
      </div>
      {!isReadOnly&&(
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:5,padding:'10px 12px',marginTop:10}}>
          <St style={{marginTop:0}}>Adicionar Item</St>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:6}}>
            <input className="vtt-input" placeholder="Nome..." value={form.n} onChange={e=>setForm(f=>({...f,n:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addItem()} style={{flex:1,minWidth:110}}/>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:9,color:'var(--sub)'}}>Peso</span>
              <input type="number" className="vtt-input" value={form.w} step="0.1" min={0} onChange={e=>setForm(f=>({...f,w:parseFloat(e.target.value)||0}))} style={{width:52,textAlign:'center'}}/>
              <span style={{fontSize:9,color:'var(--sub)'}}>kg</span>
            </div>
            <select className="vtt-select" value={form.s} onChange={e=>setForm(f=>({...f,s:e.target.value}))} style={{width:100}}>
              <option value="carried">Carregando</option><option value="equipped">Equipado</option><option value="stored">Guardado</option>
            </select>
          </div>
          <div style={{display:'flex',gap:6}}>
            <input className="vtt-input" placeholder="Nota..." value={form.no} onChange={e=>setForm(f=>({...f,no:e.target.value}))} style={{flex:1}}/>
            <RBtn onClick={addItem}>+ Adicionar</RBtn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AurasTab ──────────────────────────────────────────────────────────────────
// Hexagrama da imagem (D-32/D-40), progressão por PP (PG economia), múltiplas auras ativas (D-29),
// Titânica e Ícor só de nascença (D-42/D-43), Titânica provisória (D-50), Despertar Divino sem PP e um só (D-47, D-51, D-56, D-59), nascido Titânico não desperta (D-62), hereditária Primordial rara (D-61),
// panteão e Dons (D-49, PR5), Primordiais jogáveis (D-55), compras definitivas (D-53)
function AurasTab({ sheet, onUpdate, isReadOnly }) {
  const u = onUpdate;
  const [selGroup,setSelGroup] = useState(null);
  const [buySel,setBuySel] = useState('');
  // Fichas antigas (sem a lista de auras): a aura inicial vira a hereditária no nível 1 (Dracônica → Animalesca, D-06)
  const legacy = sheet.auraInit==='Dracônica' ? 'Animalesca' : sheet.auraInit;
  const auras = sheet.auras?.length ? sheet.auras : (legacy && (legacy==='Titânica' || auraArea(legacy)) ? [{ n: legacy, lv: 1, her: true }] : []);
  const her = hereditaryAura(auras);

  const CX=130,CY=130,R=96;
  function hexPos(deg){ return { x:CX+R*Math.cos((deg-90)*Math.PI/180), y:CY+R*Math.sin((deg-90)*Math.PI/180) }; }
  const groupColor = n => AURA_GROUPS.find(g=>g.n===n)?.c || '#ff6600';

  // P-097: aura de nascença fixa depois da criação; só o Mestre destrava
  const herLock = heritageLocked({ ...sheet, auras });
  function setHer(n) {
    if (herLock) { window.alert('A aura de nascença é fixa depois da criação; só o Mestre destrava (P-097).'); return; }
    let rest = auras.filter(x => !x.her && x.n !== n);
    // D-62: quem nasce Titânico não desperta nenhuma aura (nem as compradas)
    if (n === 'Titânica') rest = rest.map(x => { if (x.lv <= 3) return x; const y = { ...x, lv: 3 }; delete y.deus; return y; });
    u({ auras: n ? [{ n, lv: 1, her: true }, ...rest] : rest, auraInit: n });
    if (n && rareHereditary(n)) window.alert(`${n}: aura Primordial de nascença é raríssima — requer aprovação do Mestre (D-61).`);
  }
  function auraUp(i, d) {
    const x = auras[i]; if (!x) return;
    const list = [...auras];
    if (d > 0) {
      if (x.lv >= 4) return;
      if (x.lv === 3) {
        if (titanicBorn(auras)) { window.alert('Quem nasce Titânico não desperta nenhuma aura, nem as compradas, até a Titânica ter regra própria (D-62).'); return; }
        const dz = awakenedAura(auras);
        if (dz) { window.alert(`Só um Despertar Divino por personagem (D-56): ${dz.n}${dz.deus?' sob '+dz.deus:''}.`); return; }
        const ar = auraArea(x.n), gods = PANTHEON[ar] || [];
        if (!gods.length) return;
        if (!window.confirm(`Despertar Divino (nível 4) de ${x.n}: exige a aura no nível 3 e um acontecimento de lore aprovado pelo Mestre. Não custa PP. Só um Despertar por personagem (D-56). Deus da Área ${ar}: ${gods.map(g=>g.n).join(', ')}. Confirmar?`)) return;
        list[i] = { ...x, lv: 4, deus: gods.length === 1 ? gods[0].n : '' };
      } else {
        const c = PP_AURA_UP[x.lv + 1];
        if (ppLeft(sheet) < c) { window.alert(`PP insuficientes: ${x.n} ${x.lv}→${x.lv+1} custa ${c} PP`); return; }
        list[i] = { ...x, lv: x.lv + 1 };
      }
    } else {
      // Desfazer só o que ainda não foi confirmado (D-53)
      const cf = auraConfirmed(sheet, x);
      if (x.lv > 1) {
        if (x.lv <= cf) { window.alert(`${x.n}: nível ${x.lv} já confirmado, sem reembolso (D-53).`); return; }
        list[i] = { ...x, lv: x.lv - 1 };
        if (x.lv - 1 < 4) delete list[i].deus;
      } else if (!x.her) {
        if (cf > 0) { window.alert(`${x.n}: compra já confirmada, sem reembolso (D-53).`); return; }
        if (!window.confirm(`Desfazer a compra de ${x.n} (ainda não confirmada; devolve ${x.pago||0} PP)?`)) return;
        list.splice(i, 1);
      } else return;
    }
    u({ auras: list });
  }
  function buyAura() {
    if (!buySel) return;
    const c = newAuraCost(auras, buySel);
    if (c == null) return;
    if (ppLeft(sheet) < c) { window.alert(`PP insuficientes: ${buySel} custa ${c} PP`); return; }
    u({ auras: [...auras, { n: buySel, lv: 1, her: false, pago: c }] });
    setBuySel('');
  }

  const groupAuras = selGroup && selGroup !== 'Titânica' ? AURA_DETAILS[selGroup] : null;
  const owned = auras.map(x => x.n);

  return (
    <div>
      <St>Hexagrama das Auras</St>
      <div style={{fontSize:11,color:'var(--sub)',textAlign:'center',marginBottom:10}}>Clique em uma Área para ver as auras, a compatibilidade e o custo de aura nova. Anel: Primordial – Emissora – Criadora – Ícor – Deformadora – Mental. Titânica no centro.</div>

      {/* Hexagram SVG */}
      <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
        <div style={{position:'relative',width:260,height:260}}>
          <svg width="260" height="260" style={{position:'absolute',top:0,left:0}}>
            {AURA_GROUPS.map((g,i)=>{
              const p1=hexPos(g.ag), p2=hexPos(AURA_GROUPS[(i+1)%6].ag);
              return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={g.c+'30'} strokeWidth="1.5"/>;
            })}
            {AURA_GROUPS.map((g,i)=>{
              const p=hexPos(g.ag);
              return <line key={'c'+i} x1={p.x} y1={p.y} x2={CX} y2={CY} stroke="#252540" strokeWidth="0.6"/>;
            })}
          </svg>
          {/* Center: Titânica */}
          <div onClick={()=>setSelGroup(s=>s==='Titânica'?null:'Titânica')} style={{position:'absolute',left:CX-24,top:CY-24,width:48,height:48,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',cursor:'pointer',background:selGroup==='Titânica'?'rgba(255,102,0,.12)':'#0a0a18',border:`2px solid ${selGroup==='Titânica'?'#ff6600':'#444'}`,transition:'.25s'}}>
            <span style={{fontSize:13}}>⬢</span>
            <span style={{fontSize:6,fontFamily:"'Cinzel',serif",fontWeight:700,color:'#ff6600',letterSpacing:'.04em'}}>TITÂNICA</span>
          </div>
          {AURA_GROUPS.map(g=>{
            const p=hexPos(g.ag);
            const on=selGroup===g.n;
            let borderColor=g.c+'55';
            if(selGroup&&selGroup!==g.n&&selGroup!=='Titânica'){
              const d=areaDistance(selGroup,g.n);
              borderColor=d<=1?'#3a7a4c':d===2?'#c9a96e':'#b83030';
            }
            if(on)borderColor=g.c;
            return (
              <div key={g.n} onClick={()=>setSelGroup(s=>s===g.n?null:g.n)} style={{position:'absolute',left:p.x-26,top:p.y-26,width:52,height:52,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',cursor:'pointer',background:on?g.c+'20':'var(--card)',border:`2px solid ${borderColor}`,boxShadow:on?`0 0 12px ${g.c}25`:'none',transition:'.25s'}}>
                <span style={{fontSize:13}}>{g.i}</span>
                <span style={{fontSize:6,fontFamily:"'Cinzel',serif",fontWeight:700,color:g.c,letterSpacing:'.03em'}}>{g.n.toUpperCase()}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Titânica */}
      {selGroup==='Titânica'&&(
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderLeft:'3px solid #ff6600',borderRadius:4,padding:'10px 12px',marginBottom:12}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:13,fontWeight:700,color:'#ff6600',marginBottom:4}}>⬢ Titânica</div>
          <div style={{fontSize:11,color:'var(--sub)',lineHeight:1.6}}>No centro do hexagrama, fora das seis Áreas. Só de nascença: não se compra com PP (D-42). Provisório até ter regra própria: sobe 3 PP (1→2) e 4 PP (2→3); quem nasce Titânico compra qualquer outra aura por 2 PP (R13-1). Usa outras auras que já tenha visto em uso; nunca acessa Ícor nem as Divinas (nível 4). Quem nasce Titânico não desperta nenhuma aura, nem as compradas (D-59, D-62). Nível 1: 3 auras/dia, uma por vez, no nível 1. Nível 2: 5 auras/dia, 2 simultâneas, até o nível 2. Nível 3: todas, até 3 simultâneas, em qualquer nível até o 3. Leitura provisória (P-056): pode emprestar auras Primordiais já vistas em uso; os limites de 1/2/3 auras simultâneas valem só para as emprestadas (as compradas com PP ficam todas ativas, D-29).</div>
        </div>
      )}
      {/* Compatibilidade e custo de aura nova */}
      {selGroup&&selGroup!=='Titânica'&&(()=>{
        const g=AURA_GROUPS.find(x=>x.n===selGroup);
        if(!g)return null;
        return (
          <div style={{background:'var(--card)',border:'1px solid var(--border)',borderLeft:`3px solid ${g.c}`,borderRadius:4,padding:'10px 12px',marginBottom:12}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:13,fontWeight:700,color:g.c,marginBottom:5}}>{g.i} {selGroup}</div>
            <div style={{fontSize:10,color:'var(--sub)',marginBottom:5}}>Relação com {selGroup} e custo de uma aura nova para quem nasceu com aura de {selGroup}:</div>
            {AURA_GROUPS.map(x=>{
              const d=areaDistance(selGroup,x.n);
              const rel=d===0?'Mesma Área (−15% MP)':d===3?'Oposta (+25% MP, 10% colateral)':d===1?'Vizinha (neutra)':'2 passos (neutra)';
              const col=d===0?'#3a7a4c':d===3?'#b83030':'#c9a96e';
              return <div key={x.n} style={{display:'flex',justifyContent:'space-between',gap:6,padding:'2px 0',borderBottom:'1px solid var(--border)',fontSize:11}}><span>{x.i} {x.n}</span><span style={{fontWeight:700,color:col,textAlign:'right'}}>{rel} · {PP_NEW_AURA[d]} PP</span></div>;
            })}
            <div style={{fontSize:10,color:'var(--sub)',marginTop:5,lineHeight:1.5}}><b style={{color:'var(--text)'}}>Compatibilidade</b> (P-004, numa técnica que combina auras): todas da mesma Área = −15% de MP (soma com os outros descontos, piso de 50%); vizinhas ou a 2 passos = neutras; alguma oposta = +25% de MP e 10% de colateral (1d6 de dano de Arka no usuário e fim do Fluxo). Não acumula com o Fortalecimento Técnica em Conjunto.</div>
          </div>
        );
      })()}

      {/* Aura catalog */}
      {groupAuras&&(
        <>
          <St>{AURA_GROUPS.find(g=>g.n===selGroup)?.i} {selGroup} — Catálogo</St>
          {selGroup==='Primordial'&&<div style={{fontSize:11,color:'var(--sub)',lineHeight:1.5,marginBottom:8}}>Arka pura, sem forma nem vontade pessoal: a mesma Arka que os Selos contêm, que escapa nos Surtos e que corre selvagem em Vestigar. Oposta ao Ícor. Quatro auras conhecidas (D-55): Selamento, Dreno, Nulidade e Corrente. Nascer com uma delas é raríssimo (só com aprovação do Mestre); o caminho normal é comprar com PP (D-61). Pouco valem num duelo; seu peso está no grupo, no Selo, no Surto e na terra. No nível 3, todas sofrem <b style={{color:'var(--text)'}}>30% a mais de dano de técnicas de Ícor</b>. Dano de Arka = dano sem tipo elemental (Retorno de Surto, Sangria, técnicas de auras sem elemento).</div>}
          {selGroup==='Ícor'&&<div style={{fontSize:11,color:'var(--sub)',lineHeight:1.5,marginBottom:8}}>Criação livre da própria aura. A única Área com uma só aura (D-36). Só de nascença: não se compra como aura adicional (D-43).</div>}
          {groupAuras.map(aura=>{
            const c=groupColor(selGroup);
            return (
              <Acc key={aura.n} title={aura.n} open>
                {aura.nota&&<div style={{fontSize:10,color:'var(--gold)',fontStyle:'italic',marginBottom:5}}>{aura.nota}</div>}
                {aura.l.map((lv,i)=>(
                  <div key={i} style={{padding:'7px 10px',marginBottom:5,borderRadius:4,borderLeft:`3px solid ${c}`}}>
                    <div style={{fontFamily:"'Cinzel',serif",fontSize:10,fontWeight:700,color:c,marginBottom:3}}>Nível {i+1}</div>
                    <div style={{fontSize:11,color:'var(--sub)',lineHeight:1.6}} dangerouslySetInnerHTML={{__html:lv}}/>
                  </div>
                ))}
              </Acc>
            );
          })}
          {/* Despertar Divino (nv 4): deuses e Dons da Área (D-49, D-51, PR5 Dons) */}
          {(PANTHEON[selGroup]||[]).length>0&&(
            <div style={{padding:'7px 10px',margin:'8px 0',borderRadius:4,borderLeft:'3px solid #f4d03f',background:'var(--card)'}}>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:10,fontWeight:700,color:'#f4d03f',marginBottom:3}}>Nível 4 — Despertar Divino: deuses da Área {selGroup}</div>
              <div style={{fontSize:10,color:'var(--sub)',lineHeight:1.5,marginBottom:4}}>Qualquer aura {selGroup} no nível 3 pode despertar: acontecimento de lore (pacto, provação, relíquia) sob controle do Mestre, sem nível mínimo e sem custo de PP (D-47, D-51). Um único Despertar por personagem (D-56). Quem nasce Titânico não desperta (D-62). O jogador escolhe um deus da Área e recebe o Dom dele, que se soma à aura no nível 3; onde o Dom fala em “a aura”, vale a aura que despertou e o tipo de dano dela. Todos os Dons têm o mesmo peso. CD de técnica = 10 + mod DOM + proficiência. Descontos de MP de um Dom se somam aos outros, com piso de metade do custo de tabela.</div>
              {PANTHEON[selGroup].map(d=>(
                <div key={d.n} style={{fontSize:10,color:'var(--sub)',lineHeight:1.5,marginTop:5}}><b style={{color:'#f4d03f'}}>{d.n}, {d.t}</b> <span style={{opacity:.75}}>({d.mit} · {d.dm})</span><br/><b style={{color:'var(--text)'}}>{d.dom}:</b> {d.d}</div>
              ))}
            </div>
          )}
        </>
      )}
      {!selGroup&&<div style={{textAlign:'center',padding:'24px 10px',color:'var(--sub)',fontStyle:'italic',fontSize:12}}>Clique em uma Área no hexagrama para ver suas auras.</div>}

      {/* Character's auras */}
      <St>Auras do Personagem</St>
      <PPBar sheet={sheet} onUpdate={u} isReadOnly={isReadOnly}/>
      <div style={{marginBottom:8}}><Lb>Aura de nascença (hereditária, nível 1 na criação; fixa depois da criação, P-097)</Lb>
        {herLock&&<div style={{fontSize:10,color:'#b83030',marginBottom:3}}>🔒 travada {!isReadOnly&&<button className="tbtn" style={{fontSize:9,padding:'0 5px'}} onClick={()=>{ if(window.confirm('Destravar a aura de nascença? Só o Mestre pode abrir essa exceção, num caso excepcional (P-097). Ela volta a travar na próxima confirmação de compras.')) u({herLivre:true}); }}>destravar (Mestre)</button>}</div>}
        {!herLock&&sheet.herLivre&&her&&<div style={{fontSize:10,color:'var(--gold)',marginBottom:3}}>🔓 destravada pelo Mestre</div>}
        <select className="vtt-select" value={her?.n||''} disabled={isReadOnly||herLock} onChange={e=>setHer(e.target.value)}>
          <option value="">— Selecione —</option>
          {AURA_GROUPS.map(g=>(
            <optgroup key={g.n} label={g.n==='Primordial'?`${g.n} (raríssima — requer aprovação do Mestre, D-61)`:g.n}>
              {(AURA_DETAILS[g.n]||[]).filter(a=>!a.dev).map(a=><option key={a.n} value={a.n}>{a.n}</option>)}
            </optgroup>
          ))}
          <optgroup label="Centro do hexagrama"><option value="Titânica">Titânica</option></optgroup>
        </select>
      </div>
      {!auras.length&&<div style={{fontSize:11,color:'var(--sub)',fontStyle:'italic',marginBottom:8}}>Nenhuma aura. Escolha a hereditária acima.</div>}
      {auras.map((x,i)=>{
        const ar=x.n==='Titânica'?'Centro':auraArea(x.n), c=groupColor(ar);
        const dz=awakenedAura(auras), cf=auraConfirmed(sheet,x);
        const nx=x.lv<3?`${PP_AURA_UP[x.lv+1]} PP`:x.lv===3?(titanicBorn(auras)?'não desperta (Titânico, D-62)':dz?'Despertar já usado (D-56)':'Despertar (evento, 0 PP)'):'máx.';
        const gods=PANTHEON[auraArea(x.n)]||[], gd=gods.find(g=>g.n===x.deus), locked=cf>=4&&!!x.deus;
        return (
          <div key={x.n} style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',background:'var(--card)',border:'1px solid var(--border)',borderLeft:`3px solid ${c}`,borderRadius:4,padding:'6px 9px',marginBottom:4}}>
            <span style={{fontWeight:600,fontSize:12,minWidth:110}}>{x.n}</span>
            <span style={{fontSize:9,color:c}}>{ar}{x.her?' · hereditária':` · comprada (${x.pago||0} PP)`}{x.her&&ar==='Primordial'&&<b style={{color:'#b83030'}}> · raríssima — requer aprovação do Mestre (D-61)</b>}{x.lv>cf&&<b style={{color:'var(--gold)'}}> · pendente</b>}</span>
            <span style={{marginLeft:'auto'}}>{isReadOnly?<b style={{color:'var(--gold)'}}>{x.lv===4?'4 ✦':x.lv}</b>:<Nc value={x.lv===4?'4 ✦':x.lv} color="var(--gold)" onDec={()=>auraUp(i,-1)} onInc={()=>auraUp(i,1)}/>}</span>
            <span style={{fontSize:9,color:'var(--sub)',minWidth:90}}>próx.: {nx}</span>
            {x.lv>=2&&<span style={{fontSize:9,color:'#b83030'}} title="Território imperial (R10-6)">licença {auraLicense(x.lv)}</span>}
            {x.lv===4&&(
              <select className="vtt-select" disabled={isReadOnly||locked} value={x.deus||''} onChange={e=>u({auras:auras.map((y,j)=>j===i?{...y,deus:e.target.value}:y)})} style={{maxWidth:230,fontSize:10}}>
                <option value="">— deus da Área {ar} —</option>
                {gods.map(g=><option key={g.n} value={g.n}>{g.n} — {g.dom}</option>)}
                {x.deus&&!gd&&<option value={x.deus}>{x.deus} (fora do panteão)</option>}
              </select>
            )}
            {x.lv===4&&gd&&<div style={{flexBasis:'100%',fontSize:10,color:'var(--sub)',lineHeight:1.5}}><b style={{color:'#f4d03f'}}>✦ {gd.n}, {gd.t} — {gd.dom}:</b> {gd.d}</div>}
          </div>
        );
      })}
      {!isReadOnly&&(
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',margin:'6px 0'}}>
          <span style={{fontSize:10,color:'var(--sub)'}}>Comprar aura nova:</span>
          <select className="vtt-select" value={buySel} onChange={e=>setBuySel(e.target.value)} style={{flex:1,minWidth:150}}>
            {!her?<option value="">— escolha a hereditária primeiro —</option>
              :<>
                <option value="">— Selecione —</option>
                {AURA_GROUPS.map(g=>{
                  const opts=(AURA_DETAILS[g.n]||[]).filter(a=>!a.dev&&!owned.includes(a.n)&&newAuraCost(auras,a.n)!=null);
                  if(!opts.length)return null;
                  return <optgroup key={g.n} label={her.n==='Titânica'?`${g.n} (nascido Titânico: ${PP_NEW_AURA_TITANIC} PP, provisório)`:`${g.n} (distância ${areaDistance(auraArea(her.n),g.n)})`}>{opts.map(a=><option key={a.n} value={a.n}>{a.n} — {newAuraCost(auras,a.n)} PP</option>)}</optgroup>;
                })}
              </>}
          </select>
          <RBtn onClick={buyAura}>Comprar</RBtn>
        </div>
      )}
      <div style={{fontSize:10,color:'var(--sub)',lineHeight:1.5,margin:'4px 0 10px'}}>
        Progressão por Pontos de Progressão (PP): 1 por nível do 4 ao 15, +1 nos níveis 5, 10 e 15 (15 no total; D-89). <b style={{color:'var(--text)'}}>Subir aura:</b> 1→2 = 3 PP, 2→3 = 4 PP (R13-1); os níveis são cumulativos (D-59); em território imperial, nível 2 exige a licença Intermediária (30 CO) e nível 3 a Avançada (250 CO, exige a Intermediária) (R10-6, D-66). <b style={{color:'var(--text)'}}>Aura nova</b> (entra no nível 1): 1 / 2 / 2 / 3 PP para a mesma Área / vizinha / a 2 passos / oposta, contando a partir da Área da aura de nascença (R13-1). Titânica e Ícor (Aura Própria) só de nascença. Quem nasce Titânico compra qualquer outra aura por 2 PP e sobe a Titânica por 3/4 PP (provisório). Sem nível mínimo de personagem. <b style={{color:'var(--text)'}}>Compras definitivas</b> (D-53): só podem ser desfeitas antes de confirmadas (botão na barra de PP) ou do próximo level-up; depois, sem reembolso. <b style={{color:'var(--text)'}}>Despertar Divino</b> (nível 4): qualquer aura no nível 3 + um acontecimento de lore, sob controle do Mestre; não custa PP nem vem com o nível (D-89); <b style={{color:'var(--text)'}}>um único Despertar por personagem</b> (D-56); o jogador escolhe um deus da Área da aura e recebe o Dom dele (D-49). <b style={{color:'var(--text)'}}>Quem nasce Titânico não desperta nenhuma aura</b>, nem as compradas, até a Titânica ter regra própria (D-59, D-62). <b style={{color:'var(--text)'}}>Aura hereditária Primordial</b>: possível, mas raríssima — requer aprovação do Mestre; o caminho normal é comprar com PP (D-61). <b style={{color:'var(--text)'}}>Todas as auras ficam ativas ao mesmo tempo</b> (D-29). Entre auras, vale só a maior resistência a cada tipo de dano (raça × aura segue multiplicativa); descontos de MP se somam (ex.: −10% e −15% = −25%), mas nunca baixam o custo abaixo de 50% da tabela.
      </div>
      <div style={{marginBottom:8}}><Lb>Descrição / Manifestação</Lb>
        <textarea className="vtt-input" rows={2} placeholder="Como manifesta sua aura..." readOnly={isReadOnly} value={sheet.auraDesc||''} onChange={e=>u({auraDesc:e.target.value})} style={{resize:'vertical',lineHeight:1.5}}/>
      </div>
      <div><Lb>Notas sobre as auras</Lb>
        <textarea className="vtt-input" rows={2} placeholder="Como foram conquistadas, licenças, mentores..." readOnly={isReadOnly} value={sheet.extraAuras||''} onChange={e=>u({extraAuras:e.target.value})} style={{resize:'vertical',lineHeight:1.5}}/>
      </div>
    </div>
  );
}

// ── TecnicasTab ───────────────────────────────────────────────────────────────
function TecnicasTab({ sheet, onUpdate, isReadOnly, addLog, playSfx, targetToken }) {
  const u = onUpdate;
  const devTechs=sheet.devTechs||[];
  const attacks=sheet.attacks||[];
  const pBonus=profBonus(sheetLevel(sheet));

  // Local UI state
  const [fortChecks,setFortChecks]=useState(Array(FORT_ELEMENTS.length).fill(false));
  const [fortVars,setFortVars]=useState({});
  const [fortExp,setFortExp]=useState(false);
  const [showNewTech,setShowNewTech]=useState(false);
  const [showNewAtk,setShowNewAtk]=useState(false);
  const [editTechId,setEditTechId]=useState(null);
  const [editAtkId,setEditAtkId]=useState(null);
  const [techForm,setTechForm]=useState({name:'',cost:'',dmg:'',range:'',action:'Padrão',aura:'',fluxo:'Não',desc:'',forts:[],notes:''});
  const [atkForm,setAtkForm]=useState({name:'',attackDice:'1d20',damageDice:'1d8',damageType:'',range:'',linkedAttribute:'DOM',mpCost:0,notes:''});

  const auColors={};AURA_GROUPS.forEach(g=>{auColors[g.n]=g.c;});auColors['Titânica']='#ff6600';

  function emit(text,cat='dice'){addLog?.(text,cat);playSfx?.('dice');}

  // Fort calculator
  // Fortalecimentos (cap. 11, PB-5): teto +300%, 3 simultâneos, Votos×Limites não acumulam, Expansão conta
  const fort = fortTotal(fortChecks, fortVars, fortExp); // Legado da Arka saiu (R13-6)

  // Fluxo
  const fluxoActive=sheet.fluxoActive??false;
  const fluxoDeseq=sheet.fluxoDeseq??0;

  function toggleFluxo(){
    if(!fluxoActive){
      const log=[{t:'Fluxo iniciado (acertou técnica de aura; sem custo de ação).',c:'#3a7a4c'},...(sheet.fluxoLog||[])];
      u({fluxoActive:true,fluxoDeseq:0,fluxoLog:log});
    } else {
      const log=[{t:'Fluxo encerrado.',c:'var(--sub)'},...(sheet.fluxoLog||[])];
      u({fluxoActive:false,fluxoDeseq:0,fluxoLog:log});
    }
  }
  function fluxoHit(){
    if(!fluxoActive)return;
    if(fluxoDeseq>=maxPips){addLog?.(`Limite de Desequilíbrio = mod DOM (${maxPips})`,'system');return;}
    const d=fluxoDeseq+1;
    const log=[{t:`Técnica #${d+1} (mesma Área). Deseq: ${d} (cada ponto: −1 MP ou +1 ataque e dano · −${d} CA)`,c:'#3a7a4c'},...(sheet.fluxoLog||[])];
    u({fluxoDeseq:d,fluxoLog:log});
  }
  function fluxoMiss(){
    if(!fluxoActive)return;
    // Falha crítica (cap. 11, P-076): perde todo o Desequilíbrio; a técnica falhada custa o dobro; o Fluxo termina
    const log=[{t:`Falha crítica: perde todo o Desequilíbrio (${fluxoDeseq} → 0); a técnica falhada custa o dobro de MP; o Fluxo termina.`,c:'#b83030'},...(sheet.fluxoLog||[])];
    u({fluxoActive:false,fluxoDeseq:0,fluxoLog:log});
  }
  // Erro comum (P-093): não encerra o Fluxo e não soma Desequilíbrio
  function fluxoErro(){
    if(!fluxoActive)return;
    u({fluxoLog:[{t:`Errou (comum): o Fluxo continua; Desequilíbrio segue em ${fluxoDeseq}.`,c:'var(--sub)'},...(sheet.fluxoLog||[])]});
  }
  function fluxoEnd(){
    if(!fluxoActive)return;
    const log=[{t:`Fluxo encerrado, sem penalidade: Desequilíbrio ${fluxoDeseq} → 0.`,c:'var(--gold)'},...(sheet.fluxoLog||[])];
    u({fluxoActive:false,fluxoDeseq:0,fluxoLog:log});
  }

  const domFin=finalAttr(sheet,'DOM');
  const maxPips=Math.max(0,amod(domFin)); // Desequilíbrio máximo = mod DOM (cap. 11)

  // DevTech CRUD
  function saveDevTech(){
    if(!techForm.name.trim())return;
    // Teto de dados das técnicas criadas (PR5-07, D-58): aviso, sem bloquear (o Mestre aprova cada técnica)
    const md=(techForm.dmg||'').match(/(\d+)\s*d\s*8/i), cap=techDiceCap();
    if(md&&+md[1]>cap) addLog?.(`Aviso: ${md[1]}d8 passa do teto das técnicas criadas (${cap}d8, R13-2)`,'system');
    if(editTechId){
      u({devTechs:devTechs.map(t=>t.id===editTechId?{...t,...techForm,id:editTechId}:t)}); // a marca de Assinatura é fixa (R13-4)
      setEditTechId(null);
    } else {
      u({devTechs:[...devTechs,{...techForm,id:uid()}]});
    }
    setTechForm({name:'',cost:'',dmg:'',range:'',action:'Padrão',aura:'',fluxo:'Não',desc:'',forts:[],notes:''});
    setShowNewTech(false);
  }
  function editDT(t){
    setTechForm({name:t.name,cost:t.cost||'',dmg:t.dmg||'',range:t.range||'',action:t.action||'Padrão',aura:t.aura||'',fluxo:t.fluxo||'Não',desc:t.desc||'',forts:t.forts||[],notes:t.notes||''});
    setEditTechId(t.id);setShowNewTech(true);
  }

  // Attack CRUD
  function rollAttack(atk){
    const attrVal=finalAttr(sheet,atk.linkedAttribute||'DOM');
    const totalMod=amod(attrVal)+pBonus;
    const r=rollDice(1,20,totalMod);
    const sign=totalMod>=0?`+${totalMod}`:`${totalMod}`;
    let suf='';
    if(targetToken)suf=r.total>=targetToken.ac?` ✓ Acertou ${targetToken.name}!`:` ✗ Errou ${targetToken.name}.`;
    emit(`⚔ ${sheet.name} — ${atk.name}: [${r.rolls[0]}]${sign} = ${r.total}${suf}`);
  }
  function rollDamage(atk){
    const parsed=atk.damageDice?.match(/(\d+)d(\d+)([+-]\d+)?/);
    if(!parsed)return;
    const cnt=+parsed[1],sides=+parsed[2],mod=parsed[3]?parseInt(parsed[3]):0;
    const r=rollDice(cnt,sides,mod);
    emit(`💥 ${sheet.name} — ${atk.name} dano (${atk.damageDice}${atk.damageType?' '+atk.damageType:''}): [${r.rolls.join('+')}] = ${r.total}`);
    if((atk.mpCost??0)>0)u({curMP:Math.max(0,(sheet.curMP??0)-atk.mpCost)});
  }
  function saveAtk(){
    if(!atkForm.name.trim())return;
    if(editAtkId){
      u({attacks:attacks.map(a=>a.id===editAtkId?{...atkForm,id:editAtkId}:a)});
      setEditAtkId(null);
    } else {
      u({attacks:[...attacks,{...atkForm,id:uid()}]});
    }
    setAtkForm({name:'',attackDice:'1d20',damageDice:'1d8',damageType:'',range:'',linkedAttribute:'DOM',mpCost:0,notes:''});
    setShowNewAtk(false);
  }

  const acCol={Padrão:'var(--gold)',Bônus:'#3a7a4c',Reação:'#3a6aaa',Livre:'var(--sub)'};

  // Treino (cap. 11, D-21): tiers com sessões e CD; teste d20 + mod DOM + proficiência (+2 afinidade, PA-11);
  // toda sessão consome 1 de Capacidade regional; Exaustão de Arka só no 1 natural
  function newSession(){
    const nome=window.prompt('Técnica a treinar:'); if(!nome)return;
    const t=parseInt(window.prompt('Tier: '+TRAINING_TIERS.map((x,i)=>`${i+1} = ${x.t} (${x.s} sessões, CD ${x.cd})`).join(' · ')+' · 0 = personalizado','1'),10);
    const tr=TRAINING_TIERS[t-1];
    const need=tr?tr.s:(parseInt(window.prompt('Sessões necessárias:','2'),10)||2);
    const rc=RACES_DATA[sheet.race];
    const af=rc?.af?window.confirm(`A técnica é de uma aura da Área ${rc.af} (afinidade da raça: +2 no teste)?`):false;
    u({sessoesTreino:[...(sheet.sessoesTreino||[]),{nome,need,done:0,id:uid(),tier:tr?tr.t:'',cd:tr?tr.cd:0,af}]});
  }
  function trainResult(s,ok,nat1){
    if((sheet.arkaLocal??3)<=0){addLog?.('Capacidade regional esgotada! Mude de local.','system');return;}
    const ss=(sheet.sessoesTreino||[]).map(x=>x.id===s.id&&ok?{...x,done:Math.min(x.need,x.done+1)}:x);
    u({sessoesTreino:ss,arkaLocal:Math.max(0,(sheet.arkaLocal??3)-1),...(nat1?{exTreino:Math.min(5,(sheet.exTreino??0)+1)}:{})});
  }
  function trainRoll(s){
    if((sheet.arkaLocal??3)<=0){addLog?.('Capacidade regional esgotada! Mude de local.','system');return;}
    const dm=amod(finalAttr(sheet,'DOM')), bonus=dm+pBonus+(s.af?2:0);
    const r=rollDice(1,20,bonus), d=r.rolls[0];
    const ok=s.cd>0?r.total>=s.cd:false;
    trainResult(s,ok,d===1);
    emit(`📖 ${sheet.name||'Personagem'} treina ${s.nome}: [${d}] ${dm>=0?'+':''}${dm} DOM +${pBonus} prof${s.af?' +2 afinidade':''} = ${r.total}${s.cd?` vs CD ${s.cd} — ${ok?'sucesso':'falha'}`:''}${d===1?' · 1 natural: +1 Exaustão (fora do Selo: Surto)':''}`);
  }

  return (
    <div>
      {/* Generic techniques reference */}
      <St>Técnicas Genéricas</St>
      <div style={{fontSize:11,color:'var(--sub)',marginBottom:8}}>Técnicas fundamentais que todo usuário de aura pode aprender.</div>
      {GENERIC_TECHS.map((t,i)=>(
        <Acc key={i} title={t.n}>
          <div style={{marginBottom:6}}><span style={{display:'inline-block',padding:'2px 7px',borderRadius:3,fontSize:9,fontFamily:"'Cinzel',serif",fontWeight:600,letterSpacing:'.06em',marginRight:4,background:t.tagC+'20',color:t.tagC,border:`1px solid ${t.tagC}40`}}>{t.tag}</span></div>
          <div style={{fontSize:11,color:'var(--sub)',marginBottom:6}}>{t.desc}</div>
          {[['Custo',t.cost],['Dano',t.dmg],['Alcance',t.range],['Extra',t.extra]].map(([k,v])=>v&&(
            <div key={k} style={{fontSize:11,color:'var(--sub)',marginBottom:3}}><b style={{color:'var(--text)'}}>{k}:</b> {v}</div>
          ))}
        </Acc>
      ))}

      {/* Fort elements reference */}
      <St style={{marginTop:18}}>Elementos de Fortalecimento</St>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:10}}>
        {FORT_ELEMENTS.map((f,i)=>(
          <div key={i} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:4,padding:'7px 9px',fontSize:10,lineHeight:1.4}}>
            <b style={{color:'var(--gold)',fontFamily:"'Cinzel',serif",fontSize:9,letterSpacing:'.04em'}}>{f.n}</b>
            <div style={{color:'#3a7a4c',margin:'2px 0'}}>{f.ef}</div>
            <div style={{color:'var(--sub)',fontSize:9}}>Req: {f.req}</div>
          </div>
        ))}
      </div>

      {/* Fort calculator */}
      <div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:5,padding:'10px 12px',marginBottom:14}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:10,fontWeight:700,color:'var(--gold)',marginBottom:8,letterSpacing:'.08em'}}>Calculadora de Fortalecimento</div>
        <div style={{marginBottom:8}}>
          {FORT_ELEMENTS.map((f,i)=>(
            <label key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,fontSize:11,cursor:'pointer'}}>
              <input type="checkbox" checked={fortChecks[i]} onChange={e=>{const c=[...fortChecks];c[i]=e.target.checked;setFortChecks(c);}}/>
              <span>{f.n}</span>
              {FORT_VARIANTS[i]&&<select className="vtt-select" value={fortVars[i]||0} onChange={e=>setFortVars(v=>({...v,[i]:+e.target.value}))} style={{width:'auto',fontSize:11,padding:'1px 4px'}}>{FORT_VARIANTS[i].map(([lbl,pct],j)=><option key={j} value={j}>{lbl} (+{pct}%)</option>)}</select>}
            </label>
          ))}
          <label style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,fontSize:11,cursor:'pointer'}}>
            <input type="checkbox" checked={fortExp} onChange={e=>setFortExp(e.target.checked)}/>
            <span>Expansão de Domínio (+50% de dano)</span>
          </label>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <Sb label="Bônus Total" value={`+${fort.total}%`} color="#3a7a4c"/>
          <Sb label="Multiplicador" value={`×${String(Math.round(fort.mult*100)/100).replace('.',',')}`}/>
          <Sb label="Simultâneos" value={`${fort.count}/3`}/>
        </div>
        {fort.warn.length>0&&<div style={{fontSize:10,color:'#b83030',marginTop:6}}>{fort.warn.map((w,i)=><div key={i}>{w}</div>)}</div>}
        <div style={{fontSize:10,color:'var(--sub)',marginTop:6}}>Os bônus se somam e o total multiplica o dano base (+25% e +100% = ×2,25), sem custo extra de preparo (P-015). Limite: +300% cumulativo e 3 simultâneos; Votos e Limites de Uso não acumulam entre si; o +50% da Expansão de Domínio conta nos dois limites.</div>
      </div>

      {/* Fluxo de Aura */}
      <St>Fluxo de Aura</St>
      <div style={{fontSize:11,color:'var(--sub)',marginBottom:8}}>Encadeamento de técnicas. Cada acerto aumenta o Desequilíbrio.</div>
      <Acc title="Regras do Fluxo">
        <div style={{fontSize:11,color:'var(--sub)',lineHeight:1.6}}>
          <b style={{color:'var(--text)'}}>Gatilho:</b> acertar uma técnica de aura num alvo; não custa ação (P-014).<br/>
          <b style={{color:'var(--text)'}}>Continuação:</b> a próxima técnica de qualquer aura da mesma Área: +1 Desequilíbrio.<br/>
          <span style={{color:'#3a7a4c'}}><b>Bônus por ponto:</b> −1 MP (entra nos descontos, piso de 50% da tabela) OU +1 no ataque e no dano.</span><br/>
          <span style={{color:'#b83030'}}><b>Penalidade:</b> −1 de CA por ponto. <b>Falha crítica</b> (1 natural no ataque de Arka; sem rolagem de ataque, o alvo passar no teste com 20 natural): perde todo o Desequilíbrio, a técnica falhada custa o dobro e o Fluxo termina.</span><br/>
          <b style={{color:'var(--text)'}}>Erro comum</b> (P-093): não encerra o Fluxo nem soma Desequilíbrio; só acertos alimentam.<br/>
          <b style={{color:'var(--text)'}}>Limite:</b> Desequilíbrio máximo = mod DOM ({maxPips}). <b style={{color:'var(--text)'}}>Encerramento:</b> só por falha crítica ou por vontade, sem penalidade; zera ao encerrar ou no fim do combate. Técnica com aura de Área oposta: 10% de colateral que termina o Fluxo (P-004).
        </div>
      </Acc>

      <div style={{background:fluxoActive?'rgba(201,169,110,.06)':'var(--bg)',border:`1px solid ${fluxoActive?'var(--gold)':'var(--border)'}`,borderRadius:5,padding:'12px',marginBottom:14,boxShadow:fluxoActive?'0 0 12px rgba(201,169,110,.12)':'none',transition:'.3s'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:10,fontWeight:700,color:'var(--gold)',letterSpacing:'.08em'}}>FLUXO DE AURA</span>
          {!isReadOnly&&<>
            <button className="tbtn" onClick={toggleFluxo} style={{marginLeft:'auto',background:fluxoActive?'#3a7a4c':undefined}}>{fluxoActive?'Ativo ●':'Iniciar'}</button>
            <button className="tbtn" onClick={()=>u({fluxoActive:false,fluxoDeseq:0,fluxoLog:[]})}>Reset</button>
          </>}
        </div>
        <div style={{fontSize:9,color:'var(--sub)',marginBottom:5}}>Desequilíbrio:</div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
          {Array.from({length:maxPips},(_,i)=>{
            const on=i<fluxoDeseq, danger=on&&i+1>=maxPips;
            return <div key={i} style={{width:20,height:20,borderRadius:3,border:`1px solid ${danger?'#b83030':on?'var(--gold)':'var(--border)'}`,background:danger?'rgba(184,48,48,.15)':on?'rgba(201,169,110,.15)':'var(--card)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontFamily:"'Cinzel',serif",fontWeight:700,color:danger?'#b83030':on?'var(--gold)':'var(--sub)'}}>{i+1}</div>;
          })}
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
          <Sb label="Desequilíbrio" value={fluxoDeseq} color={maxPips>0&&fluxoDeseq>=maxPips?'#b83030':'var(--gold)'}/>
          <Sb label="Bônus MP" value={`−${fluxoDeseq}`} color="#3a7a4c"/>
          <Sb label="Bônus Atk" value={`+${fluxoDeseq}`} color="#3a7a4c"/>
          <Sb label="Pen. CA" value={`−${fluxoDeseq}`} color="#b83030"/>
        </div>
        {!isReadOnly&&<div style={{display:'flex',gap:6,marginBottom:8}}>
          <button className="tbtn" onClick={fluxoHit} style={{background:'#3a7a4c'}}>✓ Acertou (mesma Área)</button>
          <button className="tbtn" onClick={fluxoErro}>○ Errou (comum)</button>
          <button className="tbtn" onClick={fluxoMiss} style={{background:'#b83030'}}>✕ Falha crítica</button>
          <button className="tbtn" onClick={fluxoEnd}>Encerrar / fim do combate</button>
        </div>}
        <div style={{maxHeight:100,overflowY:'auto',fontSize:10,color:'var(--sub)'}}>
          {!(sheet.fluxoLog?.length)&&<div style={{padding:6,fontStyle:'italic'}}>Nenhum fluxo registrado.</div>}
          {(sheet.fluxoLog||[]).slice(0,15).map((l,i)=><div key={i} style={{padding:'3px 0',borderBottom:'1px solid var(--border)',color:l.c||'var(--sub)'}}>{l.t}</div>)}
        </div>
      </div>

      {/* Training sessions */}
      <St>Sessões de Treino</St>
      <div style={{fontSize:11,color:'var(--sub)',marginBottom:8}}>Técnicas desenvolvidas em Downtime. Teste de treino: <b style={{color:'var(--text)'}}>d20 + mod DOM + proficiência</b> contra a CD do tier (+2 se a aura for da Área afim da raça). Toda sessão, com sucesso ou falha, consome 1 de Capacidade regional. Exaustão só no 1 natural (fora do Selo, o 1 natural também provoca Surto). Capacidade 0 = esgotada; recompõe-se em ciclos definidos pelo Mestre (D-21, D-22).</div>
      <div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:5,padding:'10px 12px',marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:10,fontWeight:700,color:'var(--gold)'}}>CAPACIDADE REGIONAL</span>
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:12}}>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:10,color:'var(--sub)'}}>Cap:</span>
              <Nc value={sheet.arkaCap??3} onDec={()=>u({arkaCap:Math.max(0,(sheet.arkaCap??3)-1)})} onInc={()=>u({arkaCap:Math.min(20,(sheet.arkaCap??3)+1)})}/>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:10,color:'var(--sub)'}}>Atual:</span>
              <Nc value={sheet.arkaLocal??3} onDec={()=>u({arkaLocal:Math.max(0,(sheet.arkaLocal??3)-1)})} onInc={()=>u({arkaLocal:Math.min(sheet.arkaCap??3,(sheet.arkaLocal??3)+1)})}/>
            </div>
          </div>
        </div>
        <div style={{fontSize:10,color:(sheet.arkaLocal??3)<=0?'#b83030':(sheet.arkaLocal??3)<=1?'var(--gold)':'#3a7a4c'}}>
          {(sheet.arkaLocal??3)<=0?'⚠ ESGOTADA — Sem treino possível neste local.':(sheet.arkaLocal??3)<=1?`⚠ Quase esgotada. Restam ${sheet.arkaLocal??3} sessões.`:`Capacidade disponível: ${sheet.arkaLocal??3}/${sheet.arkaCap??3}`}
        </div>
      </div>

      <div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:5,padding:'10px 12px',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',marginBottom:8}}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:10,fontWeight:700,color:'var(--gold)'}}>SESSÕES</span>
          {!isReadOnly&&<button className="tbtn" style={{marginLeft:'auto'}} onClick={newSession}>+ Nova Sessão</button>}
        </div>
        {!(sheet.sessoesTreino?.length)&&<div style={{padding:10,color:'var(--sub)',fontStyle:'italic',fontSize:11}}>Nenhuma técnica em treino.</div>}
        {(sheet.sessoesTreino||[]).map(s=>{
          const pct=s.need>0?Math.round((s.done/s.need)*100):0, done=s.done>=s.need;
          return (
            <div key={s.id} style={{display:'flex',alignItems:'center',gap:8,background:'var(--card)',border:'1px solid var(--border)',borderRadius:5,padding:'8px 10px',marginBottom:6}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:done?'#3a7a4c':'var(--text)'}}>{s.nome}{done?' ✓':''}</div>
                <div style={{fontSize:9,color:'var(--sub)'}}>{s.done}/{s.need} sessões{s.tier?` · ${s.tier}, CD ${s.cd}`:''}{s.af?' · afinidade +2':''}</div>
                <div style={{height:5,background:'var(--border)',borderRadius:3,marginTop:4,overflow:'hidden'}}><div style={{height:'100%',width:`${pct}%`,background:done?'#3a7a4c':'var(--gold)',borderRadius:3}}/></div>
              </div>
              {!isReadOnly&&<div style={{display:'flex',gap:4}}>
                {!done&&<button className="tbtn" style={{padding:'3px 8px',fontSize:9}} title="Rolar o teste de treino (d20 + DOM + prof.)" onClick={()=>trainRoll(s)}>🎲</button>}
                {!done&&<button className="tbtn" style={{background:'#3a7a4c',padding:'3px 8px',fontSize:9}} title="Sessão bem-sucedida (rolada fora da ficha)" onClick={()=>trainResult(s,true,false)}>+</button>}
                {!done&&<button style={NB} title="Sessão com falha (consome Capacidade)" onClick={()=>trainResult(s,false,false)}>✕</button>}
                <button style={NB} title="Desfazer" onClick={()=>u({sessoesTreino:(sheet.sessoesTreino||[]).map(x=>x.id===s.id&&x.done>0?{...x,done:x.done-1}:x)})}>↩</button>
                <button style={{...NB,color:'#b83030'}} title="Remover" onClick={()=>u({sessoesTreino:(sheet.sessoesTreino||[]).filter(x=>x.id!==s.id)})}>🗑</button>
              </div>}
            </div>
          );
        })}
      </div>

      {/* Exaustão de Arka (cap. 15): escala única de 5 níveis */}
      <div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:5,padding:'10px 12px',marginBottom:14}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:10,fontWeight:700,color:'var(--gold)',marginBottom:6}}>EXAUSTÃO DE ARKA</div>
        <div style={{fontSize:11,color:'var(--sub)',marginBottom:6}}>+1 nível no 1 natural de um teste de treino e +1 ao usar a Expansão de Domínio. Cada Descanso Longo remove 1 nível.</div>
        <div style={{display:'flex',gap:4,marginBottom:6}}>
          {Array.from({length:5},(_,i)=>{
            const on=i<(sheet.exTreino??0);
            return <div key={i} onClick={()=>!isReadOnly&&u({exTreino:i<(sheet.exTreino??0)?i:i+1})} style={{width:24,height:24,borderRadius:4,border:`1px solid ${on?'#b83030':'var(--border)'}`,background:on?'rgba(184,48,48,.2)':'var(--card)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontFamily:"'Cinzel',serif",fontWeight:700,color:on?'#b83030':'var(--sub)',cursor:isReadOnly?'default':'pointer'}}>{i+1}</div>;
          })}
        </div>
        <div style={{fontSize:10,color:(sheet.exTreino??0)===0?'#3a7a4c':(sheet.exTreino??0)<=2?'var(--gold)':'#b83030',lineHeight:1.5}}>
          {(sheet.exTreino??0)===0?'Sem Exaustão de Arka.':EXH_DESC[Math.min(sheet.exTreino??0,5)]}
        </div>
        {!isReadOnly&&<div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
          <RBtn onClick={()=>u({exTreino:Math.min(5,(sheet.exTreino??0)+1)})}>1 natural no treino (+1)</RBtn>
          <RBtn onClick={()=>u({exTreino:Math.min(5,(sheet.exTreino??0)+1)})}>Expansão (+1)</RBtn>
          <RBtn onClick={()=>u({exTreino:Math.max(0,(sheet.exTreino??0)-1),tonicoUsado:false})}>Descanso Longo (−1)</RBtn>
          <RBtn title="Tônico de Arka (E15-02, 250 CO, raro): −1 Exaustão, máx. 1 por descanso longo" onClick={()=>{ if(sheet.tonicoUsado){addLog?.('Tônico de Arka: só 1 por descanso longo','system');return;} if(!((sheet.exTreino??0)>0))return; u({exTreino:(sheet.exTreino??0)-1,tonicoUsado:true}); }}>Tônico de Arka (−1)</RBtn>
          <RBtn onClick={()=>u({exTreino:0})}>Limpar</RBtn>
        </div>}
      </div>

      {/* Técnica Máxima */}
      <St>Técnica Máxima</St>
      <Acc title="Técnicas Máximas (aura no nível 3)">
        <div style={{fontSize:11,color:'var(--sub)',lineHeight:1.6,marginBottom:8}}>Requisito (R13-3): <span style={{color:'var(--gold)'}}>aura no nível 3</span>, uma Técnica Avançada e narrativa; treino de 8 sessões, CD 22, custo 50+ MP. Não depende do nível de personagem. A tier Máxima dá efeitos de área, alcance ou controle, não dados: o dano fica no teto de 5d8. {(sheet.auras||[]).some(x=>x.lv>=3)?<span style={{color:'#3a7a4c'}}>Você tem aura no nível 3.</span>:<span style={{color:'#b83030'}}>Nenhuma aura no nível 3 ainda.</span>}</div>
        <Lb>Sua Técnica Máxima</Lb>
        <textarea className="vtt-input" rows={3} placeholder="Nome, descrição, efeito, custo..." readOnly={isReadOnly}
          value={sheet.tecMax||''} onChange={e=>u({tecMax:e.target.value})} style={{resize:'vertical'}}/>
      </Acc>

      {/* Developed techniques */}
      <St>Técnicas Desenvolvidas</St>
      {devTechs.map(t=>(
        <Acc key={t.id} title={<span style={{display:'flex',alignItems:'center',gap:6}}>{t.assin?'★ ':''}{t.name}{t.action&&<span style={{display:'inline-block',padding:'1px 5px',borderRadius:3,fontSize:8,fontFamily:"'Cinzel',serif",fontWeight:600,background:'rgba(201,169,110,.1)',color:acCol[t.action]||'var(--sub)'}}>{t.action}</span>}{t.fluxo==='Sim'&&<span style={{display:'inline-block',padding:'1px 5px',borderRadius:3,fontSize:8,fontFamily:"'Cinzel',serif",fontWeight:600,background:'rgba(58,122,76,.1)',color:'#3a7a4c'}}>Fluxo</span>}</span>}>
          {t.aura&&<div style={{marginBottom:5}}><span style={{display:'inline-block',padding:'2px 7px',borderRadius:3,fontSize:9,fontFamily:"'Cinzel',serif",fontWeight:600,letterSpacing:'.06em',background:(auColors[t.aura]||'var(--sub)')+'20',color:auColors[t.aura]||'var(--sub)',border:`1px solid ${(auColors[t.aura]||'var(--sub)')}40`}}>{t.aura}</span></div>}
          {[['Custo',t.cost],['Dano',t.dmg],['Alcance',t.range]].map(([k,v])=>v&&<div key={k} style={{fontSize:11,color:'var(--sub)',marginBottom:3}}><b style={{color:'var(--text)'}}>{k}:</b> {v}</div>)}
          {t.desc&&<div style={{fontSize:11,color:'var(--sub)',marginTop:4,lineHeight:1.5}}>{t.desc}</div>}
          {t.forts?.length>0&&<div style={{fontSize:11,color:'var(--sub)',marginTop:4}}><b style={{color:'var(--text)'}}>Fortalecimentos:</b> {t.forts.join(', ')}</div>}
          {t.notes&&<div style={{fontSize:11,color:'var(--sub)',marginTop:4}}><b style={{color:'var(--text)'}}>Notas:</b> {t.notes}</div>}
          <div style={{fontSize:11,color:'var(--sub)',marginTop:6}}>{t.assin?<><b style={{color:'#f4d03f'}}>★ Técnica Assinatura</b>: −25% de MP (soma com os outros descontos, piso de metade da tabela); escolha fixa (R13-4).</>:!isReadOnly&&<><RBtn onClick={()=>{ const n=devTechs.filter(x=>x.assin).length; if(n>=SIGNATURE_MAX){addLog?.(`Máximo de ${SIGNATURE_MAX} Técnicas Assinatura por personagem (R13-4)`,'system');return;} if(!window.confirm(`Tornar "${t.name}" Técnica Assinatura? Exige que a técnica tenha sido treinada até o fim e um acontecimento de história, a critério do Mestre. Custa −25% de MP e a escolha é fixa para sempre.`))return; u({devTechs:devTechs.map(x=>x.id===t.id?{...x,assin:true}:x)}); }}>★ Tornar Assinatura</RBtn> <span style={{fontSize:9}}>{devTechs.filter(x=>x.assin).length}/{SIGNATURE_MAX} · técnica treinada até o fim, por acontecimento de história</span></>}</div>
          {!isReadOnly&&<div style={{display:'flex',gap:6,marginTop:8}}><RBtn onClick={()=>editDT(t)}>✎ Editar</RBtn><button className="tbtn" onClick={()=>u({devTechs:devTechs.filter(x=>x.id!==t.id)})} style={{background:'#b83030'}}>✕ Remover</button></div>}
        </Acc>
      ))}
      {!isReadOnly&&(!showNewTech?(
        <button className="tbtn" onClick={()=>setShowNewTech(true)} style={{marginBottom:14}}>+ Nova Técnica Desenvolvida</button>
      ):(
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:5,padding:'10px 12px',marginBottom:14}}>
          <St style={{marginTop:0}}>{editTechId?'Editar':'Nova'} Técnica</St>
          <div style={{fontSize:10,color:'var(--sub)',lineHeight:1.5,marginBottom:6}}>Custo pela tabela do Projetar (6 MP por d8); descontos de MP se somam, com piso de 50% da tabela. <b style={{color:'var(--text)'}}>Teto de dados</b> (PR5-07, R13-2): de 2d8 até {techDiceCap()}d8 (o máximo do Projetar, em qualquer nível), qualquer que seja o número de auras; cada aura além da primeira acrescenta um tipo de dano ou um efeito, não dados; a tier Máxima dá efeito, não dados. O teto vale só para técnicas criadas, não para capacidades do Catálogo (D-58).</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
            {[['Nome','name',''],['Custo MP','cost','Ex: 12 MP'],['Dano','dmg','Ex: 2d8 fogo'],['Alcance','range','Ex: 10m']].map(([lbl,f,ph])=>(
              <div key={f}><Lb>{lbl}</Lb><input className="vtt-input" placeholder={ph} value={techForm[f]} onChange={e=>setTechForm(x=>({...x,[f]:e.target.value}))}/></div>
            ))}
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
            <div style={{minWidth:100}}><Lb>Ação</Lb><select className="vtt-select" value={techForm.action} onChange={e=>setTechForm(x=>({...x,action:e.target.value}))}><option>Padrão</option><option>Bônus</option><option>Reação</option><option>Livre</option></select></div>
            <div style={{minWidth:110}}><Lb>Tipo de Aura</Lb><select className="vtt-select" value={techForm.aura} onChange={e=>setTechForm(x=>({...x,aura:e.target.value}))}><option value="">— Qualquer —</option>{AURA_GROUPS.map(g=><option key={g.n} value={g.n}>{g.n}</option>)}<option value="Titânica">Titânica</option></select></div>
            <div style={{minWidth:80}}><Lb>Inicia Fluxo?</Lb><select className="vtt-select" value={techForm.fluxo} onChange={e=>setTechForm(x=>({...x,fluxo:e.target.value}))}><option>Não</option><option>Sim</option></select></div>
          </div>
          <div style={{marginBottom:8}}><Lb>Efeito / Descrição</Lb><textarea className="vtt-input" rows={2} value={techForm.desc} onChange={e=>setTechForm(x=>({...x,desc:e.target.value}))} style={{resize:'vertical'}}/></div>
          <div style={{marginBottom:8}}><Lb>Fortalecimentos aceitos</Lb><div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:4}}>{FORT_ELEMENTS.map((f,i)=><label key={i} style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:10,cursor:'pointer',padding:'2px 6px',border:'1px solid var(--border)',borderRadius:3,background:'var(--card)'}}><input type="checkbox" checked={techForm.forts.includes(f.n)} onChange={e=>setTechForm(x=>({...x,forts:e.target.checked?[...x.forts,f.n]:x.forts.filter(n=>n!==f.n)}))}/><span>{f.n}</span></label>)}</div></div>
          <div style={{marginBottom:8}}><Lb>Notas extras</Lb><input className="vtt-input" value={techForm.notes} onChange={e=>setTechForm(x=>({...x,notes:e.target.value}))}/></div>
          <div style={{display:'flex',gap:6}}><RBtn onClick={saveDevTech}>{editTechId?'💾 Salvar':'+ Adicionar'}</RBtn><button onClick={()=>{setShowNewTech(false);setEditTechId(null);setTechForm({name:'',cost:'',dmg:'',range:'',action:'Padrão',aura:'',fluxo:'Não',desc:'',forts:[],notes:''}); }} style={{background:'none',border:'1px solid var(--border)',borderRadius:4,color:'var(--sub)',cursor:'pointer',fontSize:11,padding:'4px 10px',fontFamily:'inherit'}}>Cancelar</button></div>
        </div>
      ))}

      {/* VTT attacks */}
      <St>Ataques (VTT)</St>
      {targetToken&&<div style={{fontSize:10,color:'var(--sub)',marginBottom:8}}>Alvo: <span style={{color:'var(--gold)'}}>{targetToken.name}</span> (CA {targetToken.ac})</div>}
      <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:8}}>
        {!attacks.length&&<span style={{fontSize:11,color:'var(--sub)',fontStyle:'italic'}}>Nenhum ataque cadastrado.</span>}
        {attacks.map(atk=>(
          <div key={atk.id} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:5,padding:'7px 10px'}}>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{fontWeight:700,fontSize:12,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{atk.name}</span>
              <span style={{fontSize:10,color:'var(--sub)',flexShrink:0}}>{atk.damageDice}</span>
              {(atk.mpCost??0)>0&&<span style={{fontSize:10,color:'#3a6aaa',flexShrink:0}}>{atk.mpCost}MP</span>}
              <RBtn onClick={()=>rollAttack(atk)} title="Rolar ataque">⚔</RBtn>
              <RBtn onClick={()=>rollDamage(atk)} title="Rolar dano">💥</RBtn>
              {!isReadOnly&&<>
                <RBtn onClick={()=>{setAtkForm({...atk});setEditAtkId(atk.id);setShowNewAtk(true);}}>✎</RBtn>
                <button onClick={()=>u({attacks:attacks.filter(a=>a.id!==atk.id)})} style={{background:'none',border:'none',color:'#b83030',cursor:'pointer',fontSize:14}}>✕</button>
              </>}
            </div>
            {(atk.range||atk.damageType||atk.notes)&&<div style={{fontSize:10,color:'var(--sub)',marginTop:3}}>
              {atk.range&&<span style={{marginRight:8}}>📏 {atk.range}</span>}
              {atk.damageType&&<span style={{marginRight:8}}>{atk.damageType}</span>}
              {atk.notes&&<span>{atk.notes}</span>}
            </div>}
          </div>
        ))}
      </div>
      {!isReadOnly&&(!showNewAtk?(
        <button className="tbtn" onClick={()=>setShowNewAtk(true)}>+ Adicionar Ataque</button>
      ):(
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:5,padding:'8px 10px',marginBottom:10}}>
          <St style={{marginTop:0}}>{editAtkId?'Editar':'Novo'} Ataque</St>
          <input className="vtt-input" placeholder="Nome do ataque" value={atkForm.name} onChange={e=>setAtkForm(f=>({...f,name:e.target.value}))} style={{marginBottom:6}}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:6}}>
            {[['Dado Ataque','attackDice','1d20'],['Dado Dano','damageDice','1d8'],['Tipo Dano','damageType','Cortante']].map(([lbl,f,ph])=>(
              <div key={f}><Lb>{lbl}</Lb><input className="vtt-input" placeholder={ph} value={atkForm[f]||''} onChange={e=>setAtkForm(x=>({...x,[f]:e.target.value}))}/></div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:6}}>
            <div><Lb>Atributo</Lb><select className="vtt-select" value={atkForm.linkedAttribute||'DOM'} onChange={e=>setAtkForm(x=>({...x,linkedAttribute:e.target.value}))}>{ATTRS.map(a=><option key={a} value={a}>{a}</option>)}</select></div>
            <div><Lb>Alcance</Lb><input className="vtt-input" placeholder="1.5m" value={atkForm.range||''} onChange={e=>setAtkForm(x=>({...x,range:e.target.value}))}/></div>
            <div><Lb>Custo MP</Lb><input className="vtt-input" type="number" min={0} value={atkForm.mpCost||0} onChange={e=>setAtkForm(x=>({...x,mpCost:Math.max(0,parseInt(e.target.value,10)||0)}))} style={{textAlign:'center'}}/></div>
          </div>
          <input className="vtt-input" placeholder="Notas (opcional)" value={atkForm.notes||''} onChange={e=>setAtkForm(x=>({...x,notes:e.target.value}))} style={{marginBottom:8}}/>
          <div style={{display:'flex',gap:6}}>
            <RBtn onClick={saveAtk}>{editAtkId?'💾 Salvar':'+ Adicionar'}</RBtn>
            <button onClick={()=>{setShowNewAtk(false);setEditAtkId(null);setAtkForm({name:'',attackDice:'1d20',damageDice:'1d8',damageType:'',range:'',linkedAttribute:'DOM',mpCost:0,notes:''}); }} style={{background:'none',border:'1px solid var(--border)',borderRadius:4,color:'var(--sub)',cursor:'pointer',fontSize:11,padding:'4px 10px',fontFamily:'inherit'}}>Cancelar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── XpTab ─────────────────────────────────────────────────────────────────────
// XP (cap. 12 + PB-6): nível 3–15. Ganho (D-20): XP por sessão (faixa do Mestre) + XP de combate opcional
// (fórmula do painel: 10 × nível de cada inimigo, somado, ÷ jogadores; a calibrar). Do nível 4 ao 15: 1 PP por nível, 2 nos níveis 5, 10 e 15 (D-89).
function XpTab({ sheet, onUpdate, isReadOnly }) {
  const u = onUpdate;
  const [xpLv,setXpLv]=useState(5), [xpPa,setXpPa]=useState(4);
  const [durAtk,setDurAtk]=useState(10), [durCur,setDurCur]=useState(10), [durArmor,setDurArmor]=useState(false);
  const [xpFat,setXpFat]=useState(1);
  const xs = XP_SESSION[sheetLevel(sheet)];
  const xpGain=Math.floor((10*xpLv)/xpPa);
  const lv=sheetLevel(sheet), xp=sheet.xp??0;
  const atMax=lv>=LV_MAX;
  const need=atMax?0:XP_TABLE[lv-1];
  const xpPct=atMax?100:need>0?Math.min(100,(xp/need)*100):0;
  // Durabilidade opcional (apêndice; D-76, D-79): arma −0,25 por ataque (−1 por Aparar); armadura −1 por crítico sofrido; escudo −1 por Aparar ou Proteger
  const durLoss=durAtk*(durArmor?1:0.25), durRem=Math.max(0,durCur-durLoss);
  // D-89: o nível dá só HP/MP, PP e proficiência
  const milestone = n => n>LV_MIN ? `+${ppAtLevel(n)} PP${profBonus(n)>profBonus(n-1)?` · proficiência +${profBonus(n)}`:''}` : 'Início da campanha (aura de nascença no nível 1)';

  return (
    <div>
      <St>XP por Sessão</St>
      <div style={{fontSize:10,color:'var(--sub)',marginBottom:6}}>Ao fim de cada sessão, o Mestre concede XP na faixa do nível atual (R9-4): típico numa sessão comum, mínimo numa curta ou parada, máximo num marco da história. Com XP de combate, a faixa vale 80% (70% com 3+ lutas por sessão).</div>
      {xs ? (
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',marginBottom:14}}>
          <span style={{fontSize:10,color:'var(--sub)'}}>Nível {sheetLevel(sheet)}:</span>
          {['mínimo','típico','máximo'].map((nm,i)=>{ const v=Math.round(xs[i]*xpFat); return <button key={nm} className="tbtn" disabled={isReadOnly||lv>=LV_MAX} onClick={()=>u({xp:Math.min(XP_TABLE[lv-1],xp+v)})}>+{v} ({nm})</button>; })}
          <select className="vtt-select" value={xpFat} onChange={e=>setXpFat(+e.target.value)} style={{width:'auto',fontSize:11}}>
            <option value={1}>sem XP de combate</option><option value={0.8}>com XP de combate (×0,8)</option><option value={0.7}>3+ lutas por sessão (×0,7)</option>
          </select>
        </div>
      ) : <div style={{fontSize:11,color:'var(--sub)',fontStyle:'italic',marginBottom:14}}>Nível máximo: sem XP por sessão.</div>}
      <St>XP de Combate (opcional)</St>
      <div style={{fontSize:10,color:'var(--sub)',marginBottom:8}}>10 × nível de cada inimigo × valor da categoria (lacaio ¾ · padrão 1 · elite 2 · chefe 4 · chefe de fim de arco 5), somado, ÷ jogadores (R14-5).</div>
      <div style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'center',marginBottom:14}}>
        {[['Soma de nível × valor dos inimigos',xpLv,setXpLv,200],['Jogadores',xpPa,setXpPa,20]].map(([lbl,val,set,mx])=>(
          <div key={lbl}><Lb>{lbl}</Lb><Nc value={val} onDec={()=>set(v=>Math.max(1,v-1))} onInc={()=>set(v=>Math.min(mx,v+1))}/></div>
        ))}
        <Sb label="XP" value={xpGain} color="#f4d03f"/>
      </div>

      <St>Progresso</St>
      <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',marginBottom:8}}>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <span style={{fontSize:10,color:'var(--sub)'}}>Nível</span>
          <Nc value={lv} onDec={()=>!isReadOnly&&u({level:Math.max(LV_MIN,lv-1)})} onInc={()=>!isReadOnly&&u({level:Math.min(LV_MAX,lv+1)})}/>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <span style={{fontSize:10,color:'var(--sub)'}}>XP</span>
          <Nc value={xp} onDec={()=>!isReadOnly&&u({xp:Math.max(0,xp-10)})} onInc={()=>!isReadOnly&&!atMax&&u({xp:Math.min(need,xp+10)})}/>
        </div>
        {!isReadOnly&&!atMax&&<button className="tbtn" onClick={()=>u({xp:Math.min(need,xp+xpGain)})}>+ Adicionar</button>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
        <div style={{flex:1,height:9,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${xpPct}%`,borderRadius:3,background:'linear-gradient(90deg,var(--gold-dim),var(--gold))',transition:'width .3s'}}/>
        </div>
        <span style={{fontSize:10,color:'var(--sub)',minWidth:60,textAlign:'right'}}>{atMax?'Nível máximo':`${xp}/${need}`}</span>
      </div>
      {!atMax&&xp>=need&&<div style={{padding:6,background:'rgba(244,208,63,.06)',border:'1px solid rgba(244,208,63,.2)',borderRadius:4,fontFamily:"'Cinzel',serif",fontSize:9,color:'#f4d03f',textAlign:'center',fontWeight:700,marginBottom:10}}>✦ LEVEL UP! → Nível {lv+1}: {milestone(lv+1)}</div>}

      <St>Progressão por Nível</St>
      <div style={{marginBottom:8}}>
        {Array.from({length:LV_MAX-LV_MIN+1},(_,k)=>LV_MIN+k).map(n=>{
          const cur=n===lv, done=n<=lv;
          return (
            <div key={n} style={{display:'flex',gap:8,padding:'3px 6px',fontSize:11,borderBottom:'1px solid var(--border)',background:cur?'rgba(201,169,110,.08)':'transparent',color:done?'var(--text)':'var(--sub)'}}>
              <span style={{fontFamily:"'Cinzel',serif",fontWeight:700,minWidth:34,color:cur?'var(--gold)':'inherit'}}>Nv {n}</span>
              <span style={{minWidth:62,color:'var(--sub)'}}>{n<LV_MAX?`${XP_TABLE[n-1]} XP`:'—'}</span>
              <span style={{minWidth:24}}>+{profBonus(n)}</span>
              <span style={{minWidth:44,color:'var(--gold)'}}>{ppEarned(n)} PP</span>
              <span style={{minWidth:74,color:'var(--sub)'}} title="XP por sessão: mínimo–típico–máximo (R9-4)">{XP_SESSION[n]?XP_SESSION[n].join('–'):'—'}</span>
              <span style={{flex:1}}>{milestone(n)}</span>
            </div>
          );
        })}
      </div>
      <div style={{fontSize:9,color:'var(--sub)',marginBottom:4}}>A cada nível rolam-se HP e MP e ganha-se 1 PP (2 nos níveis 5, 10 e 15; 15 no total), gasto só em atributos e auras (D-89). O nível não dá outro poder: técnicas, Técnica Assinatura e Despertar Divino vêm do treino e da história.</div>
      <div style={{fontSize:9,color:'var(--sub)',marginBottom:12}}>Colunas: nível · XP para subir ao próximo · proficiência · PP acumulados · XP por sessão (mín.–típico–máx.) · benefício de nível. A cada nível rolam-se HP e MP (aba Atributos) e ganham-se 3 PP (gastos nas abas Atributos e Auras; acumulam).</div>

      <St>Durabilidade (regra opcional)</St>
      <div style={{fontSize:10,color:'var(--sub)',marginBottom:6}}>Apêndice (P-034, R10-7, D-76, D-79): tudo começa com durabilidade 10. Arma: −0,25 por ataque e −1 por Aparar. Armadura: −1 por acerto crítico sofrido. Escudo: −1 por Aparar com escudo (a arma também perde 1) e −1 por todo Proteger de quem o carrega. Com 0, a arma causa 1 + mod; armadura ou escudo se perde. Ferreiros reparam.</div>
      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
        {[[false,'Arma (−0,25/ataque)'],[true,'Armadura ou escudo (−1/evento)']].map(([isArmor,lbl])=>(
          <button key={lbl} onClick={()=>setDurArmor(isArmor)} style={{padding:'4px 10px',borderRadius:16,fontSize:11,cursor:'pointer',border:`1px solid ${durArmor===isArmor?'var(--gold-dim)':'var(--border)'}`,background:durArmor===isArmor?'rgba(201,169,110,.1)':'transparent',color:durArmor===isArmor?'var(--gold)':'var(--sub)',fontFamily:'inherit'}}>{lbl}</button>
        ))}
      </div>
      <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          <div style={{display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:9,color:'var(--sub)',minWidth:40}}>{durArmor?'Eventos':'Ataques'}</span><Nc value={durAtk} onDec={()=>setDurAtk(v=>Math.max(0,v-1))} onInc={()=>setDurAtk(v=>Math.min(200,v+1))}/></div>
          <div style={{display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:9,color:'var(--sub)',minWidth:40}}>Atual</span><Nc value={durCur} onDec={()=>setDurCur(v=>Math.max(0,v-1))} onInc={()=>setDurCur(v=>Math.min(200,v+1))}/></div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <Sb label="Perda" value={durLoss.toFixed(2)} color="#b83030"/>
          <Sb label="Restante" value={durRem.toFixed(2)} color={durRem<=0?'#b83030':durRem<=5?'var(--gold)':'#3a7a4c'}/>
        </div>
      </div>
    </div>
  );
}

// ── SalvarTab ─────────────────────────────────────────────────────────────────
function SalvarTab({ sheet, onUpdate }) {
  const u = onUpdate;
  const [jsonOut,setJsonOut]=useState('');
  const [jsonIn,setJsonIn]=useState('');
  const fileRef=useRef(null);

  function doExport(){
    const out=JSON.stringify(sheet,null,2);
    setJsonOut(out);
  }
  function doDownload(){
    const nm=(sheet.name||'personagem').replace(/\s+/g,'_').toLowerCase();
    const bl=new Blob([JSON.stringify(sheet,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download=nm+'_crepusculo.json';a.click();URL.revokeObjectURL(a.href);
  }
  function doImport(){
    try {
      const d=JSON.parse(jsonIn.trim());
      const {id,owner,linkedTokenId,...rest}=d;
      u(rest);
    } catch(e){alert('Erro no JSON: '+e.message);}
  }
  function onFile(e){
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{setJsonIn(ev.target.result);};
    r.readAsText(f); e.target.value='';
  }

  return (
    <div>
      <St>Exportar</St>
      <p style={{fontSize:11,color:'var(--sub)',marginBottom:8}}>Gere e baixe o JSON do personagem.</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
        <RBtn onClick={doExport}>Gerar JSON</RBtn>
        <RBtn onClick={doDownload}>⬇ Baixar .json</RBtn>
      </div>
      <textarea readOnly value={jsonOut} placeholder="JSON gerado aqui..." style={{fontFamily:'monospace',fontSize:10,lineHeight:1.4,background:'var(--bg)',border:'1px solid var(--border)',color:'var(--gold)',borderRadius:4,padding:9,width:'100%',minHeight:80,resize:'vertical'}}/>

      <St>Importar</St>
      <p style={{fontSize:11,color:'var(--sub)',marginBottom:8}}>Cole JSON ou carregue arquivo. O ID e dono atual serão preservados.</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
        <RBtn onClick={doImport}>Carregar Texto</RBtn>
        <RBtn onClick={()=>fileRef.current?.click()}>📂 Arquivo</RBtn>
        <input ref={fileRef} type="file" accept=".json" style={{display:'none'}} onChange={onFile}/>
      </div>
      <textarea value={jsonIn} onChange={e=>setJsonIn(e.target.value)} placeholder="Cole JSON aqui..." style={{fontFamily:'monospace',fontSize:10,lineHeight:1.4,background:'var(--bg)',border:'1px solid var(--border)',color:'var(--gold)',borderRadius:4,padding:9,width:'100%',minHeight:80,resize:'vertical'}}/>
    </div>
  );
}

// ── SheetHeader ───────────────────────────────────────────────────────────────
function SheetHeader({ sheet, onUpdate, onClose, isReadOnly }) {
  const u = onUpdate;
  const imgRef=useRef(null);
  const curHP=sheet.curHP??0, maxHP=sheet.maxHP??1;
  const curMP=sheet.curMP??0, maxMP=sheet.maxMP??1;
  const hpPct=maxHP>0?curHP/maxHP:0;
  const hpColor=hpPct>0.5?'#4a9a5a':hpPct>0.2?'#c47830':'#b83030';

  async function handleImg(e){
    const f=e.target.files[0]; if(!f)return;
    const d=await resizeImage(f,128); u({image:d}); e.target.value='';
  }

  return (
    <div style={{display:'flex',gap:12,alignItems:'flex-start',padding:'14px 16px 12px',background:'rgba(0,0,0,0.25)',borderBottom:'1px solid var(--gold)',flexShrink:0}}>
      {/* Portrait */}
      <div onClick={()=>!isReadOnly&&imgRef.current?.click()} title="Clique para alterar imagem" style={{width:64,height:64,borderRadius:'50%',flexShrink:0,border:`3px solid ${sheet.color||'#888'}`,background:sheet.image?`url(${sheet.image}) center/cover`:'radial-gradient(circle at 35% 35%,#252538,#111120)',display:'flex',alignItems:'center',justifyContent:'center',cursor:isReadOnly?'default':'pointer',overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.6)'}}>
        {!sheet.image&&<span style={{color:'#fff',fontSize:20,fontWeight:700,userSelect:'none'}}>{(sheet.name||'?').substring(0,2).toUpperCase()}</span>}
      </div>
      <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/webp" style={{display:'none'}} onChange={handleImg}/>

      {/* Info */}
      <div style={{flex:1,minWidth:0}}>
        <input className="vtt-input" value={sheet.name||''} readOnly={isReadOnly} onChange={e=>u({name:e.target.value})} style={{fontWeight:700,fontSize:15,marginBottom:4,color:'var(--gold)'}}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 56px',gap:5,marginBottom:7}}>
          <input className="vtt-input" placeholder="Raça" value={sheet.race||''} readOnly={isReadOnly} onChange={e=>u({race:e.target.value})}/>
          <input className="vtt-input" placeholder="Profissão" value={sheet.prof==='custom'?sheet.customProf?.name||'Personalizado':profKey(sheet)||''} readOnly onChange={()=>{}}/>
          <input className="vtt-input" type="number" min={LV_MIN} max={LV_MAX} value={sheet.level||LV_MIN} readOnly={isReadOnly} onChange={e=>u({level:Math.max(LV_MIN,Math.min(LV_MAX,parseInt(e.target.value,10)||LV_MIN))})} style={{textAlign:'center'}} title="Nível (3–15)"/>
        </div>
        {/* HP */}
        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}>
          <span style={{fontSize:10,color:hpColor,fontWeight:700,width:22}}>HP</span>
          <input className="vtt-input" type="number" min={0} max={maxHP} value={curHP} onChange={e=>u({curHP:Math.max(0,Math.min(maxHP,parseInt(e.target.value,10)||0))})} style={{width:48,textAlign:'center'}}/>
          <span style={{color:'var(--sub)',fontSize:11}}>/</span>
          <input className="vtt-input" type="number" min={1} value={maxHP} onChange={e=>u({maxHP:Math.max(1,parseInt(e.target.value,10)||1)})} style={{width:48,textAlign:'center'}}/>
          <Bar value={curHP} max={maxHP} color={hpColor}/>
        </div>
        {/* MP */}
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          <span style={{fontSize:10,color:'#3a6aaa',fontWeight:700,width:22}}>MP</span>
          <input className="vtt-input" type="number" min={0} max={maxMP} value={curMP} onChange={e=>u({curMP:Math.max(0,Math.min(maxMP,parseInt(e.target.value,10)||0))})} style={{width:48,textAlign:'center'}}/>
          <span style={{color:'var(--sub)',fontSize:11}}>/</span>
          <input className="vtt-input" type="number" min={0} value={maxMP} onChange={e=>u({maxMP:Math.max(0,parseInt(e.target.value,10)||0)})} style={{width:48,textAlign:'center'}}/>
          <Bar value={curMP} max={maxMP} color="#3a6aaa"/>
        </div>
      </div>

      {/* Close */}
      <button onClick={onClose} style={{background:'none',border:'none',color:'var(--sub)',cursor:'pointer',fontSize:18,lineHeight:1,padding:'0 2px',flexShrink:0,alignSelf:'flex-start'}} title="Fechar (Esc)"
        onMouseEnter={e=>{e.currentTarget.style.color='var(--text)';}} onMouseLeave={e=>{e.currentTarget.style.color='var(--sub)';}}>✕</button>
    </div>
  );
}

// ── CharacterSheet (main export) ──────────────────────────────────────────────
const TABS = [
  {id:'perfil',    label:'Perfil'},
  {id:'atributos', label:'Atributos'},
  {id:'pericias',  label:'Perícias'},
  {id:'inventario',label:'Inventário'},
  {id:'auras',     label:'Auras'},
  {id:'tecnicas',  label:'Técnicas'},
  {id:'xp',        label:'XP'},
  {id:'salvar',    label:'Salvar'},
];

export default function CharacterSheet({
  sheet, onUpdate, onClose,
  isReadOnly = false, isGM = false,
  addLog, playSfx,
  targetToken, combatActive,
  linkedToken, onTokenUpdate,
  offsetIndex = 0,
}) {
  const [tab,setTab] = useState('perfil');

  // Wrap onUpdate to also sync relevant fields to the linked token
  function update(changes) {
    // D-53: subir de nível encerra as compras de PP do nível anterior (ficam confirmadas)
    if ('level' in changes && changes.level > sheetLevel(sheet) && !('ppConf' in changes)) changes = { ...changes, ppConf: ppConfirmState(sheet), herLivre: false };
    onUpdate(changes);
    if(onTokenUpdate && linkedToken) {
      const sync={};
      if('curHP' in changes) sync.hp=changes.curHP;
      if('maxHP' in changes) sync.maxHp=changes.maxHP;
      if('curMP' in changes) sync.mp=changes.curMP;
      if('maxMP' in changes) sync.maxMp=changes.maxMP;
      if('name' in changes) sync.name=changes.name;
      if('level' in changes) sync.level=changes.level;
      if('auraInit' in changes) sync.aura=changes.auraInit;
      if('ac' in changes) sync.ac=changes.ac;
      if('movement' in changes) sync.movement=changes.movement;
      if(Object.keys(sync).length>0) onTokenUpdate(sync);
    }
  }

  // Fichas anteriores à rodada 6 (sem ppConf): as compras de PP que já existem contam como confirmadas (D-53)
  useEffect(()=>{
    // D-89: ficha salva com a economia antiga de PP → reembolsa as compras e pede para redistribuir (aviso na barra de PP)
    if(!isReadOnly){
      const conv=convertOldPP(sheet);
      if(conv?.ppConf) onUpdate(conv);
      else { const ch={...(conv||{})}; if(sheet.ppConf===undefined) ch.ppConf=ppConfirmState(sheet); if(Object.keys(ch).length) onUpdate(ch); }
    }
    // P-040: "Arkano" passou a se chamar "Canalizador"
    if(!isReadOnly && PROF_RENAMES[sheet.prof]) onUpdate({ prof: PROF_RENAMES[sheet.prof] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sheet.id]);

  // Sync curHP/maxHP from linkedToken when it changes externally
  useEffect(()=>{
    if(!linkedToken)return;
    const changes={};
    if(linkedToken.hp!==undefined && linkedToken.hp!==(sheet.curHP??0)) changes.curHP=linkedToken.hp;
    if(linkedToken.maxHp!==undefined && linkedToken.maxHp!==(sheet.maxHP??0)) changes.maxHP=linkedToken.maxHp;
    if(linkedToken.mp!==undefined && linkedToken.mp!==(sheet.curMP??0)) changes.curMP=linkedToken.mp;
    if(linkedToken.maxMp!==undefined && linkedToken.maxMp!==(sheet.maxMP??0)) changes.maxMP=linkedToken.maxMp;
    if(Object.keys(changes).length>0) onUpdate(changes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[linkedToken?.hp,linkedToken?.maxHp,linkedToken?.mp,linkedToken?.maxMp]);

  // Escape key to close
  useEffect(()=>{
    const h=(e)=>{if(e.key==='Escape'){e.stopPropagation();onClose();}};
    window.addEventListener('keydown',h,true);
    return ()=>window.removeEventListener('keydown',h,true);
  },[onClose]);

  const panelOffset = offsetIndex>0 ? {transform:`translate(${offsetIndex*28}px,${offsetIndex*-14}px)`} : {};

  const tabContent = {
    perfil:     <PerfilTab sheet={sheet} onUpdate={update} isReadOnly={isReadOnly}/>,
    atributos:  <AtributosTab sheet={sheet} onUpdate={update} isReadOnly={isReadOnly} addLog={addLog} playSfx={playSfx} targetToken={targetToken} combatActive={combatActive}/>,
    pericias:   <PericiasTab sheet={sheet} onUpdate={update} isReadOnly={isReadOnly} addLog={addLog} playSfx={playSfx}/>,
    inventario: <InventarioTab sheet={sheet} onUpdate={update} isReadOnly={isReadOnly}/>,
    auras:      <AurasTab sheet={sheet} onUpdate={update} isReadOnly={isReadOnly}/>,
    tecnicas:   <TecnicasTab sheet={sheet} onUpdate={update} isReadOnly={isReadOnly} addLog={addLog} playSfx={playSfx} targetToken={targetToken}/>,
    xp:         <XpTab sheet={sheet} onUpdate={update} isReadOnly={isReadOnly}/>,
    salvar:     <SalvarTab sheet={sheet} onUpdate={update}/>,
  };

  return (
    <div style={{position:'fixed',inset:0,zIndex:2000+offsetIndex,background:offsetIndex===0?'rgba(0,0,0,0.72)':'rgba(0,0,0,0.18)',display:'flex',alignItems:'center',justifyContent:'center'}}
      onMouseDown={offsetIndex===0?onClose:undefined}>
      <div style={{background:'var(--panel)',border:'1px solid var(--gold)',borderRadius:8,width:560,maxWidth:'96vw',maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 12px 50px rgba(0,0,0,0.9),0 0 0 1px rgba(201,169,110,.08) inset',overflow:'hidden',...panelOffset}}
        onMouseDown={e=>e.stopPropagation()}>

        <SheetHeader sheet={sheet} onUpdate={update} onClose={onClose} isReadOnly={isReadOnly}/>

        {/* Tab bar */}
        <div style={{display:'flex',flexShrink:0,borderBottom:'1px solid var(--border)',background:'rgba(0,0,0,0.15)',overflowX:'auto'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:'7px 4px',background:'none',border:'none',color:tab===t.id?'var(--gold)':'var(--sub)',borderBottom:tab===t.id?'2px solid var(--gold)':'2px solid transparent',cursor:'pointer',fontSize:9,fontFamily:"'Cinzel',serif",whiteSpace:'nowrap',fontWeight:tab===t.id?700:600,letterSpacing:'.08em',textTransform:'uppercase',transition:'color .12s'}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:'auto',padding:'10px 14px 16px'}}>
          {tabContent[tab]}
        </div>
      </div>
    </div>
  );
}
