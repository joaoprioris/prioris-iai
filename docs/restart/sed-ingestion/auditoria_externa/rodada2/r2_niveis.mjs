// F: probabilidade conjunta aproximada de um efeito real passar nos níveis 1 e 3 (3 clientes). Uso: node r2_niveis.mjs <sims>
import { simulate } from './nucleo.mjs';
import { escores, rej, pval, rng, ci, PAIR, CTRL, tstat } from './r2_lib.mjs';
const sims = +process.argv[2] || 400;
function qn(p) { const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572], c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]; p = Math.min(Math.max(p, 1e-12), 1 - 1e-12); const pl = .02425; let q, r; if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); } if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); } q = p - .5; r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
const ncdf = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
function beta_se(D, G, T) { const dir = escores(D, G, T, PAIR, 'dir'), lag = escores(D, G, T, PAIR, 'lag'); const S = dir.S, Q = lag.Q, sS = S.reduce((a, b) => a + b, 0), sQ = Q.reduce((a, b) => a + b, 0), b = sS / sQ, U = S.map((s, i) => s - b * Q[i]), m = U.reduce((a, c) => a + c, 0) / G, v = U.reduce((a, c) => a + (c - m) ** 2, 0) / (G - 1); return { b, se: Math.sqrt(G * v) / sQ, S }; }
const cenarios = process.argv[3] === 'het' ? [['60 grupos x 12 meses, 20/20/20', 12, [20, 20, 20]], ['40 grupos x 18 meses, 14/13/13', 18, [14, 13, 13]]] : [
  ['40 grupos x 18 meses, 14/13/13', 18, [14, 13, 13]], ['60 grupos x 12 meses, 20/20/20', 12, [20, 20, 20]],
  ['40 grupos x 18 meses, desigual 20/12/8', 18, [20, 12, 8]], ['60 grupos x 12 meses, desigual 30/18/12', 12, [30, 18, 12]], ['60 grupos x 12 meses, desigual 36/14/10', 12, [36, 14, 10]],
];
const efs = [['efeito so em 1 de 3 clientes (RR 3,0 contra 1,0 e 1,0)', { RRc: [3, 1, 1] }], ['efeito em 2 de 3 clientes (RR 3,0, 3,0 e 1,0)', { RRc: [3, 3, 1] }], ['RR pico 2,0 rampa', { RR: 2 }], ['RR pico 3,0 rampa', { RR: 3 }], ['RR pico 2,0 degrau', { RR: 2, mode: 'step' }], ['RR pico 2,0 rampa, A persistente', { RR: 2, arRho: .8, arSd: .6 }], ['sem efeito', { RR: 1 }]];
for (const [nm, T, split] of cenarios) for (const [en, ex] of (process.argv[3] === 'het' ? efs.slice(0, 2) : efs.slice(2))) {
  const r = rng(99 + split[0] * 3 + T + en.length), G3 = split.reduce((a, b) => a + b, 0); let n1any = 0, n1one = 0, n3 = 0, st = 0, het = 0, w50 = 0, ctrlc = 0, ctrlp = 0; const pesoMax = Math.max(...split) / G3; 
  for (let s = 0; s < sims; s++) {
    const cl = split.map((Gc, ic) => { const D = simulate({ G: Gc, T, lam: 8, driver: 'A', sizeSd: .0867, ...ex, RR: ex.RRc ? ex.RRc[ic] : ex.RR }, r); const bs = beta_se(D, Gc, T); const pc = pval(bs.S); const cs = escores(D, Gc, T, CTRL).S; return { Gc, p: pc, ...bs, cp: pval(cs), cz: qn(1 - pval(cs)), ok: !rej(cs) }; });
    const lvl1 = cl.map(c => c.p < .05 && c.ok); if (lvl1.some(Boolean)) n1any++; if (lvl1[0]) n1one++;
    const w = cl.map(c => Math.sqrt(c.Gc)), Z = cl.reduce((a, c, i) => a + w[i] * qn(1 - c.p), 0) / Math.sqrt(w.reduce((a, b) => a + b * b, 0)); const stp = 1 - ncdf(Z); const cond_st = stp < .05;
    const wt = cl.map(c => 1 / (c.se * c.se)), bb = cl.reduce((a, c, i) => a + wt[i] * c.b, 0) / wt.reduce((a, b) => a + b, 0), Qh = cl.reduce((a, c, i) => a + wt[i] * (c.b - bb) ** 2, 0), ph = Math.exp(-Qh / 2); const cond_het = ph > .05;
    const cond_w = pesoMax <= 0.5 + 1e-9; const Zc = cl.reduce((a, c, i) => a + w[i] * c.cz, 0) / Math.sqrt(w.reduce((a, b) => a + b * b, 0)); const ctrl_ok = cl.every(c => c.ok) && (1 - ncdf(Zc)) >= .05;
    if (cond_st) st++; if (cond_het) het++; if (cond_w) w50++; if (cl.every(c => c.ok)) ctrlc++; if (ctrl_ok) ctrlp++;
    if (cond_st && cond_het && cond_w && ctrl_ok) n3++;
  }
  console.log(JSON.stringify({ cenario: nm, efeito: en, sims, maior_cliente_pct: +(100 * pesoMax).toFixed(0), P_stouffer_p05: ci(st, sims), P_heterog_nao_signif: ci(het, sims), P_controles_limpos_3_clientes_e_conjunto: ci(ctrlp, sims), P_nivel1_algum_cliente: ci(n1any, sims), P_nivel1_cliente_1: ci(n1one, sims), P_nivel3_estatistico: ci(n3, sims) }));
}
