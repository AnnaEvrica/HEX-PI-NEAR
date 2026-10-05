# Reference walk of state-6.5 (hexcoupled.py) and of the observer, for tests/parity.mjs.
import numpy as np, json, os
from pretrain import load_families, HERE
from hexadaptive import baseline
from hexcoupled import walk
F=load_families(); out={}
for name,r in (('markets',F['markets']['test'][0][1]),('weather',F['weather']['test'][0][1][:4000]),('racing',F['racing']['test'][0][1])):
    e={'returns':[float(x) for x in r]}
    for read in ('MOVE','RANGE'):
        b=baseline(r,read); rows,fin,w=walk(r,read,base=b,weights=True)
        e[read]={'i':[x[0] for x in rows],'p':[x[1] for x in rows],'y':[x[3] for x in rows],'final':list(fin),'weights':[float(v) for v in w],'baseline':[None if np.isnan(v) else float(v) for v in b]}
    out[name]=e
json.dump(out,open(os.path.join(HERE,'parity_coupled_reference.json'),'w'))
print({k:(len(v['returns']),len(v['MOVE']['i']),len(v['RANGE']['i'])) for k,v in out.items()})
