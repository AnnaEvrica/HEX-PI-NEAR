# prereg_core6.md: HEX as an explicit model (state-6.4) against 6.2 and 6.3.
import numpy as np, pandas as pd, json, os
from sklearn.isotonic import IsotonicRegression
from precision import walk as hex_walk, datasets, calibrate_forward, HERE
from pretrain import load_families, train_tables, FAMILIES
from hexg import load_all
from core2 import boot
from rankcore import clip
from hexadaptive import walk as w63, baseline
from hexmodel import walk as w64, LABELS, RHO, SYM, KS, HALF
from core5 import pooled
ll=lambda p,y: -(y*np.log(p)+(1-y)*np.log(1-p))
def margins(w):
    W=pd.DataFrame(LABELS,columns=['rho','sym','half','K']); W['w']=w; W['half']=W.half.fillna(0)
    return {c:{str(k):round(float(v),3) for k,v in W.groupby(c).w.sum().items()} for c in ('rho','sym','half','K')}
if __name__=='__main__':
    rng=np.random.default_rng(73); DS,tabs=datasets(); mk=load_all(); dates={k:pd.to_datetime(s.index)[1:] for k,s in mk.items()}; OUT={}
    for dom in ('markets','weather','racing'):
        for read in ('RANGE','MOVE'):
            fr=[]; Wm=[]
            for g,(name,r,start) in enumerate(DS[dom]):
                base=baseline(r,read); r63,_=w63(r,tabs,read); r64,_,w=w64(r,read,base=base,weights=True); Wm.append(w)
                A=pd.DataFrame(r63,columns=['i','p63','b','y']).merge(pd.DataFrame(r64,columns=['i','p64','b2','y2'])[['i','p64']],on='i',how='left'); A['p64']=A.p64.fillna(A.b)
                H=hex_walk(r,tabs); pc=0 if read=='MOVE' else 3; h=H[A.i.values-12,pc]; A['H']=calibrate_forward(np.where(np.isnan(h),A.b.values,clip(h)),A.y.values)
                A['g']=g; A['start']=start
                if dom=='markets': A['date']=dates[name][A.i.values+1]
                fr.append(A)
            ALL=pd.concat(fr,ignore_index=True)
            if dom=='markets':
                ALL=ALL.sort_values('date').reset_index(drop=True); ALL['c63']=pooled(ALL,'p63'); ALL['c64']=pooled(ALL,'p64'); D=ALL[ALL.date>=pd.Timestamp('2016-01-01')]
            else:
                ALL['c63']=ALL.p63; ALL['c64']=ALL.p64; D=ALL[ALL.i>=np.maximum(26,ALL.start)]
            G=D.g.values if dom=='racing' else None
            hit=lambda c: round(float(((D[c]>=.5).astype(int)==D.y).mean())*100,2)
            def dec(c):
                s=np.abs(D[c]-.5); t=(s>=np.quantile(s,.9)).values; return [round(float(np.maximum(D[c],1-D[c])[t].mean())*100,1), round(float(((D[c]>=.5).astype(int)==D.y)[t].mean())*100,1)]
            pr=lambda a,b: (lambda d: [round(float(d.mean())*1000,2)]+boot(d,rng,G))(ll(D[a].values,D.y.values)-ll(D[b].values,D.y.values))
            e={'calls':len(D),'right %':{'6.2':hit('H'),'6.3':hit('c63'),'6.4':hit('c64'),'baseline rule':hit('b')},
               '6.4 over 6.3 (x1000 nats, positive = 6.4 better)':pr('c63','c64'),'6.4 raw over 6.3 raw':pr('p63','p64'),'6.4 over 6.2':pr('H','c64'),'6.4 over its baseline':pr('b','p64'),
               'strongest tenth: stated %, right %':{'6.2':dec('H'),'6.3':dec('c63'),'6.4':dec('c64')},
               'where the weight went (mean over series)':margins(np.mean(Wm,axis=0))}
            OUT[f'{dom} {read}']=e; print(dom,read,json.dumps(e),flush=True)
    # cold start: held-out market series, first steps, RANGE
    F=load_families(); tabs_all=[train_tables(F[f]['train']) for f in FAMILIES]; acc={}
    for name,r in F['markets']['test']:
        if len(r)<1100: continue
        base=baseline(r,'RANGE'); a=pd.DataFrame(w63(r,tabs_all,'RANGE')[0],columns=['i','p','b','y']); c=pd.DataFrame(w64(r,'RANGE',base=base)[0],columns=['i','p','b','y'])
        for T in (25,100,250,1000):
            acc.setdefault(T,{'6.3':[],'6.4':[]})
            acc[T]['6.3'].append(float((ll(a.p.values[:T],a.y.values[:T])-ll(a.b.values[:T],a.y.values[:T])).mean())*1000)
            acc[T]['6.4'].append(float((ll(c.p.values[:T],c.y.values[:T])-ll(c.b.values[:T],c.y.values[:T])).mean())*1000)
    OUT['cold start, market RANGE, log loss vs baseline x1000 (negative is better)']={f'first {T}':{k:round(float(np.mean(v)),1) for k,v in d.items()} for T,d in acc.items()}
    print(json.dumps(OUT['cold start, market RANGE, log loss vs baseline x1000 (negative is better)']),flush=True)
    json.dump(OUT,open(os.path.join(HERE,'core6_results.json'),'w'),indent=1)
