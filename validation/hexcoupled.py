# ===========================================================================
# state-6.5: state-6.4 with the two reads coupled. Reference implementation
# (base44/shared/hex.ts must match this to rounding; see parity_coupled.py).
#
# state-6.4 reads one pattern: the read's own six lines. state-6.5 reads three
# and lets one Bayesian mixture weigh them:
#   own    the read's own six lines                      (state-6.4)
#   other  the other read's six lines
#   both   the three latest lines of each
# Each pattern has its own evidence and the same 96 candidates as state-6.4
# (kernel x half-life x prior strength), so 288 in all, from a uniform start.
# The cumulative log loss is within ln 288 of the best single candidate.
# Tested in core10.py and core10b.py (prereg_core10.md).
# ===========================================================================
import numpy as np, pandas as pd
from precision import keys
from hexadaptive import baseline
import hexmodel as hm
S=64; PATTERNS=('own','other','both'); PER=hm.NE; NE=PER*len(PATTERNS)
def patterns(r, read):
    _,a,med,kd,km,kw=keys(r); dirs=np.where(kd>=0,kd>>1,-1); size=km
    own,other=(size,dirs) if read=='RANGE' else (dirs,size); ok=(dirs>=0)&(size>=0)
    return [np.where(ok,own,-1),np.where(ok,other,-1),np.where(ok,((own&7)<<3)|(other&7),-1)],a,med
def walk(r, read, base=None, weights=False):
    """Rows (i, p, b, y) for scored steps and the final (p, b). weights=True also returns final mixture weights (pattern, kernel, half-life, K)."""
    r=np.asarray(r,float); n=len(r); sts,a,med=patterns(r,read); b_all=baseline(r,read) if base is None else base; Kv=np.array(hm.KS)
    D=[np.zeros((hm.NH,S)) for _ in sts]; N=[np.zeros((hm.NH,S)) for _ in sts]; L=np.zeros(NE); rows=[]; fin=None
    for i in range(26,n):
        if sts[0][i]<0: continue
        b=b_all[i]
        if np.isnan(b): continue
        P=np.concatenate([np.clip(b+(hm.KERN[:,st[i],:]@D[g].T)[:,:,None]/((hm.AKERN[:,st[i],:]@N[g].T)[:,:,None]+Kv[None,None,:]),.01,.99).ravel() for g,st in enumerate(sts)])
        w=np.exp(L-L.max()); w/=w.sum(); p=float(w@P)
        if i==n-1: fin=(p,float(b)); break
        if read=='RANGE' and np.isnan(med[i]): continue
        y=int(a[i+1]>med[i]) if read=='RANGE' else int(r[i+1]>0)
        rows.append((i,p,float(b),y)); L+=np.log(np.where(y,P,1-P))
        for g,st in enumerate(sts): D[g]*=hm.DISC[:,None]; N[g]*=hm.DISC[:,None]; D[g][:,st[i]]+=y-b; N[g][:,st[i]]+=1
    if weights:
        w=np.exp(L-L.max()); w/=w.sum(); return rows,fin,w
    return rows,fin
