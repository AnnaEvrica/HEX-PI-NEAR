# Tenth experiment (prereg_core10.md): the entangling gate as a dial on the mirror coupling,
# and Parrondo coupling between the two reads. Compared with state-6.4 on the same calls.
import numpy as np, pandas as pd, json, os
from precision import datasets, keys, HERE
from core2 import boot
from hexadaptive import baseline
import hexmodel as hm
S=64; HAM=hm.HAM; cl=lambda p,y: 1-(p-y)**2
pw=lambda rho,d: np.where(d==0,1.0,rho**d) if rho>0 else (d==0).astype(float)
CS=(-1.0,-0.5,0.0,0.5,1.0)
DIAL=np.stack([pw(rho,HAM)+c*pw(rho,6-HAM) for rho in hm.RHO for c in CS])          # 20 kernels; c=0 and c=-1 are state-6.4's
def walk(r, read, base, groups):
    """groups: list of (state sequence, kernel stack). One Bayesian mixture over every candidate of every group."""
    r=np.asarray(r,float); n=len(r); a=np.abs(r); med=pd.Series(a).expanding(20).median().values
    DISC=np.array([1.0 if h is None else 0.5**(1.0/h) for h in hm.HALF]); Kv=np.array(hm.KS); nh=len(hm.HALF)
    G=[(st,K,np.abs(K),np.zeros((nh,S)),np.zeros((nh,S))) for st,K in groups]; sizes=[len(K)*nh*len(Kv) for _,K in groups]; L=np.zeros(sum(sizes)); out={}
    for i in range(26,n-1):
        b=base[i]
        if np.isnan(b) or any(g[0][i]<0 for g in G) or (read=='RANGE' and np.isnan(med[i])): continue
        P=np.concatenate([np.clip(b+(K[:,st[i],:]@D.T)[:,:,None]/((AK[:,st[i],:]@N.T)[:,:,None]+Kv[None,None,:]),.01,.99).ravel() for st,K,AK,D,N in G])
        w=np.exp(L-L.max()); w/=w.sum(); y=int(a[i+1]>med[i]) if read=='RANGE' else int(r[i+1]>0); out[i]=(float(w@P),y,float(b))
        L+=np.log(np.where(y,P,1-P))
        for st,K,AK,D,N in G: D*=DISC[:,None]; N*=DISC[:,None]; D[:,st[i]]+=y-b; N[:,st[i]]+=1
    w=np.exp(L-L.max()); w/=w.sum(); return out,w,sizes
if __name__=='__main__':
    rng=np.random.default_rng(101); DS,tabs=datasets(); OUT={}
    for dom,read in (('markets','RANGE'),('markets','MOVE'),('weather','MOVE'),('weather','RANGE'),('racing','MOVE')):
        fr=[]; wpos=[]; wother=[]; wmix=[]
        for g,(name,r,start) in enumerate(DS[dom]):
            _,a,med,kd,km,kw=keys(r); dirs=np.where(kd>=0,kd>>1,-1); size=km
            own,other=(size,dirs) if read=='RANGE' else (dirs,size)
            half=np.where((dirs>=0)&(size>=0),((own&7)<<3)|(other&7),-1)              # three latest lines of each
            base=baseline(r,read)
            A,_,_=walk(r,read,base,[(own,hm.KERN)])
            B,wb,_=walk(r,read,base,[(own,DIAL)])
            C,wc,sz=walk(r,read,base,[(own,hm.KERN),(other,hm.KERN)])
            E,we,sz3=walk(r,read,base,[(own,hm.KERN),(other,hm.KERN),(half,hm.KERN)])
            per=len(hm.HALF)*len(hm.KS); wk=wb.reshape(len(hm.RHO),len(CS),per).sum((0,2)); wpos.append(float(wk[3]+wk[4])); wother.append(float(wc[sz[0]:].sum())); wmix.append([float(we[:sz3[0]].sum()),float(we[sz3[0]:sz3[0]+sz3[1]].sum()),float(we[sz3[0]+sz3[1]:].sum())])
            idx=sorted(set(A)&set(B)&set(C)&set(E)); D=pd.DataFrame([(i,A[i][1],A[i][2],A[i][0],B[i][0],C[i][0],E[i][0],g) for i in idx],columns=['i','y','b','hex','dial','coupled','coupled3','g']); fr.append(D[D.i>=max(26,start)])
        D=pd.concat(fr,ignore_index=True); Gp=D.g.values if dom=='racing' else None; y=D.y.values
        hit=lambda c: round(float(((D[c]>=.5).astype(int)==y).mean())*100,2)
        pr=lambda c: (lambda d: [round(float(d.mean())*1000,2)]+boot(d,rng,Gp))(cl(D[c].values,y)-cl(D.hex.values,y))
        e={'calls':len(D),'right %':{c:hit(c) for c in ('b','hex','dial','coupled','coupled3')},'closeness of state-6.4':round(float(cl(D.hex.values,y).mean()),4),
           'mirror dial over state-6.4 (closeness x1000)':pr('dial'),'final weight on c > 0 (40% of candidates)':round(float(np.mean(wpos)),3),
           'coupled reads over state-6.4 (closeness x1000)':pr('coupled'),'final weight on the other read\'s pattern (50% of candidates)':round(float(np.mean(wother)),3),
           'coupled, with three lines of each, over state-6.4 (closeness x1000)':pr('coupled3'),'final weight: own, other, three of each':[round(float(x),3) for x in np.mean(wmix,0)]}
        OUT[f'{dom} {read}']=e; print(dom,read,json.dumps(e),flush=True)
    json.dump(OUT,open(os.path.join(HERE,'core10_results.json'),'w'),indent=1)
