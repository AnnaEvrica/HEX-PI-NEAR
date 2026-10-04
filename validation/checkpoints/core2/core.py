# ===========================================================================
# Core experiment (see prereg_core.md for the predictions written beforehand).
#
# Models, all strictly online, all sharing the same running base rate b_t and
# the same clip [0.01, 0.99]; NO isotonic calibration anywhere:
#   base     the running base rate
#   hex62    the 6.2 engine's raw mixture (states + field + pre-trained tables)
#   ctw      Context Tree Weighting, depth 6, KT estimators
#   M1..M6   nested Walsh models: logit p = logit b + sum_{1<=|S|<=m} theta_S prod_{i in S} h_i
#            fitted by recursive (online Newton) logistic regression under a
#            Gaussian prior N(0, tau^2); tau^2 on the dyadic grid 2^-4..2^4,
#            mixed by prequential likelihood
#   S0,S01,S012  order-1 models over the lines of scales 0; 0,1; 0,1,2
#   mix      prequential-likelihood mixture of ctw and M1..M6
# Scores: log loss and Brier, as skill against base; paired block bootstrap on
# identical steps; cumulative loss curves; precision with coverage.
# ===========================================================================
import numpy as np, pandas as pd, json, os, sys, itertools, math
from precision import keys, walk as hex_walk, datasets, forward_rank, HERE
from pretrain import load_families, train_tables, FAMILIES
TAUS=2.0**np.arange(-4,5); NT=len(TAUS)
clip=lambda p: np.clip(p,0.01,0.99)
logit=lambda p: math.log(p/(1-p))
SUBSETS=[s for m in range(1,7) for s in itertools.combinations(range(6),m)]
ORDER_END=[sum(1 for s in SUBSETS if len(s)<=m) for m in range(1,7)]   # 6,21,41,56,62,63

def walsh_features(lines):
    """lines: (n,6) array of +-1, newest last. Returns (n,63) products, ordered by |S|."""
    return np.stack([np.prod(lines[:,list(s)],axis=1) for s in SUBSETS],axis=1)

class OnlineLogit:
    """Recursive logistic regression, one copy per prior scale tau^2, mixed by prequential likelihood."""
    def __init__(s,d):
        s.d=d; s.th=np.zeros((NT,d)); s.P=np.stack([np.eye(d)*t for t in TAUS]); s.ll=np.zeros(NT)
    def predict(s,x,off):
        z=off+s.th@x; s.q=clip(1/(1+np.exp(-z)))
        w=np.exp(s.ll-s.ll.max()); w/=w.sum(); return float(w@s.q)
    def update(s,x,y):
        q=s.q; s.ll+=np.log(np.where(y,q,1-q))
        Px=s.P@x                                   # (NT,d)
        wgt=q*(1-q); denom=1+wgt*(Px@x)            # (NT,)
        s.P-=(wgt/denom)[:,None,None]*Px[:,:,None]*Px[:,None,:]
        s.th+=(s.P@x)*(y-q)[:,None]

class CTW:
    """Binary Context Tree Weighting, depth D, KT estimator. Context = most recent bit first."""
    def __init__(s,D=6): s.D=D; s.n={}      # node key (depth, ctx bits tuple) -> [a, b, logPe, logPw]
    def _path(s,ctx): return [(d,tuple(ctx[:d])) for d in range(s.D,-1,-1)]   # leaf first
    def _root_after(s,ctx,bit,commit):
        child_new=None; prev_key=None
        for d,k in s._path(ctx):
            a,b,lpe,lpw=s.n.get((d,k),[0,0,0.0,0.0])
            lpe2=lpe+math.log(((b if bit else a)+0.5)/(a+b+1)); a2,b2=(a,b+1) if bit else (a+1,b)
            if d==s.D: lpw2=lpe2
            else:
                other=s.n.get((d+1,k+(1-ctx[d],)),[0,0,0.0,0.0])[3]
                m=max(lpe2,child_new+other); lpw2=m+math.log(0.5*math.exp(lpe2-m)+0.5*math.exp(child_new+other-m))
            if commit: s.n[(d,k)]=[a2,b2,lpe2,lpw2]
            child_new=lpw2
        return child_new
    def predict(s,ctx):
        cur=s.n.get((0,()),[0,0,0.0,0.0])[3]
        return float(clip(math.exp(s._root_after(ctx,1,False)-cur)))
    def update(s,ctx,bit): s._root_after(ctx,bit,True)

def scale_lines(r,a,med_by_scale,i,k,kind):
    """Six lines at scale k ending at step i (newest last), +-1, or zeros if not available."""
    w=2**k
    if i-6*w+1<1: return np.zeros(6)
    out=[]
    for j in range(5,-1,-1):
        e=i-j*w; blk=r[e-w+1:e+1].sum()
        if kind=='dir': out.append(1.0 if blk>0 else -1.0)
        else:
            m=med_by_scale[k][e]
            out.append(0.0 if np.isnan(m) else (1.0 if abs(blk)>m else -1.0))
    return np.array(out)

def run_series(r,tabs):
    """Returns dict event -> DataFrame of per-step predictions for every model."""
    rows=hex_walk(r,tabs,lenses=False)
    r_,a,med,kd,km,kw=keys(r); n=len(r_)
    up=np.where(r_>0,1.0,-1.0)
    big=np.full(n,-1.0); big[1:]=np.where((a[1:]>med[:-1])&~np.isnan(med[:-1]),1.0,-1.0)
    # running medians of |block sum| at scales 1,2 (causal, expanding, 20 needed)
    med_by_scale={0:np.r_[np.nan,med[:-1]]}
    for k in (1,2):
        w=2**k; bs=np.abs(pd.Series(r_).rolling(w).sum().values)
        med_by_scale[k]=pd.Series(bs).expanding(20).median().shift(1).values
    out={}
    for ev,(pc,bc,yc,lines) in {'direction':(0,1,2,up),'size':(3,4,5,big)}.items():
        kind='dir' if ev=='direction' else 'size'
        M=[OnlineLogit(e) for e in ORDER_END]; S=[OnlineLogit(6),OnlineLogit(12),OnlineLogit(18)]; ctw=CTW(6)
        names=['base','hex62','ctw']+[f'M{m}' for m in range(1,7)]+['S0','S01','S012','mix']
        mix_names=['ctw']+[f'M{m}' for m in range(1,7)]; llmix=np.zeros(len(mix_names))
        rec=[]
        for j in range(len(rows)):
            i=12+j; p62,b,y=rows[j,pc],rows[j,bc],rows[j,yc]
            if np.isnan(p62) or np.isnan(y): continue
            y=int(y); off=logit(min(max(b,1e-6),1-1e-6))
            h=lines[i-5:i+1]                                   # newest last
            x=np.array([np.prod(h[list(s)]) for s in SUBSETS])
            ctx=[1 if v>0 else 0 for v in h[::-1]]             # most recent first
            pm=[M[m].predict(x[:ORDER_END[m]],off) for m in range(6)]
            xs=[scale_lines(r_,a,med_by_scale,i,k,kind) for k in (0,1,2)]
            xS=[xs[0],np.r_[xs[0],xs[1]],np.r_[xs[0],xs[1],xs[2]]]
            ps=[S[q].predict(xS[q],off) for q in range(3)]
            pcw=ctw.predict(ctx)
            cand=np.array([pcw]+pm); w=np.exp(llmix-llmix.max()); w/=w.sum(); pmix=float(w@cand)
            rec.append([i,y,float(clip(b)),float(clip(p62)),pcw]+pm+ps+[pmix])
            for m in range(6): M[m].update(x[:ORDER_END[m]],y)
            for q in range(3): S[q].update(xS[q],y)
            ctw.update(ctx,y); llmix+=np.log(np.where(y,cand,1-cand))
        out[ev]=pd.DataFrame(rec,columns=['i','y']+names)
    return out

MODELS=['hex62','ctw','M1','M2','M3','M4','M5','M6','S0','S01','S012','mix']
def losses(D):
    y=D.y.values; L={}; B={}
    for m in ['base']+MODELS:
        p=D[m].values; L[m]=-(y*np.log(p)+(1-y)*np.log(1-p)); B[m]=(p-y)**2
    return L,B
def boot_diff(d,rng,B=800):
    nb=max(1,len(d)//50); bl=np.array_split(d,nb)
    m=[np.concatenate([bl[j] for j in rng.integers(0,nb,nb)]).mean() for _ in range(B)]
    return [float(np.percentile(m,2.5)),float(np.percentile(m,97.5))]
def summarise(frames,rng):
    D=pd.concat(frames,ignore_index=True); L,B=losses(D); n=len(D); res={'steps':n,'models':{}}
    for m in MODELS:
        d=L[m]-L['base']; ci=boot_diff(d,rng)
        rk=np.concatenate([forward_rank(np.abs(f[m].values-0.5)) for f in frames]); top=rk>=0.75
        right=((D[m].values>=0.5).astype(int)==D.y.values); usual=((D['base'].values>=0.5).astype(int)==D.y.values)
        res['models'][m]={'logloss_skill':round(float(1-L[m].mean()/L['base'].mean()),5),'brier_skill':round(float(1-B[m].mean()/B['base'].mean()),5),
            'mean_logloss_diff_vs_base':round(float(d.mean()),6),'ci95':[round(ci[0],6),round(ci[1],6)],
            'precision_all':round(float(right.mean()),4),'usual_all':round(float(usual.mean()),4),
            'precision_strongest25':round(float(right[top].mean()),4) if top.sum()>30 else None,'coverage_strongest25':round(float(top.mean()),3),'usual_strongest25':round(float(usual[top].mean()),4) if top.sum()>30 else None}
    pair=lambda x,y_: {'diff':round(float((L[x]-L[y_]).mean()),6),'ci95':[round(v,6) for v in boot_diff(L[x]-L[y_],rng)]}
    res['paired (negative = first is better)']={'M1 vs ctw':pair('M1','ctw'),'M1 vs hex62':pair('M1','hex62'),'ctw vs hex62':pair('ctw','hex62'),'mix vs hex62':pair('mix','hex62'),'S01 vs S0':pair('S01','S0'),'S012 vs S01':pair('S012','S01')}
    res['incremental information by order (positive = the higher order helps)']={f'order {m}':pair(f'M{m-1}' if m>1 else 'base',f'M{m}') for m in range(1,7)}
    for k,v in res['incremental information by order (positive = the higher order helps)'].items(): v['diff']=-v['diff'] if False else v['diff']
    return res

def main():
    rng=np.random.default_rng(7); DS,tabs=datasets(); out={'real':{},'shuffled':{}}; curves={}
    for label in ('real','shuffled'):
        for dom,Ls in DS.items():
            fr={'direction':[], 'size':[]}
            for name,r,start in Ls:
                if label=='shuffled': r=np.concatenate([r[:start],rng.permutation(r[start:])]) if start else rng.permutation(r)
                res=run_series(r,tabs)
                for ev,f in res.items():
                    f=f[f.i>=max(13,start)]
                    if len(f): fr[ev].append(f)
            for ev in fr:
                out[label].setdefault(dom,{})[ev]=summarise(fr[ev],rng)
                if label=='real':
                    D=pd.concat(fr[ev],ignore_index=True); L,_=losses(D)
                    idx=np.linspace(0,len(D)-1,60).astype(int)
                    curves[f'{dom} {ev}']={'step':idx.tolist(),**{m:np.cumsum(L[m]-L['base'])[idx].round(2).tolist() for m in ('hex62','ctw','M1','M2','M6','mix')}}
            print(label,dom,'done',flush=True)
    # ---- learning curves from a cold start: mean log-loss difference vs base within the first T steps
    F=load_families(); tabs_all=[train_tables(F[f]['train']) for f in FAMILIES]; LC={}
    for fam in FAMILIES:
        acc={}
        for name,r in F[fam]['test']:
            if len(r)<600: continue
            a=run_series(r,tabs_all); s=run_series(r,[])
            for ev in a:
                A=a[ev]; Sx=s[ev]; LA,_=losses(A); LS,_=losses(Sx)
                for T in (25,50,100,250,500,len(A)):
                    key=(ev,'full' if T==len(A) else T)
                    acc.setdefault(key,{}).setdefault('pre-trained 6.2',[]).append((LA['hex62'][:T]-LA['base'][:T]).mean())
                    acc[key].setdefault('6.2 from nothing',[]).append((LS['hex62'][:T]-LS['base'][:T]).mean())
                    acc[key].setdefault('order-1 Walsh',[]).append((LA['M1'][:T]-LA['base'][:T]).mean())
                    acc[key].setdefault('context tree',[]).append((LA['ctw'][:T]-LA['base'][:T]).mean())
        LC[fam]={f'{ev} first {T}':{k:round(float(np.mean(v)),5) for k,v in d.items()} for (ev,T),d in acc.items()}
        print('learning curve',fam,'done',flush=True)
    out['learning curves (mean log-loss difference vs base; negative is better)']=LC; out['cumulative curves']=curves
    json.dump(out,open(os.path.join(HERE,'core_results.json'),'w'),indent=1)

if __name__=='__main__': main()
