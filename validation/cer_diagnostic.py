# After the run (not pre-registered): what do the time-displaced temperature neighbours carry?
# The controls gained about 0.002 bits per call over HEX on temperature direction. Two stand-in neighbours separate
# the explanations: a random walk (no information of any kind) and a bare calendar (an annual sine, nothing else).
#   python3 cer_diagnostic.py  -> cer/diagnostic.json
import numpy as np, pandas as pd, json, os, math
import hex7core as h7, cercore as cer
from replay import series_list, HERE
LN2=math.log(2); S,_=series_list(); out={}
for cls,role,sid,dt,r in S:
    if sid not in ('Chicago','Seattle'): continue
    d=pd.DatetimeIndex(dt).values.astype('datetime64[D]').astype(np.int64); rng=np.random.default_rng(7)
    walk=cer.channel('random walk','none',d,rng.standard_normal(len(d))); cal=np.sin(2*np.pi*d/365.2425); calendar=cer.channel('calendar','none',d[1:],np.diff(cal))
    for c in (walk,calendar): c['Z']=cer.coordinates(c)
    for read in ('MOVE','RANGE'):
        R=pd.DataFrame(h7.walk(r,read)[0]); td=d[R.i.values]; y=R.y.values; e={}
        for name,nb in (('a random walk',walk),('a bare calendar',calendar)):
            F,M=cer.features(td,[nb],0); p=cer.walk(R.p.values,y,F,M); g=(np.log(np.where(y==1,p,1-p))-np.log(np.where(y==1,R.p.values,1-R.p.values)))/LN2; b=td//20
            s=pd.Series(g).groupby(b).sum().values; n=pd.Series(g).groupby(b).size().values; idx=np.random.default_rng(3).integers(0,len(s),(2000,len(s))); m=s[idx].sum(1)/n[idx].sum(1)
            e[name]={'fusion over HEX, bits per call':round(float(g.mean()),5),'95% interval':[round(float(np.percentile(m,2.5)),5),round(float(np.percentile(m,97.5)),5)],'calls':int(len(g))}
        out[f"{sid} | {'direction' if read=='MOVE' else 'move size'}"]=e; print(sid,read,e,flush=True)
json.dump(out,open(os.path.join(HERE,'cer','diagnostic.json'),'w'),indent=1)
