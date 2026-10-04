# prereg_core3.md item 12: market RANGE structure against a drift-tracking null.
import numpy as np, pandas as pd, json, os
from precision import datasets, HERE, forward_rank
from core3 import prepare, NW, NB, lg, clip, skill, pair
from core3_ablate import hex_size
from core2 import OL
def run(r,tabs):
    F=prepare(r); W,B=F['Wa'],F['Ba']; n=len(r); _,Bd,_=hex_size(r,[],alphas=(0.0,)); P62=hex_size(r,tabs)[0]
    null=OL(1); core=OL(NW+NB+1); u=c=0.0; rec=[]
    for i in range(26,n-1):
        if np.isnan(F['med_a'][i]): continue
        y=int(F['a'][i+1]>F['med_a'][i]); base=float(clip((u+1)/(c+2))); off=lg(base)
        dr=(lg(Bd[i])-off) if not np.isnan(Bd[i]) else 0.0
        q=null.predict(np.r_[dr],off); p=core.predict(np.r_[W[i],B[i],dr],off)
        rec.append({'i':i,'y':y,'base':base,'drift null':q,'core + drift':p,'hex62':float(clip(P62[i])) if not np.isnan(P62[i]) else base})
        null.update(np.r_[dr],y); core.update(np.r_[W[i],B[i],dr],y); u+=y; c+=1
    return pd.DataFrame(rec)
if __name__=='__main__':
    rng=np.random.default_rng(53); DS,tabs=datasets(); OUT={}
    for dom in ('markets','weather'):
        fr=[]
        for name,r,start in DS[dom]:
            D=run(r,tabs); fr.append(D[D.i>=max(26,start)])
        D=pd.concat(fr,ignore_index=True)
        def prec(m,q):
            rk=np.concatenate([forward_rank(np.abs(f[m].values-0.5)) for f in fr]); t=rk>=q if q>0 else np.ones(len(D),bool)
            return {'precision':round(float(((D[m]>=.5).astype(int)==D.y)[t].mean())*100,1),'drift-null rule':round(float(((D['drift null']>=.5).astype(int)==D.y)[t].mean())*100,1),'coverage':round(float(t.mean())*100,1)}
        e={'skill % over static base':{m:skill(D,m) for m in ('drift null','core + drift','hex62')},'drift null over static base':pair(D,'base','drift null',rng),
           'STRUCTURE beyond drift null: core':pair(D,'drift null','core + drift',rng),'6.2 beyond drift null':pair(D,'drift null','hex62',rng),
           'precision core':{k:prec('core + drift',q) for k,q in (('all',0),('strongest 25%',.75),('strongest 10%',.9))},
           'precision 6.2':{k:prec('hex62',q) for k,q in (('all',0),('strongest 25%',.75),('strongest 10%',.9))}}
        OUT[dom+' RANGE']=e; print(dom,json.dumps(e),flush=True)
    json.dump(OUT,open(os.path.join(HERE,'core3_drift.json'),'w'),indent=1)
