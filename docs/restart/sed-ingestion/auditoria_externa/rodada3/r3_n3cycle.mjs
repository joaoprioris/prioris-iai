// C: o nível 3 sob ciclo de grupo (precedência estrutural), com os 3 clientes compartilhando as mesmas fases por dívida (mundo comum) ou fases independentes por cliente. Uso: node r3_n3cycle.mjs <sims por mundo> <mundos>
import { gen, esc3, pval, rng, ci, CTRL } from './r3_lib.mjs';
const sims = +process.argv[2] || 150, W = +process.argv[3] || 12, b = 3, T = 15, split = [20, 20, 20];
const ncdf = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
const qn = (p) => { let lo = -9, hi = 9; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (ncdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
const zOf = (x) => qn(1 - Math.min(Math.max(pval(x), 1e-12), 1 - 1e-12));
const rw = rng(2468), fases = () => Array.from({ length: 10 }, () => 2 * Math.PI * rw());
for (const modo of ['mesmas_fases_nos_3_clientes', 'fases_independentes_por_cliente', 'so_1_cliente_com_ciclo']) {
  let n3 = 0, tot = 0, st = 0; const r = rng(9);
  for (let w = 0; w < W; w++) { const th = fases(), ths = [th, fases(), fases()]; for (let s = 0; s < sims; s++) {
    const cl = split.map((Gc, i) => { const theta = modo === 'mesmas_fases_nos_3_clientes' ? th : ths[i]; const ex = modo === 'so_1_cliente_com_ciclo' && i > 0 ? {} : { gCycle: { amp: .6, period: 6, theta } }; const D = gen({ G: Gc, T, lam: 8, ...ex }, r); return { z: zOf(esc3(D, Gc, T, { burnY: b }).S), zc: zOf(esc3(D, Gc, T, { burnY: b, pairs: CTRL }).S) }; });
    const Z = cl.reduce((a, c) => a + c.z, 0) / Math.sqrt(3), Zc = cl.reduce((a, c) => a + c.zc, 0) / Math.sqrt(3); tot++; if (Z > 1.645) st++; if (Z > 1.645 && cl.every(c => c.z > 0) && Zc < 2.326) n3++; } }
  console.log(JSON.stringify({ modo, mundos: W, sims_total: tot, Stouffer_p05: ci(st, tot), nivel3_estatistico_passa: ci(n3, tot) }));
}
