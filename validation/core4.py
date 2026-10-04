# Fourth experiment (prereg_core4.md): the model to ship, with calibration, against 6.2.
import numpy as np, pandas as pd, json, os, sys
from sklearn.isotonic import IsotonicRegression
from precision import walk as hex_walk, datasets, forward_rank, calibrate_forward, HERE
from core2 import boot, LL
from core3_drift import run as drift_run
from rankcore import walk, clip
def ece(p,y,bins=10):
    e=0; q=pd.qcut(p,bins,duplicates='drop')
    for _,g in pd.DataFrame({'p':p,'y':y}).groupby(q,observed=True): e+=len(g)/len(p)*abs(g.p.mean()-g.y.mean())
    return round(float(e)*100,2)
def pooled_cal(frames,col):
    """Calibrate each series on the EARLIER-in-position calls of all other series plus its own earlier calls (refit every 250)."""
    out=[]
    for k,f in enumerate(frames):
        p=f[col].values; y=f.y.values; o=p.copy(); iso=None
        for i in range(len(p)):
            if i>=200 and (i-200)%250==0:
                P=np.concatenate([g[col].values[:i] for g in frames]); Y=np.concatenate([g.y.values[:i] for g in frames])
                iso=IsotonicRegression(out_of_bounds='clip',y_min=.01,y_max=.99).fit(P,Y)
            if iso is not None: o[i]=iso.predict([p[i]])[0]
        out.append(o)
    return out
def prec(D,frames,m,ref,q):
    rk=np.concatenate([forward_rank(np.abs(f[m].values-0.5)) for f in frames]); t=rk>=q if q>0 else np.ones(len(D),bool)
    right=((D[m].values>=.5).astype(int)==D.y.values); nul=((D[ref].values>=.5).astype(int)==D.y.values)
    return {'right %':round(float(right[t].mean())*100,1),'baseline rule %':round(float(nul[t].mean())*100,1),'stated %':round(float(np.maximum(D[m].values,1-D[m].values)[t].mean())*100,1),'coverage %':round(float(t.mean())*100,1),'calls':int(t.sum())}
if __name__=='__main__':
    rng=np.random.default_rng(61); DS,tabs=datasets(); OUT={}
    for dom in ('markets','weather','racing'):
        for read in ('RANGE','MOVE'):
            fr=[];gid=[];full=[]
            for g,(name,r,start) in enumerate(DS[dom]):
                D=walk(r,read,null='dyadic'); S=walk(r,read,null='static'); H=hex_walk(r,tabs)
                D['static_null']=S['null'].values; D['static_p']=S['p'].values
                pc=0 if read=='MOVE' else 3; h=H[D.i.values-12,pc]; hb=H[D.i.values-12,pc+1]
                D['hex62_raw']=np.where(np.isnan(h),D.base.values,clip(h)); D['hex62_base']=np.where(np.isnan(hb),D.base.values,clip(hb))
                D['p_cal']=calibrate_forward(D.p.values,D.y.values); D['hex62']=calibrate_forward(D.hex62_raw.values,D.y.values)
                if read=='RANGE' and dom!='racing':
                    X=drift_run(r,tabs); D['drift_core']=X.set_index('i')['core + drift'].reindex(D.i.values).values; D['drift_null']=X.set_index('i')['drift null'].reindex(D.i.values).values
                full.append(D); 
            pool=pooled_cal(full,'p')
            for g,((name,r,start),D,pp) in enumerate(zip(DS[dom],full,pool)):
                D['p_pool']=pp; K=D[D.i>=max(26,start)]; fr.append(K); gid.append(np.full(len(K),g))
            D=pd.concat(fr,ignore_index=True); G=np.concatenate(gid) if dom=='racing' else None
            pr=lambda a,b: [round(float((LL(D,a)-LL(D,b)).mean())*1000,2)]+boot(LL(D,a)-LL(D,b),rng,G)
            sk=lambda m: round(float(1-LL(D,m).mean()/LL(D,'base').mean())*100,2)
            e={'steps':len(D),'skill % over static base':{m:sk(m) for m in ['null','core','p','p_cal','p_pool','static_p','hex62_raw','hex62']+(['drift_core','drift_null'] if 'drift_core' in D else [])},
               'dyadic null over static base':pr('base','null'),'STRUCTURE: gated core over its null':pr('null','p'),
               'rank-1 calibrated over 6.2 calibrated':pr('hex62','p_cal'),'calibration: per-series over none':pr('p','p_cal'),'calibration: pooled over per-series':pr('p_cal','p_pool'),
               'ECE %':{m:ece(D[m].values,D.y.values) for m in ('p','p_cal','p_pool','hex62_raw','hex62')}}
            if 'drift_core' in D: e['dyadic-null model over single-drift model']=pr('drift_core','p'); e['dyadic null over drift null']=pr('drift_null','null')
            for m,ref in (('p_cal','null'),('p','null'),('hex62','null')):
                e[f'precision {m}']={lab:prec(D,fr,m,ref,q) for lab,q in (('all',0),('strongest 25%',.75),('strongest 10%',.9))}
            OUT[f'{dom} {read}']=e; print(dom,read,json.dumps(e),flush=True)
            json.dump(OUT,open(os.path.join(HERE,'core4_results.json'),'w'),indent=1)
