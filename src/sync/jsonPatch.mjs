/* eslint-disable no-use-before-define */
// Diferenças e patches de JSON para a sincronização da mesa.
// Usado pelo navegador (CRA) e pelo servidor (Node); módulo ES (.mjs) para servir aos dois.
//
// Uma operação é { op, path, ... }. O caminho é uma lista de segmentos:
// string = chave de objeto; { id } = item de lista identificado pelo campo id.
//   set    { path, value }      grava o valor no caminho
//   del    { path }             apaga a chave do objeto
//   upsert { path, value }      põe/substitui o item (value.id) na lista do caminho
//   remove { path, id }         tira o item com esse id da lista
//   order  { path, ids }        reordena os itens com esses ids (os demais ficam no lugar)
//   sadd / sdel { path, values } listas de primitivos tratadas como conjuntos

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function hasId(v) { return isObj(v) && (typeof v.id === 'string' || typeof v.id === 'number'); }
function isKeyed(arr) { return arr.length > 0 && arr.every(hasId) && new Set(arr.map(x => String(x.id))).size === arr.length; }
function isPrimSet(arr) {
  if (!arr.every(x => x === null || typeof x !== 'object')) return false;
  return new Set(arr).size === arr.length;
}
const sameId = (a, b) => String(a) === String(b);

function equal(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!equal(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !equal(a[k], b[k])) return false;
  return true;
}

function diff(a, b, path = [], out = []) {
  if (equal(a, b)) return out;
  if (isObj(a) && isObj(b)) {
    for (const k of Object.keys(a)) if (!(k in b) || b[k] === undefined) { if (a[k] !== undefined) out.push({ op: 'del', path: [...path, k] }); }
    for (const k of Object.keys(b)) {
      if (b[k] === undefined) continue;
      if (!(k in a) || a[k] === undefined) out.push({ op: 'set', path: [...path, k], value: b[k] });
      else diff(a[k], b[k], [...path, k], out);
    }
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const keyedA = a.length === 0 || isKeyed(a);
    const keyedB = b.length === 0 || isKeyed(b);
    if (keyedA && keyedB && (a.length > 0 || b.length > 0)) {
      const mapA = new Map(a.map(x => [String(x.id), x]));
      const mapB = new Map(b.map(x => [String(x.id), x]));
      for (const [id, x] of mapA) if (!mapB.has(id)) out.push({ op: 'remove', path, id: x.id });
      for (const [id, y] of mapB) {
        const x = mapA.get(id);
        if (!x) out.push({ op: 'upsert', path, value: y });
        else diff(x, y, [...path, { id: y.id }], out);
      }
      // ordem: depois de aplicar, os itens novos vão para o fim; compara com a ordem desejada
      const expected = a.filter(x => mapB.has(String(x.id))).map(x => String(x.id));
      for (const y of b) if (!mapA.has(String(y.id))) expected.push(String(y.id));
      const target = b.map(y => String(y.id));
      if (expected.join('\u0000') !== target.join('\u0000')) out.push({ op: 'order', path, ids: b.map(y => y.id) });
      return out;
    }
    if (isPrimSet(a) && isPrimSet(b) && (a.length > 20 || b.length > 20)) {
      const sa = new Set(a), sb = new Set(b);
      const add = b.filter(x => !sa.has(x)), del = a.filter(x => !sb.has(x));
      if (add.length) out.push({ op: 'sadd', path, values: add });
      if (del.length) out.push({ op: 'sdel', path, values: del });
      return out;
    }
  }
  out.push({ op: 'set', path, value: b });
  return out;
}

// ── aplicação (cópia na escrita: só o caminho tocado é copiado) ──────────────
function getChild(node, seg) {
  if (node == null) return undefined;
  if (isObj(seg)) return Array.isArray(node) ? node.find(x => hasId(x) && sameId(x.id, seg.id)) : undefined;
  return node[seg];
}
function setChild(node, seg, value) {
  if (isObj(seg)) {
    const arr = Array.isArray(node) ? node.slice() : [];
    const i = arr.findIndex(x => hasId(x) && sameId(x.id, seg.id));
    if (i >= 0) arr[i] = value;
    return arr;
  }
  const o = isObj(node) ? { ...node } : {};
  o[seg] = value;
  return o;
}
function updateAt(node, path, fn) {
  if (path.length === 0) return fn(node);
  const [seg, ...rest] = path;
  const child = getChild(node, seg);
  if (isObj(seg) && child === undefined) return node; // item sumiu: ignora
  return setChild(node, seg, updateAt(child, rest, fn));
}
function reorder(arr, ids) {
  const want = ids.map(String);
  const pos = new Set(want);
  const listed = new Map(arr.filter(x => hasId(x) && pos.has(String(x.id))).map(x => [String(x.id), x]));
  const queue = want.filter(id => listed.has(id)).map(id => listed.get(id));
  let q = 0;
  return arr.map(x => (hasId(x) && pos.has(String(x.id)) ? queue[q++] : x));
}

function applyOp(root, o) {
  switch (o.op) {
    case 'set': return updateAt(root, o.path, () => o.value);
    case 'del': {
      if (o.path.length === 0) return root;
      const parent = o.path.slice(0, -1), key = o.path[o.path.length - 1];
      return updateAt(root, parent, n => { if (!isObj(n) || !(key in n)) return n; const c = { ...n }; delete c[key]; return c; });
    }
    case 'upsert': return updateAt(root, o.path, n => {
      const arr = Array.isArray(n) ? n.slice() : [];
      const i = arr.findIndex(x => hasId(x) && sameId(x.id, o.value.id));
      if (i >= 0) arr[i] = o.value; else arr.push(o.value);
      return arr;
    });
    case 'remove': return updateAt(root, o.path, n => (Array.isArray(n) ? n.filter(x => !(hasId(x) && sameId(x.id, o.id))) : n));
    case 'order': return updateAt(root, o.path, n => (Array.isArray(n) ? reorder(n, o.ids) : n));
    case 'sadd': return updateAt(root, o.path, n => { const arr = Array.isArray(n) ? n.slice() : []; const s = new Set(arr); for (const v of o.values) if (!s.has(v)) { s.add(v); arr.push(v); } return arr; });
    case 'sdel': return updateAt(root, o.path, n => { if (!Array.isArray(n)) return n; const s = new Set(o.values); return n.filter(v => !s.has(v)); });
    default: return root;
  }
}
function apply(root, ops) { return ops.reduce(applyOp, root); }

function getAt(root, path) { return path.reduce((n, seg) => getChild(n, seg), root); }

export { diff, apply, applyOp, equal, getAt };
