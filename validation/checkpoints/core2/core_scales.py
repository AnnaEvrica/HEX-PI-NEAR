# Follow-up to core.py: the joint multiscale order-1 model (S012) against the
# 6.2 engine, paired on identical steps, with precision and coverage.
import numpy as np, pandas as pd, json, os
from core import run_series, losses, boot_diff
from precision import datasets, forward_rank, HERE
rng=np.random.default_rng(11); DS,tabs=datasets(); out={}
for dom in ('racing','weather','markets'):
    fr={'direction':[], 'size':[]}
    for name,r,start in DS[dom]:
        if dom=='markets' and name not in ('BTC-USD','WTI','NATGAS','VIX','FX-Euro','FX-Japan'): continue
        res=run_series(r,tabs)
        for ev,f in res.items():
            f=f[f.i>=max(13,start)]
            if len(f): fr[ev].append(f)
    for ev in fr:
        if not fr[ev]: continue
        D=pd.concat(fr[ev],ignore_index=True); L,B=losses(D); y=D.y.values; e={}
        d=L['S012']-L['hex62']; e['S012 vs hex62 logloss']=[round(float(d.mean())*1000,2)]+[round(v*1000,2) for v in boot_diff(d,rng)]
        usual=((D['base'].values>=0.5).astype(int)==y)
        for m in ('hex62','M1','S012'):
            right=((D[m].values>=0.5).astype(int)==y)
            rk=np.concatenate([forward_rank(np.abs(f[m].values-0.5)) for f in fr[ev]])
            row={'logloss skill %':round(float(1-L[m].mean()/L['base'].mean())*100,2),'brier skill %':round(float(1-B[m].mean()/B['base'].mean())*100,2),'precision all':round(float(right.mean())*100,1)}
            for lab,q in (('strongest 50%',0.5),('strongest 25%',0.75),('strongest 10%',0.9)):
                t=rk>=q
                if t.sum()>30: row[lab]={'precision':round(float(right[t].mean())*100,1),'coverage':round(float(t.mean())*100,1),'usual':round(float(usual[t].mean())*100,1)}
            e[m]=row
        e['usual all']=round(float(usual.mean())*100,1); e['steps']=len(D); out[f'{dom} {ev}']=e
        print(dom,ev,json.dumps(e))
json.dump(out,open(os.path.join(HERE,'core_scales_results.json'),'w'),indent=1)
