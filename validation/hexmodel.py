# ===========================================================================
# state-6.4: HEX as an explicit model. Reference implementation
# (base44/shared/hex.ts must match this to rounding; see parity_hex.py).
#
#   state     s = the six-line pattern of the last six steps (64 states)
#   model     y ~ Bernoulli(b + delta_s), b = the observer's baseline
#   estimate  local-likelihood Beta-Bernoulli posterior mean on the 6-cube:
#               p = b + sum_j k(s,j) D_j / ( sum_j |k(s,j)| N_j + K )
#             D_j, N_j: exponentially discounted sums of (y - b) and of 1
#             k: diffusion kernel rho^d, or its odd part rho^d - rho^(6-d)
#   mixture   96 candidates (rho x symmetry x K x half-life), Bayesian
#             likelihood weights from a uniform start
# ===========================================================================
import numpy as np, itertools
from precision import keys
from hexadaptive import baseline
RHO=(0.0,0.125,0.25,0.5); SYM=('plain','odd'); KS=(16.0,64.0,256.0); HALF=(64,256,1024,None)
S=64; HAM=np.array([[bin(a^b).count('1') for b in range(S)] for a in range(S)])
def kernel(rho,sym):
    k=np.where(HAM==0,1.0,rho**HAM) if rho>0 else (HAM==0).astype(float)
    if sym=='odd': k=k-(np.where(HAM==6,1.0,rho**(6-HAM)) if rho>0 else (HAM==6).astype(float))
    return k
KERN=np.stack([kernel(r,s) for r in RHO for s in SYM]); AKERN=np.abs(KERN); NKER=len(KERN)       # (8,64,64)
DISC=np.array([1.0 if h is None else 0.5**(1.0/h) for h in HALF]); NH=len(HALF); NK=len(KS)
NE=NKER*NH*NK
LABELS=[(r,s,h,k) for r in RHO for s in SYM for h in HALF for k in KS]                             # order: kernel, half-life, K

def states(r, read):
    r_,a,med,kd,km,kw=keys(r)
    return (km if read=='RANGE' else np.where(kd>=0,kd>>1,-1)),a,med

def walk(r, read, base=None, weights=False):
    """Rows (i, p, b, y) for scored steps and the final (p, b). weights=True also returns final mixture weights."""
    r=np.asarray(r,float); n=len(r); st,a,med=states(r,read); b_all=baseline(r,read) if base is None else base
    D=np.zeros((NH,S)); N=np.zeros((NH,S)); L=np.zeros(NE); rows=[]; fin=None; Kv=np.array(KS)
    for i in range(12,n):
        s=st[i]
        if s<0 or (read=='RANGE' and i<=25): continue
        b=b_all[i]
        if np.isnan(b): continue
        num=KERN[:,s,:]@D.T; den=AKERN[:,s,:]@N.T                                  # (8,4)
        P=np.clip(b+num[:,:,None]/(den[:,:,None]+Kv[None,None,:]),.01,.99).ravel()   # kernel, half-life, K
        w=np.exp(L-L.max()); w/=w.sum(); p=float(w@P)
        if i==n-1: fin=(p,float(b)); break
        if read=='RANGE' and np.isnan(med[i]): continue
        y=int(a[i+1]>med[i]) if read=='RANGE' else int(r[i+1]>0)
        rows.append((i,p,float(b),y))
        L+=np.log(np.where(y,P,1-P)); D*=DISC[:,None]; N*=DISC[:,None]; D[:,s]+=y-b; N[:,s]+=1
    if weights:
        w=np.exp(L-L.max()); w/=w.sum(); return rows,fin,w
    return rows,fin
