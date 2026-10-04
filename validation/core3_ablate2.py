# Follow-up to core3_ablate part A (prediction 9 in prereg_core3.md): is the
# 64-state cell's contribution to the rank core state structure, or drift tracking?
import numpy as np, pandas as pd, json, os
from precision import datasets, HERE
from core3 import series_run, skill, pair, clip, NW, NB, lg, rank_feats
from core3_ablate import hex_size
from core2 import OL, HALF
def run_series(r,tabs):
    Pf,Bf,_=hex_size(r,[]); Pn,Bn,_=hex_size(r,[],lam=1.0,G=1.0)     # cell with field: decayed, and not decayed
    res=lambda P,B: np.array([lg(p)-lg(b) if not np.isnan(p) else 0.0 for p,b in zip(P,B)])
    Rf,Rn=res(Pf,Bf),res(Pn,Bn); bd=np.array([lg(b) if not np.isnan(b) else np.nan for b in Bf])
    a=pd.Series(np.abs(r)); long=[]
    for k in (6,7,8):
        m=a.rolling(2**k).mean(); c=m.notna().cumsum().replace(0,np.nan); long.append((2*(m.expanding().rank()-0.5)/c-1).values)
    Lg=np.nan_to_num(np.stack(long,1))
    def extra(read,F):
        W,B=F['Wa'],F['Ba']; core=lambda i: np.r_[W[i],B[i]]
        # drift = decayed base rate relative to the plain base rate; the plain base offset is added back inside series_run
        drift=lambda i,off: 0.0
        M={'core + long blocks':(NW+NB+3,lambda i: np.r_[core(i),Lg[i]],'M0'),
           'core + long blocks + cell with field':(NW+NB+4,lambda i: np.r_[core(i),Lg[i],Rf[i]],'M0'),
           'core + cell with field':(NW+NB+1,lambda i: np.r_[core(i),Rf[i]],'M0'),
           'core + cell with field, no decay':(NW+NB+1,lambda i: np.r_[core(i),Rn[i]],'M0')}
        return M
    D=series_run(r,tabs,reads=('RANGE',),hex62=False,extra=extra)['RANGE']
    # drift term and forgetting need the running base rate, so they are run here on the same steps
    F=__import__('core3').prepare(r); W,B=F['Wa'],F['Ba']
    mods={'core + drift':OL(NW+NB+1),'core + drift + cell with field':OL(NW+NB+2)}
    mem={h:OL(NW+NB,half=h) for h in HALF}; llm=np.zeros(len(HALF)); out={k:[] for k in list(mods)+['core, dyadic memory']}
    for i,y,base in zip(D.i.values,D.y.values,D.base.values):
        off=lg(base); dr=(bd[i]-off) if not np.isnan(bd[i]) else 0.0; x0=np.r_[W[i],B[i]]
        xs={'core + drift':np.r_[x0,dr],'core + drift + cell with field':np.r_[x0,dr,Rf[i]]}
        for k,o in mods.items(): out[k].append(o.predict(xs[k],off))
        v=np.array([mem[h].predict(x0,off) for h in HALF]); w=np.exp(llm-llm.max()); w/=w.sum(); out['core, dyadic memory'].append(float(w@v)); llm+=np.log(np.where(y,v,1-v))
        for k,o in mods.items(): o.update(xs[k],y)
        for h in HALF: mem[h].update(x0,y)
    for k,v in out.items(): D[k]=v
    D['6.2 full']=np.where(np.isnan(hex_size(r,tabs)[0][D.i.values]),D.base.values,clip(hex_size(r,tabs)[0][D.i.values]))
    return D
if __name__=='__main__':
    rng=np.random.default_rng(43); DS,tabs=datasets(); fr=[]
    for name,r,start in DS['markets']:
        D=run_series(r,tabs); fr.append(D[D.i>=max(26,start)]); print(' ',name,flush=True)
    D=pd.concat(fr,ignore_index=True); cols=[c for c in D.columns if c not in('i','y','base')]
    A={'steps':len(D),'skill % over base rate':{m:skill(D,m) for m in cols},
       'over the rank core (positive = helps)':{k:pair(D,'M1',k,rng) for k in cols if k.startswith('core')},
       'cell with field on top of drift':pair(D,'core + drift','core + drift + cell with field',rng),
       'cell with field on top of long blocks':pair(D,'core + long blocks','core + long blocks + cell with field',rng),
       'over 6.2 full (positive = better than 6.2)':{k:pair(D,'6.2 full',k,rng) for k in cols if k.startswith('core')}}
    print(json.dumps(A),flush=True); json.dump(A,open(os.path.join(HERE,'core3_ablate2.json'),'w'),indent=1)
