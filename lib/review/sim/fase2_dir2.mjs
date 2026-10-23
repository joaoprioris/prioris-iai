// Soma versus média na exposição, e causa comum persistente. Uso: node fase2_dir2.mjs <sims>
import { simulate, rng, wilsonCI } from './nucleo.mjs';
import { componentes, direcional, rejeita, exposicaoDir } from './estimador.mjs';
const sims = +process.argv[2] || 500, base = { G: 20, T: 12, lam: 8 };
const SC = { base: {}, ar_09: { arRho: .9, arSd: .6 }, tendencia: { trendSd: .08 }, causa_comum_fraca: { cc: .3 }, causa_comum: { cc: .6 }, causa_comum_forte: { cc: 1.0 },
  'poder_RR1.5_rampa': { RR: 1.5, driver: 'A', sizeSd: .0867 }, 'poder_RR2.0_rampa': { RR: 2, driver: 'A', sizeSd: .0867 }, 'poder_RR2.0_degrau': { RR: 2, driver: 'A', mode: 'step', sizeSd: .0867 } };
const f = (k, n) => { const [lo, hi] = wilsonCI(k, n); return `${(100 * k / n).toFixed(1)} [${(100 * lo).toFixed(1)};${(100 * hi).toFixed(1)}]`; };
for (const [nm, ex] of Object.entries(SC)) {
  const o = { ...base, ...ex }, r = rng(901 + nm.length * 3), k = { lagM: 0, lagS: 0, dirM: 0, dirS: 0 };
  for (let s = 0; s < sims; s++) {
    const D = simulate({ ...o, RR: o.RR || 1 }, r);
    if (rejeita(componentes(D, o.G, o.T, { E: exposicaoDir(D, o.G, o.T, -1, true) }).S)) k.lagM++;
    if (rejeita(componentes(D, o.G, o.T, { E: exposicaoDir(D, o.G, o.T, -1, false) }).S)) k.lagS++;
    if (rejeita(direcional(D, o.G, o.T, true).S)) k.dirM++;
    if (rejeita(direcional(D, o.G, o.T, false).S)) k.dirS++;
  }
  console.log(JSON.stringify({ cenario: nm, sims, defasagem_media: f(k.lagM, sims), defasagem_soma: f(k.lagS, sims), direcional_media: f(k.dirM, sims), direcional_soma: f(k.dirS, sims) }));
}
