# Writes the Python reference walk (with the shipped tables) for three real
# series, so tests/parity.mjs can compare the TypeScript engine against it.
import numpy as np, json, os
from pretrain import load_families, walk, FAMILIES, HERE
T=json.load(open(os.path.join(HERE,'shipped_tables.json'))); tabs=[{'dir':np.array(T[f]['dir']),'size':np.array(T[f]['size'])} for f in FAMILIES]
F=load_families(); out={}
for name,r in (('markets: '+F['markets']['test'][0][0],F['markets']['test'][0][1]),('weather: Chicago',F['weather']['test'][0][1][:4000]),('racing: '+F['racing']['test'][0][0],F['racing']['test'][0][1])):
    rows,fd,fm=walk(r,tabs)
    out[name]={'returns':[float(x) for x in r],'p_up':[float(x) for x in rows[:,0]],'p_big':[None if np.isnan(x) else float(x) for x in rows[:,3]],'family_up':fd,'family_big':fm}
json.dump(out,open(os.path.join(HERE,'parity_reference.json'),'w'))
print({k:len(v['p_up']) for k,v in out.items()})
