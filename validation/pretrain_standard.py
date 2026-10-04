# The standard test (17 market series walked from their start, scored on
# 2016-2026 after yearly isotonic recalibration on earlier calls), with and
# without the pre-trained tables. Tables are trained on data before 2016 (and
# weather before 1991, half the jockeys), so the scored period is untouched.
import numpy as np, pandas as pd, json, os
from hexg import load_all
from patched import M
from field import recalibrate
from pretrain import load_families, train_tables, walk, FAMILIES, HERE
F=load_families(); T=[train_tables(F[f]['train']) for f in FAMILIES]
S=load_all(); rows=[]
for k,s in S.items():
    idx=pd.to_datetime(s.index); r=np.diff(np.log(s.values.astype(float)))
    a,_,_=walk(r,[]); b,_,_=walk(r,T)
    for j in range(len(a)):
        rows.append((k,idx[12+j+2],a[j,0],b[j,0],a[j,2],a[j,3],b[j,3],a[j,5]))
D=pd.DataFrame(rows,columns=['id','t','p_plain','p_pre','y_dir','m_plain','m_pre','y_mag'])
for c,yc in (('p_plain','y_dir'),('p_pre','y_dir'),('m_plain','y_mag'),('m_pre','y_mag')): D=recalibrate(D,c,yc)
Tt=D[(D.t>='2016-01-01')].dropna(subset=['p_pre_cal','m_pre_cal','m_plain_cal'])
ref=np.full(len(Tt),Tt.y_dir.mean()); refm=np.full(len(Tt),Tt.y_mag.mean())
out={'n':len(Tt),'direction, field only':M(Tt.p_plain_cal.values,Tt.y_dir.values,ref),'direction, field + pre-trained':M(Tt.p_pre_cal.values,Tt.y_dir.values,ref),
     'size, field only':M(Tt.m_plain_cal.values,Tt.y_mag.values,refm),'size, field + pre-trained':M(Tt.m_pre_cal.values,Tt.y_mag.values,refm)}
rng=np.random.default_rng(0); mo=Tt.t.dt.to_period('M').values; um=np.unique(mo)
for nm,(x,y,yc) in {'direction':('p_pre_cal','p_plain_cal','y_dir'),'size':('m_pre_cal','m_plain_cal','y_mag')}.items():
    d=((Tt[x]-Tt[yc])**2-(Tt[y]-Tt[yc])**2).values; grp={u:d[mo==u] for u in um}
    bs=[np.concatenate([grp[u] for u in rng.choice(um,len(um))]).mean() for _ in range(1000)]
    out[f'{nm}: pre-trained minus field-only Brier']=[round(float(d.mean()),6),[round(float(np.percentile(bs,2.5)),6),round(float(np.percentile(bs,97.5)),6)]]
for k,v in out.items(): print(k,v)
json.dump(out,open(os.path.join(HERE,'pretrain_standard_results.json'),'w'),indent=1,default=float)
