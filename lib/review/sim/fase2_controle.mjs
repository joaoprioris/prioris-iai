// Controle negativo reformulado: o mesmo teste direcional aplicado aos 60 pares fora da matriz. Mede (a) com que frequência o controle rejeita quando o método é válido (sem efeito) e (b) sob efeito real nos pares da matriz.
// Uso: node fase2_controle.mjs <sims>
import { simulate, rng, wilsonCI } from './nucleo.mjs';
import { direcional, rejeita, PARES_CONTROLE } from './estimador.mjs';
const sims = +process.argv[2] || 600, base = { G: 20, T: 12, lam: 8 };
const SC = { base: {}, ar_09: { arRho: .9, arSd: .6 }, tendencia: { trendSd: .08 }, causa_comum: { cc: .6 }, causa_comum_forte: { cc: 1 }, tudo_junto: { arRho: .6, arSd: .4, trendSd: .08, shockSd: .3, sizeSd: .8, nbShape: 3, circ: .5, cc: .3 },
  'efeito_RR3_G20': { RR: 3, driver: 'A', sizeSd: .0867 }, 'efeito_RR3_G60': { RR: 3, driver: 'A', sizeSd: .0867, G: 60 } };
const f = (k, n) => { const [lo, hi] = wilsonCI(k, n); return `${(100 * k / n).toFixed(1)} [${(100 * lo).toFixed(1)};${(100 * hi).toFixed(1)}]`; };
for (const [nm, ex] of Object.entries(SC)) {
  const o = { ...base, ...ex }, r = rng(555 + nm.length * 11); let ctrl = 0, prim = 0, ambos = 0;
  for (let s = 0; s < sims; s++) {
    const D = simulate({ ...o, RR: o.RR || 1 }, r);
    const a = rejeita(direcional(D, o.G, o.T).S), c = rejeita(direcional(D, o.G, o.T, true, PARES_CONTROLE).S);
    if (c) ctrl++; if (a) prim++; if (a && !c) ambos++;
  }
  console.log(JSON.stringify({ cenario: nm, G: o.G, sims, primario_rejeita: f(prim, sims), controle_rejeita: f(ctrl, sims), primario_e_controle_limpo: f(ambos, sims) }));
}
