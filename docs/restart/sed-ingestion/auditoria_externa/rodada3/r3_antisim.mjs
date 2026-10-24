// D: o controle é estruturalmente antissimétrico em relação ao primário? Correlação entre a estatística t do primário e a do controle sob a nula e em mundos de ciclo. Uso: node r3_antisim.mjs
import { gen, esc3, rng, PAIR, CTRL, tstat } from './r3_lib.mjs';
import { M } from './nucleo.mjs';
const b = 3, G = 20, T = 21, r = rng(1), rw = rng(2468);
const recip = PAIR.filter(q => !M[q.b].some(x => x[0] === q.a)).length, ctrlRecip = CTRL.filter(c => PAIR.some(q => q.a === c.b && q.b === c.a)).length;
console.log('pares da matriz cujo recíproco está FORA da matriz (reciproco no controle):', recip, ' | pares de controle cujo recíproco é par da matriz:', ctrlRecip, 'de', CTRL.length);
const corr = (x, y) => { const n = x.length, mx = x.reduce((a, c) => a + c, 0) / n, my = y.reduce((a, c) => a + c, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
const fases = () => Array.from({ length: 10 }, () => 2 * Math.PI * rw());
for (const [nm, mk, mundos] of [['nula_base', () => ({}), 1], ['ciclo_grupo_periodo6 (um mundo por vez, 8 mundos)', () => ({ gCycle: { amp: .6, period: 6, theta: fases() } }), 8]]) {
  const tp = [], tc = [];
  for (let w = 0; w < mundos; w++) { const o = { G, T, lam: 8, ...mk() }; for (let s = 0; s < 400; s++) { const D = gen(o, r); tp.push(tstat(esc3(D, G, T, { burnY: b }).S)); tc.push(tstat(esc3(D, G, T, { burnY: b, pairs: CTRL }).S)); } }
  console.log(nm, 'correlação entre t primário e t controle:', corr(tp, tc).toFixed(2));
}
