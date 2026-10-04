# ===========================================================================
# Walk-forward precision test.
#
# Every series is walked from its first bar. At each step the engine states
# P(next move up) and P(next move larger than usual); the outcome is then
# revealed and only then learned from. Probabilities are recalibrated on the
# series' own EARLIER calls (isotonic, refitted every 250 steps). Nothing in a
# call comes from its own future.
#
# A "call" is the side the probability favours. Its strength is how far the
# probability sits from 50%. "Strongest 10%" means: stronger than 90% of that
# series' EARLIER calls — the cut-off is set from the past, never in hindsight.
#
# Reported, on the scored period only:
#   precision  share of calls that were right
#   coverage   share of steps on which a call of that strength was made
#   usual      precision of always calling the side that has been more common
#              so far (the base-rate rule) on the same steps
#   shuffled   the same engine on the same series with the order shuffled
#   95% range  block bootstrap
#
# Scored periods: markets 2016-2026 (tables trained before 2016); weather
# 1991-2015 (tables from 1948-1990); racing: jockeys not used in training.
#
# engine: 'base'   the 6.2 engine (states + symmetry field + pre-trained tables)
#         'lenses' adds two more ways of reading the same six steps, competing
#                  by likelihood (see walk()).
# ===========================================================================
import numpy as np, pandas as pd, json, os, sys
from sklearn.isotonic import IsotonicRegression
from hexg import load_all
from pretrain import load_families, train_tables, field_matrix, FAMILIES, HERE, DATA, LAM, K, ALPHAS, G
WD=field_matrix(6,True,True); WM=field_matrix(6,False,False); AWD=np.abs(WD); AWM=np.abs(WM)
NA=len(ALPHAS)

def keys(r):
    r=np.asarray(r,float); n=len(r); a=np.abs(r)
    med=pd.Series(a).expanding(20).median().values
    up=(r>0).astype(int)
    big=np.zeros(n,int); big[1:]=(a[1:]>med[:-1])&~np.isnan(med[:-1])
    wid=np.zeros(n,int); wid[1:]=a[1:]>a[:-1]
    kd=np.full(n,-1); km=np.full(n,-1); kw=np.full(n,-1)
    for i in range(12,n):
        mom=0
        for j in range(i-5,i+1): mom=(mom<<1)|up[j]
        kd[i]=(mom<<1)|(1 if up[i-11:i+1].mean()>0.6 else 0)
        if i>25:
            s=w=0
            for j in range(i-5,i+1): s=(s<<1)|big[j]; w=(w<<1)|wid[j]
            km[i]=s; kw[i]=w
    return r,a,med,kd,km,kw

class Lens:
    """Decayed evidence for one target, read through one state key."""
    def __init__(s,n): s.D=np.zeros(n); s.N=np.zeros(n)
    def p(s,k,b): return float(np.clip(b+s.D[k]/(s.N[k]+K),.01,.99))
    def learn(s,k,y,b): s.D*=LAM; s.N*=LAM; s.D[k]+=y-b; s.N[k]+=1

def walk(r, tables, lenses=False):
    """Returns rows (p_dir, b_dir, y_dir, p_size, b_size, y_size)."""
    r,a,med,kd,km,kw=keys(r); n=len(r)
    dD=[np.zeros(128)]+[t['dir'] for t in tables]; dM=[np.zeros(64)]+[t['size'] for t in tables]
    nf=len(dD); nnat=NA*nf
    w_nat=np.concatenate([np.full(NA,0.5/NA)]+[np.full(NA,0.5/max(1,nf-1)/NA) for _ in range(nf-1)]) if nf>1 else np.full(NA,1/NA)
    if lenses:
        # two extra lenses per target start with the weight of one family each
        wx=0.5/max(1,nf-1)
        w0=np.concatenate([w_nat,[wx,wx]]); w0/=w0.sum()
    else: w0=w_nat
    lw0=np.log(w0); nc=len(w0)
    Dd=np.zeros(128);Nd=np.zeros(128);Dm=np.zeros(64);Nm=np.zeros(64);bu=bn=mu=mn=0.
    # cross lenses: direction read through size / widening states; size read through direction / widening states
    Ld=[Lens(64),Lens(64)]; Lm=[Lens(128),Lens(64)]
    lld=np.zeros(nc); llm=np.zeros(nc); out=[]
    for i in range(12,n-1):
        s=kd[i]; b=(bu+1)/(bn+2); pd_=WD[s]@Dd; pn=AWD[s]@Nd
        P=[b+(Dd[s]+al*pd_+K*d[s])/(Nd[s]+al*pn+K) for d in dD for al in ALPHAS]
        ready=km[i]>=0 and not np.isnan(med[i])
        if lenses: P+= [Ld[0].p(km[i],b), Ld[1].p(kw[i],b)] if ready else [b,b]
        P=np.clip(P,.01,.99); z=lld+lw0; w=np.exp(z-z.max()); w/=w.sum(); p=float(w@P); y=int(r[i+1]>0)
        pm=bm=ym=np.nan
        if ready:
            sm=km[i]; bm=(mu+1)/(mn+2); qd=WM[sm]@Dm; qn=AWM[sm]@Nm
            Q=[bm+(Dm[sm]+al*qd+K*d[sm])/(Nm[sm]+al*qn+K) for d in dM for al in ALPHAS]
            if lenses: Q+=[Lm[0].p(s,bm), Lm[1].p(kw[i],bm)]
            Q=np.clip(Q,.01,.99); zm=llm+lw0; wm=np.exp(zm-zm.max()); wm/=wm.sum(); pm=float(wm@Q); ym=int(a[i+1]>med[i])
            llm=G*llm+np.log(np.where(ym,Q,1-Q)); Dm*=LAM;Nm*=LAM;Dm[sm]+=ym-bm;Nm[sm]+=1
            if lenses: Lm[0].learn(s,ym,bm); Lm[1].learn(kw[i],ym,bm); Ld[0].learn(km[i],y,b); Ld[1].learn(kw[i],y,b)
            mu=mu*LAM+ym;mn=mn*LAM+1
        lld=G*lld+np.log(np.where(y,P,1-P)); Dd*=LAM;Nd*=LAM;Dd[s]+=y-b;Nd[s]+=1;bu=bu*LAM+y;bn=bn*LAM+1
        out.append((p,b,y,pm,bm,ym))
    return np.array(out,float)

REFIT=250; MINCAL=200
def calibrate_forward(p,y):
    """Isotonic recalibration using only earlier calls of the same series."""
    out=p.copy(); iso=None
    for i in range(len(p)):
        if i>=MINCAL and (i-MINCAL)%REFIT==0:
            iso=IsotonicRegression(out_of_bounds='clip',y_min=.01,y_max=.99).fit(p[:i],y[:i])
        if iso is not None: out[i]=iso.predict([p[i]])[0]
    return out

def forward_rank(score, warm=100):
    """For each step, the share of EARLIER scores this one exceeds (nan during warm-up)."""
    import bisect
    hist=[]; rk=np.full(len(score),np.nan)
    for i,s in enumerate(score):
        if len(hist)>=warm: rk[i]=bisect.bisect_left(hist,s)/len(hist)
        bisect.insort(hist,s)
    return rk

def series_calls(rows, cols, scored_from):
    x=rows[:,cols]; ok=~np.isnan(x).any(1); idx=np.where(ok)[0]; p,b,y=x[ok].T
    pc=calibrate_forward(p,y)
    call=(pc>=0.5).astype(int); right=(call==y).astype(float)
    usual=((b>=0.5).astype(int)==y).astype(float)
    rk=forward_rank(np.abs(pc-0.5))
    keep=idx>=scored_from
    return pd.DataFrame({'p':pc,'b':b,'y':y,'right':right,'usual':usual,'rank':rk})[keep]

LEVELS=(('all calls',0.0),('strongest 50%',0.5),('strongest 25%',0.75),('strongest 10%',0.9))
def boot(v, rng, B=600):
    if len(v)<30: return [None,None]
    nb=max(1,len(v)//50); bl=np.array_split(v,nb)
    m=[np.concatenate([bl[j] for j in rng.integers(0,nb,nb)]).mean() for _ in range(B)]
    return [round(float(np.percentile(m,2.5)),4),round(float(np.percentile(m,97.5)),4)]
def summarise(frames, rng):
    D=pd.concat(frames); n=len(D); res={}
    brier=float(((D.p-D.y)**2).mean()); bb=float(((D.b-D.y)**2).mean())
    res['steps scored']=n; res['brier skill']=round(1-brier/bb,4)
    for name,q in LEVELS:
        S=D if q==0 else D[D['rank']>=q]
        if len(S)<30: res[name]=None; continue
        res[name]={'precision':round(float(S.right.mean()),4),'95% range':boot(S.right.values,rng),'coverage':round(len(S)/n,3),
                   'calls':int(len(S)),'usual':round(float(S.usual.mean()),4),'stated':round(float(np.maximum(S.p,1-S.p).mean()),4)}
    return res

def datasets():
    F=load_families(); tabs=[train_tables(F[f]['train']) for f in FAMILIES]
    out={}
    mk=load_all(); L=[]
    for k,s in mk.items():
        idx=pd.to_datetime(s.index); r=np.diff(np.log(s.values.astype(float))); d=idx[1:]
        L.append((k,r,int((d<pd.Timestamp('2016-01-01')).sum())))
    out['markets']=L
    w=pd.read_csv(os.path.join(DATA,'chicago.csv')); w['Date']=pd.to_datetime(w['Date']); w=w.sort_values('Date')
    w['x']=pd.to_numeric(w['Max.TemperatureF'],errors='coerce'); w=w[w.x.between(-40,115)]
    r=np.diff(w.x.values); d=w.Date.values[1:]; keep=d<np.datetime64('2016-01-01')
    out['weather']=[('Chicago daily high',r[keep],int((d<np.datetime64('1991-01-01')).sum()))]
    out['racing']=[(k,r,0) for k,r in F['racing']['test']]
    return out,tabs

def run(engine, rng, shuffled=False):
    DS,tabs=datasets(); res={}; per={}
    for dom,L in DS.items():
        fr={'direction':[], 'size':[]}
        for name,r,start in L:
            if shuffled:
                r=np.concatenate([r[:start],rng.permutation(r[start:])]) if start else rng.permutation(r)
            rows=walk(r,tabs,lenses=(engine=='lenses'))
            off=max(0,start-13)   # rows[j] is the call made at step 12+j about step 13+j
            for ev,cols in (('direction',[0,1,2]),('size',[3,4,5])):
                f=series_calls(rows,cols,off)
                if len(f): fr[ev].append(f); per[f'{dom} | {name} | {ev}']={'steps':len(f),'precision all':round(float(f.right.mean()),4),'precision strongest 10%':(round(float(f[f['rank']>=0.9].right.mean()),4) if (f['rank']>=0.9).sum()>=20 else None),'calls strongest 10%':int((f['rank']>=0.9).sum())}
        res[dom]={ev:summarise(fr[ev],rng) for ev in fr}
    return res,per

if __name__=='__main__':
    engine=sys.argv[1] if len(sys.argv)>1 else 'base'
    rng=np.random.default_rng(3)
    real,per=run(engine,rng); shuf,_=run(engine,rng,shuffled=True)
    out={'engine':engine,'real':real,'shuffled':shuf,'per series':per}
    json.dump(out,open(os.path.join(HERE,f'precision_{engine}.json'),'w'),indent=1)
    for lab,R in (('REAL',real),('SHUFFLED',shuf)):
        print('\n==',lab,engine)
        for dom,v in R.items():
            for ev,e in v.items():
                print(f"{dom:8s} {ev:9s} n={e['steps scored']:6d} skill={e['brier skill']:+.4f} | "+' | '.join(f"{k}: {x['precision']:.3f} (cov {x['coverage']:.2f}, usual {x['usual']:.3f})" for k,x in e.items() if isinstance(x,dict)))
