// Verifica que minha implementação do estimador direcional coincide com a de estimador.mjs (mesmos dados). Uso: node r2_checa.mjs
import { simulate, rng } from './nucleo.mjs';
import { direcional } from './estimador.mjs';
import { escores } from './r2_lib.mjs';
const r = rng(1); let maxd = 0;
for (let s = 0; s < 30; s++) { const o = { G: 12, T: 12, lam: [2, 8, 16][s % 3], RR: s % 2 ? 2 : 1, driver: 'A', arRho: .5, arSd: .5 }; const D = simulate(o, r); const a = direcional(D, o.G, o.T).S, b = escores(D, o.G, o.T).S; for (let g = 0; g < o.G; g++) maxd = Math.max(maxd, Math.abs(a[g] - b[g]) / (Math.abs(a[g]) + 1e-9)); }
console.log('diferença relativa máxima entre os escores por grupo (teu vs meu):', maxd.toExponential(2));
