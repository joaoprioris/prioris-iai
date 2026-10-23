// Acrescentado nesta cópia: opção cc/ccRho (causa comum persistente por grupo: três fatores latentes AR(1) que elevam juntas as dívidas de um mesmo bloco D1 a D4, D5 a D8, D9 a D10).
// Gerador e utilitários estatísticos. Origem: núcleo escrito pelo auditor externo (docs/restart/sed-ingestion/auditoria_externa/core.mjs), copiado sem alteração de lógica para ser a base do estimador da fase 2.
// Núcleo da auditoria externa: gerador de dados e estatísticas escritos do zero (não copiam power2.mjs).
// Matriz de adjacência (índices 0..9 = D1..D10) transcrita do repositório: [adjacente, prazo].
export const M = [
  [[2,0],[1,1],[8,2]], [[5,1],[3,2],[4,2]], [[4,0],[5,1],[6,2]], [[4,0],[1,1],[5,2]], [[5,1],[6,1],[3,2]],
  [[7,1],[6,2],[8,2]], [[7,1],[5,2],[8,2]], [[6,0],[5,1],[8,2]], [[0,0],[1,1],[9,2]], [[3,0],[8,1],[0,2]]];
// classe de prazo: 0 imediata (0-1 mês), 1 curto (2-3), 2 médio (4-6)
export const WIN = [[0, 1], [2, 3], [4, 6]];
export const NP = 30;
export const PAIR = []; // p -> {a,j,b,cls}
for (let a = 0; a < 10; a++) for (let j = 0; j < 3; j++) PAIR.push({ a, j, b: M[a][j][0], cls: M[a][j][1] });
const MAXLAG = 6;

// ---------- aleatoriedade ----------
export function rng(seed) { // sfc32 com semeadura splitmix32
  let s = seed >>> 0; const sm = () => { s = (s + 0x9e3779b9) >>> 0; let z = s; z = Math.imul(z ^ (z >>> 16), 0x85ebca6b); z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35); return (z ^ (z >>> 16)) >>> 0; };
  let a = sm(), b = sm(), c = sm(), d = sm();
  const f = () => { a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0; return (t >>> 0) / 4294967296; };
  for (let i = 0; i < 12; i++) f();
  return f;
}
export const normal = (r) => Math.sqrt(-2 * Math.log(r() || 1e-300)) * Math.cos(2 * Math.PI * r());
export function gamma(r, k) { // Marsaglia Tsang
  if (k < 1) return gamma(r, k + 1) * Math.pow(r() || 1e-300, 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) { let x, v; do { x = normal(r); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = r(); if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v; }
}
export function pois(r, l) {
  if (l <= 0) return 0; let n = 0;
  while (l > 20) { n += pois(r, 20); l -= 20; }
  const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return n + k - 1;
}

// ---------- gerador de dados ----------
// opts: G,T,lam (SED médios por grupo e mês), sizeSd (log dp do tamanho do grupo), nbShape (forma gama do multiplicador mensal; 0 = sem),
// compSd (ruído iid log-peso por grupo,mês,dívida: sobredispersão da composição), arRho/arSd (log-peso latente AR(1) por grupo e dívida),
// trendSd (inclinação mensal comum a todos os grupos, por dívida), seasAmp (sazonalidade comum, período 6 meses, fase por dívida),
// skew (0 = dívidas equiprováveis; >0 = participação decrescente geométrica), pAdj, circ (kappa do classificador circular),
// RR, mode ('ramp' = estilo documento, 'step' = RR constante se houver exposição na janela), trendPair (inclinação conjunta A e B para um par)
export function simulate(o, r) {
  const { G, T, lam, sizeSd = 0, nbShape = 0, compSd = 0, arRho = 0, arSd = 0, trendSd = 0, shockSd = 0, cc = 0, ccRho = 0.8, seasAmp = 0, skew = 0, pAdj = 0.7, circ = 0, RR = 1, mode = 'ramp', common = 0, driver = 'x' } = o;
  const base = []; for (let d = 0; d < 10; d++) base.push(-skew * d);
  const slope = []; const phase = [];
  for (let d = 0; d < 10; d++) { slope.push(trendSd * normal(r)); phase.push(2 * Math.PI * r()); }
  const shock = shockSd > 0 ? Array.from({ length: T }, () => Array.from({ length: 10 }, () => shockSd * normal(r))) : null;
  const out = { n: [], N: [], x: [], realized: 0, realizedCount: 0 };
  const mu = Math.log(lam);
  for (let g = 0; g < G; g++) {
    const gsize = Math.exp(sizeSd * normal(r) - 0.5 * sizeSd * sizeSd);
    const ar = new Array(10).fill(0).map(() => arSd * normal(r));
    const zc = [cc * normal(r), cc * normal(r), cc * normal(r)]; const bloco = (d) => d < 4 ? 0 : d < 8 ? 1 : 2;
    const ng = new Int16Array(T * 10), Ng = new Int16Array(T), xg = new Int16Array(T * NP);
    for (let t = 0; t < T; t++) {
      const lw = new Array(10);
      for (let d = 0; d < 10; d++) {
        if (t > 0 || true) ar[d] = arRho * ar[d] + Math.sqrt(1 - arRho * arRho) * arSd * normal(r);
        lw[d] = base[d] + slope[d] * (t - (T - 1) / 2) + seasAmp * Math.sin(2 * Math.PI * t / 6 + phase[d]) + ar[d] + compSd * normal(r);
        if (cc > 0) { if (d === 0) for (let k = 0; k < 3; k++) zc[k] = ccRho * zc[k] + Math.sqrt(1 - ccRho * ccRho) * cc * normal(r); lw[d] += zc[bloco(d)]; }
        if (shock) lw[d] += shock[t][d]; // choque mensal comum a todos os grupos do cliente
      }
      const w = lw.map(Math.exp);
      // efeito de conversão
      if (RR > 1) {
        const ex = new Array(10).fill(0);
        for (let p = 0; p < NP; p++) {
          const { b, cls } = PAIR[p]; const [s, e] = WIN[cls];
          for (let l = 0; l <= Math.min(MAXLAG, t); l++) {
            let f; if (mode === 'ramp') f = l < s ? 0 : (l <= e ? (l - s + 1) / (e - s + 2) : 1); else f = (l >= Math.max(1, s)) ? 1 : 0;
            if (f > 0) ex[b] += f * (driver === 'A' ? ng[(t - l) * 10 + PAIR[p].a] * pAdj / 3 : xg[(t - l) * NP + p]);
          }
        }
        for (let b = 0; b < 10; b++) {
          const m = mode === 'ramp' ? Math.pow(RR, Math.min(1, ex[b] / 3)) : (ex[b] > 0 ? RR : 1);
          out.realized += m; out.realizedCount++;
          w[b] *= m;
        }
      }
      const sw = w.reduce((a, b) => a + b, 0);
      let mult = gsize; if (nbShape > 0) mult *= gamma(r, nbShape) / nbShape;
      const N = pois(r, lam * mult); Ng[t] = N;
      // probabilidades de adjacente candidato para o classificador circular (usa o log-peso latente sem efeito)
      for (let i = 0; i < N; i++) {
        let u = r() * sw, d = 0; while (d < 9 && u > w[d]) { u -= w[d]; d++; }
        ng[t * 10 + d]++;
        if (r() < pAdj) {
          let j;
          if (circ > 0) { const c = [0, 1, 2].map(q => Math.exp(circ * lw[M[d][q][0]])); const s3 = c[0] + c[1] + c[2]; let uu = r() * s3; j = 0; while (j < 2 && uu > c[j]) { uu -= c[j]; j++; } }
          else j = Math.floor(r() * 3);
          xg[t * NP + d * 3 + j]++;
        }
      }
    }
    out.n.push(ng); out.N.push(Ng); out.x.push(xg);
  }
  return out;
}

// ---------- estatísticas ----------
export const CFG = { normalize: false };
const STARTS = PAIR.map(q => Math.max(1, WIN[q.cls][0]));
// exposição por par e mês para um grupo, dada a ordem idx dos meses (null = original)
function exposures(xg, T, idx, E) {
  for (let p = 0; p < NP; p++) {
    const s = STARTS[p];
    for (let t = 0; t < T; t++) {
      let e = 0; for (let l = s; l <= MAXLAG && l <= t; l++) e += xg[(idx ? idx[t - l] : t - l) * NP + p];
      if (CFG.normalize) { const avail = Math.max(0, Math.min(MAXLAG, t) - s + 1); e = avail > 0 ? e * (MAXLAG - s + 1) / avail : 0; }
      E[p * T + t] = e;
    }
  }
}
// estatística do documento (escore): soma_p soma_t e * (n_b,t - N_t * share_b). Retorna S total e S por classe.
export function statDoc(D, G, T, perm /* array de idx por grupo ou null */, shift /* deslocamento do desfecho por grupo ou null */) {
  const S = [0, 0, 0]; const E = new Float64Array(NP * T);
  for (let g = 0; g < G; g++) {
    const xg = D.x[g], ng = D.n[g], Ng = D.N[g]; let tn = 0; const tb = new Array(10).fill(0);
    for (let t = 0; t < T; t++) { tn += Ng[t]; for (let d = 0; d < 10; d++) tb[d] += ng[t * 10 + d]; }
    if (tn === 0) continue;
    const idx = perm ? perm[g] : null; exposures(xg, T, idx, E);
    for (let p = 0; p < NP; p++) {
      const { b, cls } = PAIR[p]; const sh = tb[b] / tn; let acc = 0;
      for (let t = 0; t < T; t++) {
        const e = E[p * T + t]; if (e === 0) continue;
        let tt = idx ? idx[t] : t; if (shift) tt = (t + shift[g]) % T;
        acc += e * (ng[tt * 10 + b] - Ng[tt] * sh);
      }
      S[cls] += acc;
    }
  }
  return S;
}
export function randPerm(T, r) { const a = Array.from({ length: T }, (_, i) => i); for (let i = T - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); const tmp = a[i]; a[i] = a[k]; a[k] = tmp; } return a; }

// p-valores de permutação (meses embaralhados por grupo), global e por classe, e p mín-P ajustado (Westfall Young)
export function permTest(D, G, T, B, r, opts = {}) {
  const obs = statDoc(D, G, T, null, null); const obsG = obs[0] + obs[1] + obs[2];
  let geG = 1; const geC = [1, 1, 1]; const perms = [];
  for (let k = 0; k < B; k++) {
    let perm, shift = null;
    if (opts.shift) { perm = null; shift = []; for (let g = 0; g < G; g++) shift.push(1 + Math.floor(r() * (T - 1))); }
    else { perm = []; for (let g = 0; g < G; g++) perm.push(randPerm(T, r)); }
    const s = statDoc(D, G, T, perm, shift); perms.push(s);
    if (s[0] + s[1] + s[2] >= obsG) geG++;
    for (let c = 0; c < 3; c++) if (s[c] >= obs[c]) geC[c]++;
  }
  const pG = geG / (B + 1), pC = geC.map(v => v / (B + 1));
  // p ajustado min-P: para cada classe, P(min p* <= p_obs) usando as próprias permutações (ranking por classe)
  const pstar = perms.map(s => [0, 1, 2].map(c => { let n = 0; for (const q of perms) if (q[c] >= s[c]) n++; return n / (B + 1); })); // n inclui a própria permutação
  const minObs = Math.min(...pC);
  let cnt = 1; for (const ps of pstar) if (Math.min(...ps) <= minObs) cnt++;
  return { pG, pC, pMinP: cnt / (B + 1), obs };
}

// ---------- alternativa: teste t sobre escores por grupo, com remoção de efeito de mês (tendência/sazonalidade comuns) ----------
// y_gt,b = n/N. Para cada mês, subtrai-se a participação agregada entre grupos; a exposição também é centrada por mês entre grupos.
export function groupScores(D, G, T, opts = {}) {
  const { adjustHist = false } = opts;
  // participação agregada por mês e dívida; exposição por par, grupo e mês
  const pool = []; for (let t = 0; t < T; t++) { const n = new Array(10).fill(0); let N = 0; for (let g = 0; g < G; g++) { N += D.N[g][t]; for (let d = 0; d < 10; d++) n[d] += D.n[g][t * 10 + d]; } pool.push(n.map(v => N > 0 ? v / N : 0)); }
  const E = []; for (let g = 0; g < G; g++) { const e = new Float64Array(NP * T); exposures(D.x[g], T, null, e); E.push(e); }
  const em = new Float64Array(NP * T); for (let p = 0; p < NP; p++) for (let t = 0; t < T; t++) { let s = 0; for (let g = 0; g < G; g++) s += E[g][p * T + t]; em[p * T + t] = s / G; }
  const sc = [];
  for (let g = 0; g < G; g++) {
    let S = 0;
    for (let t = 0; t < T; t++) {
      const N = D.N[g][t]; if (N === 0) continue;
      for (let p = 0; p < NP; p++) {
        const b = PAIR[p].b; const e = E[g][p * T + t] - em[p * T + t];
        let y = D.n[g][t * 10 + b] / N - pool[t][b];
        if (adjustHist) { // desfecho como mudança em relação aos 2 meses anteriores (controla autocorrelação do próprio B)
          if (t < 2) continue; let h = 0, c = 0; for (let q = 1; q <= 2; q++) { const Nq = D.N[g][t - q]; if (Nq > 0) { h += D.n[g][(t - q) * 10 + b] / Nq - pool[t - q][b]; c++; } }
          y -= c ? h / c : 0;
        }
        S += e * y * N;
      }
    }
    sc.push(S);
  }
  return sc;
}
// cdf t de Student por integração numérica (Simpson) da densidade
function lgamma(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (let j = 0; j < 6; j++) s += c[j] / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
export function tcdf(t, df) {
  const c = Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2)) / Math.sqrt(df * Math.PI);
  const f = (u) => c * Math.pow(1 + u * u / df, -(df + 1) / 2);
  const n = 2000, a = 0, b = Math.abs(t), h = (b - a) / n; let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  const half = s * h / 3; return t >= 0 ? 0.5 + half : 0.5 - half;
}
export function tTestP(sc) { // unilateral, H1: média > 0
  const G = sc.length; const m = sc.reduce((a, b) => a + b, 0) / G; const v = sc.reduce((a, b) => a + (b - m) * (b - m), 0) / (G - 1);
  if (!(v > 0)) return 1; const t = m / Math.sqrt(v / G); return 1 - tcdf(t, G - 1);
}
export const wilsonCI = (k, n, z = 1.96) => { const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), w = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - w) / d, (c + w) / d]; };
