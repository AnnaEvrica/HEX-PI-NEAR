# ===========================================================================
# The one-pass replay with CER in shadow (prereg_cer.md).
# HEX 7.0 is replayed exactly as in replay.py. Beside every one of its calls
# CER makes its own, from the other channels only (standalone) and on top of
# HEX's call (fusion candidate), with a neighbour's value of the same date
# allowed (lag 0) or not (lag 1), on the real record and on three records
# displaced in time (the controls). Nothing here feeds back into HEX.
#   python3 cer_replay.py   -> cer/cer_ledger.parquet   every call, real record, four arms
#                              cer/cer_controls.parquet the controls, as sums over 20-day blocks
#                              (cer_*: voices combined by past reliability, cer-0.1; cerq_*: by measured weight w = A.L.C.Q, cer-0.2;
#                               cere_*, cert_*: by maximum entropy over interpretations at T = 1 and at the validated temperature, cer-0.3)
#                              cer/cer_edges.json       every edge's own expert, scored alone, its share, and its measured weight
#                              cer/cer_graph_*.json     the descriptive graph of each universe
#                              cer/cer_meta.json        counts, the no-future check, state hashes
# ===========================================================================
import numpy as np, pandas as pd, json, os, hashlib, time, math
from multiprocessing import Pool
import hex7core as h7, cercore as cer
from hexg import load_all
from replay import series_list, HERE
OUT=os.path.join(HERE,'cer'); os.makedirs(OUT,exist_ok=True); LN2=math.log(2)
SHIFTS={'real':0,'C1':1096,'C2':913,'C3':1279}; LAGS=(0,1); OFFSETS=('null','hex'); BLOCK=20
CODE_HASH=hashlib.sha256(open(os.path.join(HERE,'cercore.py'),'rb').read()+open(os.path.join(HERE,'hex7core.py'),'rb').read()).hexdigest()[:16]
days=lambda d: pd.DatetimeIndex(d).values.astype('datetime64[D]').astype(np.int64)
def env_of(sid): return 'currency' if sid.startswith('FX-') else 'energy' if sid in ('WTI','BRENT','NATGAS') else 'volatility' if sid=='VIX' else 'crypto' if sid.startswith('BTC') else 'temperature'
UNIT={'Chicago':'degF','Seattle':'degC','NewYork':'degC','Melbourne':'degC'}
def make(sid, dates, r, source):
    c=cer.channel(sid,env_of(sid),days(dates),r,UNIT.get(sid,'log change'),source); c['Z']=cer.coordinates(c); c['dates']=pd.DatetimeIndex(dates); return c
def hexrows(c): return {read:pd.DataFrame(h7.walk(c['r'],read)[0]) for read in ('MOVE','RANGE')}

def build():
    """The three universes: channels, who is whose neighbour, and HEX 7.0's own calls on every target."""
    S,_=series_list(); U={}; meta={}
    mk=[make(sid,dt,r,'replay.py: series_list') for cls,role,sid,dt,r in S if cls=='markets']; role={sid:(cls,role) for cls,role,sid,dt,r in S}
    U['markets']=dict(lag=1,channels=mk,neighbours={c['id']:[n for n in mk if n is not c] for c in mk})
    wx=[make(sid,dt,r,'replay.py: series_list') for cls,role_,sid,dt,r in S if cls=='weather']
    U['temperature']=dict(lag=0,channels=wx,neighbours={c['id']:[n for n in wx if n is not c] for c in wx})
    raw=load_all(); en=[]
    for k in ('NATGAS','WTI','BRENT'):
        s=raw[k]; s=s[(s.index>='1997-01-01')&(s.index<='2015-12-31')]; v=s.values.astype(float); en.append(make(k,pd.to_datetime(s.index)[1:],np.log(v[1:]/v[:-1]),'hexg.py: load_all, 1997-2015')); role[k+'@x']=('markets','not in the 7.0 replay')
    wx2=[c for c in wx if c['id'] in ('Chicago','Seattle')]
    U['energy x temperature']=dict(lag=1,channels=en+wx2,neighbours={**{c['id']:wx2 for c in en},**{c['id']:en for c in wx2}})
    for u in U.values():
        for c in u['channels']:
            if 'rows' not in c: c['rows']=hexrows(c)
    return U,role

def blocksum(day, g):
    b=day//BLOCK; ub,inv=np.unique(b,return_inverse=True); return ub,np.bincount(inv,weights=g),np.bincount(inv)
def interval(day, g, rng, B=1000):
    """Mean of g in bits per call with a 95% interval from a bootstrap over 20-day blocks."""
    if not len(g): return None
    _,s,n=blocksum(day,g); idx=rng.integers(0,len(s),(B,len(s))); m=s[idx].sum(1)/n[idx].sum(1)
    return [float(g.mean()),float(np.percentile(m,2.5)),float(np.percentile(m,97.5))]

def task(a):
    uname,tid,read=a; u=U[uname]; c=[x for x in u['channels'] if x['id']==tid][0]; N=u['neighbours'][tid]; R=c['rows'][read]
    td=c['days'][R.i.values]; y=R.y.values.astype(int); off={'null':R.null.values,'hex':R.p.values}; ll=lambda p: np.log(np.where(y==1,p,1-p))/LN2
    rng=np.random.default_rng(int(hashlib.sha256(f'{uname}|{tid}|{read}'.encode()).hexdigest()[:8],16))
    D=pd.DataFrame({'universe':uname,'series_id':tid,'read':read,'step':R.i.values,'day':td,'outcome':y,'null_probability':off['null'],'hex_probability':off['hex']}); ctl=[]; edges=[]; hashes={}; checks=[]
    for lag in LAGS:
        for var,shift in SHIFTS.items():
            F,M=cer.features(td,N,lag,shift); pres=M.any(1); measured=var=='real' or lag==u['lag']                      # the measured weighting: both arms on the real record, the arm that counts on the controls
            Wq,Ev,parts=cer.edge_weights(td,c,N,lag,read,shift) if measured else (None,None,None); rx=(Ev,cer.temperatures(Ev,M)) if measured else None
            if var=='real': D[f'temperature_lag{lag}']=rx[1].astype(np.float32); D[f'eligible_lag{lag}']=((Ev>0)&M).sum(1).astype(np.int16)
            if var=='real': D[f'present_lag{lag}']=M.sum(1).astype(np.int16)
            for on in OFFSETS:
                if var=='real':
                    p,I,W,hsh,pq,pe,pt=cer.walk(off[on],y,F,M,detail=True,weights=Wq,relax=rx); D[f'cer_{on}_lag{lag}']=p; D[f'cerq_{on}_lag{lag}']=pq; D[f'cere_{on}_lag{lag}']=pe; D[f'cert_{on}_lag{lag}']=pt; hashes[f'{on}|lag{lag}']=hsh; lo=ll(off[on])
                    for k,name in enumerate(['(pool)']+[n['id'] for n in N]):
                        m=pres if k==0 else M[:,k-1]
                        if m.sum()<50: edges.append(dict(universe=uname,target=tid,read=read,offset=on,lag=lag,source=name,calls=int(m.sum()),status='insufficient data')); continue
                        iv=interval(td[m],(ll(W[:,k+1])-lo)[m],rng)
                        edges.append(dict(universe=uname,target=tid,read=read,offset=on,lag=lag,source=name,calls=int(m.sum()),status='ok',bits_per_call=iv[0],low=iv[1],high=iv[2],predictive=bool(iv[1]>0),share_at_the_end=float(I[-1,k+1]),mean_share=float(I[m,k+1].mean()),starting_share=1.0/(len(N)+2),
                                          **({} if k==0 else dict(mean_A=float(parts[k-1,0]),mean_L=float(parts[k-1,1]),mean_C=float(parts[k-1,2]),mean_Q=float(parts[k-1,3]),mean_weight=float(parts[k-1,4]),calls_with_weight=float(((Wq[:,k-1]>0)&M[:,k-1]).mean())))))
                    if lag==u['lag'] and on=='null':                               # no call saw its own future: rebuild every channel from its truncated record and rerun
                        for t_ in rng.choice(np.arange(len(td)//3,len(td)),size=2,replace=False):
                            cut=td[t_]; Nt=[]
                            for n in N:
                                k=int((n['days']<=cut).sum()); nn=cer.channel(n['id'],n['env'],n['days'][:k],n['r'][:k]) if k else cer.channel(n['id'],n['env'],[10**7],[0.0]); nn['Z']=cer.coordinates(nn); Nt.append(nn)
                            kt=R.i.values[t_]+1; ct=cer.channel(c['id'],c['env'],c['days'][:kt],c['r'][:kt])
                            Rt=pd.DataFrame(h7.walk(c['r'][:R.i.values[t_]+2],read)[0]); Ft,Mt=cer.features(c['days'][Rt.i.values],Nt,lag,0)
                            Wt_,Et_,_=cer.edge_weights(c['days'][Rt.i.values],ct,Nt,lag,read); o_=cer.walk(Rt.null.values,Rt.y.values,Ft,Mt,weights=Wt_,relax=(Et_,cer.temperatures(Et_,Mt))); checks.append(float(max(abs(a_[-1]-b_[t_]) for a_,b_ in zip(o_,(p,pq,pe,pt)))))
                else:
                    out=cer.walk(off[on],y,F,M,weights=Wq,relax=rx); out=out if measured else (out,None,None,None)
                    for wname,p in zip(('reliability','measurement','relaxation','relaxation, tempered'),out):
                        if p is None or not pres.any(): continue
                        b,s,n=blocksum(td[pres],(ll(p)-ll(off[on]))[pres]); ctl.append(pd.DataFrame({'universe':uname,'series_id':tid,'read':read,'offset':on,'lag':lag,'variant':var,'weighting':wname,'block':b,'calls':n,'gain_bits':s}))
    return D,pd.concat(ctl,ignore_index=True),edges,{f'{uname}|{tid}|{read}|{k}':v for k,v in hashes.items()},checks

if __name__=='__main__':
    t0=time.time(); U,role=build(); print('built',round(time.time()-t0),'s',flush=True)
    jobs=[(un,c['id'],read) for un,u in U.items() for c in u['channels'] for read in ('MOVE','RANGE')]
    jobs.sort(key=lambda a: -len([x for x in U[a[0]]['channels'] if x['id']==a[1]][0]['r'])*(len(U[a[0]]['neighbours'][a[1]])+2))
    frames=[]; ctl=[]; edges=[]; hashes={}; checks=[]
    with Pool(2) as pool:
        for k,(D,C,E,H,X) in enumerate(pool.imap_unordered(task,jobs)):
            frames.append(D); ctl.append(C); edges+=E; hashes.update(H); checks+=X; print(k+1,len(jobs),D.universe.iloc[0],D.series_id.iloc[0],D['read'].iloc[0],len(D),round(time.time()-t0),'s',flush=True)
    L=pd.concat(frames,ignore_index=True); L['date']=pd.to_datetime(L.day,unit='D')
    nxt={}
    for un,u in U.items():
        for c in u['channels']: nxt[(un,c['id'])]=c['days']
    L['outcome_date']=pd.to_datetime([nxt[(un,s)][i+1] for un,s,i in zip(L.universe,L.series_id,L.step)],unit='D')
    L['class']=['weather' if env_of(s)=='temperature' else 'markets' for s in L.series_id]
    L['role']=[role[s+'@x'][1] if un=='energy x temperature' and s+'@x' in role else role[s][1] for un,s in zip(L.universe,L.series_id)]
    keep=(L.universe!='energy x temperature')|(L.present_lag0>0)|(L.present_lag1>0)        # temperature targets of the third universe: only the years the energy series exist
    L=L[keep].sort_values(['universe','series_id','read','step']).reset_index(drop=True); L['engine_version']='7.0'; L['cer_version']=cer.VERSION; L['code_hash']=CODE_HASH
    for c in ('universe','series_id','read','class','role','engine_version','cer_version','code_hash'): L[c]=L[c].astype('category')
    for c in [x for x in L.columns if x.startswith(('cer_null','cer_hex'))]: L[c]=np.round(L[c],6).astype(np.float32)       # CER's probabilities are kept to six decimals
    for c in [x for x in L.columns if x.startswith(('cerq_','cere_','cert_'))]:        # the measurement-based modes equal their offset on most calls: kept as the departure from it
        L['d_'+c]=np.round(L[c]-L['null_probability' if '_null_' in c else 'hex_probability'],6).astype(np.float32); L=L.drop(columns=c)
    L.drop(columns=['day']).to_parquet(os.path.join(OUT,'cer_ledger.parquet'),index=False,compression='zstd',compression_level=19)
    C=pd.concat(ctl,ignore_index=True)
    for c in ('universe','series_id','read','offset','variant','weighting'): C[c]=C[c].astype('category')
    C.to_parquet(os.path.join(OUT,'cer_controls.parquet'),index=False,compression='zstd',compression_level=19)
    json.dump(edges,open(os.path.join(OUT,'cer_edges.json'),'w'))
    for un,u in U.items():                                                         # the descriptive graph, as of the last day of the universe
        G=cer.graph(u['channels'],int(max(c['days'][-1] for c in u['channels'])))
        for e in G['edges']:
            if 'controls' in e: e['controls']=len(e['controls'])
        json.dump(G,open(os.path.join(OUT,'cer_graph_'+un.replace(' x ','_x_')+'.json'),'w')); print('graph',un,len(G['edges']),round(time.time()-t0),'s',flush=True)
    meta={'rows':int(len(L)),'targets':int(L.groupby(['universe','series_id'],observed=True).ngroups),'cer_version':cer.VERSION,'code_hash':CODE_HASH,'controls: displacement in days':{k:v for k,v in SHIFTS.items() if v},
          'no-future check: truncated reruns':len(checks),'largest difference':float(max(checks)),'state hashes':hashes,'seconds':round(time.time()-t0)}
    json.dump(meta,open(os.path.join(OUT,'cer_meta.json'),'w'),indent=1); print(json.dumps({k:v for k,v in meta.items() if k!='state hashes'}))
