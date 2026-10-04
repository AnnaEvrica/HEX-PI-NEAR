# Follow-up (prereg_core3.md, items 10-11): windowed rank nulls for MOVE; the core gated against its own null.
import numpy as np, pandas as pd, json, os, sys
from precision import datasets, HERE
from pretrain import load_families, FAMILIES
from core3 import prepare, WINS, NW, NB, lg, clip, skill, pair, LL
from core2 import OL
T_=(25,50,100,250,500,1000)
def run(r,read,priors=None,first=26):
    F=prepare(r); n=len(r); x=pd.Series(F['x'])
    if read=='MOVE':
        Q=[F['q_rank']]+[((w-x.rolling(w).rank(method='max')+1)/(w+1)).values for w in WINS]; Q=np.stack(Q,1)   # nan until the window is full
        W,B=F['Wx'],F['Bx']
    else: Q=np.zeros((n,0)); W,B=F['Wa'],F['Ba']
    nn=1+Q.shape[1]; lln=np.zeros(nn); core=OL(NW+NB); pm={k:OL(NW+NB,mu=mu,var=var) for k,(mu,var) in (priors or {}).items()}
    names=['null','core']+list(pm); llg=np.zeros(len(names)); llg2=np.zeros(2); u=c=0.0; rec=[]
    for i in range(first,n-1):
        if read=='MOVE': y=int(r[i+1]>0)
        else:
            if np.isnan(F['med_a'][i]): continue
            y=int(F['a'][i+1]>F['med_a'][i])
        base=float(clip((u+1)/(c+2))); q=np.r_[base,Q[i]]; q=np.where(np.isnan(q),base,clip(q))
        w=np.exp(lln-lln.max()); w/=w.sum(); m0=float(w@q); xf=np.r_[W[i],B[i]]; off=lg(m0)
        p1=core.predict(xf,off); pp=[o.predict(xf,off) for o in pm.values()]
        v=np.array([m0,p1]+pp); w=np.exp(llg-llg.max()); w/=w.sum(); gp=float(w@v)
        w2=np.exp(llg2-llg2.max()); w2/=w2.sum(); g2=float(w2@v[:2])
        rec.append({'i':i,'y':y,'base':base,'M0':m0,'M1':p1,'gated':g2,'gated+priors':gp})
        lln+=np.log(np.where(y,q,1-q)); llg+=np.log(np.where(y,v,1-v)); llg2+=np.log(np.where(y,v[:2],1-v[:2]))
        core.update(xf,y); [o.update(xf,y) for o in pm.values()]; u+=y; c+=1
    return pd.DataFrame(rec),core.th[4].copy(),w
if __name__=='__main__':
    rng=np.random.default_rng(47); DS,tabs=datasets(); OUT={'warm':{}}
    for dom in ('racing','weather','markets'):
        for read in ('MOVE','RANGE'):
            fr=[];gid=[]
            for g,(name,r,start) in enumerate(DS[dom]):
                D,_,_=run(r,read); D=D[D.i>=max(26,start)]; fr.append(D); gid.append(np.full(len(D),g))
            D=pd.concat(fr,ignore_index=True); G=np.concatenate(gid) if dom=='racing' else None
            e={'skill % over base rate':{m:skill(D,m) for m in ('M0','M1','gated')},'null over base':pair(D,'base','M0',rng,G),
               'STRUCTURE: M1 over null':pair(D,'M0','M1',rng,G),'gated over null':pair(D,'M0','gated',rng,G),'gated vs M1 (positive = gate better)':pair(D,'M1','gated',rng,G),
               'precision %':{m:round(float(((D[m]>=.5).astype(int)==D.y).mean())*100,1) for m in ('base','M0','M1','gated')}}
            OUT['warm'][f'{dom} {read}']=e; print(dom,read,json.dumps(e),flush=True)
    F=load_families(); pri={'MOVE':{},'RANGE':{}}
    for fam in FAMILIES:
        for read in pri:
            co=[run(seg,read)[1] for rr in F[fam]['train'] for seg in [rr[i:i+2000] for i in range(0,len(rr),2000) if len(rr[i:i+2000])>=600][:12]]
            A=np.array(co); pri[read][fam]=(A.mean(0),np.maximum(A.var(0),1e-4) if len(A)>1 else np.full(NW+NB,0.05))
        print(' priors',fam,flush=True)
    LC={}
    for fam in FAMILIES:
        for read in ('MOVE','RANGE'):
            acc={}
            for name,r in F[fam]['test']:
                if len(r)<1100: continue
                D,_,_=run(r,read,priors=pri[read])
                for T in T_:
                    for m in ('M0','M1','gated','gated+priors'): acc.setdefault(T,{}).setdefault(m,[]).append(float((LL(D,m)[:T]-LL(D,'base')[:T]).mean())*1000)
            LC[f'{fam} {read}']={f'first {T}':{m:round(float(np.mean(v)),1) for m,v in d.items()} for T,d in acc.items()}
            print(fam,read,json.dumps(LC[f'{fam} {read}']),flush=True)
    OUT['cold start (log-loss difference vs base rate x1000; negative is better)']=LC
    json.dump(OUT,open(os.path.join(HERE,'core3b.json'),'w'),indent=1)
