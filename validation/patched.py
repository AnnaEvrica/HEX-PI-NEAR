# ===========================================================================
# Deployed SCEFM vs a minimally PATCHED SCEFM, walk-forward, 17 market series,
# scored 2016-01 → 2026-09 on exactly the days the deployed engines were scored.
#
# Kept from the zip (hex6Chat runHex6Engine): the 128-state key — 6 up/down
# lines + the 12-day consensus bit — and decay-weighted memory per state.
#
# Changed (probability & statistics only, no confidence):
#   (1) P(up) = decayed frequency of up-outcomes in the state, shrunk toward
#       the series' own decayed base rate        (was Φ(μ/σ) of the bin)
#   (2) memory is updated only once the outcome is known (no overlap/lookahead)
#   (3) isotonic recalibration, refitted each year on earlier calls only
#   (4) new event: P(next move larger than usual) with 6 size lines
# Null: identical patched engine with each series' returns shuffled.
# ===========================================================================
import numpy as np, pandas as pd, math, json
from sklearn.isotonic import IsotonicRegression
from hexg import load_all, shuffled, SPLIT
LAM=0.999; K=100

def key_dir(r,i):
    mom=int(''.join('1' if v>0 else '0' for v in r[i-5:i+1]),2)
    cb=1 if (r[i-11:i+1]>0).mean()>0.6 else 0
    return (mom<<1)|cb
def run_series(x, h):
    r=np.diff(np.log(x)); n=len(r); a=np.abs(r)
    med=pd.Series(a).expanding(20).median().values
    out_d=np.full(n+1,np.nan); out_m=np.full(n+1,np.nan); yd=np.full(n+1,np.nan); ym=np.full(n+1,np.nan)
    Dd=np.zeros(128);Nd=np.zeros(128);bu=0.;bn=0.
    Dm=np.zeros(64);Nm=np.zeros(64);mu_=0.;mn=0.
    pend=[]
    for i in range(12,n):              # decision at close of bar i+1 in price index terms
        # release outcomes that are now known
        while pend and pend[0][0]<=i:
            _,s,yy,b,sm,ymm,bm=pend.pop(0)
            Dd*=LAM;Nd*=LAM;Dd[s]+=yy-b;Nd[s]+=1;bu=bu*LAM+yy;bn=bn*LAM+1
            if sm is not None:
                Dm*=LAM;Nm*=LAM;Dm[sm]+=ymm-bm;Nm[sm]+=1;mu_=mu_*LAM+ymm;mn=mn*LAM+1
        s=key_dir(r,i); b=(bu+1)/(bn+2); p=min(.99,max(.01,b+Dd[s]/(Nd[s]+K)))
        sm=int(''.join('1' if a[j]>med[j-1] else '0' for j in range(i-5,i+1)),2) if i>25 else None
        bm=(mu_+1)/(mn+2); pm=min(.99,max(.01,bm+Dm[sm]/(Nm[sm]+K))) if sm is not None else np.nan
        out_d[i+1]=p; out_m[i+1]=pm
        if i+h<n:
            yy=int(np.log(x[i+1+h])-np.log(x[i+1])>0); yd[i+1]=yy
            ymm=int(a[i+1]>med[i]) ; ym[i+1]=ymm            # magnitude: next 1-day move
            pend.append((i+h,s,yy,b,sm,ymm,bm))
    return out_d,out_m,yd,ym

def build(S):
    rows=[]
    for k,s in S.items():
        x=s.values; idx=pd.to_datetime(s.index)
        for h in (1,5):
            d,m,yd,ym=run_series(x,h)
            for i in range(len(x)):
                if not np.isnan(d[i]): rows.append((k,idx[i],h,d[i],m[i],yd[i],ym[i]))
    return pd.DataFrame(rows,columns=['id','t','h','p_dir','p_mag','y_dir','y_mag'])

def recalibrate(df,col,ycol):
    df=df.copy(); df[col+'_cal']=np.nan
    for h in (1,5):
        for Y in range(2016,2027):
            tr=df[(df.h==h)&(df.t<pd.Timestamp(f'{Y}-01-01')-pd.Timedelta(days=10))&df[col].notna()&df[ycol].notna()]
            te=(df.h==h)&(df.t.dt.year==Y)&df[col].notna()
            iso=IsotonicRegression(out_of_bounds='clip',y_min=.01,y_max=.99).fit(tr[col],tr[ycol])
            df.loc[te,col+'_cal']=iso.predict(df.loc[te,col])
    return df

def M(p,y,ref):
    p=np.clip(p,.01,.99); br=((p-y)**2).mean(); brr=((np.clip(ref,.01,.99)-y)**2).mean()
    bins=np.clip((p*10).astype(int),0,9); ece=sum((bins==q).mean()*abs(y[bins==q].mean()-p[bins==q].mean()) for q in range(10) if (bins==q).any())
    return {'brier':round(br,5),'brier_skill_vs_drift':round(1-br/brr,4),'log_loss':round(float(-(y*np.log(p)+(1-y)*np.log(1-p)).mean()),4),'ece':round(float(ece),4)}

if __name__=='__main__':
    S=load_all()
    P=recalibrate(recalibrate(build(S),'p_dir','y_dir'),'p_mag','y_mag')
    N=recalibrate(build(shuffled(S,11)),'p_dir','y_dir')
    dep=pd.read_pickle('deployed.pkl'); dep['t']=pd.to_datetime(dep.t)
    out={}; rng=np.random.default_rng(0)
    for h in (1,5):
        d=dep[dep[f'y{h}'].notna()][['id','t',f'scefm_p{h}',f'frozen_p{h}',f'b{h}',f'y{h}']]
        d=d.merge(P[P.h==h][['id','t','p_dir_cal','p_mag_cal','y_mag']],on=['id','t']).dropna(subset=['p_dir_cal'])
        y=d[f'y{h}'].values; ref=d[f'b{h}'].values
        res={'n':len(d),
             'Deployed chat engine (SCEFM)':M(d[f'scefm_p{h}'].values,y,ref),
             'Deployed pipeline (frozen, excl. BTC)':M(d[d.id!='BTC-USD'][f'frozen_p{h}'].values,d[d.id!='BTC-USD'][f'y{h}'].values,d[d.id!='BTC-USD'][f'b{h}'].values),
             'Patched SCEFM (same 128 states)':M(d.p_dir_cal.values,y,ref)}
        nn=N[N.h==h].dropna(subset=['p_dir_cal','y_dir']); nn=nn[nn.t>=SPLIT]
        res['Patched SCEFM on SHUFFLED returns']=M(nn.p_dir_cal.values,nn.y_dir.values,np.full(len(nn),nn.y_dir.mean()))
        # paired bootstrap by month: patched vs deployed Brier
        dd=((np.clip(d.p_dir_cal,.01,.99)-y)**2-(np.clip(d[f'scefm_p{h}'],.01,.99)-y)**2).values
        mo=d.t.dt.to_period('M').values; um=np.unique(mo); grp={u:dd[mo==u] for u in um}
        bs=[np.concatenate([grp[u] for u in rng.choice(um,len(um))]).mean() for _ in range(1000)]
        res['patched_minus_deployed_brier']=[round(dd.mean(),4),[round(np.percentile(bs,2.5),4),round(np.percentile(bs,97.5),4)]]
        if h==1:
            m=d.dropna(subset=['p_mag_cal','y_mag'])
            res['NEW event: next move larger than usual']=M(m.p_mag_cal.values,m.y_mag.values,np.full(len(m),0.5))
            rows=[]
            for lo,hi in ((0,.4),(.4,.45),(.45,.55),(.55,.6),(.6,1)):
                k=(m.p_mag_cal>=lo)&(m.p_mag_cal<hi)
                if k.sum()>50: rows.append({'stated':f'{int(lo*100)}–{int(hi*100)}%','avg_stated':round(m.p_mag_cal[k].mean()*100,1),'happened':round(m.y_mag[k].mean()*100,1),'n':int(k.sum())})
            res['magnitude_reliability']=rows
        out[f'h{h}']=res
        print(f'--- horizon {h} day(s)'); [print('  ',k,v) for k,v in res.items()]
    json.dump(out,open('patched_results.json','w'),indent=1,default=float)
