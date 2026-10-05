# ===========================================================================
# Does calibration change the calls?  And a calibration that cannot.
#   as built : the map is applied to the probability, and the side called is
#              read off the result, so the map can move a call across 50%.
#   side-kept: HEX's own probability fixes the side. The map is fitted to the
#              strength of that side (how far from 50%) against whether the
#              call was right, and can never state less than 50% for it.
# Scores: share right; closeness reward 1-(p-y)^2 (always between 0 and 1,
# highest when the stated probability was nearest what happened).
# Same cold start as loop_sim.py; whole-record promotion rule, run on both scores.
# ===========================================================================
import numpy as np, pandas as pd, json, os, sys, pickle
from sklearn.isotonic import IsotonicRegression
from precision import walk as hex_walk, datasets, calibrate_forward, HERE, MINCAL, REFIT
from hexg import load_all
from rankcore import clip
from hexadaptive import baseline
from hexmodel import walk as w64
MIN_CALLS,MIN_DAYS,Z,MIN_CAL=300,60,1.96,2000
START=pd.Timestamp('2016-01-01'); ll=lambda p,y: -(y*np.log(p)+(1-y)*np.log(1-p)); rw=lambda p,y: 1-(p-y)**2
def keep_side_forward(p,y):
    """6.2's own per-series map, restricted to strength: earlier calls only, side untouched."""
    out=p.copy(); iso=None; up=p>=.5; s=np.maximum(p,1-p); ok=(up.astype(int)==y).astype(int)
    for i in range(len(p)):
        if i>=MINCAL and (i-MINCAL)%REFIT==0: iso=IsotonicRegression(out_of_bounds='clip',y_min=.5,y_max=.99).fit(s[:i],ok[:i])
        if iso is not None: st=max(iso.predict([s[i]])[0],.5+1e-9); out[i]=st if up[i] else 1-st
    return out
C=os.path.join(HERE,'loop_sim_side_cache2.pkl')
if os.path.exists(C): FR=pickle.load(open(C,'rb'))
else:
    DS,tabs=datasets(); mk=load_all(); FR={}
    for read in ('RANGE','MOVE'):
        fr=[]
        for g,(name,r_full,_s) in enumerate(DS['markets']):
            d_full=pd.to_datetime(mk[name].index)[1:]; keep=d_full>=START; r=r_full[keep]; d=d_full[keep]
            rows,_=w64(r,read,base=baseline(r,read)); A=pd.DataFrame(rows,columns=['i','cand_raw','b','y'])
            H=hex_walk(r,tabs); pc=0 if read=='MOVE' else 3; h=H[A.i.values-12,pc]; A['ctl_raw']=np.where(np.isnan(h),A.b.values,clip(h)); A['ctl']=calibrate_forward(A.ctl_raw.values,A.y.values); A['ctl_kept']=keep_side_forward(A.ctl_raw.values,A.y.values)
            A['date']=d[A.i.values+1]; A['g']=g; fr.append(A)
        FR[read]=pd.concat(fr,ignore_index=True).sort_values(['date','g']).reset_index(drop=True)
    pickle.dump(FR,open(C,'wb'))
OUT={}
for read in ('RANGE','MOVE'):
    L=FR[read].copy(); y=L.y.values; L['cand']=L.cand_raw; L['kept']=L.cand_raw
    side=(L.cand_raw.values>=.5).astype(int); s=np.maximum(L.cand_raw.values,1-L.cand_raw.values); ok=(side==y).astype(int)
    ms=pd.date_range(START,L.date.max()+pd.Timedelta(days=40),freq='MS')
    for a,b in zip(ms[:-1],ms[1:]):
        past=(L.date<a).values; m=((L.date>=a)&(L.date<b)).values
        if past.sum()<MIN_CAL or not m.any(): continue
        L.loc[m,'cand']=IsotonicRegression(out_of_bounds='clip',y_min=.01,y_max=.99).fit(L.cand_raw.values[past],y[past]).predict(L.cand_raw.values[m])
        st=IsotonicRegression(out_of_bounds='clip',y_min=.5,y_max=.99).fit(s[past],ok[past]).predict(s[m])
        st=np.maximum(st,.5+1e-9); L.loc[m,'kept']=np.where(side[m]==1,st,1-st)   # the side is HEX's; a stated 50% keeps it
    hit=lambda D,c: ((D[c]>=.5).astype(int)==D.y)
    def rule(cand,score,ctl='ctl'):
        d=score(L[cand].values,y)-score(L[ctl].values,y) if score is rw else ll(L[ctl].values,y)-ll(L[cand].values,y)
        T=pd.DataFrame({'date':L.date,'d':d,'hk':hit(L,cand).astype(int),'hc':hit(L,ctl).astype(int)}); days=T.groupby('date').agg(n=('d','size'),dm=('d','mean'),hk=('hk','mean'),hc=('hc','mean'),hks=('hk','sum'),hcs=('hc','sum'))
        live='ctl'; ev=[]; shown={}; n=nd=0; S=S2=Hs=H2=hk=hc=0.
        for date,r in days.iterrows():
            shown[date]=live; n+=r.n; nd+=1; S+=r.dm; S2+=r.dm**2; h=r.hk-r.hc; Hs+=h; H2+=h*h; hk+=r.hks; hc+=r.hcs
            if n<MIN_CALLS or nd<MIN_DAYS: continue
            m=S/nd; se=np.sqrt(max(0,S2/nd-m*m)*nd/(nd-1)/nd); hm=Hs/nd; hse=np.sqrt(max(0,H2/nd-hm*hm)*nd/(nd-1)/nd)
            if live=='ctl' and m-Z*se>0 and hk>=hc: live='cand'; ev.append([str(date.date()),'promote'])
            elif live=='cand' and (m+Z*se<0 or hm+Z*hse<0): live='ctl'; ev.append([str(date.date()),'demote'])
        return ev,np.where(L.date.map(shown)=='cand',L[cand],L[ctl])
    e={}
    e['calls']=len(L)
    e['calls whose side the map changed %']={'6.4 as built':round(float(((L.cand>=.5)!=(L.cand_raw>=.5)).mean())*100,2),'6.2 (its own per-series map)':round(float(((L.ctl>=.5)!=(L.ctl_raw>=.5)).mean())*100,2),'6.4 side-kept':round(float(((L.kept>=.5)!=(L.cand_raw>=.5)).mean())*100,2),'6.2 side-kept':round(float(((L.ctl_kept>=.5)!=(L.ctl_raw>=.5)).mean())*100,2)}
    fl=((L.cand>=.5)!=(L.cand_raw>=.5)).values; fl2=((L.ctl>=.5)!=(L.ctl_raw>=.5)).values
    e['on the calls the map changed: right % before, after']={'6.4':[round(float(hit(L[fl],'cand_raw').mean())*100,1),round(float(hit(L[fl],'cand').mean())*100,1)] if fl.any() else None,'6.2':[round(float(hit(L[fl2],'ctl_raw').mean())*100,1),round(float(hit(L[fl2],'ctl').mean())*100,1)] if fl2.any() else None}
    for nm,(cand,score,ctl) in {'as built, log rule':('cand',ll,'ctl'),'side-kept 6.4 only, log rule':('kept',ll,'ctl'),'side-kept both, closeness rule':('kept',rw,'ctl_kept')}.items():
        ev,L['loop_'+nm]=rule(cand,score,ctl); e['events: '+nm]=ev
    def stats(D):
        def col(c):
            p=D[c].values; s_=np.abs(p-.5); t=s_>=np.quantile(s_,.9); h=hit(D,c).values
            return {'right %':round(float(h.mean())*100,1),'stated %':round(float(np.maximum(p,1-p).mean())*100,1),'reward':round(float(rw(p,D.y.values).mean()),4),'strongest tenth: stated, right':[round(float(np.maximum(p,1-p)[t].mean())*100,1),round(float(h[t].mean())*100,1)]}
        return {k:col(c) for k,c in (('6.2 before its map','ctl_raw'),('6.2','ctl'),('6.2 side-kept','ctl_kept'),('6.4 before any map','cand_raw'),('6.4 as built','cand'),('6.4 side-kept','kept'),('shown, as built','loop_as built, log rule'),('shown, side-kept','loop_side-kept both, closeness rule'),('baseline rule','b'))}
    e['all years']=stats(L); e['by year']={int(yv):stats(D) for yv,D in L.groupby(L.date.dt.year)}
    e['by age of the series (steps since its first)']={lab:stats(L[(L.i>=lo)&(L.i<hi)]) for lab,lo,hi in (('first 100',0,100),('100-250',100,250),('250-500',250,500),('500-1000',500,1000),('1000-2000',1000,2000),('2000+',2000,10**9))}
    OUT[read]=e
    print(read,json.dumps({k:v for k,v in e.items() if k!='by year'},indent=1))
    for yv,D in e['by year'].items(): print(yv,'built',D['shown, as built']['right %'],D['shown, as built']['strongest tenth: stated, right'],'kept',D['shown, side-kept']['right %'],D['shown, side-kept']['strongest tenth: stated, right'],D['shown, side-kept']['reward'],'| 6.2 raw',D['6.2 before its map']['right %'],'6.2',D['6.2']['right %'])
json.dump(OUT,open(os.path.join(HERE,'loop_sim_side.json'),'w'),indent=1)
