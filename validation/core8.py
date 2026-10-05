import numpy as np, pandas as pd, json, os
from precision import datasets, HERE
from core2 import boot
from hexadaptive import baseline
import hexmodel as hm, spectral as sp
ll=lambda p,y: -(y*np.log(p)+(1-y)*np.log(1-p))
def marg(w):
    W=pd.DataFrame(sp.CAND,columns=['lambda','parity','tau2','half']); W['w']=w; W['half']=W.half.fillna(0)
    return {c:{str(k):round(float(v),3) for k,v in W.groupby(c).w.sum().items()} for c in ('lambda','parity','tau2','half')}
if __name__=='__main__':
    rng=np.random.default_rng(83); DS,tabs=datasets(); OUT={}
    for dom in ('weather','racing','markets'):
        for read in ('MOVE','RANGE'):
            fr=[]; Ws=[]; Es=[]
            for g,(name,r,start) in enumerate(DS[dom]):
                base=baseline(r,read); st,a,med=hm.states(r,read)
                A=pd.DataFrame(hm.walk(r,read,base=base)[0],columns=['i','p64','b','y'])
                rows,w,e=sp.walk(r,st,base,read=read,a=a,med=med,spectrum=True); Ws.append(w); Es.append(e/max(e.sum(),1e-30))
                B=pd.DataFrame(rows,columns=['i','ps','b2','y2'])[['i','ps']]; D=A.merge(B,on='i',how='inner'); D['g']=g; fr.append(D[D.i>=max(26,start)])
            D=pd.concat(fr,ignore_index=True); G=D.g.values if dom=='racing' else None
            hit=lambda c: round(float(((D[c]>=.5).astype(int)==D.y).mean())*100,2)
            pr=lambda a,b: (lambda d: [round(float(d.mean())*1000,2)]+boot(d,rng,G))(ll(D[a].values,D.y.values)-ll(D[b].values,D.y.values))
            e={'calls':len(D),'right %':{'baseline':hit('b'),'6.4':hit('p64'),'spectral':hit('ps')},'spectral over 6.4 (x1000 nats)':pr('p64','ps'),'spectral over baseline':pr('b','ps'),'6.4 over baseline':pr('b','p64'),
               'weights':marg(np.mean(Ws,axis=0)),'share of the fitted effect by number of lines involved (0..6)':[round(float(v),3) for v in np.mean(Es,axis=0)]}
            OUT[f'{dom} {read}']=e; print(dom,read,json.dumps(e),flush=True)
            json.dump(OUT,open(os.path.join(HERE,'core8_results.json'),'w'),indent=1)
