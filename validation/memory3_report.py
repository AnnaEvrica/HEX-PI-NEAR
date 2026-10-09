# Every number of mem-0.3, from memory/ledger3.parquet (prereg_memory3.md). python3 memory3_report.py -> memory/report3.json
import os, json, numpy as np, pandas as pd
import cer_replay as R
from memory_replay import interval, ll, SHIFTS
from memory3 import ALIGN
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'memory'); L=pd.read_parquet(os.path.join(OUT,'ledger3.parquet')); meta=json.load(open(os.path.join(OUT,'meta3.json'))); rng=np.random.default_rng(11); y=L.y.values
L['bday']=np.where(L['class']=='racing',L.step.values+100000*pd.factorize(L.series_id)[0],L.day.values); L['asset']=[R.env_of(s) if c=='markets' else c for s,c in zip(L.series_id,L['class'])]
G={}
for off in ('hex','cer'):
    b=ll(L['p_'+off].values,y)
    for arm in ('tuned_direct','tuned_gated'):
        G[f'{arm}_{off}']=ll(L[f'p_{arm}_{off}'].values,y)-b; G[f'{arm}_{off}_ctl']=np.mean([ll(L[f'p_{arm}_{off}_c{s}'].values,y)-b for s in SHIFTS],0); G[f'{arm}_{off}_net']=G[f'{arm}_{off}']-G[f'{arm}_{off}_ctl']
    G[f'plain_direct_{off}']=ll(L[f'p_plain_direct_{off}'].values,y)-b
bh=ll(L.p_hex.values,y); G['mem02_strict']=ll(L.p_mem02_strict.values,y)-bh; G['mem01_full']=ll(L.p_FULL.values,y)-bh; G['tuned_minus_plain']=G['tuned_direct_hex']-G['plain_direct_hex']; G['direct_minus_gated']=G['tuned_direct_hex']-G['tuned_gated_hex']; G['tuned_minus_mem02']=np.maximum(G['tuned_direct_hex'],-9)-G['mem02_strict']
G['memory_alone_over_null']=ll(L.pM.values,y)-ll(L.p_null.values,y); G['hex_over_null']=bh-ll(L.p_null.values,y); G=pd.DataFrame(G,index=L.index)
side=lambda p: (p>=0.5).astype(int)
def table(mask):
    d=G[mask]; day=L.bday.values[mask]; o={'calls':int(mask.sum())}; o.update({k:interval(day,d[k].values,rng) for k in G.columns})
    ph=L.p_hex.values[mask]; pt=L.p_tuned_direct_hex.values[mask]; yy=y[mask]; fl=side(ph)!=side(pt)
    o['precision']=dict(share_right_null=round(float((side(L.p_null.values[mask])==yy).mean()),4),share_right_HEX=round(float((side(ph)==yy).mean()),4),share_right_tuned=round(float((side(pt)==yy).mean()),4),side_changed=int(fl.sum()),side_changed_share=round(float(fl.mean()),4),
        changed_right_with_memory=round(float((side(pt[fl])==yy[fl]).mean()),4) if fl.any() else None,probability_moved_mean=round(float(np.abs(pt-ph).mean()),4),probability_moved_p90=round(float(np.quantile(np.abs(pt-ph),0.9)),4))
    return o
rep={'by_class':{},'markets_by_asset_class':{},'temperature_by_station':{},'mappings':{},'ensemble':{}}
for rd in ('MOVE','RANGE'):
    for c in ('markets','weather','racing'):
        m=((L['class']==c)&(L['read']==rd)).values; rep['by_class'][f'{c} {rd}']=table(m); d=L[m]
        rep['mappings'][f'{c} {rd}']={a:round(float(d['c_'+a].mean()),3) for a in ALIGN}; rep['ensemble'][f'{c} {rd}']={a:round(float(d['w_'+a].mean()),3) for a in ALIGN}
    for a in ('currency','energy','crypto','volatility'): rep['markets_by_asset_class'][f'{a} {rd}']=table(((L.asset==a)&(L['read']==rd)).values)
    for s in ('NewYork','Chicago','Seattle','Melbourne'): rep['temperature_by_station'][f'{s} {rd}']=table(((L.series_id==s)&(L['read']==rd)).values)
rep['H1']=meta['H1']; rep['cost']={k:meta[k] for k in ('seconds','cpu_seconds_one_pass','calls')}; json.dump(rep,open(os.path.join(OUT,'report3.json'),'w'),indent=1)
iv=lambda v: f"{v[0]:+.4f}[{v[1]:+.4f},{v[2]:+.4f}]"; f=lambda v: f"{v[0]:+.4f}"
for sec in ('by_class','markets_by_asset_class','temperature_by_station'):
    print('==',sec)
    for k,v in rep[sec].items(): print(f"{k:17s}{v['calls']:6d} direct {f(v['tuned_direct_hex'])} ctl {f(v['tuned_direct_hex_ctl'])} net {iv(v['tuned_direct_hex_net'])} | gated {f(v['tuned_gated_hex'])} ctl {f(v['tuned_gated_hex_ctl'])} net {iv(v['tuned_gated_hex_net'])} | plain {f(v['plain_direct_hex'])} | T-P {iv(v['tuned_minus_plain'])} D-G {iv(v['direct_minus_gated'])} | mem02 {f(v['mem02_strict'])} mem01 {f(v['mem01_full'])} | onCER direct net {iv(v['tuned_direct_cer_net'])} gated net {iv(v['tuned_gated_cer_net'])} | alone {f(v['memory_alone_over_null'])} hex {f(v['hex_over_null'])}")
for k,v in rep['by_class'].items(): print(k,v['precision'])
print('MAPPINGS'); [print(k,v) for k,v in rep['mappings'].items()]; print('ENSEMBLE'); [print(k,v) for k,v in rep['ensemble'].items()]; print(rep['H1'],rep['cost'])
