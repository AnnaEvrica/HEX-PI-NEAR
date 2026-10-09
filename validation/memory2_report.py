# Every number of mem-0.2, from memory/ledger2.parquet (prereg_memory2.md).  python3 memory2_report.py -> memory/report2.json
import os, json, numpy as np, pandas as pd
from memory_replay import interval, ll, SHIFTS
from memory2 import TYPES
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'memory'); L=pd.read_parquet(os.path.join(OUT,'ledger2.parquet')); meta=json.load(open(os.path.join(OUT,'meta2.json'))); rng=np.random.default_rng(11); rep={}
y=L.y.values; base=ll(L.p_hex.values,y); g=lambda c: ll(L[c].values,y)-base
for a in ('TREE','FOREST','WORLD','BOTH','FULL','CHORD','CONV'): L['g_'+a]=g('p_'+a)
for t in TYPES: L['g_only_'+t]=g('p_only_'+t)
L['g_CONTROLS']=np.mean([g(f'p_W_CONTROL{s}') for s in SHIFTS],0); L['g_WORLD_net']=L.g_WORLD-L.g_CONTROLS; L['g_WORLD_minus_TREE']=L.g_WORLD-L.g_TREE; L['g_WORLD_minus_FOREST']=L.g_WORLD-L.g_FOREST; L['g_FOREST_minus_TREE']=L.g_FOREST-L.g_TREE; L['g_BOTH_minus_FULL']=L.g_BOTH-L.g_FULL
L['n_HEX']=base-ll(L.p_null.values,y); L['n_WORLD']=ll(L.p_WORLD.values,y)-ll(L.p_null.values,y)
L['bday']=np.where(L['class']=='racing',L.step.values+100000*pd.factorize(L.series_id)[0],L.day.values)
side=lambda p: (p>=0.5).astype(int); L['hit_null']=(side(L.p_null.values)==y); L['hit_HEX']=(side(L.p_hex.values)==y); L['hit_WORLD']=(side(L.p_WORLD.values)==y); L['flip']=side(L.p_WORLD.values)!=side(L.p_hex.values); L['dp']=np.abs(L.p_WORLD.values-L.p_hex.values)
cols=[c for c in L.columns if c.startswith(('g_','n_'))]; T={}; P={}
for (c,rd),d in L.groupby(['class','read']):
    k=f'{c} {rd}'; T[k]=dict(calls=len(d),**{x:interval(d.bday.values,d[x].values,rng) for x in cols})
    f=d[d.flip]; P[k]=dict(calls=len(d),bits_over_null_HEX=round(float(d.n_HEX.mean()),5),bits_over_null_HEX_with_memory=round(float(d.n_WORLD.mean()),5),share_right_null=round(float(d.hit_null.mean()),4),share_right_HEX=round(float(d.hit_HEX.mean()),4),share_right_with_memory=round(float(d.hit_WORLD.mean()),4),
        calls_whose_side_changed=int(len(f)),share_of_calls_changed=round(float(d.flip.mean()),4),changed_calls_right_with_memory=round(float(f.hit_WORLD.mean()),4) if len(f) else None,changed_calls_right_before=round(float(f.hit_HEX.mean()),4) if len(f) else None,
        probability_moved_mean=round(float(d.dp.mean()),4),probability_moved_p90=round(float(d.dp.quantile(0.9)),4),probability_moved_max=round(float(d.dp.max()),4))
rep['by_class_and_read']=T; rep['precision']=P
# how far HEX is from the null decides how much a voice can change: the same table by how strongly HEX itself leaned
L['lean']=pd.cut(np.abs(L.p_hex-0.5),[-1,0.02,0.05,0.10,1],labels=['under 2 points','2 to 5','5 to 10','over 10'])
rep['by_how_far_HEX_leaned']={f'{c} {rd}':{str(b):dict(calls=len(d),gain=round(float(d.g_WORLD.mean()),5),share_right_HEX=round(float(d.hit_HEX.mean()),4),share_right_with_memory=round(float(d.hit_WORLD.mean()),4),side_changed=round(float(d.flip.mean()),4)) for b,d in dd.groupby('lean',observed=True)} for (c,rd),dd in L.groupby(['class','read'])}
L['k']=L.groupby(['series_id','read']).cumcount(); Y=L[(L.k<250)&(L['class']!='racing')]
rep['first_250_calls_of_each_tree']={f'{c} {rd}':dict(calls=len(d),WORLD_minus_TREE=interval(d.bday.values,d.g_WORLD_minus_TREE.values,rng),WORLD=round(float(d.g_WORLD.mean()),5),TREE=round(float(d.g_TREE.mean()),5)) for (c,rd),d in Y.groupby(['class','read'])}
rep['by_series_weather']={f'{s} {rd}':dict(calls=len(d),TREE=round(float(d.g_TREE.mean()),5),FOREST=round(float(d.g_FOREST.mean()),5),WORLD=interval(d.bday.values,d.g_WORLD.values,rng),controls=round(float(d.g_CONTROLS.mean()),5),mem01_FULL=round(float(d.g_FULL.mean()),5),lines_across_subjects_mean=round(float(d.Sm.mean()),2),**{t:round(float(d['g_only_'+t].mean()),5) for t in TYPES}) for (s,rd),d in L[L['class']=='weather'].groupby(['series_id','read'])}
L['third']=L.k*3//L.groupby(['series_id','read']).step.transform('size'); rep['learning_by_third_WORLD']={f'{c} {rd}':[round(float(d[d.third==k].g_WORLD.mean()),5) for k in range(3)] for (c,rd),d in L.groupby(['class','read'])}
ck=meta['clock']; per=[np.diff(v) for v in ck.values()]; rep['cost']=dict(seconds_per_pass=[v[-1] for v in ck.values()],last_three_tenths_over_first_three_tenths=[round(float(p[-3:].sum()/p[:3].sum()),2) for p in per],microseconds_per_call=round(1e6*np.mean([v[-1] for v in ck.values()])/(meta['calls']/2)),total_seconds=meta['seconds']); rep['N1']=meta['N1']
json.dump(rep,open(os.path.join(OUT,'report2.json'),'w'),indent=1)
for k,v in T.items(): print(k,'| TREE',v['g_TREE'][0],'FOREST',v['g_FOREST'][0],'WORLD',v['g_WORLD'],'controls',v['g_CONTROLS'],'net',v['g_WORLD_net'],'| W-T',v['g_WORLD_minus_TREE'],'W-F',v['g_WORLD_minus_FOREST'],'| only',{t:v['g_only_'+t][0] for t in TYPES},'| mem01',v['g_FULL'][0],'BOTH',v['g_BOTH'][0],'B-F',v['g_BOTH_minus_FULL'])
for k,v in P.items(): print(k,v)
print('YOUNG',json.dumps(rep['first_250_calls_of_each_tree'])); print('COST',rep['cost']); print('THIRDS',rep['learning_by_third_WORLD'])
for k,v in rep['by_series_weather'].items(): print(k,v)
for k,v in rep['by_how_far_HEX_leaned'].items(): print(k,v)
