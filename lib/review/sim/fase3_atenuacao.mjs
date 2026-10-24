// Atenuação do beta: compara a inclinação estimada com o efeito aditivo injetado (gerador do auditor). Uso: node fase3_atenuacao.mjs <sims>
import { gen, rng } from './gerador2.mjs';
import { PAIR } from './nucleo.mjs';
import { escoresV3, beta } from './estimador2.mjs';
const sims = +process.argv[2] || 200, b = 3;
for (const [G, T] of [[40, 18], [60, 12]]) for (const inj of [0.05, 0.10, 0.20]) {
  const r = rng(11 + G + T + inj * 100); const bs = [];
  for (let s = 0; s < sims; s++) { const D = gen({ G, T: T + b, lam: 8, efeito: { beta: inj, pairs: PAIR } }, r); const e = escoresV3(D, G, T + b, { burn: b }); bs.push(beta(e.S, e.Q)); }
  const m = bs.reduce((a, c) => a + c, 0) / sims, sd = Math.sqrt(bs.reduce((a, c) => a + (c - m) ** 2, 0) / (sims - 1));
  console.log(JSON.stringify({ G, T, injetado: inj, beta_medio: +m.toFixed(4), razao_estimado_sobre_injetado: +(m / inj).toFixed(2), dp_entre_simulacoes: +sd.toFixed(4) }));
}
