# ===========================================================================
# rank-1: reference implementation of the rank core as shipped
# (base44/shared/rankCore.ts must match this to rounding; see parity_rank.py).
#
#   null   likelihood mixture of base rates at dyadic memories (half-lives
#          32..1024 and none); MOVE adds the exchangeable rank rule
#   core   logit p = logit null + beta . (7 window ranks, 5 block ranks),
#          online logistic regression, nine prior scales mixed by likelihood
#   gate   likelihood mixture of three: the null, the core offset by the null,
#          and the same core offset by the plain (no-forgetting) base rate
# Every quantity at step i uses the series up to i only.
# ===========================================================================
import numpy as np, pandas as pd, math
WINS=(2,4,8,16,32,64); BLK=(1,2,3,4,5); ND=len(WINS)+1+len(BLK)
TAUS=2.0**np.arange(-4,5); HALF=(32,64,128,256,512,1024,None); FIRST=26; MIN_MED=20
CLIP=(0.01,0.99)
clip=lambda p: np.clip(p,*CLIP)
def lg(p): p=min(max(p,1e-6),1-1e-6); return math.log(p/(1-p))

def rank_feats(v):
    s=pd.Series(np.asarray(v,float)); n=len(s); cols=[]
    for w in WINS: cols.append((2*(s.rolling(w).rank()-0.5)/w-1).values)
    cols.append((2*(s.expanding().rank()-0.5)/np.arange(1,n+1)-1).values)
    c=np.r_[0.0,np.cumsum(s.values)]                      # sequential cumulative sum; block means from differences
    for k in BLK:
        w=2**k; m=np.full(n,np.nan); m[w-1:]=(c[w:]-c[:-w])/w; m=pd.Series(m)
        cnt=m.notna().cumsum().replace(0,np.nan); cols.append((2*(m.expanding().rank()-0.5)/cnt-1).values)
    return np.nan_to_num(np.stack(cols,1))

class Core:
    """Online logistic regression, one copy per prior scale, mixed by likelihood."""
    def __init__(s,d):
        s.P=np.stack([np.eye(d)*t for t in TAUS]); s.th=np.zeros((len(TAUS),d)); s.ll=np.zeros(len(TAUS))
    def predict(s,x,off):
        s.q=clip(1/(1+np.exp(-(off+s.th@x)))); w=np.exp(s.ll-s.ll.max()); w/=w.sum(); return float(w@s.q)
    def update(s,x,y):
        q=s.q; s.ll+=np.log(np.where(y,q,1-q)); wt=q*(1-q); Px=s.P@x; den=1+wt*(Px@x)
        s.P-=(wt/den)[:,None,None]*Px[:,:,None]*Px[:,None,:]; s.th+=(s.P@x)*(y-q)[:,None]

def walk(r, read, null='three', final=False):
    """Per-step frame for one read ('MOVE' or 'RANGE'): i, y, base, null, core, p (gated).
    final=True also returns the call for the step after the last one: (null, core, p)."""
    r=np.asarray(r,float); n=len(r); x=np.cumsum(r); a=np.abs(r)
    if read=='MOVE':
        F=rank_feats(x); sx=pd.Series(x); cnt=np.arange(1,n+1)
        qrank=clip((cnt-sx.expanding().rank(method='max').values+1)/(cnt+1))
    else:
        F=rank_feats(a); med=pd.Series(a).expanding(MIN_MED).median().values
    rho=np.array([1.0 if h is None else 0.5**(1.0/h) for h in HALF]); U=np.zeros(len(HALF)); N=np.zeros(len(HALF))
    ne=len(HALF)+(1 if read=='MOVE' else 0); lln=np.zeros(ne); core=Core(ND); three=(null=='three'); core2=Core(ND) if three else None; llg=np.zeros(3 if three else 2); rows=[]
    fin=None
    for i in range(FIRST,n):
        last=(i==n-1)
        if read=='MOVE': y=None if last else int(r[i+1]>0)
        else:
            if np.isnan(med[i]): continue
            y=None if last else int(a[i+1]>med[i])
        b=clip((U+1)/(N+2)); base=float(b[-1])
        if null=='static': q0=base
        else:
            ex=np.r_[b,qrank[i]] if read=='MOVE' else b
            w=np.exp(lln-lln.max()); w/=w.sum(); q0=float(w@ex)
        pc=core.predict(F[i],lg(q0)); v=np.array([q0,pc,core2.predict(F[i],lg(base))]) if three else np.array([q0,pc]); wg=np.exp(llg-llg.max()); wg/=wg.sum(); p=float(wg@v)
        if last: fin=(q0,pc,p); break
        rows.append((i,y,base,q0,pc,p))
        if null!='static': lln+=np.log(np.where(y,ex,1-ex))
        llg+=np.log(np.where(y,v,1-v)); core.update(F[i],y); U=rho*U+y; N=rho*N+1
        if three: core2.update(F[i],y)
    D=pd.DataFrame(rows,columns=['i','y','base','null','core','p'])
    return (D,fin) if final else D
