// G: por que o "degrau" tinha poder de 41% na rodada 2 e 6% agora? Efeito constante liga no mês 1 em todos os grupos: a variação vem do início do programa. Uso: node r3_degrau.mjs
import { esc3, rej, rng, ci } from './r3_lib.mjs';
import { simulate } from './nucleo.mjs';
const sims = 500, r = rng(4); const k = { b0: 0, b1: 0, b2: 0, b3: 0 };
for (let s = 0; s < sims; s++) { const D = simulate({ G: 40, T: 21, lam: 8, RR: 2, driver: 'A', mode: 'step', sizeSd: .0867 }, r); for (const b of [0, 1, 2, 3]) if (rej(esc3(D, 40, 21, { burnY: b }).S)) k['b' + b]++; }
console.log(JSON.stringify({ efeito: 'degrau RR2, 40 grupos, 21 meses gerados', descarte0: ci(k.b0, sims), descarte1: ci(k.b1, sims), descarte2: ci(k.b2, sims), descarte3: ci(k.b3, sims) }));
