import numpy as np, pandas as pd, json, os
from precision import datasets, HERE
from core2 import boot
from hexadaptive import baseline
import hexmodel as hm
ll=lambda p,y: -(y*np.log(p)+(1-y)*np.log(1-p))
S=64; HAM=hm.HAM
def rev(s): return int(format(s,'06b')[::-1],2)
KW=np.array([rev(s) if rev(s)!=s else 63-s for s in range(S)])
def gen_walk(r, st, base, KERN, KS=hm.KS, HALF=hm.HALF, ret_exp=False):
    """state-6.4 estimator with a given state sequence and kernel stack. Returns dict i -> (p, P vector)."""
    r=np.asarray(r,float); n=len(r); AK=np.abs(KERN); nk=len(KERN); DISC=np.array([1.0 if h is None else 0.5**(1.0/h) for h in HALF]); Kv=np.array(KS)
    D=np.zeros((len(HALF),S)); N=np.zeros((len(HALF),S)); L=np.zeros(nk*len(HALF)*len(KS)); out={}
    for i in range(26,n-1):
        s=st[i]; b=base[i]
        if s<0 or np.isnan(b): continue
        P=np.clip(b+(KERN[:,s,:]@D.T)[:,:,None]/((AK[:,s,:]@N.T)[:,:,None]+Kv[None,None,:]),.01,.99).ravel()
        w=np.exp(L-L.max()); w/=w.sum(); out[i]=(float(w@P),P,L.copy()); y=int(r[i+1]>0)
        L+=np.log(np.where(y,P,1-P)); D*=DISC[:,None]; N*=DISC[:,None]; D[:,s]+=y-b; N[:,s]+=1
    return out
def casting(r):
    r=np.asarray(r,float); n=len(r); a=np.abs(r); q75=pd.Series(a).expanding(20).quantile(0.75).shift(1).values
    up=(r>0).astype(int); old=(a>q75)&~np.isnan(q75)
    prim=np.full(n,-1); res=np.full(n,-1)
    for i in range(25,n):
        p=q=0
        for j in range(i-5,i+1): p=(p<<1)|up[j]; q=(q<<1)|(up[j]^int(old[j]))
        prim[i]=p; res[i]=q
    return prim,res
# kernels
dl=np.array([[bin((a>>3)^(b>>3)).count('1') for b in range(S)] for a in range(S)]); du=np.array([[bin((a&7)^(b&7)).count('1') for b in range(S)] for a in range(S)])
pw=lambda rho,d: np.where(d==0,1.0,rho**d) if rho>0 else (d==0).astype(float)
TRI=np.stack([pw(a,dl)*pw(b,du) for a in hm.RHO for b in hm.RHO])
KWK=np.stack([hm.kernel(rho,'plain')+g*np.eye(S)[KW] for rho in hm.RHO for g in (0.0,0.5,1.0)])
if __name__=='__main__':
    rng=np.random.default_rng(79); DS,tabs=datasets(); OUT={}
    for dom in ('weather','racing','markets'):
        fr=[]
        for g,(name,r,start) in enumerate(DS[dom]):
            base=baseline(r,'MOVE'); prim,res=casting(r)
            A=gen_walk(r,prim,base,hm.KERN); B=gen_walk(r,res,base,hm.KERN); T=gen_walk(r,prim,base,TRI); K=gen_walk(r,prim,base,KWK)
            rows=[]
            for i in sorted(set(A)&set(B)):
                Pa,Pb=A[i][1],B[i][1]; La,Lb=A[i][2],B[i][2]; L=np.r_[La,Lb]; w=np.exp(L-L.max()); w/=w.sum()
                rows.append((i,int(r[i+1]>0),base[i],A[i][0],B[i][0],float(w@np.r_[Pa,Pb]),T[i][0],K[i][0],g))
            D=pd.DataFrame(rows,columns=['i','y','b','P','R','PR','T','KW','g']); fr.append(D[D.i>=max(26,start)])
        D=pd.concat(fr,ignore_index=True); G=D.g.values if dom=='racing' else None
        hit=lambda c: round(float(((D[c]>=.5).astype(int)==D.y).mean())*100,2)
        pr=lambda a,b: (lambda d: [round(float(d.mean())*1000,2)]+boot(d,rng,G))(ll(D[a].values,D.y.values)-ll(D[b].values,D.y.values))
        e={'calls':len(D),'right %':{c:hit(c) for c in ('b','P','R','PR','T','KW')},'gain over P (x1000 nats)':{c:pr('P',c) for c in ('R','PR','T','KW')},'P over baseline':pr('b','P'),'PR over baseline':pr('b','PR')}
        OUT[f'{dom} MOVE']=e; print(dom,json.dumps(e),flush=True)
    json.dump(OUT,open(os.path.join(HERE,'core7_results.json'),'w'),indent=1)
