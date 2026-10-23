import json,re,difflib,unicodedata,sys
def doc_text(path):
    d=json.load(open(path))
    c=d['content']['tabs'][0]['documentTab']['body']['content']
    out=[]
    def para(p):
        return ''.join(e.get('textRun',{}).get('content','') for e in p.get('elements',[]))
    def walk(items):
        for it in items:
            if 'paragraph' in it:
                t=para(it['paragraph']).strip()
                if t: out.append(t)
            elif 'table' in it:
                for row in it['table']['tableRows']:
                    for cell in row['tableCells']:
                        walk(cell['content'])
    walk(c)
    return out
def trans_text(path,start,end):
    L=open(path,encoding='utf8').read().split('\n')[start-1:end]
    out=[]
    for l in L:
        l=l.strip()
        if not l or l.startswith('#') or l.startswith('> **Erratum'): continue
        l=re.sub(r'^\*\*[A-Z]\d+( R\d+)?\*\*\s*','',l)
        l=re.sub(r'C\d+:\s*','',l)
        out.append(l)
    return out
def norm_tokens(lines):
    t=' '.join(lines)
    t=t.replace('\\','')
    t=unicodedata.normalize('NFKC',t)
    t=re.sub(r'[|•\*_`#>]',' ',t)
    t=re.sub(r'\s+',' ',t).lower()
    return re.findall(r"[0-9a-záàâãéêíóôõúüç™%$/\-\.,;:()\[\]“”\"'’×=+<>≥≤→—–^]+",t)
def clean(tok):
    return [re.sub(r'[\.,;:()\[\]“”"\'’—–]+','',x) for x in tok if re.sub(r'[\.,;:()\[\]“”"\'’—–]+','',x)]
def diff(a_lines,b_lines,ctx=6):
    a=clean(norm_tokens(a_lines)); b=clean(norm_tokens(b_lines))
    sm=difflib.SequenceMatcher(None,a,b,autojunk=False)
    res=[]
    for tag,i1,i2,j1,j2 in sm.get_opcodes():
        if tag=='equal': continue
        res.append((tag,' '.join(a[max(0,i1-ctx):i1])+' [[ '+' '.join(a[i1:i2])+' ]]',' '.join(b[j1:j2])))
    return len(a),len(b),res
