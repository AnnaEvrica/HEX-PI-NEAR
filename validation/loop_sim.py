# ===========================================================================
# Ten-year simulation of the system as built, from a cold start.
#   1 January 2016: no history, empty ledger, no calibration map, 6.2 shown.
#   Every trading day, for each of 17 market series and both reads:
#     both versions of HEX make a call from data since 2016 only; yesterday's calls are scored;
#   every month the calibration map is refitted from scored calls (needs 2,000);
#   every night the promotion rule (base44/shared/ledger.ts) decides which version is shown.
# Reported: what a user would have seen, year by year.
# ===========================================================================
import numpy as np, pandas as pd, json, os, sys
from sklearn.isotonic import IsotonicRegression
from precision import walk as hex_walk, datasets, calibrate_forward, HERE
from hexg import load_all
from rankcore import clip
from hexadaptive import baseline
from hexmodel import walk as w64
MIN_CALLS,MIN_DAYS,Z,MIN_CAL=300,60,1.96,2000
WINDOW=int(sys.argv[1]) if len(sys.argv)>1 else 1250          # paired calls the nightly job looks back over (0 = everything)
START=pd.Timestamp('2016-01-01'); ll=lambda p,y: -(y*np.log(p)+(1-y)*np.log(1-p))
DS,tabs=datasets(); mk=load_all(); OUT={'window':WINDOW}
for read in ('RANGE','MOVE'):
    fr=[]
    for g,(name,r_full,_s) in enumerate(DS['markets']):
        d_full=pd.to_datetime(mk[name].index)[1:]; keep=d_full>=START; r=r_full[keep]; d=d_full[keep]
        rows,_=w64(r,read,base=baseline(r,read)); A=pd.DataFrame(rows,columns=['i','cand_raw','b','y'])
        H=hex_walk(r,tabs); pc=0 if read=='MOVE' else 3; h=H[A.i.values-12,pc]; A['ctl']=calibrate_forward(np.where(np.isnan(h),A.b.values,clip(h)),A.y.values)
        A['date']=d[A.i.values+1]; A['age']=A.i.values; A['g']=g; fr.append(A)
    L=pd.concat(fr,ignore_index=True).sort_values(['date','g']).reset_index(drop=True); L['cand']=L.cand_raw; iso=None; maps=[]
    for a,b in zip(pd.date_range(START,L.date.max()+pd.Timedelta(days=40),freq='MS')[:-1],pd.date_range(START,L.date.max()+pd.Timedelta(days=40),freq='MS')[1:]):
        past=(L.date<a).values
        if past.sum()>=MIN_CAL: iso=IsotonicRegression(out_of_bounds='clip',y_min=.01,y_max=.99).fit(L.cand_raw.values[past],L.y.values[past]); maps.append(str(a.date()))
        m=((L.date>=a)&(L.date<b)).values
        if iso is not None and m.any(): L.loc[m,'cand']=iso.predict(L.cand_raw.values[m])
    L['d']=ll(L.ctl.values,L.y.values)-ll(L.cand.values,L.y.values)
    L['hc']=((L.ctl>=.5).astype(int)==L.y).astype(int); L['hk']=((L.cand>=.5).astype(int)==L.y).astype(int); L['hb']=((L.b>=.5).astype(int)==L.y).astype(int)
    days=L.groupby('date').agg(n=('d','size'),dm=('d','mean'),hd=('hk','mean'),hcs=('hc','sum'),hks=('hk','sum')); days['hd']=days.hd-L.groupby('date').hc.mean()
    live='ctl'; events=[]; shown={}; hist=[]
    for date,row in days.iterrows():
        shown[date]=live; hist.append((row.n,row.dm,row.hd,row.hcs,row.hks))
        if WINDOW:
            tot=0; k=len(hist)
            while k>0 and tot<WINDOW: k-=1; tot+=hist[k][0]
            W=hist[k:]
        else: W=hist
        n=sum(x[0] for x in W); nd=len(W)
        if n<MIN_CALLS or nd<MIN_DAYS: continue
        dm=np.array([x[1] for x in W]); hd=np.array([x[2] for x in W]); m=dm.mean(); se=dm.std(ddof=1)/np.sqrt(nd); hm_=hd.mean(); hse=hd.std(ddof=1)/np.sqrt(nd)
        hc=sum(x[3] for x in W); hk=sum(x[4] for x in W)
        if live=='ctl' and m-Z*se>0 and hk>=hc: live='cand'; events.append([str(date.date()),'promote'])
        elif live=='cand' and (m+Z*se<0 or hm_+Z*hse<0): live='ctl'; events.append([str(date.date()),'demote'])
    L['live']=L.date.map(shown); L['loop']=np.where(L.live=='cand',L.cand,L.ctl)
    def stats(D):
        hit=lambda c: round(float(((D[c]>=.5).astype(int)==D.y).mean())*100,1)
        def gap(c):
            s=np.abs(D[c]-.5); t=(s>=np.quantile(s,.9)).values; return [round(float(np.maximum(D[c],1-D[c])[t].mean())*100,1), round(float(((D[c]>=.5).astype(int)==D.y)[t].mean())*100,1)]
        return {'calls':len(D),'shown':hit('loop'),'6.2':hit('ctl'),'6.4':hit('cand'),'baseline rule':hit('b'),'shown: stated %':round(float(np.maximum(D.loop,1-D.loop).mean())*100,1),
                'shown, strongest tenth: stated, right':gap('loop'),'share of days 6.4 was shown %':round(float((D.live=='cand').mean())*100,0)}
    e={'events':events,'calibration first fitted':maps[0] if maps else None,'all years':stats(L),'by year':{int(y):stats(D) for y,D in L.groupby(L.date.dt.year)},
       'by age of the series (steps since its first)':{lab:stats(L[(L.age>=a)&(L.age<b)]) for lab,a,b in (('first 100',0,100),('100-250',100,250),('250-500',250,500),('500-1000',500,1000),('1000-2000',1000,2000),('2000+',2000,10**9))}}
    OUT[read]=e; print(read,json.dumps(e),flush=True)
json.dump(OUT,open(os.path.join(HERE,f'loop_sim_{WINDOW}.json'),'w'),indent=1)
