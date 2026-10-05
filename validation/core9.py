import numpy as np, pandas as pd, json, os
from scipy.linalg import expm
from precision import datasets, HERE
from core2 import boot
from hexadaptive import baseline
import hexmodel as hm
from core7 import gen_walk, casting
from spectral import CHI, ORD
S=64; HAM=hm.HAM; ll=lambda p,y: -(y*np.log(p)+(1-y)*np.log(1-p))
TS=(np.pi/8,np.pi/4,3*np.pi/8,np.pi/2)
def qprob(t): c2,s2=np.cos(t)**2,np.sin(t)**2; k=np.where(HAM==0,1.0,1.0)*(c2**(6-HAM))*(s2**HAM); return k
def qamp_real(t): return (np.cos(t)**(6-HAM))*(np.sin(t)**HAM)*np.cos(np.pi*HAM/2)        # Re[(cos t)^(6-d) (-i sin t)^d]
if __name__=='__main__':
    # ---- identities
    A=(HAM==1).astype(float); H=6*np.eye(S)-A; ok1=ok2=ok3=True
    for t in TS+(0.3,1.1):
        U=expm(-1j*H*t); P=np.abs(U)**2; ok1&=np.allclose(P,qprob(t)); ok3&=np.allclose(np.diag(CHI.T@P@CHI)/S,np.cos(2*t)**ORD)
        ok1&=np.allclose((U*np.exp(1j*6*t)).real, qamp_real(t)) if True else ok1
    U=expm(-1j*H*np.pi/2); ok2=np.allclose(np.abs(U)**2,np.eye(S)[::-1])
    ident={'transition probability formula':bool(ok1),'perfect transfer to the mirror pattern at t = pi/2':bool(ok2),'Walsh eigenvalue cos(2t)^k':bool(ok3)}
    print(json.dumps(ident),flush=True)
    norm=lambda k: k/np.abs(k).max()
    QK=np.stack([norm(qprob(t)) for t in TS]+[norm(qamp_real(t)) for t in TS[:3]])     # 7 quantum kernels
    BOTH=np.concatenate([hm.KERN,QK]); nd=len(hm.KERN)*len(hm.HALF)*len(hm.KS)
    rng=np.random.default_rng(89); DS,tabs=datasets(); OUT={'identities':ident}
    for dom in ('weather','racing','markets'):
        fr=[]; wq=[]
        for g,(name,r,start) in enumerate(DS[dom]):
            base=baseline(r,'MOVE'); prim,_=casting(r); A=gen_walk(r,prim,base,hm.KERN); Q=gen_walk(r,prim,base,QK); B=gen_walk(r,prim,base,BOTH)
            last=max(B); L=B[last][2]; w=np.exp(L-L.max()); w/=w.sum(); wq.append(float(w[nd:].sum()))
            rows=[(i,int(r[i+1]>0),base[i],A[i][0],Q[i][0],B[i][0],g) for i in sorted(A)]
            D=pd.DataFrame(rows,columns=['i','y','b','classical','quantum','both','g']); fr.append(D[D.i>=max(26,start)])
        D=pd.concat(fr,ignore_index=True); G=D.g.values if dom=='racing' else None
        hit=lambda c: round(float(((D[c]>=.5).astype(int)==D.y).mean())*100,2)
        pr=lambda a,b: (lambda d: [round(float(d.mean())*1000,2)]+boot(d,rng,G))(ll(D[a].values,D.y.values)-ll(D[b].values,D.y.values))
        e={'calls':len(D),'right %':{c:hit(c) for c in ('b','classical','quantum','both')},'quantum kernels alone over diffusion kernels (x1000 nats)':pr('classical','quantum'),'both over diffusion alone':pr('classical','both'),
           'final weight on the quantum kernels when both compete (mean over series; they are 7 of 15 kernels)':round(float(np.mean(wq)),3)}
        OUT[f'{dom} MOVE']=e; print(dom,json.dumps(e),flush=True)
    json.dump(OUT,open(os.path.join(HERE,'core9_results.json'),'w'),indent=1)
