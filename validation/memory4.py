# ===========================================================================
# mem-0.4: residual, counterpoint, composition (prereg_memory4.md).
# Research only. Reads the committed ledgers; changes none, and no product file.
#   python3 memory4.py -> memory/ledger4.parquet, memory/meta4.json
# ===========================================================================
import os; os.environ.setdefault('OMP_NUM_THREADS','1'); os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
import numpy as np, pandas as pd, json, time, multiprocessing as mp
import cer_replay as R, hex7core as h7, memory_core as mc, memory2 as m2, memory3 as m3
from memory_replay import SHIFTS
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'memory'); KAPPA=64.0; C=m3.C; POP=m2.POP; RP=m2.RP; AR=m2.AR; REV=m3.REV
COMPOSED=('interval','transition','cross_scale','symmetry'); THIN=30
def keys(S, H, sid, read, upto=None):
    cls,dt,r=next((c,d,x) for c,_,s,d,x in S if s==sid); r=np.asarray(r,float); h=H[(H.series_id==sid)&(H['read']==read)].sort_values('step'); A=m2.addresses(S,sid,read,lag_override=1)
    if upto is not None: r=r[:upto]; h=h[h.step+1<upto]
    a=np.abs(r); med=pd.Series(a).expanding(mc.MINMED).median().values; return h,mc.states(r,a,med,read,0),m3.states2(r,a,med,read),A['S'],A['Sm']
def tune(Q, ST, ref, y, seq, nal):
    """Q[c]: [(alignment, tally, bits, key)] read at call c; ST[c]: [(tally, bits, key)] filed after it. ref: the call each reading starts from.
    Returns the ensemble's distribution, each alignment's learned reading, and the ensemble's weights."""
    tal={}; maps=[h7.Share(len(C)) for _ in range(nal)]; ens=h7.Share(nal); N=len(y); p=np.zeros(N); EC=np.zeros((N,nal)); W=np.zeros((N,nal))
    def get(name,bits):
        v=tal.get(name)
        if v is None: v=tal[name]=np.zeros((2,1<<bits))
        return v
    for c in range(N):
        q=float(np.clip(ref[c],0.01,0.99)); V=np.full(nal,q); live=[]
        for t,name,bits,k in Q[c]:
            tt=get(name,bits); Kr=RP[POP[k^AR[bits]]]; d=(Kr@tt[0])/(Kr@tt[1]+KAPPA); P=np.clip(q+C*d,0.01,0.99); V[t]=maps[t].predict(P); live.append((t,P)); EC[c,t]=float(maps[t].influence()@C)
        p[c]=ens.predict(V); W[c]=ens.influence()
        for t,P in live: maps[t].update(P,y[c])
        ens.update(V,y[c])
        if not np.isnan(seq[c]):
            res=seq[c]-q
            for name,bits,k in ST[c]: tt=get(name,bits); tt[0,k]+=res; tt[1,k]+=1
    return p,EC,W
def specs(h, s0, s2, Sb, Sm, kind):
    Q=[]; ST=[]; sup=np.zeros(len(h),int); cnt=np.zeros(64,int)
    for c,i in enumerate(h.step.values):
        k0=int(s0[i]); kd=int(s0[i-1]) if i>0 else -1; k2=int(s2[i]); m=int(Sm[i]); kS=int(Sb[i]); q=[]; st=[]
        if k0>=0: sup[c]=cnt[k0]; cnt[k0]+=1
        if kind=='A':                                                          # mem-0.3's eight alignments
            if k0>=0: q+=[(0,'T',6,k0),(1,'T',6,k0^63),(2,'T',6,int(REV[k0])),(4,'T2',6,k0)]; st.append(('T',6,k0))
            if kd>=0: q.append((3,'Td',6,kd)); st.append(('Td',6,kd))
            if k2>=0: st.append(('T2',6,k2))
            if m>0:
                q+=[(5,f'S{m}',m,kS),(6,f'S{m}',m,kS^((1<<m)-1))]; st.append((f'S{m}',m,kS))
                if k0>=0: kk=k0|(kS<<6); q.append((7,f'TS{m}',6+m,kk)); st.append((f'TS{m}',6+m,kk))
        else:                                                                  # composed addresses: a line is set where the two differ
            if k0>=0 and m>0: k=(k0&((1<<m)-1))^kS; q.append((0,f'I{m}',m,k)); st.append((f'I{m}',m,k))
            if k0>=0 and kd>=0: k=k0^kd; q.append((1,'X',6,k)); st.append(('X',6,k))
            if k0>=0 and k2>=0: k=k0^k2; q.append((2,'Z',6,k)); st.append(('Z',6,k))
            if k0>=0: k=k0^int(REV[k0]); q.append((3,'Y',6,k)); st.append(('Y',6,k))
        Q.append(q); ST.append(st)
    return Q,ST,sup
def walk(S, H, REF, sid, read, mode, shift=0, upto=None):
    h,s0,s2,Sb,Sm=keys(S,H,sid,read,upto); y=h.outcome.values.astype(int); seq=y.astype(float)
    if shift: seq=np.r_[np.full(shift,np.nan),seq[:-shift]]
    kind='C' if mode=='C' else 'A'; Q,ST,sup=specs(h,s0,s2,Sb,Sm,kind)
    ref=h.null_probability.values if mode=='C' else REF[(sid,read)][mode][:len(h)]
    p,EC,W=tune(Q,ST,ref,y,seq,4 if kind=='C' else 8); nm={'A_hex':'pA_hex','A_cer':'pA_cer','C':'pC'}[mode]
    o=pd.DataFrame({'series_id':sid,'read':read,'step':h.step.values,(f'{nm}_s{shift}' if shift else nm):p})
    if not shift and mode=='C':
        o['support']=sup
        for t,a in enumerate(COMPOSED): o['cc_'+a]=EC[:,t].astype(np.float32); o['cw_'+a]=W[:,t].astype(np.float32)
    if not shift and mode=='A_hex':
        for t,a in enumerate(m3.ALIGN): o['ac_'+a]=EC[:,t].astype(np.float32); o['aw_'+a]=W[:,t].astype(np.float32)
    return o
def refs():
    L=pd.read_parquet(os.path.join(OUT,'ledger3.parquet'),columns=['series_id','read','step','p_hex','p_cer']); return {k:{'A_hex':g.sort_values('step').p_hex.values,'A_cer':g.sort_values('step').p_cer.values} for k,g in L.groupby(['series_id','read'])}
def job(a): sid,read,mode,shift=a; return walk(job.S,job.H,job.REF,sid,read,mode,shift)
def init(): job.S,_=R.series_list(); job.H=pd.read_parquet(os.path.join(HERE,'replay','hex7_ledger.parquet')); job.REF=refs()
def js(p,q):
    def H(x): x=np.clip(x,1e-9,1-1e-9); return -(x*np.log2(x)+(1-x)*np.log2(1-x))
    return np.maximum(H((p+q)/2)-(H(p)+H(q))/2,0)
def mix(pa, pb, y, flag=None):
    """Two voices heard together: a fixed-share mixture of two distributions; with `flag`, one mixture for each side of it."""
    A=[h7.Share(2),h7.Share(2)]; out=np.zeros(len(y))
    for t in range(len(y)):
        s=A[int(flag[t])] if flag is not None else A[0]; V=np.array([pa[t],pb[t]]); out[t]=s.predict(V); s.update(V,int(y[t]))
    return out
if __name__=='__main__':
    t0=time.time(); S,_=R.series_list(); H=pd.read_parquet(os.path.join(HERE,'replay','hex7_ledger.parquet')); key=['series_id','read','step']
    with mp.Pool(2,initializer=init) as pool: res=pool.map(job,[(s[2],rd,mode,sh) for s in S for rd in ('MOVE','RANGE') for mode in ('A_hex','A_cer','C') for sh in (0,)+SHIFTS],chunksize=4)
    print('passes',round(time.time()-t0),'s',flush=True)
    L=pd.read_parquet(os.path.join(OUT,'ledger3.parquet'),columns=['class','series_id','read','step','day','y','p_hex','p_null','p_cer','pM','p_mem02_strict','p_FULL','p_tuned_direct_hex']+[f'pM_s{s}' for s in SHIFTS]); by={}
    for o in res: by.setdefault(tuple(c for c in o.columns if c not in key),[]).append(o)
    for fs in by.values(): L=L.merge(pd.concat(fs,ignore_index=True),on=key,how='left',validate='one_to_one')
    assert L.pA_hex.notna().all() and L.pC.notna().all()
    L['tension']=js(L.pM.values,L.p_hex.values); parts=[]
    for _,g in L.groupby(['series_id','read']):
        g=g.sort_values('step'); y=g.y.values; o={}; hi=(g.tension>g.tension.expanding().median().shift(1).fillna(np.inf)).values; o['high_tension']=hi
        for off in ('hex','cer'):
            b=g['p_'+off].values; o[f'p_B_{off}']=mix(b,g.pM.values,y); o[f'p_C_{off}']=mix(b,g.pC.values,y)
            for s in SHIFTS: o[f'p_B_{off}_c{s}']=mix(b,g[f'pM_s{s}'].values,y); o[f'p_C_{off}_c{s}']=mix(b,g[f'pC_s{s}'].values,y)
        o['p_Bt_hex']=mix(g.p_hex.values,g.pM.values,y,hi); parts.append(pd.DataFrame(o,index=g.index))
    L=L.join(pd.concat(parts)); L.to_parquet(os.path.join(OUT,'ledger4.parquet'),index=False); REF=refs(); j1={}
    for sid,rd in (('FX-Euro','MOVE'),('Chicago','MOVE')):
        n=len(next(x for c,_,s,d,x in S if s==sid)); b=L[(L.series_id==sid)&(L['read']==rd)].sort_values('step')
        for mode,col in (('A_hex','pA_hex'),('C','pC')):
            a=walk(S,H,REF,sid,rd,mode,upto=int(0.6*n)); j1[f'{sid} {rd} {mode}']=dict(calls=len(a),largest_difference=float(np.abs(a[col].values-b[col].values[:len(a)]).max()))
    meta=dict(J1=j1,seconds=round(time.time()-t0),calls=int(len(L))); json.dump(meta,open(os.path.join(OUT,'meta4.json'),'w'),indent=1); print(meta)
