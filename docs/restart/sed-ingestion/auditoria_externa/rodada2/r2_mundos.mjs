// Precedência estrutural não causal: ciclos de grupo com fase por dívida e causa comum com atraso, em vários "mundos" (fases e atrasos sorteados). Uso: node r2_mundos.mjs <mundos> <sims>
import { gen, escores, rej, rng, ci, PAIR } from './r2_lib.mjs';
const W = +process.argv[2] || 15, sims = +process.argv[3] || 1000, rw = rng(2468);
for (const tipo of ['ciclo_de_grupo', 'cc_atraso']) {
  const taxas = [];
  for (let w = 0; w < W; w++) {
    const o = { G: 20, T: 12, lam: 8 };
    if (tipo === 'ciclo_de_grupo') o.gCycle = { amp: 0.6, period: 6, theta: Array.from({ length: 10 }, () => 2 * Math.PI * rw()) };
    else o.fatores = [{ L: new Array(10).fill(1), rho: 0.8, sd: 1.0, delay: Array.from({ length: 10 }, () => Math.floor(rw() * 4)) }];
    const r = rng(100 + w); let k = 0; for (let s = 0; s < sims; s++) { const D = gen(o, r); if (rej(escores(D, o.G, o.T).S)) k++; }
    taxas.push(k / sims);
  }
  taxas.sort((a, b) => a - b);
  console.log(JSON.stringify({ tipo, mundos: W, sims_por_mundo: sims, taxa_media: +(taxas.reduce((a, b) => a + b, 0) / W * 100).toFixed(1), mediana: +(taxas[W >> 1] * 100).toFixed(1), maxima: +(taxas[W - 1] * 100).toFixed(1), minima: +(taxas[0] * 100).toFixed(1), mundos_acima_de_10pct: taxas.filter(x => x > 0.10).length }));
}
