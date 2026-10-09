# ===========================================================================
# Compositional memory in the learning loop: the one-pass replay on all 43
# series of the 7.0 replay, both reads (prereg_memory.md). HEX's calls and
# outcomes are read from its committed ledger and are not recomputed or changed.
#   python3 memory_replay.py   -> memory/ledger.parquet, memory/report.json
# ===========================================================================
import os; os.environ.setdefault('OMP_NUM_THREADS','1'); os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
import numpy as np, pandas as pd, json, time, hashlib, multiprocessing as mp
import cer_replay as R, memory_core as mc, hex7core as h7
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'memory'); SHIFTS=(250,211,293); BLOCK=20
ll=lambda p,y: np.log2(np.where(y==1,np.clip(p,1e-9,1),np.clip(1-p,1e-9,1)))
def setup():
    S,_=R.series_list(); H=pd.read_parquet(os.path.join(HERE,'replay','hex7_ledger.parquet')); return S,H
def inputs(S, H, sid, read, upto=None):
    cls,dt,r=next((c,d,x) for c,_,s,d,x in S if s==sid); h=H[(H.series_id==sid)&(H['read']==read)].sort_values('step'); r=np.asarray(r,float)
    days=None if dt is None else R.days(dt); nb=[] if dt is None else [(R.days(d2),np.asarray(r2,float)) for c2,_,s2,d2,r2 in S if c2==cls and s2!=sid]
    if upto is not None:                                                   # the same series as it stood at step `upto`: nothing later, for it or any neighbour
        h=h[h.step+1<upto]; cut=days[upto-1] if days is not None else None; r=r[:upto]; days=None if days is None else days[:upto]; nb=[(d2[d2<=cut],r2[:int((d2<=cut).sum())]) for d2,r2 in nb]; nb=[x for x in nb if len(x[0])>mc.MINMED]
    return cls,r,days,nb,h
def run(S, H, sid, read, upto=None, controls=True):
    cls,r,days,nb,h=inputs(S,H,sid,read,upto); steps=h.step.values; y=h.outcome.values.astype(int); ph=h.hex_probability.values; q0=h.null_probability.values; lag=1 if cls=='markets' else 0
    F,names,diag=mc.voices(r,read,steps,y,q0,days,nb,lag); out,infl=mc.arms(F,names,mc.conventional(r,read,steps,y),y,ph,q0)
    df=pd.DataFrame({'class':cls,'series_id':sid,'read':read,'step':steps,'day':(steps if days is None else days[steps]),'y':y,'p_hex':ph,'p_null':q0,'p_65':h.legacy_65_probability.values})
    for k,v in out.items(): df['p_'+k]=v
    for i,nm in enumerate(names): df['v_'+nm]=F[:,i].astype(np.float32)
    for k,v in diag.items(): df['d_'+k]=v.astype(np.float32)
    if controls:
        for s in SHIFTS:
            Fc,nc,_=mc.voices(r,read,steps,y,q0,days,nb,lag,shift=s); g={k:Fc[:,[i for i,nm in enumerate(nc) if f(nm)]] for k,f in mc.GROUPS.items()}; df[f'p_CONTROL{s}']=mc.fuse(ph,y,[g['CUBE'],g['MEL'],g['CHORD'],Fc])[0]
    return df,infl
def task(a):
    sid,read=a; S,H=task.S,task.H; t=time.time(); df,infl=run(S,H,sid,read); return df,(sid,read,[float(x) for x in infl],round(time.time()-t,1))
def init(): task.S,task.H=setup()
def interval(day, g, rng, B=1000):
    b=day//BLOCK; ub,inv=np.unique(b,return_inverse=True); s=np.bincount(inv,weights=g); n=np.bincount(inv); idx=rng.integers(0,len(s),(B,len(s))); m=s[idx].sum(1)/n[idx].sum(1)
    return [round(float(g.mean()),5),round(float(np.percentile(m,2.5)),5),round(float(np.percentile(m,97.5)),5)]
if __name__=='__main__':
    t0=time.time(); os.makedirs(OUT,exist_ok=True); S,H=setup(); rep={}
    # M1: HEX itself, recomputed, against its ledger
    m1={}
    for sid in ('BTC-USD','Chicago'):
        r=next(x for c,_,s,d,x in S if s==sid)
        for read in ('MOVE','RANGE'):
            rows,_=h7.walk(r,read); h=H[(H.series_id==sid)&(H['read']==read)].sort_values('step'); m1[f'{sid} {read}']=float(np.abs(np.array([w['p'] for w in rows])-h.hex_probability.values).max())
    rep['M1_hex_recomputed_max_difference']=m1; print('M1',m1,flush=True)
    tasks=[(sid,read) for c,_,sid,d,x in S for read in ('MOVE','RANGE')]
    with mp.Pool(2,initializer=init) as pool: res=pool.map(task,tasks,chunksize=1)
    L=pd.concat([d for d,_ in res],ignore_index=True); L.to_parquet(os.path.join(OUT,'ledger.parquet'),index=False); rep['influence_at_the_end']={f'{s} {rd}':i for _,(s,rd,i,_) in res}; rep['seconds_per_series_read']={f'{s} {rd}':t for _,(s,rd,_,t) in res}
    print('replay',len(L),'calls',round(time.time()-t0),'s',flush=True)
    # M2: no future data
    m2={}
    for sid,read in (('FX-Euro','MOVE'),('NewYork','MOVE'),('FX-Euro','RANGE')):
        n=len(next(x for c,_,s,d,x in S if s==sid)); up=int(0.6*n); a,_=run(S,H,sid,read,upto=up,controls=False); b=L[(L.series_id==sid)&(L['read']==read)].iloc[:len(a)].reset_index(drop=True); cols=[c for c in a.columns if c.startswith(('p_','v_'))]
        m2[f'{sid} {read}']=dict(calls=len(a),largest_difference=float(np.abs(a[cols].values.astype(float)-b[cols].values.astype(float)).max()),calls_that_differ=int((np.abs(a[cols].values.astype(float)-b[cols].values.astype(float)).max(1)>1e-9).sum()))
    rep['M2_truncated_history']=m2; print('M2',m2,flush=True)
    rep['calls']=int(len(L)); rep['seconds']=round(time.time()-t0); rep['hex_ledger_sha256_unchanged']=hashlib.sha256(open(os.path.join(HERE,'replay','hex7_ledger.parquet'),'rb').read()).hexdigest()[:16]
    json.dump(rep,open(os.path.join(OUT,'replay_meta.json'),'w'),indent=1); print('done',rep['seconds'],'s')
