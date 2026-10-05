# Reward as progress, never negative (a shortfall is a lesson, kept for analysis only): closeness of a call minus the average closeness of the same
# version's earlier calls on the same series (0.75, a coin flip, before the first).
# Same ten-year cold start as loop_sim_side.py (reads its cache).
import numpy as np, pandas as pd, json, os, pickle
from sklearn.isotonic import IsotonicRegression
HERE=os.path.dirname(os.path.abspath(__file__)); FR=pickle.load(open(os.path.join(HERE,'loop_sim_side_cache2.pkl'),'rb')); START=pd.Timestamp('2016-01-01'); OUT={}
def prog(L,c):
    cl=1-(L[c].values-L.y.values)**2; g=L.g.values; out=np.empty(len(L))
    for k in np.unique(g):
        m=g==k; x=cl[m]; before=np.concatenate([[.75],np.cumsum(x)[:-1]/np.arange(1,len(x))]); out[m]=x-before
    return out,cl
for read in ('RANGE','MOVE'):
    L=FR[read].copy(); y=L.y.values; L['kept']=L.cand_raw; side=(L.cand_raw.values>=.5).astype(int); s=np.maximum(L.cand_raw.values,1-L.cand_raw.values); ok=(side==y).astype(int)
    ms=pd.date_range(START,L.date.max()+pd.Timedelta(days=40),freq='MS')
    for a,b in zip(ms[:-1],ms[1:]):
        past=(L.date<a).values; m=((L.date>=a)&(L.date<b)).values
        if past.sum()<2000 or not m.any(): continue
        st=np.maximum(IsotonicRegression(out_of_bounds='clip',y_min=.5,y_max=.99).fit(s[past],ok[past]).predict(s[m]),.5+1e-9); L.loc[m,'kept']=np.where(side[m]==1,st,1-st)
    e={}
    for nm,c in (('6.4','kept'),('6.2','ctl_kept')):
        L['p_'+c],L['c_'+c]=prog(L,c)
        R=np.maximum(L['p_'+c].values,0); e[nm]={'mean reward x1000 (no negatives)':round(float(R.mean())*1000,2),'share of calls rewarded %':round(float((R>0).mean())*100,1),'mean lesson x1000':round(float(np.maximum(-L['p_'+c].values,0).mean())*1000,2),'reward by age x1000':{lab:round(float(np.maximum(L['p_'+c].values[((L.i>=lo)&(L.i<hi)).values],0).mean())*1000,1) for lab,lo,hi in (('first 100',0,100),('100-250',100,250),('250-500',250,500),('500-1000',500,1000),('1000-2000',1000,2000),('2000+',2000,10**9))},'mean closeness':round(float(L['c_'+c].mean()),4),'mean progress x1000':round(float(L['p_'+c].mean())*1000,2),'total progress per series':round(float(L.groupby('g')['p_'+c].sum().mean()),2),
               'by age':{lab:{'closeness':round(float(D['c_'+c].mean()),4),'progress x1000':round(float(D['p_'+c].mean())*1000,2)} for lab,lo,hi in (('first 100',0,100),('100-250',100,250),('250-500',250,500),('500-1000',500,1000),('1000-2000',1000,2000),('2000+',2000,10**9)) for D in [L[(L.i>=lo)&(L.i<hi)]]},
               'by year':{int(yv):{'closeness':round(float(D['c_'+c].mean()),4),'progress x1000':round(float(D['p_'+c].mean())*1000,2)} for yv,D in L.groupby(L.date.dt.year)}}
    OUT[read]=e; print(read); [print(' ',k,{a:b for a,b in v.items() if a not in('by age','by year')},'\n   age',v['by age'],'\n   year',v['by year']) for k,v in e.items()]
json.dump(OUT,open(os.path.join(HERE,'progress_sim.json'),'w'),indent=1)
