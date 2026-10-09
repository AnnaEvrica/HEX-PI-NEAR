# ===========================================================================
# Two checks on the memory results (prereg_memory_checks.md). Local research.
#   1. cross-subject voices with same-day and with previous-day-only readings
#   2. memory on top of HEX plus CER
#   python3 memory_checks.py -> memory/checks_ledger.parquet ; then memory_checks_report.py
# ===========================================================================
import os; os.environ.setdefault('OMP_NUM_THREADS','1'); os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
import numpy as np, pandas as pd, json, time, multiprocessing as mp
import cer_replay as R, cercore as cer, memory_core as mc, memory2 as m2
from memory_replay import SHIFTS
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'memory'); CSHIFT=250
def chord_only(S, H, sid, read, lag, shift=0):
    """mem-0.1's chord and chord progression for every call of one series, with neighbours dated no later than (day - lag)."""
    cls,dt,r=next((c,d,x) for c,_,s,d,x in S if s==sid); r=np.asarray(r,float); n=len(r); a=np.abs(r); h=H[(H.series_id==sid)&(H['read']==read)].sort_values('step'); steps=h.step.values; days=R.days(dt)
    z=mc.nscore(r if read=='MOVE' else a); seq=np.full(n,np.nan); yq=h.outcome.values.astype(float)
    if shift: yq=np.r_[np.full(shift,np.nan),yq[:-shift]]
    seq[steps]=yq; avail=np.arange(n)+1; known=np.where(np.isnan(seq),0.0,seq); cnt=np.cumsum(~np.isnan(seq)); base=(np.r_[0,np.cumsum(known)[:-1]]+1)/(np.r_[0,cnt[:-1]]+2)
    nb=[(R.days(d2),np.asarray(r2,float)) for c2,_,s2,d2,r2 in S if c2==cls and s2!=sid]; X=np.full((n,1+len(nb)),np.nan); X[:,0]=z
    for j,(jd,jr) in enumerate(nb):
        jz=mc.nscore(jr if read=='MOVE' else np.abs(jr)); kk=cer.asof(days,jd,lag); ok=kk>=0; X[ok,1+j]=jz[kk[ok]]
    p,_=mc.knn(X,X,seq,avail,need=(2,0.5)); v1=mc.lgv(p)-mc.lgv(base); P=np.full((n,6*X.shape[1]),np.nan)
    for m in range(6): P[m:,(5-m)*X.shape[1]:(6-m)*X.shape[1]]=X[:n-m]
    P[:5]=np.nan; p,_=mc.knn(P,P,seq,avail,need=(12,0.5)); v2=mc.lgv(p)-mc.lgv(base); return steps,np.nan_to_num(np.stack([v1[steps],v2[steps]],1))
def cjob(a):
    sid,read,lag,shift=a; S,H=cjob.S,cjob.H; st,F=chord_only(S,H,sid,read,lag,shift); return pd.DataFrame({'series_id':sid,'read':read,'step':st,f'ch_l{lag}_s{shift}':F[:,0].astype(np.float32),f'pr_l{lag}_s{shift}':F[:,1].astype(np.float32)})
def cinit(): cjob.S,_=R.series_list(); cjob.H=pd.read_parquet(os.path.join(HERE,'replay','hex7_ledger.parquet'))
def pjob(a):
    read,lag,shift=a; S,_=R.series_list(); H=pd.read_parquet(os.path.join(HERE,'replay','hex7_ledger.parquet')); S=[s for s in S if s[3] is not None]; E=m2.events(S,H,read,lag_override=lag); V,_=m2.pass_(E,shift)
    d=E[['series_id','step']].copy(); d['read']=read
    for ti,t in enumerate(m2.TYPES): d[f'w_{t}_l{lag}_s{shift}']=V[:,ti,2].astype(np.float32)
    return d
if __name__=='__main__':
    t0=time.time(); S,_=R.series_list(); dated=[s[2] for s in S if s[3] is not None]
    with mp.Pool(2) as pool: P=pool.map(pjob,[(rd,lag,s) for rd in ('MOVE','RANGE') for lag in (0,1) for s in (0,)+SHIFTS],chunksize=1)
    print('mem-0.2 passes',round(time.time()-t0),'s',flush=True)
    with mp.Pool(2,initializer=cinit) as pool: C=pool.map(cjob,[(sid,rd,lag,s) for sid in dated for rd in ('MOVE','RANGE') for lag in (0,1) for s in (0,CSHIFT)],chunksize=1)
    print('mem-0.1 chords',round(time.time()-t0),'s',flush=True)
    L=pd.read_parquet(os.path.join(OUT,'ledger.parquet'),columns=['class','series_id','read','step','day','y','p_hex','p_null']); L=L[L['class']!='racing']; key=['series_id','read','step']
    def join(L,frames):
        by={}
        for f in frames: by.setdefault(tuple(c for c in f.columns if c not in key),[]).append(f)
        for fs in by.values(): L=L.merge(pd.concat(fs,ignore_index=True),on=key,how='left',validate='one_to_one')
        return L
    L=join(join(L,P),C)
    CE=pd.read_parquet(os.path.join(HERE,'cer','cer_ledger.parquet'),columns=['universe','series_id','read','step','hex_probability','d_cerm_hex_lag0','d_cerm_hex_lag1']); CE=CE[CE.universe.isin(('markets','temperature'))]
    for lag in (0,1): CE[f'p_cer_l{lag}']=CE.hex_probability+CE[f'd_cerm_hex_lag{lag}'].astype(float)
    L=L.merge(CE[key+['hex_probability','p_cer_l0','p_cer_l1']],on=key,how='left',validate='one_to_one'); print('calls',len(L),'without a CER call',int(L.p_cer_l0.isna().sum()),'HEX differs from CER ledger by',float((L.p_hex-L.hex_probability).abs().max()),flush=True)
    for c in ('p_cer_l0','p_cer_l1'): L[c]=L[c].fillna(L.p_hex)
    def one(g):
        g=g.sort_values('step'); y=g.y.values.astype(int); o={}; f=lambda cols: np.nan_to_num(g[cols].values.astype(float))
        for lag in (0,1):
            for on,off in (('hex',g.p_hex.values),('cer',g[f'p_cer_l{lag}'].values)):
                o[f'p_chord_l{lag}_{on}']=mc.fuse(off,y,[f([f'ch_l{lag}_s0',f'pr_l{lag}_s0'])])[0]; o[f'p_chordC_l{lag}_{on}']=mc.fuse(off,y,[f([f'ch_l{lag}_s{CSHIFT}',f'pr_l{lag}_s{CSHIFT}'])])[0]
                o[f'p_world_l{lag}_{on}']=mc.fuse(off,y,[f([f'w_{t}_l{lag}_s0' for t in m2.TYPES])])[0]
                for s in SHIFTS: o[f'p_worldC{s}_l{lag}_{on}']=mc.fuse(off,y,[f([f'w_{t}_l{lag}_s{s}' for t in m2.TYPES])])[0]
        return pd.DataFrame(o,index=g.index)
    L=L.join(pd.concat([one(g) for _,g in L.groupby(['series_id','read'])])); L.to_parquet(os.path.join(OUT,'checks_ledger.parquet'),index=False); print('done',round(time.time()-t0),'s')
