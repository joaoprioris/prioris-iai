// confere meu escorer contra estimador2.mjs (escoresV3) com descarte
import { simulate, rng } from './nucleo.mjs';
import { escoresV3 } from './estimador2.mjs';
import { esc3 } from './r3_lib.mjs';
const r = rng(5); let m = 0;
for (let s = 0; s < 20; s++) { const o = { G: 10, T: 15, lam: [4, 8][s % 2], RR: s % 3 ? 2 : 1, driver: 'A' }; const D = simulate(o, r); for (const b of [0, 3]) { const a = escoresV3(D, 10, 15, { burn: b }).S, c = esc3(D, 10, 15, { burnY: b }).S; for (let g = 0; g < 10; g++) m = Math.max(m, Math.abs(a[g] - c[g]) / (Math.abs(a[g]) + 1e-9)); } }
console.log('diferença relativa máxima (estimador2 vs meu esc3):', m.toExponential(2));
