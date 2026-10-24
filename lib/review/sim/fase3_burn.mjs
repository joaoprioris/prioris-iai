// A fase 1 funciona como descarte inicial (burn in): gera-se T+b meses e o teste usa os T seguintes. Uso: node fase3_burn.mjs <sims> [T]
import { gen, rng } from './gerador2.mjs';
import { escoresV3, rejeita } from './estimador2.mjs';
const sims = +process.argv[2] || 600, T = +process.argv[3] || 18, G = 20, lam = 8;
const cen = { base: {}, transitorio_tau2: { transient: { sd: 1, tau: 2 } }, transitorio_tau4_forte: { transient: { sd: 1.5, tau: 4 } }, ar_zero: { ar: { rho: .8, sd: .8 }, arZero: true }, tendencia_grupo_opostos: { gTrend: { sd: .08, L: [1, 1, 1, 1, -1, -1, -1, -1, 1, -1] } } };
console.log('FP % com G=20, T de teste =', T, '; b = meses de descarte (fase 1) gerados a mais');
for (const [nm, ex] of Object.entries(cen)) {
  const row = [nm];
  for (const b of [0, 2, 3, 4, 6]) { const r = rng(900 + b * 11 + nm.length); let k = 0; for (let s = 0; s < sims; s++) { const D = gen({ G, T: T + b, lam, ...ex }, r); if (rejeita(escoresV3(D, G, T + b, { burn: b }).S)) k++; } row.push(`b${b}=${(100 * k / sims).toFixed(1)}`); }
  console.log(row.join('\t'));
}
