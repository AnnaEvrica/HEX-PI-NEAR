# The two checks, from memory/checks_ledger.parquet (prereg_memory_checks.md). python3 memory_checks_report.py -> memory/checks.json
import os, json, numpy as np, pandas as pd
import cer_replay as R
from memory_replay import interval, ll, SHIFTS
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'memory'); L=pd.read_parquet(os.path.join(OUT,'checks_ledger.parquet')); rng=np.random.default_rng(11); y=L.y.values
L['asset']=[R.env_of(s) for s in L.series_id]; G={}
for lag in (0,1):
    for on in ('hex','cer'):
        off=L.p_hex.values if on=='hex' else L[f'p_cer_l{lag}'].values; b=ll(off,y)
        G[f'chord_l{lag}_{on}']=ll(L[f'p_chord_l{lag}_{on}'].values,y)-b; G[f'chordC_l{lag}_{on}']=ll(L[f'p_chordC_l{lag}_{on}'].values,y)-b
        G[f'world_l{lag}_{on}']=ll(L[f'p_world_l{lag}_{on}'].values,y)-b; G[f'worldC_l{lag}_{on}']=np.mean([ll(L[f'p_worldC{s}_l{lag}_{on}'].values,y)-b for s in SHIFTS],0)
    G[f'cer_l{lag}']=ll(L[f'p_cer_l{lag}'].values,y)-ll(L.p_hex.values,y)
G=pd.DataFrame(G,index=L.index)
def table(mask):
    d=G[mask]; day=L.day.values[mask]; o={'calls':int(mask.sum())}
    for lag,name in ((0,'same day'),(1,'previous day only')):
        e={'CER over HEX':interval(day,d[f'cer_l{lag}'].values,rng)}
        for on,label in (('hex','over HEX'),('cer','over HEX plus CER')):
            for m,c in (('chord','chordC'),('world','worldC')):
                e[f'{m} {label}']=interval(day,d[f'{m}_l{lag}_{on}'].values,rng); e[f'{m} {label}, controls']=round(float(d[f'{c}_l{lag}_{on}'].mean()),5); e[f'{m} {label}, net']=interval(day,(d[f'{m}_l{lag}_{on}']-d[f'{c}_l{lag}_{on}']).values,rng)
        o[name]=e
    return o
rep={'by_class':{},'markets_by_asset_class':{},'temperature_by_station':{}}
for rd in ('MOVE','RANGE'):
    for c in ('markets','weather'): rep['by_class'][f'{c} {rd}']=table(((L['class']==c)&(L['read']==rd)).values)
    for a in ('currency','energy','crypto','volatility'): rep['markets_by_asset_class'][f'{a} {rd}']=table(((L.asset==a)&(L['read']==rd)).values)
    for s in ('NewYork','Chicago','Seattle','Melbourne'): rep['temperature_by_station'][f'{s} {rd}']=table(((L.series_id==s)&(L['read']==rd)).values)
json.dump(rep,open(os.path.join(OUT,'checks.json'),'w'),indent=1)
f=lambda v: f"{v[0]:+.4f}" if isinstance(v,list) else f"{v:+.4f}"; iv=lambda v: f"{v[0]:+.4f}[{v[1]:+.4f},{v[2]:+.4f}]"
for sec,T in rep.items():
    print('==',sec)
    for k,v in T.items():
        for lg in ('same day','previous day only'):
            e=v[lg]; print(f"{k:17s}{v['calls']:6d} {lg[:8]:8s} CER {f(e['CER over HEX'])} | chord/HEX {f(e['chord over HEX'])} ctl {f(e['chord over HEX, controls'])} net {iv(e['chord over HEX, net'])} | world/HEX {f(e['world over HEX'])} ctl {f(e['world over HEX, controls'])} net {iv(e['world over HEX, net'])} || chord/CER net {iv(e['chord over HEX plus CER, net'])} | world/CER net {iv(e['world over HEX plus CER, net'])}")
