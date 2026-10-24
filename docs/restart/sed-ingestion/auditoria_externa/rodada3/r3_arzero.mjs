import { gen, esc3, rej, rng, ci } from './r3_lib.mjs';
const r = rng(8), sims = 3000; let a = 0, b = 0, c = 0;
for (let s = 0; s < sims; s++) { const D = gen({ G: 20, T: 21, lam: 8, ar: { rho: .8, sd: .8 }, arZero: true }, r); if (rej(esc3(D, 20, 21, { burnY: 0 }).S)) a++; if (rej(esc3(D, 20, 21, { burnY: 3 }).S)) b++; if (rej(esc3(D, 20, 21, { burnY: 6 }).S)) c++; }
console.log(JSON.stringify({ cenario: 'ar_comeca_em_zero G20 T total 21', sims, sem_descarte: ci(a, sims), descarte3: ci(b, sims), descarte6: ci(c, sims) }));
