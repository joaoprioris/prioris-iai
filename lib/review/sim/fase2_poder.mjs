// Poder do teste direcional (defasagem menos avanço, exposição média) pelo tamanho do piloto. Uso: node fase2_poder.mjs <sims> [liberacao|celulas|todos]
import { simulate, rng, wilsonCI } from './nucleo.mjs';
import { direcional, rejeita, suprimirCelulas, liberarGrupoMes } from './estimador.mjs';
const sims = +process.argv[2] || 300, modo = process.argv[3] || 'todos';
const f = (k) => { const [lo, hi] = wilsonCI(k, sims); return `${Math.round(100 * k / sims)}`; };
console.log('driver A (contagem de A como principal), efeito em rampa, sizeSd 0.0867; RR = pico do efeito; colunas: poder % com liberação agregada por grupo e mês (todos | celulas) ' + sims + ' sims');
console.log(['G', 'T', 'lam', 'liberacao', 'RR1.5', 'RR2', 'RR3'].join('\t'));
const grid = [];
for (const lam of [4, 8, 16]) for (const T of [12, 18, 24]) for (const G of [10, 20, 40, 60, 100]) grid.push([G, T, lam]);
for (const [G, T, lam] of grid) for (const lib of (modo === 'todos' ? ['agregada', 'celulas'] : [modo])) {
  if (lib === 'celulas' && lam !== 8) continue;
  const row = [G, T, lam, lib];
  for (const RR of [1.5, 2, 3]) {
    const r = rng(31337 + G * 7 + T * 13 + lam * 17 + RR * 101); let k = 0;
    for (let s = 0; s < sims; s++) {
      let D = simulate({ G, T, lam, RR, driver: 'A', sizeSd: .0867 }, r);
      D = lib === 'celulas' ? suprimirCelulas(D, G, T) : liberarGrupoMes(D, G, T);
      if (rejeita(direcional(D, G, T, true).S)) k++;
    }
    row.push(f(k));
  }
  console.log(row.join('\t'));
}
