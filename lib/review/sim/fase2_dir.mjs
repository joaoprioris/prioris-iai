// Compara o teste só de defasagem com o teste direcional (defasagem menos avanço): erro tipo I e poder. Uso: node fase2_dir.mjs <sims>
import { simulate, rng, wilsonCI } from './nucleo.mjs';
import { componentes, direcional, rejeita, exposicaoDir, efeito } from './estimador.mjs';
const sims = +process.argv[2] || 500, base = { G: 20, T: 12, lam: 8 };
const SC = { base: {}, ar_06: { arRho: .6, arSd: .6 }, ar_09: { arRho: .9, arSd: .6 }, tendencia: { trendSd: .08 }, choque_comum: { shockSd: .5 }, circ_ar: { arRho: .8, arSd: .6, circ: 1 }, tudo_junto: { arRho: .6, arSd: .4, trendSd: .08, shockSd: .3, sizeSd: .8, nbShape: 3, circ: .5 },
  'poder_RR1.5_rampa': { RR: 1.5, driver: 'A', sizeSd: .0867 }, 'poder_RR2.0_rampa': { RR: 2, driver: 'A', sizeSd: .0867 }, 'poder_RR1.5_degrau': { RR: 1.5, driver: 'A', mode: 'step', sizeSd: .0867 }, 'poder_RR2.0_degrau': { RR: 2, driver: 'A', mode: 'step', sizeSd: .0867 } };
const f = (k, n) => { const [lo, hi] = wilsonCI(k, n); return `${(100 * k / n).toFixed(1)} [${(100 * lo).toFixed(1)};${(100 * hi).toFixed(1)}]`; };
for (const [nm, ex] of Object.entries(SC)) {
  const o = { ...base, ...ex }, r = rng(777 + nm.length * 3), k = { lag: 0, dir: 0, cobre: 0 }; let bm = 0;
  for (let s = 0; s < sims; s++) {
    const D = simulate({ ...o, RR: o.RR || 1 }, r);
    const L = componentes(D, o.G, o.T, { E: exposicaoDir(D, o.G, o.T, -1) }); if (rejeita(L.S)) k.lag++;
    const d = direcional(D, o.G, o.T); if (rejeita(d.S)) k.dir++;
    const e = efeito(d.S, d.Q); bm += e.beta; if (e.lo <= 0 && e.hi >= 0) k.cobre++;
  }
  console.log(JSON.stringify({ cenario: nm, sims, so_defasagem: f(k.lag, sims), direcional: f(k.dir, sims), ic_direcional_cobre_zero: f(k.cobre, sims), beta_medio: (bm / sims).toExponential(2) }));
}
