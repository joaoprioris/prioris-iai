import sys,glob,json,re,unicodedata
from collections import Counter
sys.path.insert(0,'.')
base='/root/.claude/projects/-home-user-prioris-iai/d3802d98-2c56-5fb4-b331-9f46400cb37e/tool-results/'
def nz(s):
    s=s.replace('\\','');s=unicodedata.normalize('NFKC',s)
    return re.sub(r'[^0-9a-záàâãéêíóôõúüç%$]+',' ',s.lower()).strip()
def sect(path,ref):
    L=open(path,encoding='utf8').read().split('\n')
    idx=[i for i,l in enumerate(L) if l.startswith('## F')]
    for k,i in enumerate(idx):
        if L[i].startswith('## '+ref+' '):
            return i+2,(idx[k+1] if k+1<len(idx) else len(L)),L
def orig_struct(path,ref):
    s,e,L=sect(path,ref)
    paras=[];tables=[];cur=None
    for l in L[s-1:e]:
        l=l.strip()
        if re.match(r'^#+ Tabela',l) or re.match(r'^#+ T\d+',l):
            cur=[];tables.append(cur);continue
        m=re.match(r'^\*\*(T\d+) R(\d+)\*\*\s*(.*)',l)
        if m:
            cells=re.split(r'\s*\|\s*C\d+:\s*',re.sub(r'^C1:\s*','',m.group(3)))
            if cur is None: cur=[];tables.append(cur)
            cur.append(cells);continue
        m=re.match(r'^\*\*P\d+\*\*\s*(.*)',l)
        if m: paras.append(m.group(1))
    return paras,tables
def new_struct(path):
    d=json.load(open(path));c=d['content']['tabs'][0]['documentTab']['body']['content']
    paras=[];tables=[]
    def para(p): return ''.join(e.get('textRun',{}).get('content','') for e in p.get('elements',[])).strip()
    for it in c:
        if 'paragraph' in it:
            t=para(it['paragraph'])
            if t: paras.append(t)
        elif 'table' in it:
            rows=[]
            for r in it['table']['tableRows']:
                rows.append([' '.join(para(x['paragraph']) for x in cell['content'] if 'paragraph' in x).strip() for cell in r['tableCells']])
            tables.append(rows)
    return paras,tables
src={'ARQUITETURA':('fund.md','F01'),'DOSSIE_METODOLOGICO':('fund.md','F03'),'MANUAL_OFICIAL_AUDITORIA':('fund.md','F07'),'ROTEIRO':('fund.md','F12'),'CULTURAL_RISK_ENGINE':('ag.md','F17'),'HEALTH_MONITOR':('ag.md','F18'),'MODELO_IEC':('ag.md','F19')}
for f in sorted(glob.glob(base+'mcp-Google_Docs-read_doc-*.txt')):
    t=json.load(open(f))['content']['title']
    k=[x for x in src if t.startswith(x)]
    if not k: continue
    p,ref=src[k[0]]
    op,ot=orig_struct(p,ref); np_,nt=new_struct(f)
    print('=====',t)
    print('tabelas orig',len(ot),'novo',len(nt))
    print(' linhas orig',[len(x) for x in ot]); print(' linhas novo',[len(x) for x in nt])
    oc=[[len(r) for r in x] for x in ot]; nc=[[len(r) for r in x] for x in nt]
    print(' tabelas com forma diferente:',[i for i,(a,b) in enumerate(zip(oc,nc)) if a!=b])
    oset=[nz(x) for x in op]+[nz(c) for x in ot for r in x for c in r]
    nset=[nz(x) for x in np_]+[nz(c) for x in nt for r in x for c in r]
    co,cn=Counter(oset),Counter(nset)
    miss=[x for x in (co-cn).elements() if x]; extra=[x for x in (cn-co).elements() if x]
    print(' so no original:',len(miss),'| so no novo:',len(extra))
    for x in miss: print('  ORIG>',x[:170])
    for x in extra: print('  NOVO>',x[:170])
