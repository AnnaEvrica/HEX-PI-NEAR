# prereg_core4.md items 6-7: three-way gate; date-aligned pooled calibration.
import numpy as np, pandas as pd, json, os
from sklearn.isotonic import IsotonicRegression
from precision import datasets, calibrate_forward, HERE
from hexg import load_all
from core2 import boot, LL
from rankcore import walk
rng=np.random.default_rng(67); DS,tabs=datasets(); OUT={}
mk=load_all(); dates={k:pd.to_datetime(s.index)[1:] for k,s in mk.items()}
for dom in ('markets','weather','racing'):
    for read in ('RANGE','MOVE'):
        fr=[];gid=[];full=[]
        for g,(name,r,start) in enumerate(DS[dom]):
            A=walk(r,read,null='dyadic'); S=walk(r,read,null='static'); T=walk(r,read,null='three')
            A['static_p']=S.p.values; A['three']=T.p.values; A['p_cal']=calibrate_forward(A.p.values,A.y.values); A['three_cal']=calibrate_forward(T.p.values,T.y.values)
            if dom=='markets': A['date']=dates[name][A.i.values+1]     # date the outcome becomes known
            A['g']=g; A['start']=start; full.append(A)
        if dom=='markets':
            ALL=pd.concat(full,ignore_index=True).sort_values('date'); ALL['pool']=ALL['three']; cuts=pd.date_range(ALL.date.min(),ALL.date.max(),freq='QS'); iso=None
            for a,b in zip(cuts[:-1],cuts[1:]):
                past=ALL[ALL.date<a]
                if len(past)>=2000:
                    iso=IsotonicRegression(out_of_bounds='clip',y_min=.01,y_max=.99).fit(past['three'].values,past.y.values)
                    m=(ALL.date>=a)&(ALL.date<b); ALL.loc[m,'pool']=iso.predict(ALL.loc[m,'three'].values)
            m=ALL.date>=cuts[-1]
            if iso is not None: ALL.loc[m,'pool']=iso.predict(ALL.loc[m,'three'].values)
            full=[ALL[ALL.g==g].sort_values('i') for g in range(len(full))]
        for A in full:
            K=A[A.i>=max(26,A.start.iloc[0])]; fr.append(K); gid.append(K.g.values)
        D=pd.concat(fr,ignore_index=True); G=np.concatenate(gid) if dom=='racing' else None
        pr=lambda a,b: [round(float((LL(D,a)-LL(D,b)).mean())*1000,2)]+boot(LL(D,a)-LL(D,b),rng,G)
        sk=lambda m: round(float(1-LL(D,m).mean()/LL(D,'base').mean())*100,2)
        hit=lambda m: round(float(((D[m]>=.5).astype(int)==D.y).mean())*100,1)
        cols=['null','p','static_p','three','p_cal','three_cal']+(['pool'] if dom=='markets' else [])
        e={'skill %':{m:sk(m) for m in cols},'hit %':{m:hit(m) for m in cols},'three-way over dyadic two-way':pr('p','three'),'three-way over static two-way':pr('static_p','three')}
        if dom=='markets': e['date-aligned pooled calibration over per-series']=pr('three_cal','pool'); e['pooled over uncalibrated']=pr('three','pool')
        e['stated vs right, strongest decile']={m:[round(float(np.maximum(D[m],1-D[m])[np.abs(D[m]-.5)>=np.quantile(np.abs(D[m]-.5),.9)].mean())*100,1), round(float(((D[m]>=.5).astype(int)==D.y)[np.abs(D[m]-.5)>=np.quantile(np.abs(D[m]-.5),.9)].mean())*100,1)] for m in (['three','three_cal']+(['pool'] if dom=='markets' else []))}
        OUT[f'{dom} {read}']=e; print(dom,read,json.dumps(e),flush=True)
json.dump(OUT,open(os.path.join(HERE,'core4b_results.json'),'w'),indent=1)
