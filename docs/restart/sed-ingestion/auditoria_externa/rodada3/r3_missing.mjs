// E: tratar mês suprimido como ausente (e não como participação zero) na exposição. Uso: node r3_missing.mjs <sims>
import { gen, esc3, rej, rng, ci, PAIR, lib } from './r3_lib.mjs';
import { simulate } from './nucleo.mjs';
const sims = +process.argv[2] || 500;
for (const [nm, f, G] of [['nula', (r) => gen({ G: 40, T: 21, lam: 8 }, r), 40], ['aditivo 0,10', (r) => gen({ G: 40, T: 21, lam: 8, efeito: { beta: .10, pairs: PAIR } }, r), 40], ['rampa RR2 (nucleo)', (r) => simulate({ G: 40, T: 21, lam: 8, RR: 2, driver: 'A', sizeSd: .0867 }, r), 40]]) for (const pk of [['piso proxy 5 SED', 5], ['piso proxy 7 SED', 7]]) {
  const r = rng(3), k = { zero: 0, aus: 0 }; for (let s = 0; s < sims; s++) { const D = lib(f(r), G, 21, pk[1]); if (rej(esc3(D, G, 21, { burnY: 3 }).S)) k.zero++; if (rej(esc3(D, G, 21, { burnY: 3, skipMissing: true }).S)) k.aus++; }
  console.log(JSON.stringify({ dgp: nm, liberacao: pk[0], G, rejeita_tratando_mes_suprimido_como_zero_v3: ci(k.zero, sims), rejeita_tratando_como_ausente: ci(k.aus, sims) }));
}
