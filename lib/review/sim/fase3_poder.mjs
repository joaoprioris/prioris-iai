// Poder do estimador v3 (descarte de 2 meses + remoção de tendência por grupo) contra o v2, em quatro formas de efeito, com liberação agregada (piso proxy de 3 ou 5 SED no grupo-mês).
// Uso: node fase3_poder.mjs <sims>
import { simulate } from './nucleo.mjs';
import { gen, rng } from './gerador2.mjs';
import { PAIR } from './nucleo.mjs';
import { escoresV3, rejeita } from './estimador2.mjs';
const sims = +process.argv[2] || 300;
const lib = (D, G, T, k) => { const n = [], N = []; for (let g = 0; g < G; g++) { const a = new Int16Array(T * 10), b = new Int16Array(T); for (let t = 0; t < T; t++) if (D.N[g][t] >= k) { b[t] = D.N[g][t]; for (let d = 0; d < 10; d++) a[t * 10 + d] = D.n[g][t * 10 + d]; } n.push(a); N.push(b); } return { n, N }; };
const DGP = {
  rampa_RR2: (G, T, lam, r) => simulate({ G, T, lam, RR: 2, driver: 'A', sizeSd: .0867 }, r),
  rampa_RR3: (G, T, lam, r) => simulate({ G, T, lam, RR: 3, driver: 'A', sizeSd: .0867 }, r),
  degrau_RR2: (G, T, lam, r) => simulate({ G, T, lam, RR: 2, driver: 'A', mode: 'step', sizeSd: .0867 }, r),
  aditivo_beta10: (G, T, lam, r) => gen({ G, T, lam, efeito: { beta: 0.10, pairs: PAIR } }, r),
  rapido_lag12_beta10: (G, T, lam, r) => gen({ G, T, lam, efeito: { beta: 0.10, pairs: PAIR, lags: [1, 2] } }, r),
};
const V = { v2: {}, v3: { burn: 2, detrend: true } };
console.log('poder %, ' + sims + ' sims; colunas: DGP, G, T, lam, piso proxy, v2, v3');
for (const [nm, f] of Object.entries(DGP)) for (const [G, T] of [[20, 12], [40, 12], [60, 12], [40, 18], [60, 18], [40, 24]]) for (const [lam, k] of [[8, 3], [8, 5], [16, 5]]) {
  const r = rng(77 + G * 3 + T * 5 + lam + k), c = { v2: 0, v3: 0 };
  for (let s = 0; s < sims; s++) { const D = lib(f(G, T, lam, r), G, T, k); for (const [v, op] of Object.entries(V)) if (rejeita(escoresV3(D, G, T, op).S)) c[v]++; }
  console.log([nm, G, T, lam, k, Math.round(100 * c.v2 / sims), Math.round(100 * c.v3 / sims)].join('\t'));
}
