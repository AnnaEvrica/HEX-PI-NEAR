# ===========================================================================
# mem-0.3: self-tuning memory, harmonic matchmaking (prereg_memory3.md).
# Research only. Reads the committed ledgers; changes none, and no product file.
#   python3 memory3.py -> memory/ledger3.parquet, memory/meta3.json
# ===========================================================================
import os; os.environ.setdefault('OMP_NUM_THREADS','1'); os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
import numpy as np, pandas as pd, json, time, multiprocessing as mp
import cer_replay as R, hex7core as h7, memory_core as mc, memory2 as m2
from memory_replay import SHIFTS
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'memory'); RHO=0.25; KAPPA=64.0
ALIGN=('unison','inversion','retrograde','delay','dilation','kin_unison','kin_inversion','modulation'); C=np.array([-1.0,-0.5,0.0,0.5,1.0])
POP=m2.POP; RP=m2.RP; AR=m2.AR; REV=np.array([int(format(i,'06b')[::-1],2) for i in range(64)])
def states2(r, a, med, read):
    """Six-line own state whose lines each cover two steps (the past at half speed)."""
    n=len(r); cs=np.r_[0,np.cumsum(r)]; ca=np.r_[0,np.cumsum(a)]; s=np.full(n,-1,int); t=np.arange(11,n); v=np.zeros(len(t),int)
    for m in range(6):
        hi=t+1-2*m; lo=hi-2; v|=((cs[hi]-cs[lo]>0) if read=='MOVE' else ((ca[hi]-ca[lo])/2>med[t])).astype(int)<<m
    ok=~np.isnan(med[t]) if read=='RANGE' else np.ones(len(t),bool); s[t[ok]]=v[ok]; return s
def walk(S, H, sid, read, shift=0, upto=None, detail=False):
    """One tree, one read, one pass. For each call: memory's distribution p_M (the ensemble of resolved alignments) and the untuned p_plain."""
    cls,dt,r=next((c,d,x) for c,_,s,d,x in S if s==sid); r=np.asarray(r,float); h=H[(H.series_id==sid)&(H['read']==read)].sort_values('step')
    A=m2.addresses(S,sid,read,lag_override=1)
    if upto is not None: r=r[:upto]; h=h[h.step+1<upto]
    n=len(r); a=np.abs(r); med=pd.Series(a).expanding(mc.MINMED).median().values; s0=mc.states(r,a,med,read,0); s2=states2(r,a,med,read); Sb=A['S']; Sm=A['Sm']
    steps=h.step.values; y=h.outcome.values.astype(int); q0=h.null_probability.values; seq=y.astype(float)
    if shift: seq=np.r_[np.full(shift,np.nan),seq[:-shift]]
    tal={}; maps=[h7.Share(len(C)) for _ in ALIGN]; ens=h7.Share(len(ALIGN)); N=len(steps); pM=np.zeros(N); pP=np.zeros(N); EC=np.zeros((N,len(ALIGN))); W=np.zeros((N,len(ALIGN)))
    def get(name,size):
        v=tal.get(name)
        if v is None: v=tal[name]=np.zeros((2,size))
        return v
    def delta(name,m,s):
        t=get(name,1<<m); Kr=RP[POP[s^AR[m]]]; return (Kr@t[0])/(Kr@t[1]+KAPPA)
    for c in range(N):
        i=steps[c]; q=q0[c]; k0=int(s0[i]); kd=int(s0[i-1]) if i>0 else -1; k2=int(s2[i]); m=int(Sm[i]); kS=int(Sb[i]); d=[None]*len(ALIGN)
        if k0>=0: d[0]=delta('T',6,k0); d[1]=delta('T',6,k0^63); d[2]=delta('T',6,int(REV[k0])); d[4]=delta('T2',6,k0)       # the present, as it is, against the past at half speed
        if kd>=0: d[3]=delta('Td',6,kd)
        if m>0:
            d[5]=delta(f'S{m}',m,kS); d[6]=delta(f'S{m}',m,kS^((1<<m)-1))
            if k0>=0: d[7]=delta(f'TS{m}',6+m,k0|(kS<<6))
        V=np.full(len(ALIGN),q); live=[]
        for t,dv in enumerate(d):
            if dv is None: continue
            P=np.clip(q+C*dv,0.01,0.99); V[t]=maps[t].predict(P); live.append((t,P)); EC[c,t]=float(maps[t].influence()@C)
        pM[c]=ens.predict(V); W[c]=ens.influence(); pl=[d[t] for t in (0,5,7) if d[t] is not None]; pP[c]=np.clip(q+(np.mean(pl) if pl else 0.0),0.01,0.99)
        for t,P in live: maps[t].update(P,y[c])                                   # the mappings and the ensemble learn from what happened
        ens.update(V,y[c])
        if not np.isnan(seq[c]):                                                  # memory files what followed, under every key this moment has
            res=seq[c]-q
            if k0>=0: t_=get('T',64); t_[0,k0]+=res; t_[1,k0]+=1
            if kd>=0: t_=get('Td',64); t_[0,kd]+=res; t_[1,kd]+=1
            if k2>=0: t_=get('T2',64); t_[0,k2]+=res; t_[1,k2]+=1
            if m>0:
                t_=get(f'S{m}',1<<m); t_[0,kS]+=res; t_[1,kS]+=1
                if k0>=0: kk=k0|(kS<<6); t_=get(f'TS{m}',1<<(6+m)); t_[0,kk]+=res; t_[1,kk]+=1
    o=pd.DataFrame({'series_id':sid,'read':read,'step':steps,(f'pM_s{shift}' if shift else 'pM'):pM})
    if not shift:
        o['p_plain']=pP
        for t,nm in enumerate(ALIGN): o['c_'+nm]=EC[:,t].astype(np.float32); o['w_'+nm]=W[:,t].astype(np.float32)
    return o
def job(a):
    sid,read,shift=a; t=time.time(); o=walk(job.S,job.H,sid,read,shift); return o,time.time()-t
def init(): job.S,_=R.series_list(); job.H=pd.read_parquet(os.path.join(HERE,'replay','hex7_ledger.parquet'))
if __name__=='__main__':
    t0=time.time(); S,_=R.series_list(); H=pd.read_parquet(os.path.join(HERE,'replay','hex7_ledger.parquet')); key=['series_id','read','step']
    with mp.Pool(2,initializer=init) as pool: res=pool.map(job,[(s[2],rd,sh) for s in S for rd in ('MOVE','RANGE') for sh in (0,)+SHIFTS],chunksize=1)
    cpu=sum(t for _,t in res); L=pd.read_parquet(os.path.join(OUT,'ledger2.parquet'),columns=['class','series_id','read','step','day','y','p_hex','p_null','p_65','p_FULL','p_WORLD','p_TREE'])
    by={}
    for o,_ in res: by.setdefault(tuple(c for c in o.columns if c not in key),[]).append(o)
    for fs in by.values(): L=L.merge(pd.concat(fs,ignore_index=True),on=key,how='left',validate='one_to_one')
    assert L.pM.notna().all()
    K=pd.read_parquet(os.path.join(OUT,'checks_ledger.parquet'),columns=key+['p_world_l1_hex','p_chord_l1_hex','p_cer_l1']); L=L.merge(K,on=key,how='left')
    L['p_mem02_strict']=L.p_world_l1_hex.fillna(L.p_WORLD); L['p_cer']=L.p_cer_l1.fillna(L.p_hex)                 # racing has no neighbours: its mem-0.2 and its CER are what they were
    lg=mc.lgv; sig=lambda x: np.clip(1/(1+np.exp(-x)),0.01,0.99)
    for off in ('hex','cer'):
        b=L['p_'+off].values; L[f'p_tuned_direct_{off}']=sig(lg(b)+lg(L.pM.values)-lg(L.p_null.values)); L[f'p_plain_direct_{off}']=sig(lg(b)+lg(L.p_plain.values)-lg(L.p_null.values))
        for s in SHIFTS: L[f'p_tuned_direct_{off}_c{s}']=sig(lg(b)+lg(L[f'pM_s{s}'].values)-lg(L.p_null.values))
    parts=[]
    for _,g in L.groupby(['series_id','read']):
        g=g.sort_values('step'); y=g.y.values.astype(int); o={}
        for off in ('hex','cer'):
            o[f'p_tuned_gated_{off}']=mc.fuse(g['p_'+off].values,y,[(lg(g.pM.values)-lg(g.p_null.values))[:,None]])[0]
            for s in SHIFTS: o[f'p_tuned_gated_{off}_c{s}']=mc.fuse(g['p_'+off].values,y,[(lg(g[f'pM_s{s}'].values)-lg(g.p_null.values))[:,None]])[0]
        parts.append(pd.DataFrame(o,index=g.index))
    L=L.join(pd.concat(parts)); L.to_parquet(os.path.join(OUT,'ledger3.parquet'),index=False)
    # H1: no future data
    h1={}
    for sid,rd in (('FX-Euro','MOVE'),('NewYork','MOVE'),('Chicago','RANGE')):
        n=len(next(x for c,_,s,d,x in S if s==sid)); a=walk(S,H,sid,rd,upto=int(0.6*n)); b=L[(L.series_id==sid)&(L['read']==rd)].sort_values('step').iloc[:len(a)]
        h1[f'{sid} {rd}']=dict(calls=len(a),largest_difference=float(np.abs(a.pM.values-b.pM.values).max()))
    meta=dict(H1=h1,seconds=round(time.time()-t0),cpu_seconds_all_passes=round(cpu),cpu_seconds_one_pass=round(cpu/4),calls=int(len(L))); json.dump(meta,open(os.path.join(OUT,'meta3.json'),'w'),indent=1); print(meta)
