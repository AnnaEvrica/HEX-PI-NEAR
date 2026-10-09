# Every number of the compositional-memory experiment, from memory/ledger.parquet (prereg_memory.md).
#   python3 memory_report.py -> memory/report.json
import os, json, numpy as np, pandas as pd
import cer_replay as R, memory_core as mc
from memory_replay import interval, ll, SHIFTS
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'memory'); L=pd.read_parquet(os.path.join(OUT,'ledger.parquet')); rng=np.random.default_rng(11); rep={}
ARMS=['CONV','CUBE','MEL','CHORD','FULL']; y=L.y.values; base=ll(L.p_hex.values,y)
for a in ARMS+[f'CONTROL{s}' for s in SHIFTS]: L['g_'+a]=ll(L['p_'+a].values,y)-base
L['g_FULL_minus_CONV']=L.g_FULL-L.g_CONV; L['n_HEX']=base-ll(L.p_null.values,y); L['n_ALONE']=ll(L.p_ALONE.values,y)-ll(L.p_null.values,y); L['n_65']=ll(L.p_65.values,y)-ll(L.p_null.values,y)
L['g_CONTROLS']=L[[f'g_CONTROL{s}' for s in SHIFTS]].mean(1); L['g_FULL_minus_controls']=L.g_FULL-L.g_CONTROLS
# the day for the bootstrap: calendar day, offset per series for those without dates so that blocks stay within a series
L['bday']=np.where(L['class']=='racing',L.step.values+100000*pd.factorize(L.series_id)[0],L.day.values)
cols=['g_'+a for a in ARMS]+[f'g_CONTROL{s}' for s in SHIFTS]+['g_CONTROLS','g_FULL_minus_controls','g_FULL_minus_CONV','n_HEX','n_ALONE','n_65']
T={}
for (c,rd),g in L.groupby(['class','read']): T[f'{c} {rd}']=dict(calls=len(g),series=int(g.series_id.nunique()),**{k:interval(g.bday.values,g[k].values,rng) for k in cols})
rep['by_class_and_read']=T
rep['by_series_FULL']={f'{s} {rd}':dict(calls=len(g),FULL=interval(g.bday.values,g.g_FULL.values,rng),controls=round(float(g.g_CONTROLS.mean()),5),CHORD=round(float(g.g_CHORD.mean()),5),MEL=round(float(g.g_MEL.mean()),5),CUBE=round(float(g.g_CUBE.mean()),5),CONV=round(float(g.g_CONV.mean()),5)) for (s,rd),g in L.groupby(['series_id','read'])}
# how it learned: FULL's gain in each third of every series' record
L['third']=L.groupby(['series_id','read']).cumcount()*3//L.groupby(['series_id','read']).step.transform('size')
rep['learning_by_third']={f'{c} {rd}':[round(float(g[g.third==k].g_FULL.mean()),5) for k in range(3)] for (c,rd),g in L.groupby(['class','read'])}
# each voice against what HEX missed: correlation of the voice with (outcome - HEX's probability)
V=[c for c in L.columns if c.startswith('v_')]; res=L.y-L.p_hex
rep['voice_correlation_with_what_HEX_missed']={f'{c} {rd}':{v[2:]:round(float(np.corrcoef(g[v],res.loc[g.index])[0,1]),4) if g[v].std()>0 else None for v in V} for (c,rd),g in L.groupby(['class','read'])}
# the transformation profile at 6 notes: the nearest earlier phrase as it is, inverted, and at half speed
D=L[L['read']=='MOVE']; ok=D.d_melody6.notna()&D.d_inversion6.notna()&D.d_augmentation6.notna()
rep['transformation_profile_6_notes']={c:dict(calls=int(len(g)),median_distance=dict(identity=round(float(g.d_melody6.median()),4),inversion=round(float(g.d_inversion6.median()),4),augmentation=round(float(g.d_augmentation6.median()),4)),inverted_is_nearer=round(float((g.d_inversion6<g.d_melody6).mean()),4),half_speed_is_nearer=round(float((g.d_augmentation6<g.d_melody6).mean()),4)) for c,g in D[ok].groupby('class')}
# M8: are the 64 states occupied alike at every scale? Total variation between scales, against scale 0 resampled to the same size in blocks
S,_=R.series_list(); ss={}
def occ(v): return np.bincount(v,minlength=64)/len(v)
for cls in ('markets','weather','racing'):
    for read,label in (('MOVE','direction states'),('RANGE','size states')):
        st={k:[] for k in mc.SCALES}
        for c,_,sid,dt,r in S:
            if c!=cls: continue
            r=np.asarray(r,float); a=np.abs(r); med=pd.Series(a).expanding(mc.MINMED).median().values
            for k in mc.SCALES: s=mc.states(r,a,med,read,k); s=s[6*6**k-1::6**k]; st[k].append(s[s>=0])
        P0=np.concatenate(st[0]); o0=occ(P0); out={}
        for k in (1,2):
            Pk=np.concatenate(st[k]); tv=0.5*np.abs(occ(Pk)-o0).sum(); nb=max(1,len(Pk)//6); starts=rng.integers(0,len(P0)-6,(500,nb)); null=[0.5*np.abs(occ(P0[(s[:,None]+np.arange(6)).ravel()])-o0).sum() for s in starts]
            out[f'scale {k} against scale 0']=dict(samples=int(len(Pk)),total_variation=round(float(tv),4),sampling_noise_95th_percentile=round(float(np.percentile(null,95)),4),within_sampling_noise=bool(tv<=np.percentile(null,95)))
        ss[f'{cls}, {label}']=out
rep['M8_self_similarity']=ss
meta=json.load(open(os.path.join(OUT,'replay_meta.json'))); rep['M1']=meta['M1_hex_recomputed_max_difference']; rep['M2']=meta['M2_truncated_history']; rep['calls']=meta['calls']; rep['seconds']=meta['seconds']
rep['cost']=dict(seconds_total=meta['seconds'],slowest_series_read_seconds=max(meta['seconds_per_series_read'].values()),ledger_megabytes=round(os.path.getsize(os.path.join(OUT,'ledger.parquet'))/1e6,1))
json.dump(rep,open(os.path.join(OUT,'report.json'),'w'),indent=1)
for k,v in T.items(): print(k,v['calls'],'| FULL',v['g_FULL'],'| controls',v['g_CONTROLS'],'| FULL-controls',v['g_FULL_minus_controls'],'| CONV',v['g_CONV'],'| CUBE',v['g_CUBE'],'| MEL',v['g_MEL'],'| CHORD',v['g_CHORD'],'| FULL-CONV',v['g_FULL_minus_CONV'],'| over null: HEX',v['n_HEX'],'ALONE',v['n_ALONE'],'6.5',v['n_65'])
