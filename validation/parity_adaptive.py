# Reference walk of state-6.3 (HEX with the observer's baseline) and of the observer itself,
# with the shipped tables, for tests/parity.mjs.
import numpy as np, json, os
from pretrain import load_families, FAMILIES, HERE
from hexadaptive import walk, baseline
T=json.load(open(os.path.join(HERE,'shipped_tables.json'))); tabs=[{'dir':np.array(T[f]['dir']),'size':np.array(T[f]['size'])} for f in FAMILIES]
F=load_families(); out={}
for name,r in (('markets',F['markets']['test'][0][1]),('weather',F['weather']['test'][0][1][:4000]),('racing',F['racing']['test'][0][1])):
    e={'returns':[float(x) for x in r]}
    for read in ('MOVE','RANGE'):
        rows,fin=walk(r,tabs,read); b=baseline(r,read)
        e[read]={'i':[x[0] for x in rows],'p':[x[1] for x in rows],'y':[x[3] for x in rows],'final':list(fin),'baseline':[None if np.isnan(v) else float(v) for v in b]}
    out[name]=e
json.dump(out,open(os.path.join(HERE,'parity_adaptive_reference.json'),'w'))
print({k:(len(v['returns']),len(v['MOVE']['i']),len(v['RANGE']['i'])) for k,v in out.items()})
