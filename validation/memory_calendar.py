# Added after the run (not pre-registered): on temperature, how much of what memory adds is the season?
# The calendar alone (annual sine and cosine of the date) as a voice on HEX, and memory on top of that.
#   python3 memory_calendar.py -> memory/calendar.json
import os, json, numpy as np, pandas as pd, memory_core as mc
from memory_replay import interval, ll
HERE=os.path.dirname(os.path.abspath(__file__)); L=pd.read_parquet(os.path.join(HERE,'memory','ledger.parquet')); L=L[L['class']=='weather']; rng=np.random.default_rng(11); rows=[]; out={}
for (sid,read),g in L.groupby(['series_id','read']):
    g=g.sort_values('step'); y=g.y.values; ph=g.p_hex.values; ang=2*np.pi*g.day.values/365.25; C=np.stack([np.sin(ang),np.cos(ang)],1); pc=mc.fuse(ph,y,[C])[0]
    names=[c[2:] for c in g.columns if c.startswith('v_')]; F=np.nan_to_num(g[[c for c in g.columns if c.startswith('v_')]].values.astype(float)); G=[F[:,[i for i,nm in enumerate(names) if f(nm)]] for f in mc.GROUPS.values()]+[F]
    pm=mc.fuse(pc,y,G)[0]; b=ll(ph,y); d=pd.DataFrame(dict(series_id=sid,read=read,day=g.day.values,calendar=ll(pc,y)-b,memory=g.p_FULL.pipe(lambda p: ll(p.values,y))-b,memory_on_calendar=ll(pm,y)-ll(pc,y))); rows.append(d)
    out[f'{sid} {read}']={k:round(float(d[k].mean()),5) for k in ('calendar','memory','memory_on_calendar')}
D=pd.concat(rows)
for read,g in D.groupby('read'): out[f'all four stations {read}']={k:interval(g.day.values,g[k].values,rng) for k in ('calendar','memory','memory_on_calendar')}
json.dump(out,open(os.path.join(HERE,'memory','calendar.json'),'w'),indent=1)
for k,v in out.items(): print(k,v)
