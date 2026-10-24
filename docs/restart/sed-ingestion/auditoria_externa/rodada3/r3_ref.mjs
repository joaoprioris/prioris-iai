// E: confere a variante "referência por controles" (pReferencia de estimador2.mjs). Uso: node r3_ref.mjs <sims>
import { gen, rng, ci } from './r3_lib.mjs';
import { pReferencia } from './estimador2.mjs';
const sims = +process.argv[2] || 300, G = 20, T = 21;
for (const [nm, ex] of Object.entries({ base: {}, causa_comum_forte: { fatores: [{ L: [1, -1, 1, 1, -1, -1, 1, -1, 1, -1], rho: .8, sd: 1 }] } })) { const r = rng(6); let k = 0; for (let s = 0; s < sims; s++) { const D = gen({ G, T, lam: 8, ...ex }, r); if (pReferencia(D, G, T, { burn: 3 }, r, 99).p <= 0.05) k++; } console.log(JSON.stringify({ cenario: nm, sims, referencia_por_controles_rejeita_5pct: ci(k, sims) })); }
