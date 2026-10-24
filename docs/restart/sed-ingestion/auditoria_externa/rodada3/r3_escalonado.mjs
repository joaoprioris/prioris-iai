// A: descarte por grupo (3 meses a partir da entrada de cada grupo) versus descarte de calendário, em início escalonado. Uso: node r3_escalonado.mjs <sims>
import { gen, esc3, rej, rng, ci } from './r3_lib.mjs';
const sims = +process.argv[2] || 1500, G = 20, T = 21, b = 3;
const cortaPorGrupo = (D, k) => { const n = D.n.map((a, g) => { const c = Int16Array.from(a); for (let t = 0; t < D.N[g].length; t++) if (t < D.EG[g] + k) for (let d = 0; d < 10; d++) c[t * 10 + d] = 0; return c; }), N = D.N.map((a, g) => Int16Array.from(a, (v, t) => t < D.EG[g] + k ? 0 : v)); return { n, N }; };
for (const [nm, ex] of Object.entries({ escalonado_sem_transitorio: { entry: { max: 6 } }, escalonado_tau2: { entry: { max: 6 }, transient: { sd: 1, tau: 2 }, transOnset: true }, escalonado_tau4_sd1_5: { entry: { max: 6 }, transient: { sd: 1.5, tau: 4 }, transOnset: true }, escalonado_tau6_sd1: { entry: { max: 6 }, transient: { sd: 1, tau: 6 }, transOnset: true } })) {
  const r = rng(11 + nm.length), k = { cal: 0, grp: 0, grp6: 0 }; for (let s = 0; s < sims; s++) { const D = gen({ G, T, lam: 8, ...ex }, r); if (rej(esc3(D, G, T, { burnY: 3 }).S)) k.cal++; if (rej(esc3(cortaPorGrupo(D, 3), G, T, { burnY: 0, skipMissing: true }).S)) k.grp++; if (rej(esc3(cortaPorGrupo(D, 6), G, T, { burnY: 0, skipMissing: true }).S)) k.grp6++; }
  console.log(JSON.stringify({ cenario: nm, G, T_total: T, sims, descarte_calendario_3: ci(k.cal, sims), descarte_por_grupo_3_a_partir_da_entrada: ci(k.grp, sims), descarte_por_grupo_6: ci(k.grp6, sims) }));
}
