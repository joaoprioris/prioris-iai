// Rodada 2: implementação própria do estimador direcional (a partir da descrição do METODO v2, sem copiar estimador.mjs) e gerador próprio de cenários.
import { M, WIN, PAIR, rng, normal, gamma, pois, tcdf, wilsonCI } from './nucleo.mjs';
export { rng, wilsonCI, PAIR };
export const ci = (k, n) => { const [lo, hi] = wilsonCI(k, n); return `${(100 * k / n).toFixed(1)} [${(100 * lo).toFixed(1)};${(100 * hi).toFixed(1)}]`; };
// pares de controle: 60 pares fora da matriz, prazo por rodízio 0,1,2
export const CTRL = (() => { const o = []; let k = 0; for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) if (a !== b && !M[a].some(q => q[0] === b)) o.push({ a, b, cls: (k++) % 3 }); return o; })();
const qtCache = new Map();
export function qt(df, alpha) { const k = df + ':' + alpha; if (qtCache.has(k)) return qtCache.get(k); let lo = 0, hi = 30; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (1 - tcdf(m, df) > alpha) lo = m; else hi = m; } qtCache.set(k, hi); return hi; }
// Escores por grupo do estimador direcional. D = {n:[Int16Array T*10], N:[Int16Array T]}; clients: vetor com o cliente de cada grupo (centragem por mês dentro do cliente).
// modo: 'dir' (defasagem menos avanço), 'lag' (só defasagem), 'lead' (só avanço)
export function escores(D, G, T, pairs = PAIR, modo = 'dir', clients = null) {
  const cl = clients || new Array(G).fill(0), ncl = Math.max(...cl) + 1;
  const sh = (g, u, d) => D.N[g][u] > 0 ? D.n[g][u * 10 + d] / D.N[g][u] : 0;
  const P = pairs.length, s0 = pairs.map(q => Math.max(1, WIN[q.cls][0]));
  // diferença de exposição d_gtp = e_lag - e_lead (médias da participação de A sobre defasagens/avanços s..6 existentes)
  const E = [];
  for (let g = 0; g < G; g++) {
    const e = new Float64Array(P * T);
    for (let p = 0; p < P; p++) for (let t = 0; t < T; t++) {
      let vl = 0, cl_ = 0, vf = 0, cf = 0;
      for (let l = s0[p]; l <= 6; l++) { if (t - l >= 0) { vl += sh(g, t - l, pairs[p].a); cl_++; } if (t + l < T) { vf += sh(g, t + l, pairs[p].a); cf++; } }
      const lag = cl_ ? vl / cl_ : 0, lead = cf ? vf / cf : 0;
      e[p * T + t] = modo === 'dir' ? lag - lead : modo === 'lag' ? lag : lead;
    }
    E.push(e);
  }
  const S = new Array(G).fill(0), Q = new Array(G).fill(0);
  for (let c = 0; c < ncl; c++) {
    const gs = []; for (let g = 0; g < G; g++) if (cl[g] === c) gs.push(g);
    for (let t = 0; t < T; t++) {
      let Nt = 0; const nt = new Array(10).fill(0); for (const g of gs) { Nt += D.N[g][t]; for (let d = 0; d < 10; d++) nt[d] += D.n[g][t * 10 + d]; }
      const em = new Float64Array(P); for (let p = 0; p < P; p++) { let s = 0; for (const g of gs) s += E[g][p * T + t]; em[p] = s / gs.length; }
      for (const g of gs) { const N = D.N[g][t]; if (!N) continue; for (let p = 0; p < P; p++) { const b = pairs[p].b, e = E[g][p * T + t] - em[p], y = D.n[g][t * 10 + b] / N - (Nt ? nt[b] / Nt : 0); S[g] += e * y * N; Q[g] += e * e * N; } }
    }
  }
  return { S, Q };
}
export function tstat(x) { const G = x.length, m = x.reduce((a, b) => a + b, 0) / G, v = x.reduce((a, b) => a + (b - m) ** 2, 0) / (G - 1); return v > 0 ? m / Math.sqrt(v / G) : 0; }
export const rej = (x, alpha = 0.05) => tstat(x) > qt(x.length - 1, alpha);
export const pval = (x) => 1 - tcdf(tstat(x), x.length - 1);
// ---------- gerador próprio ----------
// o: G,T,lam,sizeSd,nbShape,compSd; ar:{rho,sd} (por grupo e dívida); fatores: [{L:[10], rho, sd, delay:[10]|null}]; commonTrend:[10]; gTrend:{sd, L:[10]|null, idSd};
// season:{amp, period, phase:[10]}; gCycle:{amp, period, theta:[10]}; skew; supMes (prob de suprimir o grupo-mês); efeito: {beta, pairs, lags:[lo,hi]|null}
export function gen(o, r) {
  const { G, T, lam, sizeSd = 0, nbShape = 0, compSd = 0, ar = null, fatores = [], commonTrend = null, gTrend = null, season = null, gCycle = null, skew = 0, supMes = 0, efeito = null, volRamp = null, transient = null, arZero = false, entry = null, regime = null, transOnset = false } = o;
  const n = [], N = [], PP = [], EG = []; const c = (T - 1) / 2; const maxD = Math.max(0, ...fatores.map(f => f.delay ? Math.max(...f.delay) : 0));
  for (let g = 0; g < G; g++) {
    const gs = Math.exp(sizeSd * normal(r) - 0.5 * sizeSd * sizeSd);
    const F = fatores.map(f => { const x = new Array(T + maxD).fill(0); let v = arZero ? 0 : f.sd * normal(r); for (let t = 0; t < T + maxD; t++) { v = f.rho * v + Math.sqrt(1 - f.rho * f.rho) * f.sd * normal(r); x[t] = v; } return x; });
    const arS = new Array(10).fill(0).map(() => ar && !arZero ? ar.sd * normal(r) : 0);
    const bloco = (d) => d < 4 ? 0 : d < 8 ? 1 : 2; const tz = transient ? [0, 1, 2].map(() => transient.sd * normal(r)) : null;
    let gz = null, gslope = new Array(10).fill(0);
    if (gTrend) { const z = gTrend.sd * normal(r); for (let d = 0; d < 10; d++) gslope[d] = (gTrend.L ? gTrend.L[d] : 1) * z + (gTrend.idSd || 0) * normal(r); }
    const phg = 2 * Math.PI * r();
    const eg = entry ? Math.floor(r() * (entry.max + 1)) : 0; EG.push(eg);
    const rz = regime ? [0, 1, 2].map(() => regime.sd * normal(r)) : null; const Pg = new Float32Array(T * 10);
    const ng = new Int16Array(T * 10), Ng = new Int16Array(T);
    for (let t = 0; t < T; t++) {
      const lw = new Array(10);
      for (let d = 0; d < 10; d++) {
        let v = -skew * d;
        if (commonTrend) v += commonTrend[d] * (t - c);
        v += gslope[d] * (t - c);
        if (season) v += season.amp * Math.sin(2 * Math.PI * t / season.period + season.phase[d]);
        if (gCycle) v += gCycle.amp * Math.sin(2 * Math.PI * t / gCycle.period + phg + gCycle.theta[d]);
        fatores.forEach((f, k) => { v += f.L[d] * F[k][t + maxD - (f.delay ? f.delay[d] : 0)]; });
        if (ar) { arS[d] = ar.rho * arS[d] + Math.sqrt(1 - ar.rho * ar.rho) * ar.sd * normal(r); v += arS[d]; }
        if (compSd) v += compSd * normal(r);
        if (transient) v += tz[bloco(d)] * Math.exp(-Math.max(0, t - (transOnset ? eg : 0)) / transient.tau);
        if (rz && t >= regime.at) v += rz[bloco(d)];
        lw[d] = v;
      }
      let w = lw.map(Math.exp); let sw = w.reduce((a, b) => a + b, 0); let p = w.map(x => x / sw);
      if (efeito && t > 0) { // efeito aditivo conhecido na participação de B: p_b += beta * soma das exposições dos pares com destino b (média da participação de A nas defasagens da janela)
        const add = new Array(10).fill(0);
        for (const q of efeito.pairs) { const [s, e] = efeito.lags || [Math.max(1, WIN[q.cls][0]), 6]; let v = 0, k = 0; for (let l = s; l <= e; l++) if (t - l >= 0) { v += Ng[t - l] ? ng[(t - l) * 10 + q.a] / Ng[t - l] : 0; k++; } if (k) add[q.b] += efeito.beta * v / k; }
        p = p.map((x, d) => Math.max(0, x + add[d])); const s2 = p.reduce((a, b) => a + b, 0); p = p.map(x => x / s2);
      }
      for (let d = 0; d < 10; d++) Pg[t * 10 + d] = p[d];
      let mult = gs; if (nbShape > 0) mult *= gamma(r, nbShape) / nbShape;
      const lt = volRamp ? lam * (volRamp[0] + (volRamp[1] - volRamp[0]) * t / (T - 1)) / 1 : lam; const Nn = t < eg ? 0 : pois(r, lt * mult); Ng[t] = Nn;
      for (let i = 0; i < Nn; i++) { let u = r(), d = 0; while (d < 9 && u > p[d]) { u -= p[d]; d++; } ng[t * 10 + d]++; }
    }
    if (supMes > 0) for (let t = 0; t < T; t++) if (r() < supMes) { Ng[t] = 0; for (let d = 0; d < 10; d++) ng[t * 10 + d] = 0; }
    n.push(ng); N.push(Ng); PP.push(Pg);
  }
  return { n, N, P: PP, EG };
}
export const sg = (L) => (d) => L[d % L.length];
