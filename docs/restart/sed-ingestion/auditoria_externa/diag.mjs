// Diagnósticos: controle negativo (60 pares), placebo de tempo vs placebo de antecedência (lead), desclassificação, Brier fora da amostra.
// Uso: node diag.mjs neg|placebo|misclass|brier <sims>
import { simulate, rng, permTest, statDoc, randPerm, groupScores, tTestP, wilsonCI, PAIR, NP, M, WIN } from './core.mjs';
const mode = process.argv[2], sims = +process.argv[3] || 300;
const ci = (k, n) => { const [lo, hi] = wilsonCI(k, n); return `${(100 * k / n).toFixed(1)} [${(100 * lo).toFixed(1)};${(100 * hi).toFixed(1)}]`; };

if (mode === 'neg') {
  // 60 pares fora da matriz, exposição = contagem do principal A (o classificador não escolhe adjacente fora da matriz), janela 1..6, teste de permutação por par, p<0,05
  const non = []; for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) if (a !== b && !M[a].some(q => q[0] === b)) non.push([a, b]);
  console.log('pares fora da matriz:', non.length);
  const scen = { iid: {}, ar: { arRho: 0.8, arSd: 0.6 }, tend: { trendSd: 0.08 } };
  for (const [nm, ex] of Object.entries(scen)) {
    const G = 20, T = 12, lam = 8, B = 99; const r = rng(4242); const counts = [];
    for (let s = 0; s < sims; s++) {
      const D = simulate({ G, T, lam, RR: 1, ...ex }, r);
      // exposição de A: soma de n[a] em t-1..t-6 ; S_pair = soma e*(n_b - N*sh_b)
      const stat = (perm) => { const S = new Float64Array(60); for (let g = 0; g < G; g++) { const ng = D.n[g], Ng = D.N[g]; let tn = 0; const tb = new Array(10).fill(0); for (let t = 0; t < T; t++) { tn += Ng[t]; for (let d = 0; d < 10; d++) tb[d] += ng[t * 10 + d]; } if (!tn) continue; const idx = perm ? perm[g] : null;
        non.forEach(([a, b], k) => { const sh = tb[b] / tn; let acc = 0; for (let t = 1; t < T; t++) { let e = 0; for (let l = 1; l <= Math.min(6, t); l++) e += ng[(idx ? idx[t - l] : t - l) * 10 + a]; const tt = idx ? idx[t] : t; acc += e * (ng[tt * 10 + b] - Ng[tt] * sh); } S[k] += acc; }); } return S; };
      const obs = stat(null); const ge = new Array(60).fill(1);
      for (let k = 0; k < B; k++) { const perm = []; for (let g = 0; g < G; g++) perm.push(randPerm(T, r)); const sp = stat(perm); for (let i = 0; i < 60; i++) if (sp[i] >= obs[i]) ge[i]++; }
      counts.push(ge.filter(v => v / (B + 1) <= 0.05).length);
    }
    const mean = counts.reduce((a, b) => a + b, 0) / sims; const v = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / (sims - 1);
    const over7 = counts.filter(c => c >= 7).length, over9 = counts.filter(c => c >= 9).length;
    console.log(JSON.stringify({ cenario: nm, G, T, lam, sims, media_descobertas_de_60: +mean.toFixed(2), var_obs: +v.toFixed(2), var_binomial_indep: +(60 * .05 * .95).toFixed(2), 'P(>=7 de 60) [reprova controle]': ci(over7, sims), 'P(>=9 de 60)': ci(over9, sims) }));
  }
}

if (mode === 'placebo') {
  // Placebo "ordem embaralhada" (do documento) é a própria referência da permutação: sob qualquer cenário rejeita 5%. Placebo de antecedência (lead): usa exposição do FUTURO (t+l) para explicar o desfecho de t.
  // Se rejeitar, há confusão por persistência/tendência (causalidade reversa é impossível).
  const scen = { nulo_iid: {}, tendencia: { trendSd: 0.08 }, ar: { arRho: 0.8, arSd: 0.6 }, circ_ar: { arRho: 0.8, arSd: 0.6, circ: 1 }, 'efeito_real_RR1.5': { RR: 1.5, mode: 'ramp' } };
  for (const [nm, ex] of Object.entries(scen)) {
    const G = 20, T = 12, lam = 8, B = 199; const r = rng(99); let mainRej = 0, leadRej = 0, both = 0;
    for (let s = 0; s < sims; s++) {
      const D = simulate({ G, T, lam, ...ex }, r);
      const main = permTest(D, G, T, B, r).pG <= 0.05;
      // lead: inverter o tempo (série reversa) transforma lag em lead
      const Dr = { n: D.n.map(a => { const o = new Int16Array(a.length); for (let t = 0; t < T; t++) for (let d = 0; d < 10; d++) o[t * 10 + d] = a[(T - 1 - t) * 10 + d]; return o; }), N: D.N.map(a => Int16Array.from([...a].reverse())), x: D.x.map(a => { const o = new Int16Array(a.length); for (let t = 0; t < T; t++) for (let p = 0; p < NP; p++) o[t * NP + p] = a[(T - 1 - t) * NP + p]; return o; }) };
      const lead = permTest(Dr, G, T, B, r).pG <= 0.05;
      if (main) mainRej++; if (lead) leadRej++; if (main && !lead) both++;
    }
    console.log(JSON.stringify({ cenario: nm, G, T, lam, sims, rejeita_principal: ci(mainRej, sims), rejeita_placebo_antecedencia: ci(leadRej, sims), principal_e_passa_placebo: ci(both, sims) }));
  }
}

if (mode === 'misclass') {
  // classificação imperfeita: cada SED tem probabilidade q de trocar de dívida principal (e o par vai junto), efeito real RR 1,5 e 2,0
  const relabel = (D, G, T, q, r) => { for (let g = 0; g < G; g++) { const n = D.n[g], x = D.x[g]; const n2 = new Int16Array(n.length), x2 = new Int16Array(x.length);
    for (let t = 0; t < T; t++) { for (let d = 0; d < 10; d++) for (let i = 0; i < n[t * 10 + d]; i++) { let k = d; if (r() < q) { k = Math.floor(r() * 9); if (k >= d) k++; } n2[t * 10 + k]++; }
      for (let p = 0; p < NP; p++) for (let i = 0; i < x[t * NP + p]; i++) { const a = Math.floor(p / 3), j = p % 3; let k = a; if (r() < q) { k = Math.floor(r() * 9); if (k >= a) k++; } x2[t * NP + k * 3 + j]++; } }
    D.n[g] = n2; D.x[g] = x2; D.N[g] = D.N[g]; } return D; };
  for (const q of [0, 0.15, 0.3, 0.45]) for (const RR of [1.5, 2]) {
    const G = 20, T = 12, lam = 8, B = 199; const r = rng(31 + Math.round(q * 100) + RR * 10); let rej = 0;
    for (let s = 0; s < sims; s++) { const D = relabel(simulate({ G, T, lam, RR, mode: 'ramp', sizeSd: 0.0867 }, r), G, T, q, r); if (permTest(D, G, T, B, r).pG <= 0.05) rej++; }
    console.log(JSON.stringify({ troca_principal_q: q, G, T, lam, RR, sims, poder: ci(rej, sims) }));
  }
}

if (mode === 'brier') {
  // Ganho de previsão fora da amostra (Brier) com a exposição versus baseline sem ela. Treino: metade dos grupos (ajusta beta por grade); teste: outra metade.
  for (const [G, T, lam, RR] of [[20, 12, 8, 1.5], [20, 12, 8, 2], [40, 12, 8, 1.5], [40, 12, 8, 2], [20, 12, 8, 1.0]]) {
    const r = rng(2024 + G + RR * 10); let pass = 0, sims_ok = 0; const diffs = [];
    for (let s = 0; s < sims; s++) {
      const D = simulate({ G, T, lam, RR, mode: 'ramp', sizeSd: 0.0867 }, r);
      const tr = [], te = []; for (let g = 0; g < G; g++) (g % 2 ? te : tr).push(g);
      // exposição total por (g,t,b) = soma dos pares que chegam em b, janela de cada par (início..6), meses t>=6 apenas (histórico completo)
      const ex = (g, t, b) => { let e = 0; for (let p = 0; p < NP; p++) { if (PAIR[p].b !== b) continue; for (let l = Math.max(1, WIN[PAIR[p].cls][0]); l <= 6 && l <= t; l++) e += D.x[g][(t - l) * NP + p]; } return e; };
      const share = new Array(10).fill(0); let tot = 0; for (const g of tr) for (let t = 0; t < T; t++) { tot += D.N[g][t]; for (let d = 0; d < 10; d++) share[d] += D.n[g][t * 10 + d]; } for (let d = 0; d < 10; d++) share[d] /= tot;
      const brier = (gs, beta) => { const per = []; for (const g of gs) { let s2 = 0, c = 0; for (let t = 6; t < T; t++) for (let b = 0; b < 10; b++) { const mu = share[b] * D.N[g][t] * (1 + beta * ex(g, t, b)); const p = 1 - Math.exp(-mu); const y = D.n[g][t * 10 + b] > 0 ? 1 : 0; s2 += (p - y) ** 2; c++; } per.push(s2 / c); } return per; };
      let bestB = 0, bestS = Infinity; for (let beta = 0; beta <= 1.0001; beta += 0.05) { const v = brier(tr, beta).reduce((a, b) => a + b, 0); if (v < bestS) { bestS = v; bestB = beta; } }
      const b0 = brier(te, 0), b1 = brier(te, bestB); const d = b0.map((v, i) => v - b1[i]); const m = d.reduce((a, b) => a + b, 0) / d.length; const sd = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / (d.length - 1));
      const lo = m - 2.093 * sd / Math.sqrt(d.length) * (d.length === 20 ? 1 : 1); // t aproximado (df ~ 9 a 19): usa 2,26 para df 9
      const tcrit = d.length <= 10 ? 2.262 : 2.093; if (m - tcrit * sd / Math.sqrt(d.length) > 0) pass++; diffs.push(m); sims_ok++;
    }
    const md = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    console.log(JSON.stringify({ G, T, lam, RR, sims, 'P(IC95 do ganho de Brier > 0)': ci(pass, sims), ganho_medio_brier: +md.toFixed(5) }));
  }
}
