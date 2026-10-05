# ===========================================================================
# The one-pass replay of HEX PI 7.0 (prereg_replay.md).
# For every series: reveal, score, learn, predict, commit, one timestamp at a
# time. Writes the ledger of every call, the final state of every series
# (the checkpoint), and a check that no call saw its own future.
#   python3 replay.py   -> replay/hex7_ledger.parquet (every call), replay/hex7_state_snapshots.parquet (coefficients every 25th call),
#                          replay/hex7_checkpoint_<date>.json (final state of every series), replay/replay_meta.json
# ===========================================================================
import numpy as np, pandas as pd, json, os, hashlib, sys, time
from sklearn.isotonic import IsotonicRegression
import hex7core as h7, hexcoupled as hc
from hexg import load_all
from precision import datasets, HERE
OUT=os.path.join(HERE,'replay'); os.makedirs(OUT,exist_ok=True); REP=os.path.join(HERE,'data_replication'); START=pd.Timestamp('2016-01-01')
USED_FX=['Australia','Canada','Switzerland','Japan','United Kingdom','New Zealand','Sweden','Norway','Euro','Mexico','India','South Africa']
CODE_HASH=hashlib.sha256(open(os.path.join(HERE,'hex7core.py'),'rb').read()).hexdigest()[:16]
ll=lambda p,y: np.log(np.where(y==1,p,1-p))

def series_list():
    """(class, role, id, dates of each change, changes). role: development or replication."""
    S=[]; mk=load_all()
    for k,s in mk.items():
        s=s[pd.to_datetime(s.index)>=START]; v=s.values.astype(float); S.append(('markets','development',k,pd.to_datetime(s.index)[1:],np.log(v[1:]/v[:-1])))     # log of the ratio, as the product computes it
    fx=pd.read_csv(os.path.join(HERE,'data','exchange-rates-daily.csv')); elig={}
    for c,g in fx.groupby('Country'):
        if c in USED_FX: continue
        v=pd.to_numeric(g.set_index('Date')['Exchange rate'],errors='coerce'); v=v[v>0].sort_index(); v=v[~v.index.duplicated()]; v=v[(pd.to_datetime(v.index)>=START)&(v.index<='2026-09-30')]
        r=np.log(v.values[1:]/v.values[:-1]); ok=len(v)>=2000 and (r!=0).mean()>=0.5; elig[c]={'observations':int(len(v)),'share of days with a change':round(float((r!=0).mean()),3),'included':bool(ok)}
        if ok: S.append(('markets','replication','FX-'+c.replace(' ',''),pd.to_datetime(v.index)[1:],r))
    w=pd.read_csv(os.path.join(HERE,'data','chicago.csv')); w['Date']=pd.to_datetime(w['Date']); w=w.sort_values('Date'); w['x']=pd.to_numeric(w['Max.TemperatureF'],errors='coerce'); w=w[w.x.between(-40,115)]; w=w[w.Date<'2016-01-01']
    S.append(('weather','development','Chicago',pd.DatetimeIndex(w.Date.values[1:]),np.diff(w.x.values)))
    m=pd.read_csv(os.path.join(REP,'daily-max-temperatures.csv')); m.columns=['Date','x']; m['Date']=pd.to_datetime(m.Date); m['x']=pd.to_numeric(m.x,errors='coerce'); m=m.dropna().sort_values('Date')
    S.append(('weather','replication','Melbourne',pd.DatetimeIndex(m.Date.values[1:]),np.diff(m.x.values)))
    s=pd.read_csv(os.path.join(REP,'2016-weather-data-seattle.csv')); s['Date']=pd.to_datetime(s.Date,format='%m/%d/%Y'); s['x']=pd.to_numeric(s.Max_TemperatureC,errors='coerce'); s=s.dropna(subset=['x']).sort_values('Date')
    S.append(('weather','replication','Seattle',pd.DatetimeIndex(s.Date.values[1:]),np.diff(s.x.values)))
    v=pd.read_csv(os.path.join(REP,'weather.csv')); v=v[v.location=='New York'].copy(); v['Date']=pd.to_datetime(v.date); v['x']=pd.to_numeric(v.temp_max,errors='coerce'); v=v.dropna(subset=['x']).sort_values('Date')
    S.append(('weather','replication','NewYork',pd.DatetimeIndex(v.Date.values[1:]),np.diff(v.x.values)))
    DS,_=datasets()
    for k,r,_s in DS['racing']: S.append(('racing','development',k,None,np.asarray(r,float)))
    return S,elig

if __name__=='__main__':
    t0=time.time(); S,elig=series_list(); frames=[]; ckpt={}; rng=np.random.default_rng(11); checks=[]
    for cls,role,sid,dates,r in S:
        chain=[]; h=b''
        for v in r: h=hashlib.sha256(h+np.float64(v).tobytes()).digest(); chain.append(h.hex()[:16])
        for read in ('MOVE','RANGE'):
            rows,fin=h7.walk(r,read,detail=True)
            if not rows: continue
            D=pd.DataFrame(rows); B=np.stack(D.pop('beta').values); I=np.stack(D.pop('influence').values)
            base=np.full(len(r),np.nan); base[D.i.values]=D.null.values
            p65=pd.Series({x[0]:x[1] for x in hc.walk(r,read,base=base)[0]}); D['legacy_65_probability']=p65.reindex(D.i.values).values
            D['date']=dates[D.i.values] if dates is not None else pd.NaT; D['outcome_date']=dates[D.i.values+1] if dates is not None else pd.NaT; D['step']=D.i.values
            D['series_id']=sid; D['class']=cls; D['role']=role; D['read']=read; D['experience_count']=np.arange(1,len(D)+1); D['data_hash']=[chain[i] for i in D.i.values]
            D['rank_coefficients']=list(B[:,:h7.NZ].round(6)); D['cross_read_coefficients']=list(B[:,h7.NZ:].round(6)); D['active_scales']=[[int(w) if w else 0 for w,bv in zip(h7.WINS+(0,),b[:h7.NZ]) if abs(bv)>=0.05] for b in B]
            D['influence_null']=I[:,0]; D['influence_rank']=I[:,1]; D['influence_cross']=I[:,2]; frames.append(D)
            ckpt[f'{sid}|{read}']=dict(series_id=sid,klass=cls,read=read,experience_count=int(len(D)),last_date=str(dates[-1].date()) if dates is not None else None,null=fin['null'],p=fin['p'],rank=fin['rank'],cross=fin['cross'],
                                      beta=[float(v) for v in fin['beta']],influence=[float(v) for v in fin['influence']],state_hash=rows[-1]['state_hash'])
            for t_ in rng.choice(D.i.values[5:],size=min(3,len(D)-5),replace=False):   # no call saw its own future: rerun on the truncated history
                f=h7.walk(r[:t_+1],read)[1]; checks.append(abs(f['p']-float(D.loc[D.i==t_,'p'].iloc[0])))
        print(sid,cls,role,len(r),round(time.time()-t0),'s',flush=True)
    L=pd.concat(frames,ignore_index=True).rename(columns={'null':'null_probability','p':'hex_probability','p_frozen':'frozen_probability','rank':'rank_probability','cross':'cross_probability','y':'outcome'})
    L['engine_version']='7.0'; L['code_hash']=CODE_HASH; y=L.outcome.values
    # the strength map of 6.5, pooled over the development market series night by night; it never changes a call
    L['shown_probability']=L.hex_probability; dev=((L['class']=='markets')&(L.role=='development')).values
    for read in ('MOVE','RANGE'):
        m=dev&(L['read']==read).values; M=L[m].sort_values('outcome_date'); p=M.hex_probability.values; yy=M.outcome.values; od=M.outcome_date.values; cd=M.date.values; s=np.maximum(p,1-p); ok=((p>=.5).astype(int)==yy).astype(int); out=p.copy()
        order=np.argsort(cd,kind='stable'); days=np.unique(cd)
        for d in days:
            past=od<d
            if past.sum()<2000: continue
            g=IsotonicRegression(out_of_bounds='clip',y_min=.5,y_max=.99).fit(s[past],ok[past]); today=cd==d; st=np.minimum(.99,np.maximum(.5001,g.predict(s[today]))); out[today]=np.where(p[today]>=.5,st,1-st)
        L.loc[M.index,'shown_probability']=out
        print('strength map',read,round(time.time()-t0),'s',flush=True)
    for nm,c in (('null','null_probability'),('hex','hex_probability'),('legacy_65','legacy_65_probability'),('shown','shown_probability'),('frozen','frozen_probability')): L[nm+'_log_loss']=-ll(L[c].values,y)
    L['information_gain_vs_null']=L.null_log_loss-L.hex_log_loss; L['information_gain_vs_65']=L.legacy_65_log_loss-L.hex_log_loss; L['learning_gain']=L.frozen_log_loss-L.hex_log_loss
    L['cumulative_information_gain_vs_null']=L.groupby(['series_id','read']).information_gain_vs_null.cumsum(); L['cumulative_information_gain_vs_65']=L.groupby(['series_id','read']).information_gain_vs_65.cumsum()
    L['brier_hex']=(L.hex_probability-y)**2; L['brier_null']=(L.null_probability-y)**2; L['correct_hex']=((L.hex_probability>=.5).astype(int)==y).astype(int); L['correct_null']=((L.null_probability>=.5).astype(int)==y).astype(int)
    L['prediction_strength']=np.maximum(L.hex_probability,1-L.hex_probability); L['calibration_bin']=np.minimum(9,np.floor(L.hex_probability*10)).astype(int)
    for c in ('rank_coefficients','cross_read_coefficients'): L[c]=L[c].map(lambda v: [float(x) for x in v])
    L.drop(columns=['i']).to_parquet(os.path.join(OUT,'hex7_ledger_full.parquet'),index=False)          # every column, with coefficients on every row (large; not kept in the repository)
    # what the repository keeps: every call with what is needed to recompute every number, and the state every 25th call
    keep=['date','outcome_date','step','series_id','class','role','read','engine_version','experience_count','outcome','null_probability','hex_probability','shown_probability','frozen_probability','legacy_65_probability','rank_probability','cross_probability','influence_null','influence_rank','influence_cross','state_hash','data_hash','code_hash']
    C=L[keep].copy()
    for c in keep:
        if C[c].dtype==np.float64 and c not in ('null_probability','hex_probability'): C[c]=C[c].astype(np.float32)
    for c in ('series_id','class','role','read','engine_version','code_hash'): C[c]=C[c].astype('category')
    C.to_parquet(os.path.join(OUT,'hex7_ledger.parquet'),index=False,compression='zstd',compression_level=19)
    last_of=L.groupby(['series_id','read']).experience_count.transform('max')==L.experience_count
    L[(L.experience_count%25==0)|last_of][['series_id','read','date','step','experience_count','rank_coefficients','cross_read_coefficients','influence_null','influence_rank','influence_cross','state_hash']].to_parquet(os.path.join(OUT,'hex7_state_snapshots.parquet'),index=False,compression='zstd')
    last=str(L.outcome_date.max().date()).replace('-','_'); json.dump({'code_hash':CODE_HASH,'engine_version':'7.0','series':ckpt},open(os.path.join(OUT,f'hex7_checkpoint_{last}.json'),'w'),indent=1)
    meta={'rows':int(len(L)),'series':int(L.series_id.nunique()),'code_hash':CODE_HASH,'one-pass check: truncated reruns':len(checks),'largest difference':float(max(checks)),'currency eligibility':elig,'seconds':round(time.time()-t0)}
    json.dump(meta,open(os.path.join(OUT,'replay_meta.json'),'w'),indent=1); print(json.dumps({k:v for k,v in meta.items() if k!='currency eligibility'})); print(json.dumps(elig))
