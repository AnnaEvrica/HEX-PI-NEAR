# ===========================================================================
# Compositional memory as voices in HEX's learning loop. Research only
# (prereg_memory.md). Nothing here is product code and nothing here changes
# HEX 7.0, CER, the ledger or governance.
#
#   notes      normal score of the read's own variable against its own past
#   cube       the six-line state at scales 0, 1, 2 and the 6.5 estimator on it
#   knn        the 64 nearest earlier phrases, chords or run states, causal
#   voices     every voice of a series and read, as log-odds against the base rate
#   fuse       HEX's own learner with HEX's call as offset and voices as experts
# ===========================================================================
import numpy as np, pandas as pd, math
from scipy.special import ndtri
import hex7core as h7, cercore as cer
K=64; RHO=0.25; KPRIOR=64.0; SCALES=(0,1,2); PHRASES=(6,36); STALE=5; GAP=5; MINMED=20
lgv=lambda p: np.log(np.clip(p,1e-6,1-1e-6)/(1-np.clip(p,1e-6,1-1e-6)))
def nscore(v):
    """Normal score of each value against all values so far (causal)."""
    s=pd.Series(np.floor(np.asarray(v,float)*1e9+0.5)/1e9); u=(s.expanding().rank().values-0.5)/np.arange(1,len(s)+1); return ndtri(np.clip(u,1e-6,1-1e-6))
POP=np.array([bin(i).count('1') for i in range(64)]); DH=POP[np.arange(64)[:,None]^np.arange(64)[None,:]]
KPLAIN=np.where(DH==0,1.0,RHO**DH); KODD=KPLAIN-np.where(DH==6,1.0,RHO**(6-DH))
def states(r, a, med, read, k):
    """The six-line own state of every step at scale k (a line summarises 6^k steps). -1 where there is not yet enough history."""
    n=len(r); b=6**k; cs=np.r_[0,np.cumsum(r)]; ca=np.r_[0,np.cumsum(a)]; s=np.full(n,-1,int); t=np.arange(6*b-1,n)
    if not len(t): return s
    v=np.zeros(len(t),int)
    for m in range(6):
        hi=t+1-m*b; lo=hi-b; line=(cs[hi]-cs[lo]>0) if read=='MOVE' else ((ca[hi]-ca[lo])/b>med[t])
        v|=line.astype(int)<<m
    ok=~np.isnan(med[t]) if read=='RANGE' else np.ones(len(t),bool); s[t[ok]]=v[ok]; return s
def cube(s, seq, q0):
    """The 6.5 estimator on the cube, plain and odd kernels: for each step, what the states near this one were followed by. seq, q0: per step, nan where there was no call."""
    n=len(s); D=np.zeros(64); N=np.zeros(64); out=np.full((n,2),np.nan)
    for i in range(n):
        if s[i]<0 or np.isnan(q0[i]): continue
        for c,Kk in enumerate((KPLAIN,KODD)):
            d=(Kk[s[i]]@D)/(np.abs(Kk[s[i]])@N+KPRIOR); out[i,c]=lgv(np.clip(q0[i]+d,0.01,0.99))-lgv(q0[i])
        if not np.isnan(seq[i]): D[s[i]]+=seq[i]-q0[i]; N[s[i]]+=1          # what followed step i is known before the call at i + 1
    return out
def knn(Q, L, seq, avail, need=None, chunk=400):
    """For each row i of Q, the K nearest rows j of L that may be recalled at i (avail[j] <= i, seq[j] known): distance mean((q - l)^2 / 2)
    over the coordinates both have. need: fewest shared coordinates (default: all of Q's). Returns (share of seq among them, shrunk; nearest distance)."""
    n,D=Q.shape; Ml=~np.isnan(L); L0=np.where(Ml,L,0.0); L2=L0*L0; Mlf=Ml.astype(float); ok=~np.isnan(seq); s0=np.where(ok,seq,0.0); p=np.full(n,np.nan); dm=np.full(n,np.nan); J=np.arange(L.shape[0])
    for a in range(0,n,chunk):
        R=np.arange(a,min(n,a+chunk)); Mq=~np.isnan(Q[R]); Q0=np.where(Mq,Q[R],0.0); C=Mq.astype(float)@Mlf.T; S=(Q0*Q0)@Mlf.T+Mq.astype(float)@L2.T-2*Q0@L0.T
        nd=(Mq.sum(1) if need is None else np.maximum(need[0],np.ceil(need[1]*Mq.sum(1))))[:,None]
        with np.errstate(divide='ignore',invalid='ignore'): d=np.round(np.maximum(S,0)/(2*C),10)
        bad=(C<nd)|(C<1)|(avail[None,:]>R[:,None])|(~ok[None,:]); d=d+1e-12*(R[:,None]-J[None,:]); d[bad]=np.inf           # among equals, the more recent
        cnt=(~bad).sum(1); go=np.where(cnt>=2*K)[0]
        if not len(go): continue
        ix=np.argpartition(d[go],K-1,axis=1)[:,:K]; p[R[go]]=(s0[ix].sum(1)+1)/(K+2); dm[R[go]]=np.take_along_axis(d[go],ix,1).min(1)
    return p,dm
def phrase(z, L):
    n=len(z); E=np.full((n,L),np.nan)
    for m in range(L): E[m:,L-1-m]=z[:n-m]
    E[:L-1]=np.nan; return E
def voices(r, read, steps, y, q0, days=None, neighbours=(), lag=0, shift=0):
    """Every voice for every call. r: the series' changes. steps, y, q0: HEX's calls (step index, outcome, null). neighbours: [(days, changes)].
    shift: 0, or the control (what followed each recalled moment is taken from `shift` calls earlier). Returns (F [calls x voices], names, diagnostics)."""
    r=np.asarray(r,float); n=len(r); a=np.abs(r); med=pd.Series(a).expanding(MINMED).median().values; own=r if read=='MOVE' else a; z=nscore(own)
    seq=np.full(n,np.nan); yq=np.asarray(y,float)
    if shift: yq=np.r_[np.full(shift,np.nan),yq[:-shift]]
    seq[steps]=yq; qs=np.full(n,np.nan); qs[steps]=q0; avail=np.arange(n)+1
    known=np.where(np.isnan(seq),0.0,seq); cnt=np.cumsum(~np.isnan(seq)); base=(np.r_[0,np.cumsum(known)[:-1]]+1)/(np.r_[0,cnt[:-1]]+2)        # running base rate of what has been revealed before each step
    V={}; diag={}
    def put(name, p): V[name]=lgv(p)-lgv(base)
    for k in SCALES:
        c=cube(states(r,a,med,read,k),seq,qs); V[f'cube{k}']=c[:,0]; V[f'cube{k}odd']=c[:,1]
    for L in PHRASES:
        E=phrase(z,L); p,dm=knn(E,E,seq,avail); put(f'melody{L}',p); diag[f'melody{L}']=dm
        p,dm=knn(-E,E,1-seq,avail); put(f'inversion{L}',p); diag[f'inversion{L}']=dm
    if read=='MOVE':
        z2=np.r_[np.nan,(z[1:]+z[:-1])/math.sqrt(2)]; A=np.full((n,6),np.nan)
        for m in range(6): A[2*m+1:,5-m]=z2[1:n-2*m]
        A[:11]=np.nan; s2=np.full(n,np.nan); s2[:n-2]=(r[1:n-1]+r[2:n]>0).astype(float); s2[np.isnan(np.r_[seq[1:],np.nan])|np.isnan(seq)]=np.nan
        if shift: s2=np.r_[np.full(shift,np.nan),s2[:-shift]]
        p,dm=knn(phrase(z,6),A,s2,avail+1); put('augmentation6',p); diag['augmentation6']=dm
    quiet=np.where(np.isnan(med),np.nan,(a<=med).astype(float)); X=np.full((n,1+len(neighbours)),np.nan); X[:,0]=z; nq=np.full((n,len(neighbours)),np.nan)
    if days is not None:
        for j,(jd,jr) in enumerate(neighbours):
            jr=np.asarray(jr,float); ja=np.abs(jr); jz=nscore(jr if read=='MOVE' else ja); jm=pd.Series(ja).expanding(MINMED).median().values; kk=cer.asof(days,jd,lag); ok=(kk>=0)
            ok[ok]&=(days[ok]-lag-jd[kk[ok]])<=STALE; X[ok,1+j]=jz[kk[ok]]; qq=np.where(np.isnan(jm),np.nan,(ja<=jm).astype(float)); nq[ok,j]=qq[kk[ok]]       # a stale neighbour is absent, not sustained
    if len(neighbours):
        p,dm=knn(X,X,seq,avail,need=(2,0.5)); put('chord',p); diag['chord']=dm
        P=np.full((n,6*X.shape[1]),np.nan)
        for m in range(6): P[m:,(5-m)*X.shape[1]:(6-m)*X.shape[1]]=X[:n-m]
        P[:5]=np.nan; p,dm=knn(P,P,seq,avail,need=(12,0.5)); put('progression6',p); diag['progression6']=dm
    else: V['chord']=np.full(n,np.nan); V['progression6']=np.full(n,np.nan)
    run=np.full(n,np.nan); cur=0; st=np.nan; unknown=True                         # silence: the present quiet or active run, in doublings
    for i in range(n):
        if np.isnan(quiet[i]): continue
        gap=days is not None and i>0 and days[i]-days[i-1]>GAP
        if quiet[i]!=st or gap: unknown=gap or np.isnan(st); st=quiet[i]; cur=1
        else: cur+=1
        if not unknown: run[i]=(-1 if st==1 else 1)*math.log2(1+cur)
    m=(~np.isnan(nq)).sum(1); share=np.where(m>0,(np.nansum(nq,1)/np.maximum(m,1)-0.5)/np.sqrt(0.25/np.maximum(m,1)),np.nan); Sx=np.stack([run,share],1); Sx[np.isnan(run)]=np.nan
    p,dm=knn(Sx,Sx,seq,avail,need=(1,0.5)); put('silence',p); diag['silence']=dm
    names=list(V); F=np.nan_to_num(np.stack([V[k][steps] for k in names],1)); return F,names,{k:v[steps] for k,v in diag.items()}
GROUPS={'CUBE':lambda nm: nm.startswith('cube'),'MEL':lambda nm: nm.startswith(('melody','inversion','augmentation','silence')),'CHORD':lambda nm: nm.startswith(('chord','progression'))}
def fuse(off, y, G):
    """HEX's learner: one online logistic regression per group in G (nine prior scales, mixed by likelihood) on the offset `off`, mixed with the offset itself by the fixed-share mixture."""
    M=len(G); d=max(g.shape[1] for g in G); R=h7.Residual(M,d); A=h7.Share(M+1); X=np.zeros((M,d)); n=len(y); p=np.zeros(n)
    for t in range(n):
        for m,g in enumerate(G): X[m,:g.shape[1]]=g[t]
        o=float(np.clip(off[t],0.01,0.99)); V=np.r_[o,R.predict(X,h7.lg(o))]; p[t]=A.predict(V); R.update(int(y[t])); A.update(V,int(y[t]))
    return p,A.influence()
def conventional(r, read, steps, y, shift=0):
    """The conventional memory: the 64 nearest earlier windows of the series' own last 8 notes."""
    r=np.asarray(r,float); n=len(r); z=nscore(r if read=='MOVE' else np.abs(r)); seq=np.full(n,np.nan); yq=np.asarray(y,float)
    if shift: yq=np.r_[np.full(shift,np.nan),yq[:-shift]]
    seq[steps]=yq; known=np.where(np.isnan(seq),0.0,seq); cnt=np.cumsum(~np.isnan(seq)); base=(np.r_[0,np.cumsum(known)[:-1]]+1)/(np.r_[0,cnt[:-1]]+2)
    E=phrase(z,8); p,_=knn(E,E,seq,np.arange(n)+1); return np.nan_to_num((lgv(p)-lgv(base))[steps])[:,None]
def arms(F, names, conv, y, p_hex, q0):
    """Every arm's call for one series and read."""
    g={k:F[:,[i for i,nm in enumerate(names) if f(nm)]] for k,f in GROUPS.items()}; out={}
    out['CONV']=fuse(p_hex,y,[conv])[0]
    for k in GROUPS: out[k]=fuse(p_hex,y,[g[k]])[0] if g[k].shape[1] and np.any(g[k]) else np.asarray(p_hex,float).copy()
    full=[g['CUBE'],g['MEL'],g['CHORD'],F]; out['FULL'],infl=fuse(p_hex,y,full); out['ALONE']=fuse(q0,y,full)[0]; return out,infl
