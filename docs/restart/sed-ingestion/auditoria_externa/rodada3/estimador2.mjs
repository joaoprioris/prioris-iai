// Estimador direcional, versão 3. Acrescenta ao v2: descarte dos primeiros meses (burn in), remoção de tendência linear por grupo, janela única 1 a 6 meses.
// Escore por grupo de (defasagem menos avanço), com exposição e desfecho centrados por mês dentro do cliente.
import { PAIR, WIN } from './nucleo.mjs';
import { tcdf } from './nucleo.mjs';
const ccache = new Map();
export function tCrit(df, alpha = 0.05) { const k = df + ':' + alpha; if (ccache.has(k)) return ccache.get(k); let lo = 0, hi = 30; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (1 - tcdf(m, df) > alpha) lo = m; else hi = m; } ccache.set(k, hi); return hi; }
export function tstat(x) { const G = x.length, m = x.reduce((a, b) => a + b, 0) / G, v = x.reduce((a, b) => a + (b - m) ** 2, 0) / (G - 1); return v > 0 ? m / Math.sqrt(v / G) : 0; }
export const rejeita = (x, a = 0.05) => tstat(x) > tCrit(x.length - 1, a);
export const pvalor = (x) => 1 - tcdf(tstat(x), x.length - 1);
function recorta(D, b) { return b > 0 ? { n: D.n.map(a => a.slice(b * 10)), N: D.N.map(a => a.slice(b)) } : D; }
function detr(v) { // resíduo da regressão linear no tempo
  const T = v.length; let sx = 0, sy = 0, sxx = 0, sxy = 0; for (let t = 0; t < T; t++) { sx += t; sy += v[t]; sxx += t * t; sxy += t * v[t]; }
  const den = T * sxx - sx * sx; const b = den ? (T * sxy - sx * sy) / den : 0, a = (sy - b * sx) / T; return v.map((y, t) => y - a - b * t);
}
// opts: burn (meses descartados), detrend (bool), janela ('classe' | 'cheia'), clients (cliente de cada grupo), pairs
export function escoresV3(D0, G, T0, opts = {}) {
  const { burn = 0, detrend = false, janela = 'classe', clients = null, pairs = PAIR } = opts;
  const D = recorta(D0, burn), T = T0 - burn, cl = clients || new Array(G).fill(0), ncl = Math.max(...cl) + 1, P = pairs.length;
  const s0 = pairs.map(q => janela === 'cheia' ? 1 : Math.max(1, WIN[q.cls][0]));
  const sh = (g, u, d) => D.N[g][u] > 0 ? D.n[g][u * 10 + d] / D.N[g][u] : 0;
  const E = [];
  for (let g = 0; g < G; g++) {
    const e = new Float64Array(P * T);
    for (let p = 0; p < P; p++) for (let t = 0; t < T; t++) {
      let vl = 0, cL = 0, vf = 0, cF = 0;
      for (let l = s0[p]; l <= 6; l++) { if (t - l >= 0) { vl += sh(g, t - l, pairs[p].a); cL++; } if (t + l < T) { vf += sh(g, t + l, pairs[p].a); cF++; } }
      e[p * T + t] = (cL ? vl / cL : 0) - (cF ? vf / cF : 0);
    }
    E.push(e);
  }
  // séries centradas por mês dentro do cliente
  const ec = E.map(() => new Float64Array(P * T)), yc = E.map(() => new Float64Array(P * T));
  for (let c = 0; c < ncl; c++) {
    const gs = []; for (let g = 0; g < G; g++) if (cl[g] === c) gs.push(g);
    for (let t = 0; t < T; t++) {
      let Nt = 0; const nt = new Array(10).fill(0); for (const g of gs) { Nt += D.N[g][t]; for (let d = 0; d < 10; d++) nt[d] += D.n[g][t * 10 + d]; }
      for (let p = 0; p < P; p++) { let s = 0; for (const g of gs) s += E[g][p * T + t]; const em = s / gs.length, b = pairs[p].b;
        for (const g of gs) { const N = D.N[g][t]; ec[g][p * T + t] = E[g][p * T + t] - em; yc[g][p * T + t] = N ? D.n[g][t * 10 + b] / N - (Nt ? nt[b] / Nt : 0) : 0; } }
    }
  }
  const S = new Array(G).fill(0), Q = new Array(G).fill(0), Sgp = Array.from({ length: G }, () => new Float64Array(P));
  for (let g = 0; g < G; g++) for (let p = 0; p < P; p++) {
    let e = Array.from(ec[g].subarray(p * T, (p + 1) * T)), y = Array.from(yc[g].subarray(p * T, (p + 1) * T));
    if (detrend) { e = detr(e); y = detr(y); }
    for (let t = 0; t < T; t++) { const N = D.N[g][t]; S[g] += e[t] * y[t] * N; Q[g] += e[t] * e[t] * N; Sgp[g][p] += e[t] * y[t] * N; }
  }
  return { S, Q, Sgp };
}

// ---------- referência por pares de controle ----------
// Os 60 pares fora da matriz recebem a classe de prazo por rodízio. O p valor compara a estatística t dos 30 pares da matriz com a de subconjuntos
// aleatórios de 30 pares de controle, com a mesma composição por classe de prazo (6 imediata, 11 curto, 13 médio). Captura precedência de calendário que atinge qualquer par.
import { M } from './nucleo.mjs';
export const CTRL = (() => { const o = []; let k = 0; for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) if (a !== b && !M[a].some(q => q[0] === b)) o.push({ a, b, cls: (k++) % 3 }); return o; })();
export const TODOS = [...PAIR, ...CTRL];
const COMPOSICAO = (() => { const c = [0, 0, 0]; for (const q of PAIR) c[q.cls]++; return c; })();
export function pReferencia(D, G, T, opts = {}, r, R = 199) {
  const { Sgp } = escoresV3(D, G, T, { ...opts, pairs: TODOS });
  const soma = (idx) => { const x = new Array(G).fill(0); for (let g = 0; g < G; g++) for (const p of idx) x[g] += Sgp[g][p]; return x; };
  const idxM = PAIR.map((_, i) => i), tM = tstat(soma(idxM));
  const porClasse = [[], [], []]; CTRL.forEach((q, i) => porClasse[q.cls].push(PAIR.length + i));
  let ge = 1;
  for (let k = 0; k < R; k++) {
    const idx = [];
    for (let c = 0; c < 3; c++) { const pool = porClasse[c].slice(); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; } idx.push(...pool.slice(0, COMPOSICAO[c])); }
    if (tstat(soma(idx)) >= tM) ge++;
  }
  return { p: ge / (R + 1), tM };
}

// ---------- efeito interpretável ----------
// beta: inclinação agrupada (soma S / soma Q): variação da participação de B por unidade de participação de A na janela (escala 0 a 1).
export const beta = (S, Q) => { const sQ = Q.reduce((a, b) => a + b, 0); return sQ > 0 ? S.reduce((a, b) => a + b, 0) / sQ : 0; };
// Efeito relativo: aumento relativo da participação de B para +10 pontos percentuais na participação média de A na janela. pB = participação média de B no período.
export const efeitoRelativo = (b, pB) => (pB > 0 ? (b * 0.10) / pB : 0);
