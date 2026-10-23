// Compara exposição por pares do classificador (x) com exposição pela contagem de A como principal (independente da escolha do classificador).
// Uso: node variantes.mjs <sims>
import { simulate, rng, permTest, groupScores, tTestP, wilsonCI, PAIR, NP } from './core.mjs';
const sims = +process.argv[2] || 500, B = 199;
const ci = (k, n) => { const [lo, hi] = wilsonCI(k, n); return `${(100 * k / n).toFixed(1)} [${(100 * lo).toFixed(1)};${(100 * hi).toFixed(1)}]`; };
const toA = (D, G, T) => ({ n: D.n, N: D.N, x: D.x.map((_, g) => { const o = new Int16Array(T * NP); for (let t = 0; t < T; t++) for (let p = 0; p < NP; p++) o[t * NP + p] = D.n[g][t * 10 + PAIR[p].a]; return o; }) });
const scen = {
  nulo_iid: { RR: 1 }, ar_06: { RR: 1, arRho: 0.6, arSd: 0.6 }, tendencia: { RR: 1, trendSd: 0.08 }, circ_ar: { RR: 1, arRho: 0.8, arSd: 0.6, circ: 1 }, circ_ar_fraco: { RR: 1, arRho: 0.8, arSd: 0.4, circ: 0.5 },
  'poderA_RR1.5': { RR: 1.5, mode: 'ramp', sizeSd: 0.0867, driver: 'A' }, 'poderA_RR2.0': { RR: 2, mode: 'ramp', sizeSd: 0.0867, driver: 'A' },
  'poder_RR1.5': { RR: 1.5, mode: 'ramp', sizeSd: 0.0867 }, 'poder_RR2.0': { RR: 2, mode: 'ramp', sizeSd: 0.0867 },
};
console.log('G=20 T=12 lam=8; taxa de rejeição (%) [IC95 Wilson]. x = pares do classificador; A = contagem de A como principal');
for (const [nm, ex] of Object.entries(scen)) {
  const G = 20, T = 12, lam = 8; const r = rng(555 + nm.length); const k = { px: 0, pA: 0, tx: 0, tA: 0 };
  for (let s = 0; s < sims; s++) {
    const D = simulate({ G, T, lam, ...ex }, r), DA = toA(D, G, T);
    if (permTest(D, G, T, B, r).pG <= 0.05) k.px++; if (permTest(DA, G, T, B, r).pG <= 0.05) k.pA++;
    if (tTestP(groupScores(D, G, T)) <= 0.05) k.tx++; if (tTestP(groupScores(DA, G, T)) <= 0.05) k.tA++;
  }
  console.log(JSON.stringify({ cenario: nm, perm_x: ci(k.px, sims), perm_A: ci(k.pA, sims), t_demean_x: ci(k.tx, sims), t_demean_A: ci(k.tA, sims) }));
}
