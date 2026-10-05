# Control for core10: is the gain from three lines of each read a coupling, or just a shorter pattern?
# Adds a set that reads the three latest lines of the read's OWN pattern only, and splits each series in half.
import numpy as np, pandas as pd, json, os
from precision import datasets, keys, HERE
from core2 import boot
from hexadaptive import baseline
import hexmodel as hm
from core10 import walk, cl
rng=np.random.default_rng(102); DS,tabs=datasets(); OUT={}
for dom,read in (('weather','MOVE'),('markets','RANGE'),('markets','MOVE'),('racing','MOVE'),('weather','RANGE')):
    fr=[]
    for g,(name,r,start) in enumerate(DS[dom]):
        _,a,med,kd,km,kw=keys(r); dirs=np.where(kd>=0,kd>>1,-1); size=km; own,other=(size,dirs) if read=='RANGE' else (dirs,size)
        ok=(dirs>=0)&(size>=0); half=np.where(ok,((own&7)<<3)|(other&7),-1); own3=np.where(ok,(own&7)<<3,-1); base=baseline(r,read)
        A,_,_=walk(r,read,base,[(np.where(ok,own,-1),hm.KERN)]); B,_,_=walk(r,read,base,[(own,hm.KERN),(other,hm.KERN),(half,hm.KERN)]); C,_,_=walk(r,read,base,[(own,hm.KERN),(other,hm.KERN),(own3,hm.KERN)])
        idx=sorted(set(A)&set(B)&set(C)); D=pd.DataFrame([(i,A[i][1],A[i][0],B[i][0],C[i][0],g) for i in idx],columns=['i','y','hex','three_of_each','three_own_only','g']); D=D[D.i>=max(26,start)]; D['late']=(np.arange(len(D))>=len(D)//2); fr.append(D)
    D=pd.concat(fr,ignore_index=True)
    def pr(c,M): d=cl(D[c].values[M],D.y.values[M])-cl(D.hex.values[M],D.y.values[M]); return [round(float(d.mean())*1000,2)]+boot(d,rng,D.g.values[M] if dom=='racing' else None)
    al=np.ones(len(D),bool); e={'calls':len(D),'right %':{c:round(float(((D[c]>=.5).astype(int)==D.y).mean())*100,2) for c in ('hex','three_of_each','three_own_only')},
       'three of each over 6.4':pr('three_of_each',al),'three own only over 6.4':pr('three_own_only',al),'three of each, first half of each series':pr('three_of_each',~D.late.values),'three of each, second half':pr('three_of_each',D.late.values)}
    OUT[f'{dom} {read}']=e; print(dom,read,json.dumps(e),flush=True)
json.dump(OUT,open(os.path.join(HERE,'core10b_results.json'),'w'),indent=1)
