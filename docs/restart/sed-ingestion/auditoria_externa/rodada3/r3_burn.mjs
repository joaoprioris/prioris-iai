// A: o descarte inicial resolve o transitório? Transitórios lentos, início escalonado, mudança de regime. Uso: node r3_burn.mjs <sims> [G] [Tteste]
import { gen, esc3, rej, rng, ci } from './r3_lib.mjs';
const sims = +process.argv[2] || 1500, G = +process.argv[3] || 20, Tt = +process.argv[4] || 18, b = 3, T = Tt + b, lam = 8;
const V = { sem_descarte: { burnY: 0 }, descarte3_doc: { burnY: 3 }, descarte3_exposicao_livre: { burnY: 3, burnE: 0 }, descarte6: { burnY: 6 }, descarte3_janela_cheia_nos_dois_lados: { burnY: 3, mid: true } };
const SC = {
  base: {},
  transit_tau2_sd1: { transient: { sd: 1, tau: 2 } }, transit_tau4_sd1_5: { transient: { sd: 1.5, tau: 4 } },
  transit_tau6_sd1: { transient: { sd: 1, tau: 6 } }, transit_tau6_sd1_5: { transient: { sd: 1.5, tau: 6 } }, transit_tau10_sd1_5: { transient: { sd: 1.5, tau: 10 } },
  escalonado_tau2: { entry: { max: 6 }, transient: { sd: 1, tau: 2 }, transOnset: true }, escalonado_tau4_sd1_5: { entry: { max: 6 }, transient: { sd: 1.5, tau: 4 }, transOnset: true }, escalonado_tau6_sd1: { entry: { max: 6 }, transient: { sd: 1, tau: 6 }, transOnset: true },
  escalonado_sem_transitorio: { entry: { max: 6 } },
  regime_meio_sd0_5: { regime: { sd: 0.5, at: Math.floor(T / 2) } }, regime_meio_sd0_8: { regime: { sd: 0.8, at: Math.floor(T / 2) } }, regime_meio_sd1_2: { regime: { sd: 1.2, at: Math.floor(T / 2) } },
};
for (const [nm, ex] of Object.entries(SC)) {
  const o = { G, T, lam, ...ex }, r = rng(3000 + nm.length * 13 + nm.charCodeAt(2)), k = {}; for (const v of Object.keys(V)) k[v] = 0;
  for (let s = 0; s < sims; s++) { const D = gen(o, r); for (const [v, op] of Object.entries(V)) if (rej(esc3(D, G, T, op).S)) k[v]++; }
  const row = { cenario: nm, G, T_total: T, sims }; for (const v of Object.keys(V)) row[v] = ci(k[v], sims); console.log(JSON.stringify(row));
}
