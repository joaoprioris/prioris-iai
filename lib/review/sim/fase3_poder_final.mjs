// Poder do estimador final (v2 com descarte de 3 meses, sem remoção de tendência), piso proxy de 5 SED por grupo e mês. Uso: node fase3_poder_final.mjs <sims>
import { simulate, PAIR } from './nucleo.mjs';
import { gen, rng } from './gerador2.mjs';
import { escoresV3, rejeita } from './estimador2.mjs';
const sims = +process.argv[2] || 250, b = 3, k = 5;
const lib = (D, G, T) => { const n = [], N = []; for (let g = 0; g < G; g++) { const a = new Int16Array(T * 10), c = new Int16Array(T); for (let t = 0; t < T; t++) if (D.N[g][t] >= k) { c[t] = D.N[g][t]; for (let d = 0; d < 10; d++) a[t * 10 + d] = D.n[g][t * 10 + d]; } n.push(a); N.push(c); } return { n, N }; };
const DGP = {
  rampa_RR2: (G, T, lam, r) => simulate({ G, T, lam, RR: 2, driver: 'A', sizeSd: .0867 }, r),
  rampa_RR3: (G, T, lam, r) => simulate({ G, T, lam, RR: 3, driver: 'A', sizeSd: .0867 }, r),
  degrau_RR2: (G, T, lam, r) => simulate({ G, T, lam, RR: 2, driver: 'A', mode: 'step', sizeSd: .0867 }, r),
  aditivo_beta10: (G, T, lam, r) => gen({ G, T, lam, efeito: { beta: 0.10, pairs: PAIR } }, r),
  rapido_lag12_beta10: (G, T, lam, r) => gen({ G, T, lam, efeito: { beta: 0.10, pairs: PAIR, lags: [1, 2] } }, r),
};
console.log('poder %, ' + sims + ' sims, descarte ' + b + ' meses (os T de teste vêm depois), piso proxy ' + k + ' SED por grupo e mês; colunas: efeito, grupos, meses de teste, SED por grupo e mês, poder');
for (const [nm, f] of Object.entries(DGP)) for (const lam of [4, 8, 16]) for (const T of [12, 18, 24]) for (const G of [20, 40, 60, 100]) {
  const r = rng(77 + G * 3 + T * 5 + lam); let c = 0;
  for (let s = 0; s < sims; s++) { const D = lib(f(G, T + b, lam, r), G, T + b); if (rejeita(escoresV3(D, G, T + b, { burn: b }).S)) c++; }
  console.log([nm, G, T, lam, Math.round(100 * c / sims)].join('\t'));
}
