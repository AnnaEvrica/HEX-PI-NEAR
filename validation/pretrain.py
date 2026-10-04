# ===========================================================================
# Pre-trained, domain-agnostic prior — build and test.
#
# The engine learns each series from scratch, so on a new or short series its
# states carry no evidence and every read sits at the base rate. This adds
# pre-trained state tables: for each of the engine's states, how far the
# outcome has run from a series' own base rate, learned on three families of
# real data (markets, weather, horse racing).
#
# The prior is domain-agnostic in use: a new series is not told which family
# it belongs to. Every family's table (and "no table") competes, together with
# the symmetry-field strengths, and each is weighted by how well it has
# explained that series' own outcomes so far (decayed likelihood). A family
# that does not fit is switched off by the data.
#
#   p(alpha, f) = b + (D_s + alpha*pull_D + K*delta_f[s]) / (N_s + alpha*pull_N + K)
#
# Test (cold start: every test series begins with NO history of its own):
#   markets  tables from 2000-2015, tested on 2016-2026
#   weather  tables from Chicago 1948-1990, tested on 1991-2015
#   racing   tables from half the jockeys, tested on the other half
# Controls: the same test series shuffled; and each family tested with its own
# table withheld (transfer from the other two families only).
# ===========================================================================
import numpy as np, pandas as pd, math, json, os, sys
from hexg import load_all
HERE=os.path.dirname(os.path.abspath(__file__)); DATA=os.path.join(HERE,'data')
LAM=0.999; K=100; ALPHAS=(0.0,0.25,1.0,4.0); G=0.999; K0=50
FAMILIES=('markets','weather','racing')

def field_matrix(bits, mirror, consensus):
    S=1<<bits; n=S*(2 if consensus else 1); W=np.zeros((n,n))
    for s in range(n):
        ms,cs=(s>>1,s&1) if consensus else (s,0)
        for t in range(n):
            mt,ct=(t>>1,t&1) if consensus else (t,0)
            if s==t or cs!=ct: continue
            d=bin(ms^mt).count('1')
            if mirror and mt==(S-1)^ms: W[s,t]-=1.0
            elif d<=2: W[s,t]+=1.0/d**2
    return W
WD=field_matrix(6,True,True); WM=field_matrix(6,False,False); AWD=np.abs(WD); AWM=np.abs(WM)

def states(r):
    """Direction key (128), size key (64), outcomes, for a change series r."""
    r=np.asarray(r,float); n=len(r); a=np.abs(r)
    med=pd.Series(a).expanding(20).median().values          # med[j] uses a[0..j]
    up=(r>0).astype(int)
    sizebit=np.zeros(n,int); sizebit[1:]=(a[1:]>med[:-1])&~np.isnan(med[:-1])
    kd=np.full(n,-1); km=np.full(n,-1)
    for i in range(12,n):
        mom=0
        for j in range(i-5,i+1): mom=(mom<<1)|up[j]
        kd[i]=(mom<<1)|(1 if up[i-11:i+1].mean()>0.6 else 0)
        if i>25:
            s=0
            for j in range(i-5,i+1): s=(s<<1)|sizebit[j]
            km[i]=s
    return r,a,med,kd,km

CHUNK=500   # training series are cut into young series of this length (see header)

def train_tables(series_list, chunk=CHUNK):
    """Sum of (outcome - running base rate) per state, over training series.
    Each training series is cut into consecutive chunks that are each walked
    from a cold start, so the tables describe what a YOUNG series does — which
    is when a prior matters. (A long series' own evidence outgrows the prior.)"""
    Dd=np.zeros(128);Nd=np.zeros(128);Dm=np.zeros(64);Nm=np.zeros(64)
    pieces=[]
    for r in series_list:
        r=np.asarray(r,float)
        pieces+= [r] if not chunk else [r[i:i+chunk] for i in range(0,len(r),chunk) if len(r[i:i+chunk])>=80]
    for r in pieces:
        r,a,med,kd,km=states(r); n=len(r); bu=bn=mu=mn=0.
        for i in range(12,n-1):
            y=int(r[i+1]>0); b=(bu+1)/(bn+2); Dd[kd[i]]+=y-b; Nd[kd[i]]+=1; bu=bu*LAM+y; bn=bn*LAM+1
            if km[i]>=0 and not np.isnan(med[i]):
                ym=int(a[i+1]>med[i]); bm=(mu+1)/(mn+2); Dm[km[i]]+=ym-bm; Nm[km[i]]+=1; mu=mu*LAM+ym; mn=mn*LAM+1
    return {'dir':Dd/(Nd+K0),'size':Dm/(Nm+K0),'n_dir':int(Nd.sum()),'n_size':int(Nm.sum())}

def walk(r, tables):
    """Cold-start walk-forward. tables: list of (delta_dir, delta_size) or None for 'no table'.
    Returns per-step rows: p_dir, b_dir, y_dir, p_size, b_size, y_size, and final family weights."""
    r,a,med,kd,km=states(r); n=len(r)
    dD=[np.zeros(128)]+[t['dir'] for t in tables]; dM=[np.zeros(64)]+[t['size'] for t in tables]
    nc=len(ALPHAS)*len(dD)
    Dd=np.zeros(128);Nd=np.zeros(128);Dm=np.zeros(64);Nm=np.zeros(64);bu=bn=mu=mn=0.
    # Starting weights: "no table" holds half, the families share the rest.
    w0=np.concatenate([np.full(len(ALPHAS),0.5/len(ALPHAS))]+[np.full(len(ALPHAS),0.5/max(1,len(tables))/len(ALPHAS)) for _ in tables]) if tables else np.full(len(ALPHAS),1/len(ALPHAS))
    lw0=np.log(w0)
    lld=np.zeros(nc); llm=np.zeros(nc); out=[]
    for i in range(12,n-1):
        s=kd[i]; b=(bu+1)/(bn+2); pd_=WD[s]@Dd; pn=AWD[s]@Nd
        P=np.clip([b+(Dd[s]+al*pd_+K*d[s])/(Nd[s]+al*pn+K) for d in dD for al in ALPHAS],.01,.99)
        z=lld+lw0; w=np.exp(z-z.max()); w/=w.sum(); p=float(w@P); y=int(r[i+1]>0)
        pm=bm=ym=np.nan
        if km[i]>=0 and not np.isnan(med[i]):
            sm=km[i]; bm=(mu+1)/(mn+2); qd=WM[sm]@Dm; qn=AWM[sm]@Nm
            Q=np.clip([bm+(Dm[sm]+al*qd+K*d[sm])/(Nm[sm]+al*qn+K) for d in dM for al in ALPHAS],.01,.99)
            zm=llm+lw0; wm=np.exp(zm-zm.max()); wm/=wm.sum(); pm=float(wm@Q); ym=int(a[i+1]>med[i])
            llm=G*llm+np.log(np.where(ym,Q,1-Q)); Dm*=LAM;Nm*=LAM;Dm[sm]+=ym-bm;Nm[sm]+=1;mu=mu*LAM+ym;mn=mn*LAM+1
        lld=G*lld+np.log(np.where(y,P,1-P)); Dd*=LAM;Nd*=LAM;Dd[s]+=y-b;Nd[s]+=1;bu=bu*LAM+y;bn=bn*LAM+1
        out.append((p,b,y,pm,bm,ym))
    z=lld+lw0; wd=np.exp(z-z.max()); wd/=wd.sum(); zm=llm+lw0; wm=np.exp(zm-zm.max()); wm/=wm.sum()
    fam=lambda w: [round(float(w[k*len(ALPHAS):(k+1)*len(ALPHAS)].sum()),3) for k in range(len(dD))]
    return np.array(out,float), fam(wd), fam(wm)

def skill(rows, cols, first=None):
    x=rows[:, cols]; x=x[~np.isnan(x).any(1)]
    if first: x=x[:first]
    if len(x)<20: return None
    p,b,y=x.T; return round(float(1-((p-y)**2).sum()/((b-y)**2).sum()),4)

def load_families():
    F={}
    mk=load_all()
    F['markets']={'train':[],'test':[]}
    for k,s in mk.items():
        idx=pd.to_datetime(s.index); x=s.values.astype(float); r=np.diff(np.log(x)); d=idx[1:]
        F['markets']['train'].append(r[d<pd.Timestamp('2016-01-01')]); F['markets']['test'].append((k,r[d>=pd.Timestamp('2016-01-01')]))
    w=pd.read_csv(os.path.join(DATA,'chicago.csv')); w['Date']=pd.to_datetime(w['Date']); w=w.sort_values('Date')
    w['x']=pd.to_numeric(w['Max.TemperatureF'],errors='coerce'); w=w[w.x.between(-40,115)]
    r=np.diff(w.x.values); d=w.Date.values[1:]
    F['weather']={'train':[r[d<np.datetime64('1991-01-01')]],'test':[('Chicago daily high',r[(d>=np.datetime64('1991-01-01'))&(d<np.datetime64('2016-01-01'))])]}
    hr=pd.read_csv(os.path.join(DATA,'horse_results.csv')); hc=pd.read_csv(os.path.join(DATA,'horse_races.csv'))
    hc['d']=pd.to_datetime(hc['race_date'],format='%d/%m/%y',errors='coerce')
    hr=hr.merge(hc[['race_id','d']],on='race_id').dropna(subset=['d'])
    hr['fp']=pd.to_numeric(hr.finishing_position,errors='coerce'); hr=hr.dropna(subset=['fp'])
    fs=hr.groupby('race_id').horse_id.transform('count'); hr['m']=2*(fs-hr.fp)/(fs-1).clip(lower=1)-1
    jocks=[j for j,c in hr.jockey.value_counts().items() if c>=400]
    S=[(j,np.diff(hr[hr.jockey==j].sort_values('d').m.values)) for j in jocks]
    F['racing']={'train':[r for _,r in S[1::2]],'test':[(f'jockey {j}',r) for j,r in S[0::2]]}
    return F

def evaluate(F, tables, label, rng):
    res={}
    for fam in FAMILIES:
        full=[tables[f] for f in FAMILIES]
        other=[tables[f] for f in FAMILIES if f!=fam]
        rows={'scratch':[], 'pretrained':[], 'transfer':[]}; fw=[]
        for name,r in F[fam]['test']:
            if len(r)<80: continue
            if label=='shuffled': r=rng.permutation(r)
            a,_,_=walk(r,[]); b,wd,wm=walk(r,full); c,_,_=walk(r,other)
            rows['scratch'].append(a); rows['pretrained'].append(b); rows['transfer'].append(c); fw.append((wd,wm))
        out={'series':len(rows['scratch']),'steps':int(sum(len(x) for x in rows['scratch']))}
        for ev,cols in (('direction',[0,1,2]),('size',[3,4,5])):
            for first,tag in ((250,'first 250 steps'),(None,'all steps')):
                cat=lambda key: np.vstack([x[:first] if first else x for x in rows[key]])
                e={k:skill(cat(k),cols) for k in rows}
                # paired bootstrap of Brier difference (pretrained - scratch), by series block of 50 steps
                A=cat('scratch')[:,cols]; B=cat('pretrained')[:,cols]; ok=~np.isnan(A).any(1)&~np.isnan(B).any(1)
                d=((B[ok,0]-B[ok,2])**2-(A[ok,0]-A[ok,2])**2); nb=max(1,len(d)//50); blocks=np.array_split(d,nb)
                bs=[np.concatenate([blocks[j] for j in rng.integers(0,nb,nb)]).mean() for _ in range(600)]
                e['brier_diff_pretrained_minus_scratch']=[round(float(d.mean()),5),[round(float(np.percentile(bs,2.5)),5),round(float(np.percentile(bs,97.5)),5)]]
                out[f'{ev}, {tag}']=e
        fwd=np.mean([x[0] for x in fw],0); fwm=np.mean([x[1] for x in fw],0)
        out['final family weights (none, markets, weather, racing)']={'direction':[round(float(v),3) for v in fwd],'size':[round(float(v),3) for v in fwm]}
        res[fam]=out
    return res

if __name__=='__main__':
    rng=np.random.default_rng(5)
    F=load_families()
    tables={f:train_tables(F[f]['train']) for f in FAMILIES}
    print({f:(tables[f]['n_dir'],tables[f]['n_size']) for f in FAMILIES})
    out={'training steps (direction, size)':{f:[tables[f]['n_dir'],tables[f]['n_size']] for f in FAMILIES}}
    for label in ('real','shuffled'):
        out[label]=evaluate(F,tables,label,rng)
        print('\n==',label)
        for fam,v in out[label].items():
            print(fam, v['series'],'series',v['steps'],'steps')
            for k,e in v.items():
                if isinstance(e,dict): print('   ',k,e)
    json.dump(out,open(os.path.join(HERE,'pretrain_results.json'),'w'),indent=1)
