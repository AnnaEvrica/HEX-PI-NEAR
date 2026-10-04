# prereg_core5.md: HEX calls, the rank core observes and calibrates.
import numpy as np, pandas as pd, json, os, math
from sklearn.isotonic import IsotonicRegression
from precision import walk as hex_walk, keys, datasets, calibrate_forward, HERE, WM, AWM, WD, AWD
from pretrain import K, ALPHAS, LAM, G
from hexg import load_all
from core2 import boot
from rankcore import walk, clip, lg, TAUS, HALF
ll=lambda p,y: -(y*np.log(p)+(1-y)*np.log(1-p))
class Cal:
    """Online calibration of HEX with the observer: logit p = logit h + a*(logit q - logit h) + c. Starts at HEX."""
    def __init__(s): s.P=np.stack([np.eye(2)*t for t in TAUS]); s.th=np.zeros((len(TAUS),2)); s.ll=np.zeros(len(TAUS))
    def predict(s,x,off): s.q=clip(1/(1+np.exp(-(off+s.th@x)))); w=np.exp(s.ll-s.ll.max()); w/=w.sum(); return float(w@s.q)
    def update(s,x,y):
        q=s.q; s.ll+=np.log(np.where(y,q,1-q)); wt=q*(1-q); Px=s.P@x; den=1+wt*(Px@x)
        s.P-=(wt/den)[:,None,None]*Px[:,:,None]*Px[:,None,:]; s.th+=(s.P@x)*(y-q)[:,None]
def observe(h,q,y):
    c=Cal(); llg=np.zeros(2); out=np.empty(len(h))
    for i in range(len(h)):
        x=np.array([lg(q[i])-lg(h[i]),1.0]); pc=c.predict(x,lg(h[i])); v=np.array([h[i],pc]); w=np.exp(llg-llg.max()); w/=w.sum(); out[i]=float(w@v)
        llg+=np.log(np.where(y[i],v,1-v)); c.update(x,y[i])
    return out
def hex_plus(r,tables,read,nullq):
    """6.2 with the observer's dyadic baseline in place of its own decayed base rate. nullq: dict i -> baseline."""
    r_,a,med,kd,km,kw=keys(r); n=len(r); size=(read=='RANGE'); S=64 if size else 128; W=WM if size else WD; AW=AWM if size else AWD
    d0=[np.zeros(S)]+[t['size' if size else 'dir'] for t in tables]; nf=len(d0); na=len(ALPHAS)
    w0=np.concatenate([np.full(na,0.5/na)]+[np.full(na,0.5/max(1,nf-1)/na) for _ in range(nf-1)]); lw0=np.log(w0); L=np.zeros(len(w0)); D=np.zeros(S); N=np.zeros(S); out={}
    for i in range(12,n-1):
        s=km[i] if size else kd[i]
        if size and not (s>=0 and not np.isnan(med[i])): continue
        if i not in nullq: continue
        b=nullq[i]; pd_=W[s]@D; pn=AW[s]@N
        Q=np.clip([b+(D[s]+al*pd_+K*d[s])/(N[s]+al*pn+K) for d in d0 for al in ALPHAS],.01,.99); z=L+lw0; w=np.exp(z-z.max()); w/=w.sum(); out[i]=float(w@Q)
        y=int(a[i+1]>med[i]) if size else int(r[i+1]>0)
        L=G*L+np.log(np.where(y,Q,1-Q)); D*=LAM; N*=LAM; D[s]+=y-b; N[s]+=1
    return out
def pooled(ALL,col,freq='MS'):
    o=ALL[col].values.copy(); iso=None; cuts=pd.date_range(ALL.date.min(),ALL.date.max()+pd.Timedelta(days=40),freq=freq)
    for a,b in zip(cuts[:-1],cuts[1:]):
        past=(ALL.date<a).values
        if past.sum()>=2000: iso=IsotonicRegression(out_of_bounds='clip',y_min=.01,y_max=.99).fit(ALL[col].values[past],ALL.y.values[past])
        m=((ALL.date>=a)&(ALL.date<b)).values
        if iso is not None and m.any(): o[m]=iso.predict(ALL[col].values[m])
    return o
if __name__=='__main__':
    rng=np.random.default_rng(71); DS,tabs=datasets(); mk=load_all(); dates={k:pd.to_datetime(s.index)[1:] for k,s in mk.items()}; OUT={}
    for read in ('RANGE','MOVE'):
        fr=[]
        for g,(name,r,start) in enumerate(DS['markets']):
            A=walk(r,read); H=hex_walk(r,tabs); pc=0 if read=='MOVE' else 3
            h=H[A.i.values-12,pc]; A['h']=np.where(np.isnan(h),A.base.values,clip(h))
            A['H']=calibrate_forward(A.h.values,A.y.values)
            A['ho']=observe(A.h.values,A['null'].values,A.y.values)
            hp=hex_plus(r,tabs,read,dict(zip(A.i.values,A['null'].values))); A['hplus_raw']=[hp.get(i,b) for i,b in zip(A.i.values,A.base.values)]
            A['date']=dates[name][A.i.values+1]; A['g']=g; fr.append(A)
        ALL=pd.concat(fr,ignore_index=True).sort_values('date').reset_index(drop=True)
        ALL['HP']=pooled(ALL,'h'); ALL['HO']=pooled(ALL,'ho'); ALL['H+']=pooled(ALL,'hplus_raw'); ALL['R1']=pooled(ALL,'p')
        # HS: HEX's side kept; the stated probability for that side comes from HO, floored at one half
        side=(ALL.h>=.5).values; ps=np.where(side,ALL.HO,1-ALL.HO); ps=np.maximum(ps,0.5); ALL['HS']=np.where(side,ps,1-ps)
        D=ALL[ALL.date>=pd.Timestamp('2016-01-01')]
        hit=lambda c: round(float(((D[c]>=.5).astype(int)==D.y).mean())*100,2)
        def dec(c):
            s=np.abs(D[c]-.5); t=(s>=np.quantile(s,.9)).values; return [round(float(np.maximum(D[c],1-D[c])[t].mean())*100,1), round(float(((D[c]>=.5).astype(int)==D.y)[t].mean())*100,1)]
        pr=lambda a,b: (lambda d: [round(float(d.mean())*1000,2)]+boot(d,rng))((ll(D[a].values,D.y.values)-ll(D[b].values,D.y.values)))
        cols=['H','HP','HO','HS','H+','R1','null']
        agree=float(((D.HO>=.5)==(D.h>=.5)).mean())
        e={'calls':len(D),'right %':{c:hit(c) for c in cols},'log-loss gain over H (x1000)':{c:pr('H',c) for c in cols if c!='H'},
           'strongest tenth: stated %, right %':{c:dec(c) for c in cols if c!='null'},
           'mean stated %':{c:round(float(np.maximum(D[c],1-D[c]).mean())*100,1) for c in cols},
           'HO keeps the side HEX called on % of calls':round(agree*100,1),
           'when HO and HEX disagree: HEX right %, HO right %':[round(float(((D.h>=.5).astype(int)==D.y)[((D.HO>=.5)!=(D.h>=.5))].mean())*100,1), round(float(((D.HO>=.5).astype(int)==D.y)[((D.HO>=.5)!=(D.h>=.5))].mean())*100,1)]}
        OUT[read]=e; print(read,json.dumps(e),flush=True)
    json.dump(OUT,open(os.path.join(HERE,'core5_results.json'),'w'),indent=1)
