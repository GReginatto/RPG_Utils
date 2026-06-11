import { useState, useEffect, useRef } from 'react';
import { rollDice } from '../utils/dice';
import { resizeImage } from '../utils/imageUtils';
import {
  ATTRS, RACES_DATA, PROFESSIONS_DATA, SKILLS,
  AURA_GROUPS, AURA_DETAILS, XP_TABLE, GENERIC_TECHS,
  FORT_ELEMENTS, FORT_BONUSES, FORT_SPECIAL, EXH_DESC,
} from '../utils/rpgData';

// ── helpers ───────────────────────────────────────────────────────────────────
function getProf(sheet) {
  return sheet.prof === 'custom'
    ? (sheet.customProf || { m: {}, hp: '1d8', mp: '1d8', mv: '9+DEX', sk: '' })
    : (PROFESSIONS_DATA[sheet.prof] || { m: {}, hp: '1d8', mp: '1d8', mv: '9+DEX', sk: '' });
}
function finalAttr(sheet, a) {
  const p = getProf(sheet);
  return (sheet.attrs?.[a] ?? 6) + (p.m?.[a] ?? 0) + (RACES_DATA[sheet.race]?.bonus?.[a] ?? 0);
}
function amod(v) { return Math.floor(((v ?? 10) - 10) / 2); }
function mstr(v) { const m = amod(v); return m >= 0 ? `+${m}` : `${m}`; }
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

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
      {RACES_DATA[race] && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeft: `3px solid ${RACES_DATA[race].c}`, borderRadius: 4, padding: '8px 10px', fontSize: 11, color: 'var(--sub)', fontStyle: 'italic', marginBottom: 10 }}>
          {RACES_DATA[race].ab}
        </div>
      )}

      <St>Profissão</St>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
        {[...Object.keys(PROFESSIONS_DATA),'custom'].map(key => {
          const on = (sheet.prof||'custom') === key;
          return <button key={key} onClick={() => !isReadOnly && u({prof:key})} style={{ padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: isReadOnly?'default':'pointer', border: `1px solid ${on?'var(--gold-dim)':'var(--border)'}`, background: on?'rgba(201,169,110,.1)':'transparent', color: on?'var(--gold)':'var(--sub)', fontFamily: 'inherit' }}>{key==='custom'?'✎ Personalizado':key}</button>;
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--sub)', marginBottom: 8 }}>
        <b style={{color:'var(--text)'}}>Perícias:</b> {p.sk||'—'} · <b style={{color:'var(--text)'}}>HP:</b> {p.hp||'1d8'}+CON · <b style={{color:'var(--text)'}}>MP:</b> {p.mp||'1d8'}+INT · <b style={{color:'var(--text)'}}>Movi:</b> {p.mv||'9+DEX'}m
      </div>

      {(sheet.prof||'custom')==='custom' && !isReadOnly && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 5, padding: '10px 12px', marginBottom: 10 }}>
          <St style={{marginTop:0}}>Editor de Profissão</St>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            {[['Nome','name',''],['Dado HP','hp','1d8'],['Dado MP','mp','1d8'],['Locomoção','mv','9+DEX']].map(([lbl,f,ph]) => (
              <div key={f}><Lb>{lbl}</Lb><input className="vtt-input" placeholder={ph} value={sheet.customProf?.[f]||''} onChange={e => u({customProf:{...(sheet.customProf||{}), [f]:e.target.value}})} /></div>
            ))}
          </div>
          <Lb>Perícias</Lb>
          <input className="vtt-input" style={{marginBottom:8}} value={sheet.customProf?.sk||''} onChange={e => u({customProf:{...(sheet.customProf||{}),sk:e.target.value}})} />
          <Lb>Modificadores</Lb>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {ATTRS.map(a => {
              const v = sheet.customProf?.m?.[a]??0;
              return (
                <div key={a} style={{display:'flex',alignItems:'center',gap:4}}>
                  <span style={{fontSize:10,color:'var(--sub)',width:28}}>{a}</span>
                  <Nc value={(v>=0?'+':'')+v} color={v>0?'#3a7a4c':v<0?'#b83030':'var(--text)'}
                    onDec={()=>u({customProf:{...(sheet.customProf||{}),m:{...(sheet.customProf?.m||{}),[a]:v-1}}})}
                    onInc={()=>u({customProf:{...(sheet.customProf||{}),m:{...(sheet.customProf?.m||{}),[a]:v+1}}})} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <St>Aparência & Personalidade</St>
      {[['Aparência','appearance','Descrição física...',2],['Personalidade','personality','Traços, ideais, defeitos...',2],['História','background','Background...',3],['Motivação','motivation','Motivação?',2],['Notas','notes','Anotações...',2]].map(([lbl,f,ph,rows]) => (
        <div key={f} style={{marginBottom:8}}><Lb>{lbl}</Lb><textarea className="vtt-input" rows={rows} placeholder={ph} readOnly={isReadOnly} value={sheet[f]||''} onChange={e=>u({[f]:e.target.value})} style={{resize:'vertical',lineHeight:1.5}} /></div>
      ))}
    </div>
  );
}

// ── AtributosTab ──────────────────────────────────────────────────────────────
function AtributosTab({ sheet, onUpdate, isReadOnly, addLog, playSfx, targetToken, combatActive }) {
  const u = onUpdate;
  const p = getProf(sheet);

  const conFin = finalAttr(sheet,'CON'), intFin = finalAttr(sheet,'INT');
  const dexFin = finalAttr(sheet,'DEX'), domFin = finalAttr(sheet,'DOM');
  const conMod = amod(conFin), intMod = amod(intFin), dexMod = amod(dexFin), domMod = amod(domFin);

  const hDie = (p.hp||'1d8').match(/(\d+)d(\d+)/);
  const hN=hDie?+hDie[1]:1, hS=hDie?+hDie[2]:8;
  const mDie = (p.mp||'1d8').match(/(\d+)d(\d+)/);
  const mN=mDie?+mDie[1]:1, mS=mDie?+mDie[2]:8;

  const baseHP = hN*hS+conMod, baseMP = mN*mS+intMod;
  const bonusHP = (sheet.hpRolls||[]).reduce((s,v)=>s+v,0);
  const bonusMP = (sheet.mpRolls||[]).reduce((s,v)=>s+v,0);
  const calcMaxHP = Math.max(1,baseHP+bonusHP);
  const calcMaxMP = Math.max(0,baseMP+bonusMP);

  const mvBase = parseInt((p.mv||'9+DEX').match(/(\d+)/)?.[1]||'9');
  const movement = mvBase+dexMod;

  const usedPts = ATTRS.reduce((s,a)=>s+(sheet.attrs?.[a]??6)-6,0);
  const leftPts = 35-usedPts;
  const ptColor = leftPts<0?'#b83030':leftPts===0?'#3a7a4c':'var(--gold)';

  const curHP = sheet.curHP??0, maxHP = sheet.maxHP||calcMaxHP;
  const curMP = sheet.curMP??0, maxMP = sheet.maxMP||calcMaxMP;
  const hpPct = maxHP>0?curHP/maxHP:0;
  const hpColor = hpPct>0.5?'#4a9a5a':hpPct>0.2?'#c47830':'#b83030';

  function emit(text) { addLog?.(text,'dice'); playSfx?.('dice'); }

  function rollLevelUp() {
    const hR = rollDice(hN,hS,conMod), mR = rollDice(mN,mS,intMod);
    const hGain=Math.max(1,hR.total), mGain=Math.max(0,mR.total);
    const hp2=[...(sheet.hpRolls||[]),hGain], mp2=[...(sheet.mpRolls||[]),mGain];
    const newMaxHP=Math.max(1,baseHP+hp2.reduce((s,v)=>s+v,0));
    const newMaxMP=Math.max(0,baseMP+mp2.reduce((s,v)=>s+v,0));
    u({hpRolls:hp2,mpRolls:mp2,maxHP:newMaxHP,maxMP:newMaxMP,curHP:newMaxHP,curMP:newMaxMP});
    emit(`🎲 Level ${hp2.length+1}! HP +${hGain} [${hR.rolls.join(',')}${conMod>=0?'+':''}${conMod}] · MP +${mGain}`);
  }

  function doRest(type) {
    if (type==='short') {
      const rec=Math.ceil(calcMaxMP*0.5), newMp=Math.min(maxMP,(curMP)+rec);
      u({curMP:newMp}); addLog?.(`☕ ${sheet.name} descanso curto. MP: ${curMP}→${newMp}`,'heal');
    } else {
      u({curHP:calcMaxHP,curMP:calcMaxMP,maxHP:calcMaxHP,maxMP:calcMaxMP});
      addLog?.(`🛏 ${sheet.name} descanso longo. HP/MP restaurados.`,'heal');
    }
    playSfx?.('heal');
  }

  return (
    <div>
      {/* Point buy indicator */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'7px 14px',borderRadius:5,marginBottom:10, background:leftPts<0?'rgba(184,48,48,.06)':'rgba(201,169,110,.04)', border:`1px solid ${leftPts<0?'rgba(184,48,48,.2)':'rgba(201,169,110,.15)'}` }}>
        <span style={{fontSize:11,color:'var(--sub)'}}>Pontos:</span>
        <span style={{fontSize:22,fontWeight:700,fontFamily:"'Cinzel',serif",color:ptColor}}>{leftPts}</span>
        <span style={{fontSize:10,color:'var(--sub)'}}>/35</span>
      </div>

      {/* Attribute boxes */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:12 }}>
        {ATTRS.map(a => {
          const base=sheet.attrs?.[a]??6, fin=finalAttr(sheet,a), mod=amod(fin);
          const pm=getProf(sheet).m?.[a]??0, rm=RACES_DATA[sheet.race]?.bonus?.[a]??0;
          return (
            <div key={a} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:5,padding:'6px 3px',textAlign:'center'}}>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:'var(--gold)',fontWeight:700,letterSpacing:'.12em',marginBottom:3}}>{a}</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:2}}>
                {!isReadOnly&&<button style={NB} onClick={()=>u({attrs:{...sheet.attrs,[a]:Math.max(6,base-1)}})}>−</button>}
                <span style={{minWidth:20,textAlign:'center',fontWeight:700,fontSize:13}}>{base}</span>
                {!isReadOnly&&<button style={NB} onClick={()=>u({attrs:{...sheet.attrs,[a]:Math.min(18,base+1)}})}>+</button>}
              </div>
              {(pm!==0||rm!==0)&&<div style={{fontSize:7,color:'var(--sub)',marginTop:2}}>{pm!==0&&<span style={{color:pm>0?'#3a7a4c':'#b83030'}}>P{pm>0?'+':''}{pm}</span>}{rm!==0&&<span style={{color:'#3a7a4c',marginLeft:2}}>R+{rm}</span>}</div>}
              <div style={{fontSize:17,fontWeight:700,fontFamily:"'Cinzel',serif",marginTop:2}}>{fin}</div>
              <div style={{fontSize:9,color:mod>=0?'#3a7a4c':'#b83030'}}>mod {mod>=0?'+':''}{mod}</div>
            </div>
          );
        })}
      </div>

      {/* Derived stats */}
      <St>Derivados</St>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
        <Sb label="HP Base" value={baseHP} sub={`${p.hp||'1d8'}${conMod>=0?'+':''}${conMod}`} color="#b83030"/>
        <Sb label="MP Base" value={baseMP} sub={`${p.mp||'1d8'}${intMod>=0?'+':''}${intMod}`} color="#3a6aaa"/>
        <Sb label="HP Total" value={calcMaxHP} sub={bonusHP?`base+${bonusHP}`:'base'} color="#b83030"/>
        <Sb label="MP Total" value={calcMaxMP} sub={bonusMP?`base+${bonusMP}`:'base'} color="#3a6aaa"/>
        <Sb label="Movimento" value={`${movement}m`} sub={`${mvBase}${dexMod>=0?'+':''}${dexMod}`} color="#3a7a4c"/>
        <Sb label="Iniciativa" value={`3d8${mstr(domFin)}`} sub="DOM"/>
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
      <St>Rolagem de Level Up</St>
      <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:5,padding:'10px 12px',marginBottom:10}}>
        <div style={{fontSize:11,color:'var(--sub)',marginBottom:6}}>Nv.1 = máx do dado + mod. Cada level up seguinte, role o dado e some o modificador.</div>
        {!isReadOnly&&(
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
            <RBtn onClick={rollLevelUp}>🎲 Rolar Level Up</RBtn>
            <RBtn onClick={()=>{const hp=[...(sheet.hpRolls||[])];const mp=[...(sheet.mpRolls||[])];hp.pop();mp.pop();u({hpRolls:hp,mpRolls:mp});}}>↩ Desfazer</RBtn>
            <RBtn onClick={()=>u({hpRolls:[],mpRolls:[]})}>Resetar</RBtn>
          </div>
        )}
        {(sheet.hpRolls?.length??0)>0?(
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {(sheet.hpRolls||[]).map((v,i)=>(
              <div key={i} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:4,padding:'3px 7px',fontSize:10,textAlign:'center'}}>
                <div style={{fontSize:8,color:'var(--sub)'}}>Nv.{i+2}</div>
                <span style={{color:'#b83030',fontWeight:700}}>+{v}</span><span style={{color:'var(--sub)'}}> / </span><span style={{color:'#3a6aaa',fontWeight:700}}>+{(sheet.mpRolls||[])[i]??0}</span>
              </div>
            ))}
          </div>
        ):(
          <div style={{fontSize:10,color:'var(--sub)',fontStyle:'italic'}}>Nenhuma rolagem. Nível atual: 1 (base).</div>
        )}
      </div>

      {/* Combat stats */}
      <St>Combate</St>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
        {[['CA','ac',10],['Movimento (m)','movement',9],['Bônus Prof.','profBonus',2]].map(([lbl,f,def])=>(
          <div key={f}><Lb>{lbl}</Lb><input className="vtt-input" type="number" min={0} value={sheet[f]??def} readOnly={isReadOnly} onChange={e=>u({[f]:Math.max(0,parseInt(e.target.value,10)||0)})} style={{textAlign:'center'}}/></div>
        ))}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:targetToken?4:10}}>
        <span style={{fontSize:11,color:'var(--sub)',width:80}}>Iniciativa</span>
        <span style={{color:'var(--gold)',fontWeight:700}}>3d8{mstr(domFin)}</span>
        <RBtn onClick={()=>{const r=rollDice(3,8,domMod);emit(`⚡ ${sheet.name||'Personagem'} iniciativa: [${r.rolls.join('+')}]${mstr(domFin)} = ${r.total}`);}}>Rolar</RBtn>
      </div>
      {targetToken&&<div style={{fontSize:10,color:'var(--sub)',marginBottom:10}}>Alvo: <span style={{color:'var(--gold)'}}>{targetToken.name}</span> (CA {targetToken.ac})</div>}

      {/* Falls */}
      <St>Quedas</St>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <Nc value={sheet.falls??0} color="#b83030" onDec={()=>u({falls:Math.max(0,(sheet.falls??0)-1)})} onInc={()=>u({falls:Math.min(4,(sheet.falls??0)+1)})}/>
        <span style={{fontSize:10,color:'var(--sub)'}}>/4</span>
        <RBtn onClick={()=>u({falls:0})}>Reset</RBtn>
      </div>

      {/* Rest */}
      <St>Descanso</St>
      <div style={{display:'flex',gap:8}}>
        {[['☕ Descanso Curto','short','Recupera 50% do MP máximo (10 min)'],['🛏 Descanso Longo','long','Recupera 100% HP e MP (8h)']].map(([lbl,type,title])=>(
          <button key={type} className="tbtn" disabled={!!combatActive} title={combatActive?'Indisponível em combate':title}
            onClick={()=>window.confirm(`${title}. Confirmar?`)&&doRest(type)}
            style={{flex:1,fontSize:11,opacity:combatActive?0.4:1}}>{lbl}</button>
        ))}
      </div>
    </div>
  );
}

// ── PericiasTab ───────────────────────────────────────────────────────────────
function PericiasTab({ sheet, onUpdate, isReadOnly, addLog, playSfx }) {
  const u = onUpdate;
  const profs = sheet.proficiencies||[];
  const custom = sheet.customProfs||[];
  const [form,setForm] = useState({n:'',a:'DEX'});

  function toggle(name) {
    if(isReadOnly)return;
    const idx=profs.indexOf(name);
    u({proficiencies:idx>=0?profs.filter(x=>x!==name):[...profs,name]});
  }
  function rollSkill(name,attr) {
    const fin=finalAttr(sheet,attr), mod=amod(fin)+(profs.includes(name)?2:0);
    const r=rollDice(1,20,mod);
    addLog?.(`🎯 ${sheet.name||'Personagem'} — ${name} (${attr}${profs.includes(name)?'+2':''}): [${r.rolls[0]}]${mod>=0?'+':''}${mod} = ${r.total}`,'dice');
    playSfx?.('dice');
  }
  function addCustom() {
    if(!form.n.trim())return;
    u({customProfs:[...custom,{n:form.n.trim(),a:form.a}]});
    setForm({n:'',a:'DEX'});
  }

  const allSkills=[...SKILLS,...custom.map(p=>({n:p.n,a:p.a}))];

  return (
    <div>
      <St>Perícias</St>
      <div style={{fontSize:11,color:'var(--sub)',marginBottom:10}}>Clique no círculo para marcar proficiência. Bônus = mod do atributo + proficiência (+2).</div>
      {allSkills.map((sk,i)=>{
        const isC=i>=SKILLS.length, on=profs.includes(sk.n);
        const fin=finalAttr(sheet,sk.a), mod=amod(fin), total=mod+(on?2:0);
        return (
          <div key={sk.n} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 6px',borderRadius:4}}>
            <div onClick={()=>toggle(sk.n)} style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${on?'var(--gold)':'var(--border)'}`,background:on?'var(--gold)':'transparent',cursor:isReadOnly?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'.2s'}}>
              {on&&<span style={{fontSize:9,color:'var(--bg)',fontWeight:700}}>✓</span>}
            </div>
            <span style={{fontSize:12,flex:1}}>{sk.n}{isC&&<span style={{fontSize:9,color:'var(--sub)',marginLeft:4}}>(custom)</span>}</span>
            <span style={{fontSize:9,color:'var(--sub)',fontFamily:"'Cinzel',serif",width:28,textAlign:'center'}}>{sk.a}</span>
            <span style={{fontSize:13,fontWeight:700,fontFamily:"'Cinzel',serif",width:28,textAlign:'center',color:total>=0?'#3a7a4c':'#b83030'}}>{total>=0?'+':''}{total}</span>
            <RBtn onClick={()=>rollSkill(sk.n,sk.a)}>1d20</RBtn>
            {isC&&!isReadOnly&&<button onClick={()=>{const nm=custom[i-SKILLS.length].n;u({customProfs:custom.filter((_,j)=>j!==i-SKILLS.length),proficiencies:profs.filter(x=>x!==nm)});}} style={{background:'none',border:'none',color:'var(--sub)',cursor:'pointer',fontSize:12}}>✕</button>}
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
        {[['copper','CO (Cobre)','#b87333'],['silver','LP (Prata)','#aaa'],['gold','FC (Ouro)','#c9a96e']].map(([key,lbl,color])=>(
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
function AurasTab({ sheet, onUpdate, isReadOnly }) {
  const u = onUpdate;
  const [selGroup,setSelGroup] = useState(null);

  const CX=130,CY=130,R=96;
  function hexPos(deg){ return { x:CX+R*Math.cos((deg-90)*Math.PI/180), y:CY+R*Math.sin((deg-90)*Math.PI/180) }; }

  function auraDistance(a,b){
    const ia=AURA_GROUPS.findIndex(g=>g.n===a), ib=AURA_GROUPS.findIndex(g=>g.n===b);
    if(ia<0||ib<0)return 0;
    const d=Math.abs(ia-ib); return Math.min(d,6-d);
  }

  const auras=selGroup&&selGroup!=='Titânica'?AURA_DETAILS[selGroup]:null;

  return (
    <div>
      <St>Hexagrama das Auras</St>
      <div style={{fontSize:11,color:'var(--sub)',textAlign:'center',marginBottom:10}}>Clique em um grupo para ver afinidades e auras.</div>

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
          {/* 6 aura nodes */}
          {AURA_GROUPS.map(g=>{
            const p=hexPos(g.ag);
            const on=selGroup===g.n;
            let borderColor=g.c+'55';
            if(selGroup&&selGroup!==g.n&&selGroup!=='Titânica'){
              const d=auraDistance(selGroup,g.n);
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

      {/* Affinity info */}
      {selGroup==='Titânica'&&(
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderLeft:'3px solid #ff6600',borderRadius:4,padding:'10px 12px',marginBottom:12}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:13,fontWeight:700,color:'#ff6600',marginBottom:4}}>⬢ Titânica</div>
          <div style={{fontSize:11,color:'var(--sub)',lineHeight:1.6}}>Acesso a todos os grupos de aura (exceto Ícor) sem restrições de especialização. Nível 1: 3 auras/dia, uma por vez. Nível 2: 5 auras, 2 simultâneas. Nível 3: todas, 3 simultâneas, instantâneas.</div>
        </div>
      )}
      {selGroup&&selGroup!=='Titânica'&&(()=>{
        const g=AURA_GROUPS.find(x=>x.n===selGroup);
        if(!g)return null;
        return (
          <div style={{background:'var(--card)',border:'1px solid var(--border)',borderLeft:`3px solid ${g.c}`,borderRadius:4,padding:'10px 12px',marginBottom:12}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:13,fontWeight:700,color:g.c,marginBottom:5}}>{g.i} {selGroup} — Custo de afinidade</div>
            {AURA_GROUPS.filter(x=>x.n!==selGroup).map(x=>{
              const d=auraDistance(selGroup,x.n);
              const cost=d<=1?'1 pt':d===2?'2 pts':'3 pts';
              const col=d<=1?'#3a7a4c':d===2?'#c9a96e':'#b83030';
              return <div key={x.n} style={{display:'flex',justifyContent:'space-between',padding:'2px 0',borderBottom:'1px solid var(--border)',fontSize:11}}><span>{x.i} {x.n}</span><span style={{fontWeight:700,color:col}}>{cost}</span></div>;
            })}
          </div>
        );
      })()}

      {/* Aura catalog */}
      {auras&&(
        <>
          <St>{AURA_GROUPS.find(g=>g.n===selGroup)?.i} {selGroup} — Catálogo</St>
          {auras.map(aura=>(
            <Acc key={aura.n} title={aura.n} open>
              {aura.l.map((lv,i)=>{
                const g=AURA_GROUPS.find(x=>x.n===selGroup);
                return (
                  <div key={i} style={{padding:'7px 10px',marginBottom:5,borderRadius:4,borderLeft:`3px solid ${g?.c||'var(--border)'}`}}>
                    <div style={{fontFamily:"'Cinzel',serif",fontSize:10,fontWeight:700,color:g?.c||'var(--gold)',marginBottom:3}}>Nível {i+1}</div>
                    <div style={{fontSize:11,color:'var(--sub)',lineHeight:1.6}}>{lv}</div>
                  </div>
                );
              })}
            </Acc>
          ))}
        </>
      )}
      {!selGroup&&<div style={{textAlign:'center',padding:'24px 10px',color:'var(--sub)',fontStyle:'italic',fontSize:12}}>Clique em um grupo no hexagrama para ver suas auras.</div>}

      {/* Character's aura */}
      <St>Auras do Personagem</St>
      <div style={{marginBottom:8}}><Lb>Aura Inicial</Lb>
        <select className="vtt-select" value={sheet.auraInit||''} disabled={isReadOnly} onChange={e=>u({auraInit:e.target.value})}>
          <option value="">— Selecione —</option>
          {AURA_GROUPS.map(g=><option key={g.n} value={g.n}>{g.n}</option>)}
          <option value="Titânica">Titânica</option>
          <option value="Ícor">Ícor (Personalizada)</option>
        </select>
      </div>
      <div style={{marginBottom:8}}><Lb>Descrição / Manifestação</Lb>
        <textarea className="vtt-input" rows={2} placeholder="Como manifesta sua aura..." readOnly={isReadOnly} value={sheet.auraDesc||''} onChange={e=>u({auraDesc:e.target.value})} style={{resize:'vertical',lineHeight:1.5}}/>
      </div>
      <div><Lb>Auras Adicionais</Lb>
        <textarea className="vtt-input" rows={2} placeholder="Auras adquiridas na campanha..." readOnly={isReadOnly} value={sheet.extraAuras||''} onChange={e=>u({extraAuras:e.target.value})} style={{resize:'vertical',lineHeight:1.5}}/>
      </div>
    </div>
  );
}

// ── TecnicasTab ───────────────────────────────────────────────────────────────
function TecnicasTab({ sheet, onUpdate, isReadOnly, addLog, playSfx, targetToken }) {
  const u = onUpdate;
  const devTechs=sheet.devTechs||[];
  const attacks=sheet.attacks||[];
  const profBonus=sheet.profBonus??2;

  // Local UI state
  const [fortChecks,setFortChecks]=useState(Array(FORT_ELEMENTS.length).fill(false));
  const [showNewTech,setShowNewTech]=useState(false);
  const [showNewAtk,setShowNewAtk]=useState(false);
  const [editTechId,setEditTechId]=useState(null);
  const [editAtkId,setEditAtkId]=useState(null);
  const [techForm,setTechForm]=useState({name:'',cost:'',dmg:'',range:'',action:'Padrão',aura:'',fluxo:'Não',desc:'',forts:[],notes:''});
  const [atkForm,setAtkForm]=useState({name:'',attackDice:'1d20',damageDice:'1d8',damageType:'',range:'',linkedAttribute:'DOM',mpCost:0,notes:''});

  const auColors={};AURA_GROUPS.forEach(g=>{auColors[g.n]=g.c;});auColors['Titânica']='#ff6600';

  function emit(text,cat='dice'){addLog?.(text,cat);playSfx?.('dice');}

  // Fort calculator
  const {total:fortTotal,actions:fortActions} = (() => {
    let total=0,count=0;
    FORT_ELEMENTS.forEach((_,i)=>{
      if(!fortChecks[i])return; count++;
      if(FORT_SPECIAL[i])total+=FORT_SPECIAL[i][0]; else total+=FORT_BONUSES[i]||0;
    });
    return {total,actions:Math.max(0,count-1)};
  })();

  // Fluxo
  const fluxoActive=sheet.fluxoActive??false;
  const fluxoDeseq=sheet.fluxoDeseq??0;

  function toggleFluxo(){
    if(!fluxoActive){
      const log=[{t:'Fluxo iniciado! Ação bônus consumida.',c:'#3a7a4c'},...(sheet.fluxoLog||[])];
      u({fluxoActive:true,fluxoDeseq:0,fluxoLog:log});
    } else {
      const log=[{t:'Fluxo encerrado.',c:'var(--sub)'},...(sheet.fluxoLog||[])];
      u({fluxoActive:false,fluxoDeseq:0,fluxoLog:log});
    }
  }
  function fluxoHit(){
    if(!fluxoActive)return;
    const d=fluxoDeseq+1;
    const log=[{t:`Técnica #${d+1} acertou! Deseq: ${d} (−${d} MP ou +${d} atk · −${d} Def)`,c:'#3a7a4c'},...(sheet.fluxoLog||[])];
    u({fluxoDeseq:d,fluxoLog:log});
  }
  function fluxoMiss(){
    if(!fluxoActive)return;
    const log=[{t:`FALHOU! Fluxo interrompido. Desequilíbrio ${fluxoDeseq} persiste.`,c:'#b83030'},...(sheet.fluxoLog||[])];
    u({fluxoActive:false,fluxoLog:log});
  }
  function fluxoEnd(){
    if(!fluxoActive)return;
    const log=[{t:`Encerrado voluntariamente. Deseq ${fluxoDeseq} persiste até próx. turno.`,c:'var(--gold)'},...(sheet.fluxoLog||[])];
    u({fluxoActive:false,fluxoLog:log});
  }

  const domFin=finalAttr(sheet,'DOM');
  const maxPips=Math.max(domFin,8);

  // DevTech CRUD
  function saveDevTech(){
    if(!techForm.name.trim())return;
    if(editTechId){
      u({devTechs:devTechs.map(t=>t.id===editTechId?{...techForm,id:editTechId}:t)});
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
    const totalMod=amod(attrVal)+profBonus;
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
            </label>
          ))}
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <Sb label="Bônus Total" value={`+${fortTotal}%`} color="#3a7a4c"/>
          <Sb label="Ações Extra" value={fortActions}/>
          <Sb label="Turnos Prep." value={Math.max(0,fortActions-1)}/>
        </div>
      </div>

      {/* Fluxo de Aura */}
      <St>Fluxo de Aura</St>
      <div style={{fontSize:11,color:'var(--sub)',marginBottom:8}}>Encadeamento de técnicas. Cada acerto aumenta o Desequilíbrio.</div>
      <Acc title="Regras do Fluxo">
        <div style={{fontSize:11,color:'var(--sub)',lineHeight:1.6}}>
          <b style={{color:'var(--text)'}}>Gatilho:</b> Acertar uma técnica com dano/efeito. Consome ação bônus + MP.<br/>
          <b style={{color:'var(--text)'}}>Desequilíbrio:</b> +1 por técnica após a primeira. Persiste até próximo turno.<br/>
          <span style={{color:'#3a7a4c'}}><b>Benefícios:</b> −1 MP/ponto (mín 1) ou +1 acerto/dano por ponto.</span><br/>
          <span style={{color:'#b83030'}}><b>Riscos:</b> −1 Defesa por ponto. Falha: MP dobrada, limiar crítico.</span><br/>
          <b style={{color:'var(--text)'}}>Limite:</b> Máx técnicas = DOM ({domFin}).
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
            const on=i<fluxoDeseq, danger=on&&i>=Math.floor(maxPips*0.7);
            return <div key={i} style={{width:20,height:20,borderRadius:3,border:`1px solid ${danger?'#b83030':on?'var(--gold)':'var(--border)'}`,background:danger?'rgba(184,48,48,.15)':on?'rgba(201,169,110,.15)':'var(--card)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontFamily:"'Cinzel',serif",fontWeight:700,color:danger?'#b83030':on?'var(--gold)':'var(--sub)'}}>{i+1}</div>;
          })}
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
          <Sb label="Desequilíbrio" value={fluxoDeseq} color={fluxoDeseq>=Math.floor(maxPips*0.7)?'#b83030':'var(--gold)'}/>
          <Sb label="Bônus MP" value={`−${fluxoDeseq}`} color="#3a7a4c"/>
          <Sb label="Bônus Atk" value={`+${fluxoDeseq}`} color="#3a7a4c"/>
          <Sb label="Pen. Def" value={`−${fluxoDeseq}`} color="#b83030"/>
        </div>
        {!isReadOnly&&<div style={{display:'flex',gap:6,marginBottom:8}}>
          <button className="tbtn" onClick={fluxoHit} style={{background:'#3a7a4c'}}>✓ Acertou</button>
          <button className="tbtn" onClick={fluxoMiss} style={{background:'#b83030'}}>✕ Errou</button>
          <button className="tbtn" onClick={fluxoEnd}>Encerrar</button>
        </div>}
        <div style={{maxHeight:100,overflowY:'auto',fontSize:10,color:'var(--sub)'}}>
          {!(sheet.fluxoLog?.length)&&<div style={{padding:6,fontStyle:'italic'}}>Nenhum fluxo registrado.</div>}
          {(sheet.fluxoLog||[]).slice(0,15).map((l,i)=><div key={i} style={{padding:'3px 0',borderBottom:'1px solid var(--border)',color:l.c||'var(--sub)'}}>{l.t}</div>)}
        </div>
      </div>

      {/* Training sessions */}
      <St>Sessões de Treino</St>
      <div style={{fontSize:11,color:'var(--sub)',marginBottom:8}}>Técnicas desenvolvidas em Downtime. DOM controla o aprendizado.</div>
      <div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:5,padding:'10px 12px',marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:10,fontWeight:700,color:'var(--gold)'}}>ARKA DO LOCAL</span>
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
          {(sheet.arkaLocal??3)<=0?'⚠ ESGOTADO — Sem treino possível.':(sheet.arkaLocal??3)<=1?`⚠ Quase esgotado. Restam ${sheet.arkaLocal??3} sessões.`:`Arka disponível: ${sheet.arkaLocal??3}/${sheet.arkaCap??3}`}
        </div>
      </div>

      <div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:5,padding:'10px 12px',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',marginBottom:8}}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:10,fontWeight:700,color:'var(--gold)'}}>SESSÕES</span>
          {!isReadOnly&&<button className="tbtn" style={{marginLeft:'auto'}} onClick={()=>{
            const nome=window.prompt('Técnica a treinar:'); if(!nome)return;
            const need=parseInt(window.prompt('Sessões necessárias:','3'))||3;
            u({sessoesTreino:[...(sheet.sessoesTreino||[]),{nome,need,done:0,id:uid()}]});
          }}>+ Nova Sessão</button>}
        </div>
        {!(sheet.sessoesTreino?.length)&&<div style={{padding:10,color:'var(--sub)',fontStyle:'italic',fontSize:11}}>Nenhuma técnica em treino.</div>}
        {(sheet.sessoesTreino||[]).map(s=>{
          const pct=s.need>0?Math.round((s.done/s.need)*100):0, done=s.done>=s.need;
          return (
            <div key={s.id} style={{display:'flex',alignItems:'center',gap:8,background:'var(--card)',border:'1px solid var(--border)',borderRadius:5,padding:'8px 10px',marginBottom:6}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:done?'#3a7a4c':'var(--text)'}}>{s.nome}{done?' ✓':''}</div>
                <div style={{fontSize:9,color:'var(--sub)'}}>{s.done}/{s.need} sessões</div>
                <div style={{height:5,background:'var(--border)',borderRadius:3,marginTop:4,overflow:'hidden'}}><div style={{height:'100%',width:`${pct}%`,background:done?'#3a7a4c':'var(--gold)',borderRadius:3}}/></div>
              </div>
              {!isReadOnly&&<div style={{display:'flex',gap:4}}>
                {!done&&<button className="tbtn" style={{background:'#3a7a4c',padding:'3px 8px',fontSize:9}} onClick={()=>{
                  if((sheet.arkaLocal??3)<=0){addLog?.('Arka esgotada!','system');return;}
                  const ss=(sheet.sessoesTreino||[]).map(x=>x.id===s.id?{...x,done:Math.min(x.need,x.done+1)}:x);
                  u({sessoesTreino:ss,arkaLocal:Math.max(0,(sheet.arkaLocal??3)-1),exTreino:Math.min(5,(sheet.exTreino??0)+1)});
                }}>+</button>}
                <button style={NB} onClick={()=>u({sessoesTreino:(sheet.sessoesTreino||[]).map(x=>x.id===s.id&&x.done>0?{...x,done:x.done-1}:x)})}>↩</button>
                <button style={{...NB,color:'#b83030'}} onClick={()=>u({sessoesTreino:(sheet.sessoesTreino||[]).filter(x=>x.id!==s.id)})}>✕</button>
              </div>}
            </div>
          );
        })}
      </div>

      {/* Exhaustion */}
      <div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:5,padding:'10px 12px',marginBottom:14}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:10,fontWeight:700,color:'var(--gold)',marginBottom:6}}>EXAUSTÃO DE TREINO</div>
        <div style={{fontSize:11,color:'var(--sub)',marginBottom:6}}>+1 nível após cada sessão. Descanso Longo remove 1 nível.</div>
        <div style={{display:'flex',gap:4,marginBottom:6}}>
          {Array.from({length:5},(_,i)=>{
            const on=i<(sheet.exTreino??0);
            return <div key={i} onClick={()=>!isReadOnly&&u({exTreino:i<(sheet.exTreino??0)?i:i+1})} style={{width:24,height:24,borderRadius:4,border:`1px solid ${on?'#b83030':'var(--border)'}`,background:on?'rgba(184,48,48,.2)':'var(--card)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontFamily:"'Cinzel',serif",fontWeight:700,color:on?'#b83030':'var(--sub)',cursor:isReadOnly?'default':'pointer'}}>{i+1}</div>;
          })}
        </div>
        <div style={{fontSize:10,color:(sheet.exTreino??0)===0?'#3a7a4c':(sheet.exTreino??0)<=2?'var(--gold)':'#b83030',lineHeight:1.5}}>
          {EXH_DESC[Math.min(sheet.exTreino??0,4)]||'Sem exaustão de treino.'}
        </div>
        {!isReadOnly&&<div style={{display:'flex',gap:6,marginTop:8}}>
          <RBtn onClick={()=>u({exTreino:Math.max(0,(sheet.exTreino??0)-1)})}>Descanso Longo (−1)</RBtn>
          <RBtn onClick={()=>u({exTreino:0})}>Limpar</RBtn>
        </div>}
      </div>

      {/* Técnica Máxima */}
      <St>Técnica Máxima</St>
      <Acc title="Técnicas Máximas (Nível 10+)">
        <div style={{fontSize:11,color:'var(--sub)',lineHeight:1.6,marginBottom:8}}>Ao atingir <span style={{color:'var(--gold)'}}>nível 10</span> ou superior, o personagem pode criar uma <span style={{color:'var(--gold)'}}>Técnica Máxima</span> — a aproximação máxima de sua aura.</div>
        <Lb>Sua Técnica Máxima</Lb>
        <textarea className="vtt-input" rows={3} placeholder="Nome, descrição, efeito, custo..." readOnly={isReadOnly}
          value={sheet.tecMax||''} onChange={e=>u({tecMax:e.target.value})} style={{resize:'vertical'}}/>
      </Acc>

      {/* Developed techniques */}
      <St>Técnicas Desenvolvidas</St>
      {devTechs.map(t=>(
        <Acc key={t.id} title={<span style={{display:'flex',alignItems:'center',gap:6}}>{t.name}{t.action&&<span style={{display:'inline-block',padding:'1px 5px',borderRadius:3,fontSize:8,fontFamily:"'Cinzel',serif",fontWeight:600,background:'rgba(201,169,110,.1)',color:acCol[t.action]||'var(--sub)'}}>{t.action}</span>}{t.fluxo==='Sim'&&<span style={{display:'inline-block',padding:'1px 5px',borderRadius:3,fontSize:8,fontFamily:"'Cinzel',serif",fontWeight:600,background:'rgba(58,122,76,.1)',color:'#3a7a4c'}}>Fluxo</span>}</span>}>
          {t.aura&&<div style={{marginBottom:5}}><span style={{display:'inline-block',padding:'2px 7px',borderRadius:3,fontSize:9,fontFamily:"'Cinzel',serif",fontWeight:600,letterSpacing:'.06em',background:(auColors[t.aura]||'var(--sub)')+'20',color:auColors[t.aura]||'var(--sub)',border:`1px solid ${(auColors[t.aura]||'var(--sub)')}40`}}>{t.aura}</span></div>}
          {[['Custo',t.cost],['Dano',t.dmg],['Alcance',t.range]].map(([k,v])=>v&&<div key={k} style={{fontSize:11,color:'var(--sub)',marginBottom:3}}><b style={{color:'var(--text)'}}>{k}:</b> {v}</div>)}
          {t.desc&&<div style={{fontSize:11,color:'var(--sub)',marginTop:4,lineHeight:1.5}}>{t.desc}</div>}
          {t.forts?.length>0&&<div style={{fontSize:11,color:'var(--sub)',marginTop:4}}><b style={{color:'var(--text)'}}>Fortalecimentos:</b> {t.forts.join(', ')}</div>}
          {t.notes&&<div style={{fontSize:11,color:'var(--sub)',marginTop:4}}><b style={{color:'var(--text)'}}>Notas:</b> {t.notes}</div>}
          {!isReadOnly&&<div style={{display:'flex',gap:6,marginTop:8}}><RBtn onClick={()=>editDT(t)}>✎ Editar</RBtn><button className="tbtn" onClick={()=>u({devTechs:devTechs.filter(x=>x.id!==t.id)})} style={{background:'#b83030'}}>✕ Remover</button></div>}
        </Acc>
      ))}
      {!isReadOnly&&(!showNewTech?(
        <button className="tbtn" onClick={()=>setShowNewTech(true)} style={{marginBottom:14}}>+ Nova Técnica Desenvolvida</button>
      ):(
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:5,padding:'10px 12px',marginBottom:14}}>
          <St style={{marginTop:0}}>{editTechId?'Editar':'Nova'} Técnica</St>
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
function XpTab({ sheet, onUpdate, isReadOnly }) {
  const u = onUpdate;
  const [xpCr,setXpCr]=useState(5), [xpCh,setXpCh]=useState(1), [xpPa,setXpPa]=useState(4);
  const [durAtk,setDurAtk]=useState(10), [durCur,setDurCur]=useState(20), [durArmor,setDurArmor]=useState(false);
  const xpGain=Math.floor((xpCr*xpCh)/xpPa);
  const lv=sheet.level??1, xp=sheet.xp??0;
  const need=XP_TABLE[Math.min(lv,XP_TABLE.length-1)]||99999;
  const xpPct=need>0?Math.min(100,(xp/need)*100):0;
  const durLoss=durAtk*(durArmor?0.20:0.25), durRem=Math.max(0,durCur-durLoss);

  return (
    <div>
      <St>Calculadora XP</St>
      <div style={{fontSize:10,color:'var(--sub)',marginBottom:8}}>(NvCriatura × NvDesafio) ÷ Participantes</div>
      <div style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'center',marginBottom:14}}>
        {[['Criatura',xpCr,setXpCr],['Desafio',xpCh,setXpCh],['Jogadores',xpPa,setXpPa]].map(([lbl,val,set])=>(
          <div key={lbl}><Lb>{lbl}</Lb><Nc value={val} onDec={()=>set(v=>Math.max(1,v-1))} onInc={()=>set(v=>Math.min(lbl==='Jogadores'?20:100,v+1))}/></div>
        ))}
        <Sb label="XP" value={xpGain} color="#f4d03f"/>
      </div>

      <St>Progresso</St>
      <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',marginBottom:8}}>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <span style={{fontSize:10,color:'var(--sub)'}}>Nível</span>
          <Nc value={lv} onDec={()=>!isReadOnly&&u({level:Math.max(1,lv-1)})} onInc={()=>!isReadOnly&&u({level:Math.min(20,lv+1)})}/>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <span style={{fontSize:10,color:'var(--sub)'}}>XP</span>
          <Nc value={xp} onDec={()=>!isReadOnly&&u({xp:Math.max(0,xp-10)})} onInc={()=>!isReadOnly&&u({xp:Math.min(need,xp+10)})}/>
        </div>
        {!isReadOnly&&<button className="tbtn" onClick={()=>u({xp:Math.min(need,xp+xpGain)})}>+ Adicionar</button>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
        <div style={{flex:1,height:9,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${xpPct}%`,borderRadius:3,background:'linear-gradient(90deg,var(--gold-dim),var(--gold))',transition:'width .3s'}}/>
        </div>
        <span style={{fontSize:10,color:'var(--sub)',minWidth:60,textAlign:'right'}}>{xp}/{need}</span>
      </div>
      {xp>=need&&<div style={{padding:6,background:'rgba(244,208,63,.06)',border:'1px solid rgba(244,208,63,.2)',borderRadius:4,fontFamily:"'Cinzel',serif",fontSize:9,color:'#f4d03f',textAlign:'center',fontWeight:700,marginBottom:10}}>✦ LEVEL UP! → Nível {lv+1}</div>}

      <St>Durabilidade</St>
      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
        {[[false,'Arma (×0.25)'],[true,'Armadura (×0.20)']].map(([isArmor,lbl])=>(
          <button key={lbl} onClick={()=>setDurArmor(isArmor)} style={{padding:'4px 10px',borderRadius:16,fontSize:11,cursor:'pointer',border:`1px solid ${durArmor===isArmor?'var(--gold-dim)':'var(--border)'}`,background:durArmor===isArmor?'rgba(201,169,110,.1)':'transparent',color:durArmor===isArmor?'var(--gold)':'var(--sub)',fontFamily:'inherit'}}>{lbl}</button>
        ))}
      </div>
      <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          <div style={{display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:9,color:'var(--sub)',minWidth:40}}>Ataques</span><Nc value={durAtk} onDec={()=>setDurAtk(v=>Math.max(0,v-1))} onInc={()=>setDurAtk(v=>Math.min(200,v+1))}/></div>
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
          <input className="vtt-input" placeholder="Profissão" value={sheet.prof==='custom'?sheet.customProf?.name||'Personalizado':sheet.prof||''} readOnly onChange={()=>{}}/>
          <input className="vtt-input" type="number" min={1} max={20} value={sheet.level||1} readOnly={isReadOnly} onChange={e=>u({level:Math.max(1,Math.min(20,parseInt(e.target.value,10)||1))})} style={{textAlign:'center'}} title="Nível"/>
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
