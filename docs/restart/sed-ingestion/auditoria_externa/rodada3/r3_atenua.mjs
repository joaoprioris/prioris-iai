// C: o beta é traduzível em efeito mínimo? Razão beta estimado / efeito injetado sob variações de forma, volume e persistência. Uso: node r3_atenua.mjs <sims>
import { gen, esc3, rng, PAIR } from './r3_lib.mjs';
const sims = +process.argv[2] || 150, b = 3, G = 40, Tt = 18, T = Tt + b;
const casos = [
  ['base lam8, janela do estimador', {}, [0.05, 0.1, 0.2, 0.4]],
  ['lam 4', { lam: 4 }, [0.1, 0.2]], ['lam 16', { lam: 16 }, [0.1, 0.2]],
  ['A persistente (AR 0,8)', { ar: { rho: .8, sd: .6 } }, [0.1, 0.2]],
  ['efeito só em lags 1 a 2', { lags: [1, 2] }, [0.1, 0.2]], ['efeito só em lags 4 a 6', { lags: [4, 6] }, [0.1, 0.2]],
  ['participações desiguais (skew 0,6)', { skew: 0.6 }, [0.1, 0.2]],
];
for (const [nm, ex, injs] of casos) for (const inj of injs) {
  const r = rng(77 + nm.length + Math.round(inj * 100)), bs = [];
  for (let s = 0; s < sims; s++) { const lags = ex.lags || null; const o = { G, T, lam: ex.lam || 8, ar: ex.ar || null, skew: ex.skew || 0, efeito: { beta: inj, pairs: PAIR, lags } }; const D = gen(o, r); const e = esc3(D, G, T, { burnY: b }); bs.push(e.S.reduce((a, c) => a + c, 0) / e.Q.reduce((a, c) => a + c, 0)); }
  const m = bs.reduce((a, c) => a + c, 0) / sims, sd = Math.sqrt(bs.reduce((a, c) => a + (c - m) ** 2, 0) / (sims - 1));
  console.log(JSON.stringify({ caso: nm, injetado: inj, beta_medio: +m.toFixed(4), razao: +(m / inj).toFixed(2), dp: +sd.toFixed(4) }));
}
