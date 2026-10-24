// Rodada 3: escorer generalizado (descarte de desfecho e de fonte de exposição separados, janela cheia, tendência por grupo, desfecho contínuo para a pesquisa silenciosa).
import { gen as gen0, rng, ci, qt, PAIR, CTRL, tstat, rej, pval } from './r3_gen.mjs';
import { WIN } from './nucleo.mjs';
export { gen0 as gen, rng, ci, PAIR, CTRL, tstat, rej, pval, qt };
// D: {n,N}; opts: burnY (primeiro mês com desfecho), burnE (primeiro mês que pode ser fonte de exposição), pairs, Y (desfecho contínuo [g][t*10+d] em vez da participação), cheia, detrend, mid (restringe t a janelas cheias nos dois lados), clients
export function esc3(D, G, T, o = {}) {
  const { burnY = 0, burnE = burnY, skipMissing = false, pairs = PAIR, Y = null, cheia = false, detrend = false, mid = false, clients = null, modo = 'dir' } = o;
  const cl = clients || new Array(G).fill(0), ncl = Math.max(...cl) + 1, P = pairs.length, s0 = pairs.map(q => cheia ? 1 : Math.max(1, WIN[q.cls][0]));
  const sh = (g, u, d) => D.N[g][u] > 0 ? D.n[g][u * 10 + d] / D.N[g][u] : 0;
  const E = [];
  for (let g = 0; g < G; g++) { const e = new Float64Array(P * T); for (let p = 0; p < P; p++) for (let t = burnY; t < T; t++) { let vl = 0, cL = 0, vf = 0, cF = 0; for (let l = s0[p]; l <= 6; l++) { if (t - l >= burnE && !(skipMissing && D.N[g][t - l] === 0)) { vl += sh(g, t - l, pairs[p].a); cL++; } if (t + l < T && !(skipMissing && D.N[g][t + l] === 0)) { vf += sh(g, t + l, pairs[p].a); cF++; } } if (mid && (cL === 0 || cF === 0)) { e[p * T + t] = NaN; continue; } const lag = cL ? vl / cL : 0, lead = cF ? vf / cF : 0; e[p * T + t] = modo === 'dir' ? lag - lead : lag; } E.push(e); }
  const S = new Array(G).fill(0), Q = new Array(G).fill(0), ec = E.map(() => new Float64Array(P * T)), yc = E.map(() => new Float64Array(P * T));
  for (let c = 0; c < ncl; c++) { const gs = []; for (let g = 0; g < G; g++) if (cl[g] === c) gs.push(g);
    for (let t = burnY; t < T; t++) { let Nt = 0; const nt = new Array(10).fill(0), cnt = new Array(10).fill(0); for (const g of gs) { Nt += D.N[g][t]; for (let d = 0; d < 10; d++) { nt[d] += Y ? Y[g][t * 10 + d] : D.n[g][t * 10 + d]; } }
      for (let p = 0; p < P; p++) { let s = 0, k = 0; for (const g of gs) { if (!Number.isNaN(E[g][p * T + t])) { s += E[g][p * T + t]; k++; } } const em = k ? s / k : 0, b = pairs[p].b;
        for (const g of gs) { const N = D.N[g][t]; ec[g][p * T + t] = Number.isNaN(E[g][p * T + t]) ? NaN : E[g][p * T + t] - em; yc[g][p * T + t] = Y ? Y[g][t * 10 + b] - nt[b] / gs.length : (N ? D.n[g][t * 10 + b] / N - (Nt ? nt[b] / Nt : 0) : 0); } } } }
  const detr = (v) => { const n = v.length; let sx = 0, sy = 0, sxx = 0, sxy = 0; for (let t = 0; t < n; t++) { sx += t; sy += v[t]; sxx += t * t; sxy += t * v[t]; } const den = n * sxx - sx * sx, b = den ? (n * sxy - sx * sy) / den : 0, a = (sy - b * sx) / n; return v.map((y, t) => y - a - b * t); };
  for (let g = 0; g < G; g++) for (let p = 0; p < P; p++) {
    const idx = []; for (let t = burnY; t < T; t++) if (!Number.isNaN(ec[g][p * T + t])) idx.push(t);
    let e = idx.map(t => ec[g][p * T + t]), y = idx.map(t => yc[g][p * T + t]); if (detrend === true || detrend === 'both') { e = detr(e); y = detr(y); } else if (detrend === 'y') y = detr(y); else if (detrend === 'e') e = detr(e);
    idx.forEach((t, i) => { const w = Y ? 1 : D.N[g][t]; S[g] += e[i] * y[i] * w; Q[g] += e[i] * e[i] * w; });
  }
  return { S, Q };
}
export const lib = (D, G, T, k = 3) => { const n = [], N = []; for (let g = 0; g < G; g++) { const a = new Int16Array(T * 10), c = new Int16Array(T); for (let t = 0; t < T; t++) if (D.N[g][t] >= k) { c[t] = D.N[g][t]; for (let d = 0; d < 10; d++) a[t * 10 + d] = D.n[g][t * 10 + d]; } n.push(a); N.push(c); } return { n, N }; };
