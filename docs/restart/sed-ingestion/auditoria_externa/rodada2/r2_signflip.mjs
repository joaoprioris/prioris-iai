// Alternativa ao t: teste de inversão de sinais sobre os escores direcionais por grupo (válido se a distribuição do escore é simétrica sob a nula, o que decorre da reversibilidade temporal). Uso: node r2_signflip.mjs <sims>
import { gen, escores, rej, rng, ci, PAIR } from './r2_lib.mjs';
import { simulate } from './nucleo.mjs';
const sims = +process.argv[2] || 3000;
function pSF(x, r, B = 999) { const G = x.length, obs = x.reduce((a, b) => a + b, 0); let ge = 1; for (let k = 0; k < B; k++) { let s = 0; for (let g = 0; g < G; g++) s += r() < .5 ? -x[g] : x[g]; if (s >= obs - 1e-12) ge++; } return ge / (B + 1); }
const sinais = [1, -1, 1, 1, -1, -1, 1, -1, 1, -1];
const SC = { base: {}, G10: { G: 10 }, G6: { G: 6 }, lam2: { lam: 2 }, ar_09: { ar: { rho: .9, sd: .6 } }, cc_forte: { fatores: [{ L: sinais, rho: .8, sd: 1 }] }, transitorio_inicial: { transient: { sd: 1, tau: 2 } } };
for (const [k, ex] of Object.entries(SC)) { const o = { G: 20, T: 12, lam: 8, ...ex }, r = rng(55 + k.length); let t = 0, f = 0; for (let s = 0; s < sims; s++) { const D = gen(o, r), S = escores(D, o.G, o.T).S; if (rej(S)) t++; if (pSF(S, r, 399) <= 0.05) f++; }
  console.log(JSON.stringify({ cenario: k, G: o.G, sims, t_unilateral: ci(t, sims), inversao_de_sinais: ci(f, sims) })); }
// poder: 40 grupos 18 meses, driver A RR 2 (gerador do documento)
{ const r = rng(5); let t = 0, f = 0; const n = 500; for (let s = 0; s < n; s++) { const D = simulate({ G: 40, T: 18, lam: 8, RR: 2, driver: 'A', sizeSd: .0867 }, r), S = escores(D, 40, 18).S; if (rej(S)) t++; if (pSF(S, r, 399) <= 0.05) f++; } console.log(JSON.stringify({ poder_40x18_RR2: { t: ci(t, n), inversao_de_sinais: ci(f, n) } })); }
