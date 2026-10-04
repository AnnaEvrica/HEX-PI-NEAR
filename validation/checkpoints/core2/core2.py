# ===========================================================================
# Second core experiment (predictions in prereg_core2.md).
#   A  leakage: perturb the future, check the past is untouched
#   B  level-rank baseline, and lines on top of it
#   C  scale spectrum: order-1 over scales 0..k, k = 0..4, incremental gain per scale
#   D  dyadic memory (half-lives 32..1024 and none), mixed prequentially
#   E  transfer as line-effect priors; cold-start learning curves
# All models share the running base rate b_t as offset and the clip [0.01,0.99].
# No isotonic step. Uncertainty: paired block bootstrap; by jockey in racing.
# ===========================================================================
import numpy as np, pandas as pd, json, os, sys, math
from precision import keys, walk as hex_walk, datasets, forward_rank, HERE
from pretrain import load_families, train_tables, FAMILIES
TAUS=2.0**np.arange(-4,5); NT=len(TAUS); NS=5
HALF=[32,64,128,256,512,1024,None]
clip=lambda p: np.clip(p,0.01,0.99)

def features(r):
    """Per-step features, each row i using only r[0..i]."""
    r=np.asarray(r,float); n=len(r); c=np.r_[0.0,np.cumsum(r)]          # c[i+1] = level after step i
    Xd=np.zeros((n,NS,6)); Xs=np.zeros((n,NS,6))
    for k in range(NS):
        w=2**k; bs=np.full(n,np.nan); bs[w-1:]=c[w:]-c[:-w]             # bs[e] = sum r[e-w+1..e]
        ab=np.abs(bs); med=pd.Series(ab).expanding(20).median().shift(1).values
        ld=np.where(np.isnan(bs),0.0,np.where(bs>0,1.0,-1.0))
        ls=np.where(np.isnan(med)|np.isnan(ab),0.0,np.where(ab>med,1.0,-1.0))
        for j in range(6):                                              # column 5 = newest block
            sh=(5-j)*w
            Xd[sh:,k,j]=ld[:n-sh] if sh else ld; Xs[sh:,k,j]=ls[:n-sh] if sh else ls
            if sh: Xd[:sh,k,j]=0; Xs[:sh,k,j]=0
        # a scale is usable only once all six blocks exist
        Xd[:6*w,k,:]=0; Xs[:6*w,k,:]=0
    lev=pd.Series(c[1:])
    ranks=np.stack([(lev.rolling(W).rank(pct=True).values if W else lev.expanding().rank(pct=True).values) for W in (8,32,128,None)],axis=1)
    R=np.where(np.isnan(ranks),0.0,2*ranks-1)                           # centred: +1 = highest level seen
    return Xd,Xs,R

class OL:
    """Recursive logistic regression; one copy per prior scale (and per prior mean), mixed by prequential likelihood.
    half: exponential forgetting half-life in steps (None = none). mu: prior mean (d,) or None."""
    def __init__(s,d,half=None,mu=None,var=None):
        s.d=d; base=np.ones(d) if var is None else np.asarray(var)
        s.L0=np.stack([np.diag(1.0/(base*t)) for t in TAUS]); s.L=s.L0.copy()
        s.th=np.tile(np.zeros(d) if mu is None else np.asarray(mu,float),(NT,1)); s.ll=np.zeros(NT)
        s.rho=None if half is None else 0.5**(1.0/half); s.P=np.linalg.inv(s.L)
    def predict(s,x,off):
        s.q=clip(1/(1+np.exp(-(off+s.th@x)))); w=np.exp(s.ll-s.ll.max()); w/=w.sum(); return float(w@s.q)
    def update(s,x,y):
        q=s.q; s.ll+=np.log(np.where(y,q,1-q)); wgt=q*(1-q)
        if s.rho is None:
            Px=s.P@x; den=1+wgt*(Px@x); s.P-=(wgt/den)[:,None,None]*Px[:,:,None]*Px[:,None,:]
        else:
            s.L=s.rho*s.L+(1-s.rho)*s.L0+wgt[:,None,None]*np.outer(x,x)[None]; s.P=np.linalg.inv(s.L)
        s.th+=(s.P@x)*(y-q)[:,None]

def series_run(r,tabs,what):
    rows=hex_walk(r,tabs,lenses=False); Xd,Xs,R=features(r); out={}
    for ev,(pc,bc,yc,X) in {'direction':(0,1,2,Xd),'size':(3,4,5,Xs)}.items():
        mods={}
        if 'scales' in what:
            for k in range(NS): mods[f'S{k}']=(OL(6*(k+1)),lambda i,k=k,X=X: X[i,:k+1].ravel())
        if 'level' in what and ev=='direction':
            mods['level']=(OL(4),lambda i: R[i]); mods['level+S2']=(OL(22),lambda i,X=X: np.r_[R[i],X[i,:3].ravel()])
        if 'memory' in what:
            for h in HALF: mods[f'mem{h}']=(OL(18,half=h),lambda i,X=X: X[i,:3].ravel())
        if 'prior' in what:
            pri=what['prior'][ev]
            for nm,(mu,var) in pri.items(): mods[f'prior:{nm}']=(OL(18,mu=mu,var=var),lambda i,X=X: X[i,:3].ravel())
            mods['prior:none']=(OL(18),lambda i,X=X: X[i,:3].ravel())
        names=list(mods); rec=[]; llm={'memory':np.zeros(len(HALF))}; lp=None
        pn=[m for m in names if m.startswith('prior:')]; llp=np.zeros(len(pn))
        for j in range(len(rows)):
            i=12+j; p62,b,y=rows[j,pc],rows[j,bc],rows[j,yc]
            if np.isnan(p62) or np.isnan(y): continue
            y=int(y); off=math.log(min(max(b,1e-6),1-1e-6)/(1-min(max(b,1e-6),1-1e-6)))
            xs={m:f(i) for m,(o,f) in mods.items()}; ps={m:o.predict(xs[m],off) for m,(o,f) in mods.items()}
            row={'i':i,'y':y,'base':float(clip(b)),'hex62':float(clip(p62)),**ps}
            if 'memory' in what:
                v=np.array([ps[f'mem{h}'] for h in HALF]); w=np.exp(llm['memory']-llm['memory'].max()); w/=w.sum(); row['memmix']=float(w@v)
                llm['memory']=llm['memory']+np.log(np.where(y,v,1-v))
            if pn:
                v=np.array([ps[m] for m in pn]); w=np.exp(llp-llp.max()); w/=w.sum(); row['priormix']=float(w@v); llp=llp+np.log(np.where(y,v,1-v))
            rec.append(row)
            for m,(o,f) in mods.items(): o.update(xs[m],y)
        out[ev]=pd.DataFrame(rec)
        if 'coef' in what: out[ev+'_coef']=mods['S2'][0].th[4].copy() if 'S2' in mods else None   # tau^2 = 1 copy
    return out

LL=lambda D,m: -(D.y.values*np.log(D[m].values)+(1-D.y.values)*np.log(1-D[m].values))
def boot(d,rng,groups=None,B=1000):
    if groups is not None:
        g=np.unique(groups); parts=[d[groups==u] for u in g]
        m=[np.concatenate([parts[j] for j in rng.integers(0,len(g),len(g))]).mean() for _ in range(B)]
    else:
        nb=max(1,len(d)//50); bl=np.array_split(d,nb); m=[np.concatenate([bl[j] for j in rng.integers(0,nb,nb)]).mean() for _ in range(B)]
    return [round(float(np.percentile(m,2.5))*1000,2),round(float(np.percentile(m,97.5))*1000,2)]
def skill(D,m): return round(float(1-LL(D,m).mean()/LL(D,'base').mean())*100,2)
def pair(D,a,b,rng,groups=None): d=LL(D,a)-LL(D,b); return [round(float(d.mean())*1000,2)]+boot(d,rng,groups)
def prec(frames,m,q):
    D=pd.concat(frames,ignore_index=True); rk=np.concatenate([forward_rank(np.abs(f[m].values-0.5)) for f in frames]); t=rk>=q if q>0 else np.ones(len(D),bool)
    right=((D[m].values>=0.5).astype(int)==D.y.values); usual=((D['base'].values>=0.5).astype(int)==D.y.values)
    return {'precision':round(float(right[t].mean())*100,1),'coverage':round(float(t.mean())*100,1),'usual':round(float(usual[t].mean())*100,1)}

def collect(DS,tabs,what,doms,shuffle=None,only=None):
    out={}
    for dom in doms:
        fr={'direction':[], 'size':[]}; gid={'direction':[], 'size':[]}
        for g,(name,r,start) in enumerate(DS[dom]):
            if shuffle is not None: r=np.concatenate([r[:start],shuffle.permutation(r[start:])]) if start else shuffle.permutation(r)
            res=series_run(r,tabs,what)
            for ev in ('direction','size'):
                f=res[ev]; f=f[f.i>=max(13,start)]
                if len(f): fr[ev].append(f); gid[ev].append(np.full(len(f),g))
        out[dom]=(fr,gid); print(' ',dom,'done',flush=True)
    return out

def main():
    rng=np.random.default_rng(21); DS,tabs=datasets(); OUT={}
    # ---------- A leakage
    name,r,_=DS['racing'][0]; T=len(r)//2; r2=r.copy(); r2[T+1:]=rng.permutation(r2[T+1:])*rng.choice([-1,1],len(r2)-T-1)
    fa=features(r); fb=features(r2); same=all(np.array_equal(x[:T+1],y[:T+1]) for x,y in zip(fa,fb))
    pa=series_run(r,tabs,{'scales':1})['direction']; pb=series_run(r2,tabs,{'scales':1})['direction']
    ka=pa[pa.i<=T]; kb=pb[pb.i<=T]
    # the call at step i is about step i+1; its outcome y is allowed to differ at i = T. Predictions must agree for i <= T.
    predsame=bool(np.allclose(ka[['S0','S2','S4','hex62']].values,kb[['S0','S2','S4','hex62']].values))
    OUT['A leakage']={'features up to T identical after randomising the future':bool(same),'predictions up to T identical':predsame,'T':int(T)}
    print('A',OUT['A leakage'],flush=True)
    # ---------- B + C : scales and level baseline, all domains
    res=collect(DS,tabs,{'scales':1,'level':1},('racing','weather','markets'))
    C={}
    for dom,(fr,gid) in res.items():
        for ev in ('direction','size'):
            if not fr[ev]: continue
            D=pd.concat(fr[ev],ignore_index=True); G=np.concatenate(gid[ev]) if dom=='racing' else None
            e={'steps':len(D),'skill %':{m:skill(D,m) for m in ['hex62']+[f'S{k}' for k in range(NS)]+(['level','level+S2'] if ev=='direction' else [])}}
            e['scale spectrum (gain from adding scale k; positive helps)']={f'scale {k} ({2**k} step)':pair(D,(f'S{k-1}' if k else 'base'),f'S{k}',rng,G) for k in range(NS)}
            e['paired (negative = first better)']={'S2 vs hex62':pair(D,'S2','hex62',rng,G),'S4 vs hex62':pair(D,'S4','hex62',rng,G)}
            if ev=='direction': e['paired (negative = first better)'].update({'S2 vs level':pair(D,'S2','level',rng,G),'level+S2 vs level':pair(D,'level+S2','level',rng,G),'level+S2 vs S2':pair(D,'level+S2','S2',rng,G)})
            best=max([f'S{k}' for k in range(NS)],key=lambda m: skill(D,m)); e['best scale model']=best
            e['precision']={m:{lab:prec(fr[ev],m,q) for lab,q in (('all',0),('strongest 25%',0.75),('strongest 10%',0.9))} for m in (['hex62',best]+(['level'] if ev=='direction' else []))}
            C[f'{dom} {ev}']=e; print(dom,ev,json.dumps({k:e[k] for k in ('skill %','scale spectrum (gain from adding scale k; positive helps)','paired (negative = first better)')}),flush=True)
    OUT['B-C scales and level']=C
    # shuffled control, racing only (fully shuffled series)
    sh=collect(DS,tabs,{'scales':1,'level':1},('racing',),shuffle=rng); fr,_=sh['racing']; D=pd.concat(fr['direction'],ignore_index=True)
    OUT['shuffled racing direction skill %']={m:skill(D,m) for m in ['hex62','S0','S2','S4','level','level+S2']}; print('shuffled',OUT['shuffled racing direction skill %'],flush=True)
    # ---------- D memory (three scales), all domains
    res=collect(DS,tabs,{'memory':1},('markets','weather','racing')); Dm={}
    for dom,(fr,gid) in res.items():
        for ev in ('direction','size'):
            if not fr[ev]: continue
            D=pd.concat(fr[ev],ignore_index=True); G=np.concatenate(gid[ev]) if dom=='racing' else None
            Dm[f'{dom} {ev}']={'skill %':{m:skill(D,m) for m in ['hex62']+[f'mem{h}' for h in HALF]+['memmix']},'memmix vs no forgetting':pair(D,'memmix','memNone',rng,G),'memmix vs hex62':pair(D,'memmix','hex62',rng,G)}
            print(dom,ev,json.dumps(Dm[f'{dom} {ev}']),flush=True)
    OUT['D dyadic memory']=Dm
    # ---------- E priors from training series, cold start
    F=load_families(); tabs_all=[train_tables(F[f]['train']) for f in FAMILIES]; pri={'direction':{},'size':{}}
    for fam in FAMILIES:
        co={'direction':[], 'size':[]}
        for rr in F[fam]['train']:
            for seg in [rr[i:i+2000] for i in range(0,len(rr),2000) if len(rr[i:i+2000])>=600][:12]:
                o=series_run(seg,[],{'scales':1,'coef':1})
                for ev in co:
                    if o.get(ev+'_coef') is not None: co[ev].append(o[ev+'_coef'])
        for ev in co:
            A=np.array(co[ev]); pri[ev][fam]=(A.mean(0), np.maximum(A.var(0),1e-4) if len(A)>1 else np.full(18,0.05))
        print('  priors',fam,len(co['direction']),flush=True)
    OUT['E prior means (three scales x six lines, newest last)']={ev:{f:[round(float(v),3) for v in pri[ev][f][0]] for f in pri[ev]} for ev in pri}
    LC={}
    for fam in FAMILIES:
        acc={}
        for name,r in F[fam]['test']:
            if len(r)<1100: continue
            a=series_run(r,tabs_all,{'prior':pri}); s=series_run(r,[],{'scales':1})
            for ev in ('direction','size'):
                A=a[ev]; S=s[ev]; n=min(len(A),len(S))
                for T in (25,50,100,250,500,1000):
                    d=acc.setdefault((ev,T),{})
                    for lab,(Dx,m) in {'6.2 with 64-state tables':(A,'hex62'),'6.2 from nothing':(S,'hex62'),'lines, no prior':(A,'prior:none'),'lines, coefficient priors (mixed)':(A,'priormix')}.items():
                        d.setdefault(lab,[]).append(float((LL(Dx,m)[:T]-LL(Dx,'base')[:T]).mean())*1000)
        LC[fam]={f'{ev} first {T}':{k:round(float(np.mean(v)),1) for k,v in d.items()} for (ev,T),d in acc.items()}
        print('learning',fam,json.dumps({k:v for k,v in LC[fam].items() if ('direction' in k)!=(fam=='markets')}),flush=True)
    OUT['E learning curves (mean log-loss difference vs base x1000; negative is better)']=LC
    json.dump(OUT,open(os.path.join(HERE,'core2_results.json'),'w'),indent=1)

if __name__=='__main__': main()
