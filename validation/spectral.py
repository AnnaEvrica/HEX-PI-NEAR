# ===========================================================================
# Spectral HEX: the exact posterior under the cube's diffusion prior.
#   delta_s = sum_A c_A chi_A(s),  chi_A(s) = (-1)^(number of lines of A set in s)
#   prior   c_A ~ N(0, tau^2 lambda^|A|)      (equivalently delta ~ GP with kernel rho^d)
#   data    y - b = delta_s + e,  Var e = b(1-b)
#   update  Kalman filter in 64 dimensions; forgetting as an Ornstein-Uhlenbeck relaxation toward the prior
#   mixture over (lambda, parity, tau^2, half-life), Bayesian weights, uniform start
# ===========================================================================
import numpy as np
S=64; ORD=np.array([bin(a).count('1') for a in range(S)])
CHI=np.array([[1.0 if bin(a&s).count('1')%2==0 else -1.0 for a in range(S)] for s in range(S)])    # CHI[s,A]
LAMS=(1/64,1/16,1/4,1.0); PAR=('all','odd','even'); TAUS=(2.0**-13,2.0**-10,2.0**-7); HALF=(256,None)
CAND=[(l,p,t,h) for l in LAMS for p in PAR for t in TAUS for h in HALF]; NE=len(CAND)
def prior_var(l,p,t):
    v=t*l**ORD
    if p=='odd': v=np.where(ORD%2==1,v,0.0)
    if p=='even': v=np.where(ORD%2==0,v,0.0)
    return v
P0=np.stack([np.diag(prior_var(l,p,t)) for l,p,t,h in CAND]); GAM=np.array([1.0 if h is None else 0.5**(1.0/h) for l,p,t,h in CAND])
def walk(r, st, base, read='MOVE', a=None, med=None, spectrum=False):
    r=np.asarray(r,float); n=len(r); P=P0.copy(); C=np.zeros((NE,S)); L=np.zeros(NE); rows=[]
    for i in range(26,n-1):
        s=st[i]; b=base[i]
        if s<0 or np.isnan(b): continue
        if read=='RANGE' and np.isnan(med[i]): continue
        x=CHI[s]; pe=np.clip(b+C@x,.01,.99); w=np.exp(L-L.max()); w/=w.sum(); p=float(w@pe)
        y=int(a[i+1]>med[i]) if read=='RANGE' else int(r[i+1]>0)
        rows.append((i,p,float(b),y)); L+=np.log(np.where(y,pe,1-pe))
        Px=P@x; v=b*(1-b); g=Px/(v+Px@x)[:,None]; C+=g*((y-b)-C@x)[:,None]; P-=g[:,:,None]*Px[:,None,:]
        # forgetting as a stationary process in time: effects relax toward zero, the prior is the resting state
        C*=np.sqrt(GAM)[:,None]; P=GAM[:,None,None]*P+(1-GAM)[:,None,None]*P0
    if spectrum:
        w=np.exp(L-L.max()); w/=w.sum(); c=w@C; e=np.array([(c[ORD==k]**2).sum() for k in range(7)]); return rows,w,e
    return rows
