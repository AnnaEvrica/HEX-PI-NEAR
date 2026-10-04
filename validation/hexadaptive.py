# ===========================================================================
# state-6.3: HEX with the observer's baseline. Reference implementation
# (base44/shared/stateProbability.ts with a baseline must match this to
# rounding; see parity_adaptive.py).
#
# The 64-state engine is unchanged except for one thing: the base rate each
# state's evidence is measured against. In 6.2 that is one decayed frequency
# (factor 0.999). Here it is the observer's baseline: a likelihood-weighted
# mixture of base rates at dyadic memories (half-lives 32..1024 steps, and
# none), plus the exchangeable rank rule for MOVE (rankcore.walk, 'null').
#   p = b_obs + (D_s + alpha*pull_D + K*delta_f[s]) / (N_s + alpha*pull_N + K)
# HEX makes the call. The observer never does.
# ===========================================================================
import numpy as np
from precision import keys, WM, AWM, WD, AWD
from pretrain import K, ALPHAS, LAM, G
from rankcore import walk as observe

def baseline(r, read):
    """Observer baseline per step index (nan where it has none yet), including the last index."""
    D,fin=observe(r,read,final=True); b=np.full(len(r),np.nan); b[D.i.values]=D['null'].values
    if fin is not None: b[len(r)-1]=fin[0]
    return b

def walk(r, tables, read):
    """Returns (i, p, b, y) rows for scored steps and the final (p, b) for the next step."""
    base=baseline(r,read); r_,a,med,kd,km,kw=keys(r); n=len(r); size=(read=='RANGE'); S=64 if size else 128
    W=WM if size else WD; AW=AWM if size else AWD
    d0=[np.zeros(S)]+[t['size' if size else 'dir'] for t in tables]; nf=len(d0); na=len(ALPHAS)
    w0=np.concatenate([np.full(na,0.5/na)]+[np.full(na,0.5/max(1,nf-1)/na) for _ in range(nf-1)]) if nf>1 else np.full(na,1/na)
    lw0=np.log(w0); L=np.zeros(len(w0)); D=np.zeros(S); N=np.zeros(S); rows=[]; fin=None
    for i in range(12,n):
        s=km[i] if size else kd[i]
        if size and not (i>25 and s>=0): continue
        b=base[i]
        if np.isnan(b): continue
        pd_=W[s]@D; pn=AW[s]@N
        Q=np.clip([b+(D[s]+al*pd_+K*d[s])/(N[s]+al*pn+K) for d in d0 for al in ALPHAS],.01,.99); z=L+lw0; w=np.exp(z-z.max()); w/=w.sum(); p=float(w@Q)
        if i==n-1: fin=(p,float(b)); break
        if size and np.isnan(med[i]): continue
        y=int(a[i+1]>med[i]) if size else int(r[i+1]>0)
        rows.append((i,p,float(b),y))
        L=G*L+np.log(np.where(y,Q,1-Q)); D*=LAM; N*=LAM; D[s]+=y-b; N[s]+=1
    return rows,fin
