// Simulação de poder com INÍCIO GRADUAL e CONSOLIDAÇÃO TARDIA do efeito (adjacência que vira principal aos poucos).
// Janelas por prazo da matriz (meses): imediata 0-1, curto 2-3, médio 4-6. Premissas de volume são hipóteses.
const P={imediata:[0,1],curto:[2,3],medio:[4,6]};
// [adjacente, prazo] por dívida principal (índices 0..9 = D1..D10), do Mestre (Doc. 1)
const M=[
 [[2,'imediata'],[1,'curto'],[8,'medio']],
 [[5,'curto'],[3,'medio'],[4,'medio']],
 [[4,'imediata'],[5,'curto'],[6,'medio']],
 [[4,'imediata'],[1,'curto'],[5,'medio']],
 [[5,'curto'],[6,'curto'],[3,'medio']],
 [[7,'curto'],[6,'medio'],[8,'medio']],
 [[7,'curto'],[5,'medio'],[8,'medio']],
 [[6,'imediata'],[5,'curto'],[8,'medio']],
 [[0,'imediata'],[1,'curto'],[9,'medio']],
 [[3,'imediata'],[8,'curto'],[0,'medio']]];
const MAXLAG=6;
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function pois(r,l){if(l>30){const u=Math.sqrt(-2*Math.log(r()||1e-12))*Math.cos(2*Math.PI*r());return Math.max(0,Math.round(l+Math.sqrt(l)*u))}let L=Math.exp(-l),k=0,p=1;do{k++;p*=r()}while(p>L);return k-1}
// fração do efeito já presente com defasagem l: 0 antes da janela, sobe dentro dela, 1 (consolidado) depois
function ramp(l,prazo){const [s,e]=P[prazo];if(l<s)return 0;if(l<=e)return(l-s+1)/(e-s+2);return 1}
function simulate({G,T,lambda,RR,seed,pAdj=0.7}){
  const r=rng(seed),n=[],x=[];
  for(let g=0;g<G;g++){
    const gl=lambda*Math.exp(0.3*(r()-0.5)),ng=[],xg=[];
    for(let t=0;t<T;t++){
      const w=new Array(10).fill(1);
      if(RR>1){
        const ex=new Array(10).fill(0);
        for(let a=0;a<10;a++)for(let j=0;j<3;j++){const [b,pz]=M[a][j];for(let l=0;l<=Math.min(MAXLAG,t);l++){const f=ramp(l,pz);if(f>0&&t-l>=0&&xg[t-l])ex[b]+=f*xg[t-l][a][j]}}
        for(let b=0;b<10;b++)w[b]*=Math.pow(RR,Math.min(1,ex[b]/3));
      }
      const sw=w.reduce((s,v)=>s+v,0),nt=new Array(10).fill(0),xt=Array.from({length:10},()=>[0,0,0]),N=pois(r,gl);
      for(let i=0;i<N;i++){let u=r()*sw,d=0;while(u>w[d]){u-=w[d];d++}nt[d]++;if(r()<pAdj)xt[d][Math.floor(r()*3)]++}
      ng.push(nt);xg.push(xt);
    }
    n.push(ng);x.push(xg);
  }
  return {n,x};
}
// exposição acumulada pré-especificada: pares A->B desde o início da janela do prazo (defasagem s até 6)
function exposure(x,g,t,a,j){const s=Math.max(1,P[M[a][j][1]][0]);let e=0;for(let l=s;l<=Math.min(MAXLAG,t);l++)e+=x[g][t-l][a][j];return e}
function globalS(data,G,T,shifts){
  let S=0,V=0;
  for(let g=0;g<G;g++){
    let tn=0;const tb=new Array(10).fill(0);const Nt=[];
    for(let t=0;t<T;t++){let N=0;for(let d=0;d<10;d++){N+=data.n[g][t][d];tb[d]+=data.n[g][t][d]}Nt.push(N);tn+=N}
    if(tn===0)continue;
    for(let a=0;a<10;a++)for(let j=0;j<3;j++){
      const b=M[a][j][0],sh=tb[b]/tn;
      for(let t=0;t<T;t++){
        const tt=shifts?((t+shifts[g])%T):t;
        const e=exposure(data.x,g,t,a,j);
        if(e===0)continue;
        S+=e*(data.n[g][tt][b]-Nt[tt]*sh);V+=e*e*Math.max(Nt[tt]*sh*(1-sh),0.05);
      }
    }
  }
  return {S,V};
}
function permutarMeses(data,G,T,r){
  const n=[],x=[];
  for(let g=0;g<G;g++){
    const idx=Array.from({length:T},(_,i)=>i);
    for(let i=T-1;i>0;i--){const k=Math.floor(r()*(i+1));[idx[i],idx[k]]=[idx[k],idx[i]]}
    n.push(idx.map(i=>data.n[g][i]));x.push(idx.map(i=>data.x[g][i]));
  }
  return {n,x};
}
// Permuta a ORDEM DOS MESES de cada grupo, mantendo juntos o par e o desfecho do mesmo mes (sob a hipotese nula os meses sao trocaveis).
function pPerm(data,G,T,B,r){
  const obs=globalS(data,G,T,null);let ge=1;
  for(let k=0;k<B;k++){const pd=permutarMeses(data,G,T,r);if(globalS(pd,G,T,null).S>=obs.S)ge++}
  return ge/(B+1);
}
function run({G,T,lambda,RR,sims,B=199}){
  let rej=0,rejZ=0;const r=rng(99);
  for(let s=0;s<sims;s++){
    const data=simulate({G,T,lambda,RR,seed:7000+s*104729+G*31+T});
    const o=globalS(data,G,T,null);if(o.V>0&&o.S/Math.sqrt(o.V)>1.6449)rejZ++;
    if(pPerm(data,G,T,B,r)<=0.05)rej++;
  }
  return {perm:rej/sims,normal:rejZ/sims};
}
const sims=Number(process.argv[2]||200);
console.log('TESTE GLOBAL COM INICIO GRADUAL E CONSOLIDACAO TARDIA; exposicao acumulada desde o inicio da janela do prazo; p por permutacao da ordem dos meses (par e desfecho do mesmo mes permanecem juntos), alpha 5%');
console.log('G\tT\tlambda\tFP perm\tFP normal\tpoder perm RR1.5\tpoder perm RR2.0');
const cfgs=process.argv[3]==='fp'?[[10,6,4],[10,12,4],[20,9,8],[40,12,8],[10,9,16]]:null;
const grid=cfgs||[4,8,16].flatMap(l=>[10,20,40].flatMap(G=>[6,9,12].map(T=>[G,T,l])));
for(const [G,T,lambda] of grid){
  const n0=run({G,T,lambda,RR:1,sims}),n1=run({G,T,lambda,RR:1.5,sims}),n2=run({G,T,lambda,RR:2,sims});
  console.log([G,T,lambda,n0.perm.toFixed(3),n0.normal.toFixed(3),n1.perm.toFixed(2),n2.perm.toFixed(2)].join('\t'));
}
