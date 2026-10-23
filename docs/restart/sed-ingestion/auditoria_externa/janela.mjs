// Testa se a janela de exposição truncada nos primeiros meses (menos defasagens disponíveis) explica a inflação sob tendência. Uso: node janela.mjs <sims>
import { simulate, rng, permTest, CFG, wilsonCI } from './core.mjs';
const sims = +process.argv[2] || 1000;
const ci = (k, n) => { const [lo, hi] = wilsonCI(k, n); return `${(100 * k / n).toFixed(1)} [${(100 * lo).toFixed(1)};${(100 * hi).toFixed(1)}]`; };
for (const [nm, ex] of Object.entries({ nulo_iid: {}, tendencia: { trendSd: 0.08 }, tendencia_forte: { trendSd: 0.15 }, ar_06: { arRho: 0.6, arSd: 0.6 } })) for (const norm of [false, true]) {
  CFG.normalize = norm; const r = rng(808 + nm.length); let k = 0, kb = 0;
  for (let s = 0; s < sims; s++) { const D = simulate({ G: 10, T: 12, lam: 8, RR: 1, ...ex }, r); const p = permTest(D, 10, 12, 199, r); if (p.pG <= 0.05) k++; if (Math.min(...p.pC) * 3 <= 0.05) kb++; }
  console.log(JSON.stringify({ cenario: nm, exposicao_normalizada: norm, G: 10, T: 12, lam: 8, sims, global: ci(k, sims), bonf3_classes: ci(kb, sims) }));
}
