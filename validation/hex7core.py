# ===========================================================================
# HEX PI 7.0 — reference implementation (base44/shared/hex7.ts must match
# this to rounding; see parity_hex7.py and tests/parity.mjs).
#
#     logit p = logit q0 + beta . Z
#
#   q0     the null: what the series' own record already implies
#          (seven memories mixed by likelihood; MOVE adds the position rule)
#   Z      where the present value sits among its surroundings: midranks in
#          windows of 2..64 values and in all history, mapped to (-1, 1),
#          for the level and for the size of the change
#   beta   learned online (logistic regression, nine prior scales mixed by
#          likelihood); two models: own ranks, own + the other observable
#   call   the null and the two models mixed with reversible influence
#          (fixed share at five rates, the rates mixed by likelihood)
#   clock  where the series carries dates, a fourth voice joins the mixture:
#          the second model's coordinates and nine for the date of the latest
#          finished step (day of the week, time of year). No dates: no clock,
#          and the call is the three-voice call exactly.
# Every quantity at step i uses the series up to i only. Order per step:
# predict, (outcome arrives), score, learn.
# ===========================================================================
import numpy as np, pandas as pd, math, hashlib
WINS=(2,4,8,16,32,64); NZ=len(WINS)+1; TAUS=2.0**np.arange(-4,5); HALF=(32,64,128,256,512,1024,None); FIRST=26; MIN_MED=20
ALPHAS=(0.0,0.001,0.005,0.02,0.05); BURN=500; NC=9
def calendar(days):
    """C: nine coordinates of a date given as whole days since 1 January 1970: the day of the week as seven indicators (Monday first), and the sine and cosine of the time of year."""
    d=np.asarray(days,np.int64); ang=2*np.pi*d/365.25; return np.c_[np.eye(7)[(d+3)%7],np.sin(ang),np.cos(ang)]
clip=lambda p: np.clip(p,.01,.99)
def lg(p): p=min(max(p,1e-6),1-1e-6); return math.log(p/(1-p))
def ranks(v):
    """Z: midrank of each value among the last w values (w = 2..64) and among all values so far, as 2(rank - 1/2)/w - 1. Zero until a window is full.
    Values are rounded to nine decimals first, so that a level returning exactly to an earlier level ranks as a tie whatever the arithmetic that produced it."""
    s=pd.Series(np.floor(np.asarray(v,float)*1e9+0.5)/1e9); n=len(s); cols=[(2*(s.rolling(w).rank()-0.5)/w-1).values for w in WINS]
    cols.append((2*(s.expanding().rank()-0.5)/np.arange(1,n+1)-1).values); return np.nan_to_num(np.stack(cols,1))

class Share:
    """Mixture with reversible influence. One fixed-share mixture per rate; the rates mixed by likelihood. Rate 0 is the plain Bayesian mixture."""
    def __init__(s,n,alphas=ALPHAS): s.a=np.array(alphas)[:,None]; s.w=np.full((len(alphas),n),1.0/n); s.ll=np.zeros(len(alphas)); s.n=n
    def weights(s): o=np.exp(s.ll-s.ll.max()); return o/o.sum()
    def predict(s,P): s.q=s.w@P; s.o=s.weights(); return float(s.o@s.q)
    def update(s,P,y):
        s.ll+=np.log(np.where(y,s.q,1-s.q)); w=s.w*np.where(y,P,1-P)[None,:]; w/=w.sum(1,keepdims=True); s.w=(1-s.a)*w+s.a/s.n
    def influence(s): return s.weights()@s.w                                   # each expert's current share of the call

class Residual:
    """M online logistic regressions (model m sees its own zero-padded features), each at nine prior scales mixed by likelihood."""
    def __init__(s,M,d): s.T=len(TAUS); s.P=np.tile(np.stack([np.eye(d)*t for t in TAUS])[None],(M,1,1,1)); s.th=np.zeros((M,s.T,d)); s.ll=np.zeros((M,s.T))
    def mix(s): w=np.exp(s.ll-s.ll.max(1,keepdims=True)); return w/w.sum(1,keepdims=True)
    def predict(s,X,off): s.X=X; s.q=clip(1/(1+np.exp(-(off+np.einsum('mtd,md->mt',s.th,X))))); return (s.mix()*s.q).sum(1)
    def update(s,y):
        q=s.q; X=s.X; s.ll+=np.log(np.where(y,q,1-q)); wt=q*(1-q); Px=np.einsum('mtij,mj->mti',s.P,X); den=1+wt*np.einsum('mti,mi->mt',Px,X)
        s.P-=(wt/den)[:,:,None,None]*Px[:,:,:,None]*Px[:,:,None,:]; s.th+=np.einsum('mtij,mj->mti',s.P,X)*(y-q)[:,:,None]
    def beta(s): return (s.mix()[:,:,None]*s.th).sum(1)                         # the coefficients in force, per model

def walk(r, read, detail=False, days=None):
    """One series, one read, one pass. Returns (rows, final).
    rows: one dict per scored step: i, y, null, rank, cross, p, p_frozen (and coefficients, influence, state hash when detail=True).
    final: the call for the step that has not happened: dict(null, rank, cross, p, beta, influence).
    days: the date of each step, as whole days since 1 January 1970 (days[i] is the date r[i] was completed). Given, the clock joins: rows and final also carry
    clock (the fourth voice) and p3 (the call without it), p is the four-voice call, and influence has four entries. p_frozen stays the three-voice engine's."""
    r=np.asarray(r,float); n=len(r); x=np.cumsum(r); a=np.abs(r); med=pd.Series(a).expanding(MIN_MED).median().values
    own,oth=(x,a) if read=='MOVE' else (a,x); Zo=ranks(own); Zx=ranks(oth)
    if read=='MOVE': cnt=np.arange(1,n+1); qpos=clip((cnt-pd.Series(np.floor(x*1e9+0.5)/1e9).expanding().rank(method='max').values+1)/(cnt+1))
    rho=np.array([1.0 if h is None else 0.5**(1.0/h) for h in HALF]); U=np.zeros(len(HALF)); N=np.zeros(len(HALF)); ne=len(HALF)+(read=='MOVE'); lln=np.zeros(ne)
    R=Residual(2,2*NZ); X=np.zeros((2,2*NZ)); A=Share(3); rows=[]; final=None; frozen=None; scored=0
    dated=days is not None
    if dated:
        if len(days)!=n: raise ValueError('days must have one entry per step')
        Cal=calendar(days); Rc=Residual(1,2*NZ+NC); Xc=np.zeros((1,2*NZ+NC)); Ac=Share(4)
    for i in range(FIRST,n):
        if read=='RANGE' and np.isnan(med[i]): continue
        # ---- predict
        b=clip((U+1)/(N+2)); ex=np.r_[b,qpos[i]] if read=='MOVE' else b; w0=np.exp(lln-lln.max()); w0/=w0.sum(); q0=float(w0@ex)
        X[0,:NZ]=Zo[i]; X[1,:NZ]=Zo[i]; X[1,NZ:]=Zx[i]; m=R.predict(X,lg(q0)); V=np.array([q0,m[0],m[1]]); p=p3=A.predict(V)
        if dated: Xc[0,:2*NZ]=X[1]; Xc[0,2*NZ:]=Cal[i]; mc=float(Rc.predict(Xc,lg(q0))[0]); Vc=np.array([q0,m[0],m[1],mc]); p=Ac.predict(Vc)
        if frozen is not None:                                                    # the same engine with its learning stopped after BURN calls; the null still moves
            th,mixw,aw,ao=frozen; qf=clip(1/(1+np.exp(-(lg(q0)+np.einsum('mtd,md->mt',th,X))))); pf=float(ao@(aw@np.array([q0,(mixw[0]*qf[0]).sum(),(mixw[1]*qf[1]).sum()])))
        else: pf=p3
        if i==n-1:
            final=dict(null=q0,rank=float(m[0]),cross=float(m[1]),p=p,beta=R.beta()[1].copy(),influence=(Ac if dated else A).influence().copy(),memories=(ex.copy(),w0.copy()))
            if dated: final.update(clock=mc,p3=p3,beta_clock=Rc.beta()[0].copy())
            break
        # ---- the outcome arrives; score is taken by the caller from this row; then learn
        y=int(r[i+1]>0) if read=='MOVE' else int(a[i+1]>med[i])
        row=dict(i=i,y=y,null=q0,rank=float(m[0]),cross=float(m[1]),p=p,p_frozen=pf)
        if dated: row['clock']=mc; row['p3']=p3
        if detail:
            row['beta']=R.beta()[1].copy(); row['influence']=(Ac if dated else A).influence().copy()
            row['state_hash']=hashlib.sha256(b''.join(np.ascontiguousarray(v).tobytes() for v in (R.th,R.ll,A.w,A.ll,lln,U,N)+((Rc.th,Rc.ll,Ac.w,Ac.ll) if dated else ()))).hexdigest()[:16]
        rows.append(row)
        lln+=np.log(np.where(y,ex,1-ex)); R.update(y); A.update(V,y)
        if dated: Rc.update(y); Ac.update(Vc,y)
        U=rho*U+y; N=rho*N+1; scored+=1
        if scored==BURN: frozen=(R.th.copy(),R.mix().copy(),A.w.copy(),A.weights().copy())
    return rows,final
