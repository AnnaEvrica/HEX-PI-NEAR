# Replay of the shipped loop on the 17 market series, 2016-2026: both engines called every day,
# pooled calibration refitted from past calls only, promotion rule applied night by night.
import numpy as np, pandas as pd, json, os
from sklearn.isotonic import IsotonicRegression
from precision import walk as hex_walk, datasets, calibrate_forward, HERE
from hexg import load_all
from rankcore import walk, clip
MIN_CALLS,MIN_DAYS,Z=300,60,1.96
DS,tabs=datasets(); mk=load_all(); dates={k:pd.to_datetime(s.index)[1:] for k,s in mk.items()}; OUT={}
ll=lambda p,y: -(y*np.log(p)+(1-y)*np.log(1-p))
for read in ('RANGE','MOVE'):
    fr=[]
    for g,(name,r,start) in enumerate(DS['markets']):
        A=walk(r,read); H=hex_walk(r,tabs); pc=0 if read=='MOVE' else 3
        h=H[A.i.values-12,pc]; A['ctl']=calibrate_forward(np.where(np.isnan(h),A.base.values,clip(h)),A.y.values)
        A['date']=dates[name][A.i.values+1]; A['g']=g; fr.append(A)
    ALL=pd.concat(fr,ignore_index=True).sort_values('date').reset_index(drop=True); ALL['cand']=ALL.p; iso=None
    cuts=pd.date_range(ALL.date.min(),ALL.date.max()+pd.Timedelta(days=40),freq='MS')
    for a,b in zip(cuts[:-1],cuts[1:]):                      # refit monthly from calls already scored
        past=ALL[ALL.date<a]
        if len(past)>=2000: iso=IsotonicRegression(out_of_bounds='clip',y_min=.01,y_max=.99).fit(past.p.values,past.y.values)
        if iso is not None:
            m=(ALL.date>=a)&(ALL.date<b)
            if m.any(): ALL.loc[m,'cand']=iso.predict(ALL.loc[m,'p'].values)
    L=ALL[ALL.date>=pd.Timestamp('2016-01-01')].copy()         # the ledger starts in 2016
    L['d']=ll(L.ctl.values,L.y.values)-ll(L.cand.values,L.y.values)
    L['hc']=((L.ctl>=.5).astype(int)==L.y).astype(int); L['hk']=((L.cand>=.5).astype(int)==L.y).astype(int); L['hb']=((L['null']>=.5).astype(int)==L.y).astype(int)
    days=L.groupby('date').agg(dsum=('d','sum'),n=('d','size'),dm=('d','mean'),hc=('hc','sum'),hk=('hk','sum'))
    live='ctl'; events=[]; shown=[]; cn=0; S=S2=0.0; nd=0; dsum=0.0; hc=hk=0
    for date,row in days.iterrows():
        shown.append((date,live))
        cn+=row.n; nd+=1; S+=row.dm; S2+=row.dm**2; dsum+=row.dsum; hc+=row.hc; hk+=row.hk
        if cn>=MIN_CALLS and nd>=MIN_DAYS:
            m=S/nd; se=np.sqrt(max(S2/nd-m*m,0)*nd/(nd-1)/nd)
            if live=='ctl' and m-Z*se>0 and hk>=hc: live='cand'; events.append((str(date.date()),'promote',int(cn),nd))
            elif live=='cand' and m+Z*se<0: live='ctl'; events.append((str(date.date()),'demote',int(cn),nd))
    sm=dict(shown); L['live']=L.date.map(sm); L['loop']=np.where(L.live=='cand',L.cand,L.ctl)
    hit=lambda c: round(float(((L[c]>=.5).astype(int)==L.y).mean())*100,2)
    dec=lambda c: (lambda t: [round(float(np.maximum(L[c],1-L[c])[t].mean())*100,1), round(float(((L[c]>=.5).astype(int)==L.y)[t].mean())*100,1)])(np.abs(L[c]-.5)>=np.quantile(np.abs(L[c]-.5),.9))
    OUT[read]={'calls':len(L),'events':events,'right %':{'6.2 alone':hit('ctl'),'rank-1 alone':hit('cand'),'the loop (6.2 until promoted)':hit('loop'),'baseline rule':hit('null'),'static base rule':hit('base')},
        'strongest tenth: stated %, right %':{'6.2':dec('ctl'),'rank-1':dec('cand')},
        'mean stated vs right, all calls':{'6.2':[round(float(np.maximum(L.ctl,1-L.ctl).mean())*100,1),hit('ctl')],'rank-1':[round(float(np.maximum(L.cand,1-L.cand).mean())*100,1),hit('cand')]},
        'by year right % (6.2, rank-1)':{int(y):[round(float(g.hc.mean())*100,1),round(float(g.hk.mean())*100,1)] for y,g in L.groupby(L.date.dt.year)}}
    print(read,json.dumps(OUT[read]),flush=True)
json.dump(OUT,open(os.path.join(HERE,'loop_replay.json'),'w'),indent=1)
