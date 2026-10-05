# Reference walk of HEX 7.0 (hex7core.py), for tests/parity.mjs.
import numpy as np, json, os
from pretrain import load_families, HERE
from hexadaptive import baseline
import hex7core as h7
F=load_families(); out={}
for name,r in (('markets',F['markets']['test'][0][1]),('weather',F['weather']['test'][0][1][:4000]),('racing',F['racing']['test'][0][1])):
    e={'returns':[float(x) for x in r]}
    for read in ('MOVE','RANGE'):
        rows,fin=h7.walk(r,read)
        e[read]={'i':[x['i'] for x in rows],'p':[x['p'] for x in rows],'y':[x['y'] for x in rows],'null':[x['null'] for x in rows],'final':[fin['p'],fin['null'],fin['rank'],fin['cross']],'beta':[float(v) for v in fin['beta']],'influence':[float(v) for v in fin['influence']]}
    out[name]=e
json.dump(out,open(os.path.join(HERE,'parity_hex7_reference.json'),'w'))
print({k:(len(v['returns']),len(v['MOVE']['i']),len(v['RANGE']['i'])) for k,v in out.items()})
