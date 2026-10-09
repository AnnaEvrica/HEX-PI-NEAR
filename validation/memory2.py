# ===========================================================================
# mem-0.2: addressed memory with floating pooling (prereg_memory2.md).
# Research only. Reads HEX 7.0's committed ledger and the mem-0.1 ledger;
# changes neither, and no product file.
#   python3 memory2.py   -> memory/ledger2.parquet, memory/meta2.json
#
#   addresses   T0, T1, T2 (six lines through time), S (lines across kin
#               subjects at one moment), T0+S
#   tallies     what followed, filed under the address, at three levels:
#               tree, forest, world
#   pass_       one chronological pass over every call of a read: voices
#               first, then the evidence, released when its outcome is dated
# ===========================================================================
import os; os.environ.setdefault('OMP_NUM_THREADS','1'); os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
import numpy as np, pandas as pd, json, time, heapq, multiprocessing as mp
import cer_replay as R, cercore as cer, memory_core as mc
from memory_replay import ll, SHIFTS
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'memory'); RHO=0.25; KAPPA=64.0; KIN=6; MINKIN=50
POP=np.array([bin(i).count('1') for i in range(4096)]); RP=RHO**np.arange(13); AR={m:np.arange(1<<m) for m in range(13)}
TYPES=('T0','T1','T2','S','T0S'); LEVELS=('tree','forest','world')
def addresses(S, sid, read):
    """Every address of every step of one series. Returns dict of arrays over steps: T0, T1, T2 (0..63, -1 unknown), S (bits), Sm (number of lines), and outcome day."""
    cls,dt,r=next((c,d,x) for c,_,s,d,x in S if s==sid); r=np.asarray(r,float); n=len(r); a=np.abs(r); med=pd.Series(a).expanding(mc.MINMED).median().values
    out={f'T{k}':mc.states(r,a,med,read,k) for k in mc.SCALES}; Sb=np.zeros(n,int); Sm=np.zeros(n,int)
    if dt is not None:
        days=R.days(dt); lag=1 if cls=='markets' else 0; z=mc.nscore(r if read=='MOVE' else a); nb=[(R.days(d2),np.asarray(r2,float)) for c2,_,s2,d2,r2 in S if c2==cls and s2!=sid]; J=len(nb); X=np.full((n,J),np.nan); B=np.full((n,J),np.nan)
        for j,(jd,jr) in enumerate(nb):
            ja=np.abs(jr); jz=mc.nscore(jr if read=='MOVE' else ja); jm=pd.Series(ja).expanding(mc.MINMED).median().values; kk=cer.asof(days,jd,lag); ok=kk>=0; X[ok,j]=jz[kk[ok]]
            B[ok,j]=(jr[kk[ok]]>0) if read=='MOVE' else np.where(np.isnan(jm[kk[ok]]),np.nan,ja[kk[ok]]>jm[kk[ok]])
        pr=~np.isnan(X); P=np.where(pr,z[:,None]*X,0.0); cs=np.cumsum(P,0); cn=np.cumsum(pr,0); kin=np.zeros((n,J)); cnt=np.zeros((n,J)); kin[1:]=cs[:-1]; cnt[1:]=cn[:-1]       # kinship: running mean product of notes, from earlier steps only
        with np.errstate(divide='ignore',invalid='ignore'): kin=np.where(cnt>=MINKIN,kin/cnt,np.nan)
        ok=pr&~np.isnan(kin)&~np.isnan(B); score=np.where(ok,np.abs(kin),-1.0); order=np.argsort(-score,1,kind='stable')[:,:KIN]
        for m in range(min(KIN,J)):
            j=order[:,m]; rows=np.arange(n); good=score[rows,j]>=0; b=B[rows,j]
            line=np.where(kin[rows,j]>=0,b,1-b) if read=='MOVE' else b                        # direction: did the kin move the way it usually moves with this subject
            Sb|=np.where(good,np.nan_to_num(line).astype(int)<<m,0); Sm+=good.astype(int)   # kin are taken in order, so the lines present are always the first Sm
        oday=np.r_[days[1:],days[-1]+1]; day=days
    else: day=np.arange(n); oday=day+1
    out.update(S=Sb,Sm=Sm,day=day,oday=oday); return out
def events(S, H, read, until=None):
    """Every call of a read, in the order the world met them."""
    rows=[]; forests={'markets':0,'weather':1}
    for t,(cls,_,sid,dt,r) in enumerate(S):
        h=H[(H.series_id==sid)&(H['read']==read)].sort_values('step'); A=addresses(S,sid,read); st=h.step.values
        d=pd.DataFrame(dict(tree=t,forest=forests.get(cls,-1),series_id=sid,step=st,day=A['day'][st],oday=A['oday'][st],y=h.outcome.values.astype(float),q0=h.null_probability.values,T0=A['T0'][st],T1=A['T1'][st],T2=A['T2'][st],S=A['S'][st],Sm=A['Sm'][st]))
        rows.append(d)
    E=pd.concat(rows,ignore_index=True)
    if until is not None: E=E[(E.forest<0)|(E.oday<=until)]
    return E
def pass_(E, shift=0):
    """One pass. Returns voices [calls x address types x levels] in E's row order, and seconds per tenth of the calls."""
    E=E.reset_index(drop=True); y=E.y.values.copy()
    if shift: y=E.groupby('tree').y.shift(shift).values
    dated=E[E.forest>=0].sort_values(['day','tree'],kind='stable').index.values; undated=E[E.forest<0].sort_values(['tree','step'],kind='stable').index.values; order=np.r_[dated,undated]
    tal={}; pend=[]; V=np.zeros((len(E),len(TYPES),3)); tree=E.tree.values; forest=E.forest.values; day=E.day.values; oday=E.oday.values; q0=E.q0.values; T=[E.T0.values,E.T1.values,E.T2.values]; Sb=E.S.values; Sm=E.Sm.values; clock=[]; t0=time.time(); seq=0
    def get(key,size):
        v=tal.get(key)
        if v is None: v=tal[key]=np.zeros((2,size))
        return v
    for c,i in enumerate(order):
        if c%max(1,len(order)//10)==0: clock.append(time.time()-t0)
        f=forest[i]
        if f>=0:
            while pend and pend[0][0]<day[i]:                                    # another tree's evidence is used only once its outcome is dated before today
                _,_,key_f,key_w,size,s,res=heapq.heappop(pend); a=get(key_f,size); a[0,s]+=res; a[1,s]+=1; a=get(key_w,size); a[0,s]+=res; a[1,s]+=1
        addr=[]
        for k in range(3):
            if T[k][i]>=0: addr.append((k,f'T{k}',6,int(T[k][i])))
        if Sm[i]>0:
            addr.append((3,f'S{Sm[i]}',int(Sm[i]),int(Sb[i])))
            if T[0][i]>=0: addr.append((4,f'TS{Sm[i]}',6+int(Sm[i]),int(T[0][i])|(int(Sb[i])<<6)))
        lq=mc.lgv(q0[i])
        for ti,name,m,s in addr:
            size=1<<m; Kr=RP[POP[s^AR[m]]]; at=get((name,'t',tree[i]),size); nt,dt_=Kr@at[0],Kr@at[1]
            if f>=0: af=get((name,'f',f),size); aw=get((name,'w'),size); nf,df,nw,dw=Kr@af[0],Kr@af[1],Kr@aw[0],Kr@aw[1]
            else: nf=df=nw=dw=0.0
            d_w=nw/(dw+KAPPA); d_fw=(nf+KAPPA*d_w)/(df+KAPPA); d_f=nf/(df+KAPPA)
            for li,d in enumerate((nt/(dt_+KAPPA),(nt+KAPPA*d_f)/(dt_+KAPPA),(nt+KAPPA*d_fw)/(dt_+KAPPA))): V[i,ti,li]=mc.lgv(np.clip(q0[i]+d,0.01,0.99))-lq
            if not np.isnan(y[i]):
                res=y[i]-q0[i]; at[0,s]+=res; at[1,s]+=1                         # its own evidence is known at its next bar
                if f>=0: seq+=1; heapq.heappush(pend,(int(oday[i]),seq,(name,'f',f),(name,'w'),size,s,res))
    clock.append(time.time()-t0); return V,clock
def job(a):
    read,shift,until=a; S,_=R.series_list(); H=pd.read_parquet(os.path.join(HERE,'replay','hex7_ledger.parquet')); E=events(S,H,read,until); V,clock=pass_(E,shift); return read,shift,until,E,V,clock
if __name__=='__main__':
    t0=time.time(); jobs=[(rd,s,None) for rd in ('MOVE','RANGE') for s in (0,)+SHIFTS]+[('MOVE',0,11000),('MOVE',0,17500)]      # the last two: the world cut off at a date, for the no-future check
    with mp.Pool(2) as pool: res=pool.map(job,jobs,chunksize=1)
    M1=pd.read_parquet(os.path.join(OUT,'ledger.parquet')); frames=[]; meta={'clock':{},'N1':{}}
    full={(rd,s):(E,V) for rd,s,u,E,V,c in res if u is None}
    for rd,s,u,E,V,c in res:
        if u is None: meta['clock'][f'{rd} shift {s}']=[round(x,1) for x in c]
        else:
            E0,V0=full[(rd,0)]; k=E.merge(E0.reset_index().rename(columns={'index':'row0'})[['series_id','step','row0']],on=['series_id','step'])
            meta['N1'][f'cut at day {u}']=dict(calls=int(len(E)),dated_calls=int((E.forest>=0).sum()),largest_difference=float(np.abs(V-V0[k.row0.values]).max()))
    for rd in ('MOVE','RANGE'):
        E,V=full[(rd,0)]; d=E[['series_id','step','tree','forest']].copy(); d['read']=rd
        for ti,tn in enumerate(TYPES):
            for li,ln in enumerate(LEVELS): d[f'a_{tn}_{ln}']=V[:,ti,li].astype(np.float32)
            for s in SHIFTS: d[f'c{s}_{tn}']=full[(rd,s)][1][:,ti,2].astype(np.float32)
        d['Sm']=E.Sm.values; frames.append(d)
    A=pd.concat(frames,ignore_index=True); L=M1.merge(A,on=['series_id','read','step'],how='left',validate='one_to_one'); assert len(L)==len(M1) and L.a_T0_tree.notna().all()
    print('passes done',round(time.time()-t0),'s',meta['N1'],flush=True)
    # the arms, per series and read, on HEX's own call
    def fuse_one(g):
        g=g.sort_values('step'); y=g.y.values.astype(int); ph=g.p_hex.values; o={}
        W=g[[f'a_{t}_world' for t in TYPES]].values.astype(float)
        for ln in LEVELS: o['p_'+ln.upper()]=mc.fuse(ph,y,[g[[f'a_{t}_{ln}' for t in TYPES]].values.astype(float)])[0]
        for ti,t in enumerate(TYPES): o['p_only_'+t]=mc.fuse(ph,y,[W[:,[ti]]])[0] if np.any(W[:,ti]) else ph.copy()
        for s in SHIFTS: o[f'p_W_CONTROL{s}']=mc.fuse(ph,y,[g[[f'c{s}_{t}' for t in TYPES]].values.astype(float)])[0]
        F=np.nan_to_num(g[[c for c in g.columns if c.startswith('v_')]].values.astype(float)); names=[c[2:] for c in g.columns if c.startswith('v_')]; G=[F[:,[i for i,nm in enumerate(names) if f(nm)]] for f in mc.GROUPS.values()]
        o['p_BOTH']=mc.fuse(ph,y,G+[F,W,np.c_[F,W]])[0]; return pd.DataFrame(o,index=g.index)
    parts=[fuse_one(g) for _,g in L.groupby(['series_id','read'])]; L=L.join(pd.concat(parts)); L.to_parquet(os.path.join(OUT,'ledger2.parquet'),index=False)
    meta['seconds']=round(time.time()-t0); meta['calls']=int(len(L)); json.dump(meta,open(os.path.join(OUT,'meta2.json'),'w'),indent=1); print('done',meta['seconds'],'s')
