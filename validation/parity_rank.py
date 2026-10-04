# Reference walk of rank-1 for tests/parity.mjs (TypeScript must match to rounding).
import json, os, numpy as np
from precision import datasets, HERE
from rankcore import walk
DS,_=datasets(); pick={'BTC':None,'weather':DS['weather'][0][1][-6000:],'racing':DS['racing'][0][1]}
for n,r,_s in DS['markets']:
    if 'BTC' in n.upper() or 'bitcoin' in n.lower(): pick['BTC']=r
if pick['BTC'] is None: pick['BTC']=DS['markets'][0][1]
out={}
for name,r in pick.items():
    e={'returns':[float(v) for v in r]}
    for read in ('MOVE','RANGE'):
        D,fin=walk(r,read,final=True)
        e[read]={'i':D.i.tolist(),'y':D.y.tolist(),'null':D['null'].tolist(),'core':D['core'].tolist(),'p':D['p'].tolist(),'final':list(fin)}
    out[name]=e
json.dump(out,open(os.path.join(HERE,'parity_rank_reference.json'),'w'))
print({k:(len(v['returns']),len(v['MOVE']['i']),len(v['RANGE']['i'])) for k,v in out.items()})
