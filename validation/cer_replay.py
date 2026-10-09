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
# The three comparators (measurement, relaxation, tempered) are frozen at cer-0.3 (cer/frozen_manifest.json). They take 45 minutes to
# recompute and their code is unchanged, so by default their committed calls are carried over and only a sample of targets is recomputed
# and checked against them. CER_FROZEN=all recomputes every one. The reliability comparator is recomputed for every call either way.
FROZEN=os.environ.get('CER_FROZEN','sample'); SAMPLE={('temperature','NewYork','MOVE'),('temperature','NewYork','RANGE'),('temperature','Melbourne','MOVE'),('markets','FX-Euro','RANGE'),('markets','WTI','MOVE'),('markets','BTC-USD','MOVE'),('energy x temperature','NATGAS','MOVE')}
CODE_HASH=hashlib.sha256(open(os.path.join(HERE,'cercore.py'),'rb').read()+open(os.path.join(HERE,'hex7core.py'),'rb').read()).hexdigest()[:16]
days=lambda d: pd.DatetimeIndex(d).values.astype('datetime64[D]').astype(np.int64)
def env_of(sid): return 'currency' if sid.startswith('FX-') else 'energy' if sid in ('WTI','BRENT','NATGAS') else 'volatility' if sid=='VIX' else 'crypto' if sid.startswith('BTC') else 'temperature'
UNIT={'Chicago':'degF','Seattle':'degC','NewYork':'degC','Melbourne':'degC'}
def make(sid, dates, r, source):
    c=cer.channel(sid,env_of(sid),days(dates),r,UNIT.get(sid,'log change'),source); cer.prepare(c); c['dates']=pd.DatetimeIndex(dates); return c
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
    D=pd.DataFrame({'universe':uname,'series_id':tid,'read':read,'step':R.i.values,'day':td,'outcome':y,'null_probability':off['null'],'hex_probability':off['hex']}); ctl=[]; edges=[]; hashes={}; checks=[]; frozen=FROZEN=='all' or (FROZEN=='sample' and a in SAMPLE); mom=[]; sig=None
    for lag in LAGS:
        for var,shift in SHIFTS.items():
            F,M=cer.features(td,N,lag,shift); pres=M.any(1); measured=var=='real' or lag==u['lag']                      # the measured weighting: both arms on the real record, the arm that counts on the controls
            Wq,Ev,parts=cer.edge_weights(td,c,N,lag,read,shift) if measured and frozen else (None,None,None); rx=(Ev,cer.temperatures(Ev,M)) if measured and frozen else None
            if var=='real' and frozen: D[f'temperature_lag{lag}']=rx[1].astype(np.float32); D[f'eligible_lag{lag}']=((Ev>0)&M).sum(1).astype(np.int16)
            Em,nov,S,sm=cer.moments(td,c,N,lag,read,shift,perceive=(var=='real' and read=='MOVE')) if measured else (None,None,None,None)      # the moment: perceived once per target (on its changes), eligibility per read
            if var=='real':
                D[f'moment_eligible_lag{lag}']=((Em>0)&np.c_[pres,M]).sum(1).astype(np.int16)
                for k,name in enumerate(['(pool)']+[n['id'] for n in N]): mom.append(dict(universe=uname,target=tid,read=read,lag=lag,source=name,mean_evidence=float(sm['mean_evidence'][k]),share_of_measurements_eligible=float(sm['share_of_measurements_eligible'][k])))
                if nov is not None:
                    for k,nm in enumerate(('intrinsic_tail','joint_tail','relational_surprisal','temporal_tail')): D[f'{nm}_lag{lag}']=nov[:,k].astype(np.float32)
                    if lag==u['lag']: sig=S
            if var=='real': D[f'present_lag{lag}']=M.sum(1).astype(np.int16)
            for on in OFFSETS:
                if var=='real':
                    p,I,W,hsh,pq,pe,pt,pm=cer.walk(off[on],y,F,M,detail=True,weights=Wq,relax=rx,moments=Em); D[f'cer_{on}_lag{lag}']=p; D[f'cerm_{on}_lag{lag}']=pm
                    if frozen: D[f'cerq_{on}_lag{lag}']=pq; D[f'cere_{on}_lag{lag}']=pe; D[f'cert_{on}_lag{lag}']=pt
                    hashes[f'{on}|lag{lag}']=hsh; lo=ll(off[on])
                    for k,name in enumerate(['(pool)']+[n['id'] for n in N]):
                        m=pres if k==0 else M[:,k-1]
                        if m.sum()<50: edges.append(dict(universe=uname,target=tid,read=read,offset=on,lag=lag,source=name,calls=int(m.sum()),status='insufficient data')); continue
                        iv=interval(td[m],(ll(W[:,k+1])-lo)[m],rng)
                        edges.append(dict(universe=uname,target=tid,read=read,offset=on,lag=lag,source=name,calls=int(m.sum()),status='ok',bits_per_call=iv[0],low=iv[1],high=iv[2],predictive=bool(iv[1]>0),share_at_the_end=float(I[-1,k+1]),mean_share=float(I[m,k+1].mean()),starting_share=1.0/(len(N)+2),
                                          **({} if k==0 or parts is None else dict(mean_A=float(parts[k-1,0]),mean_L=float(parts[k-1,1]),mean_C=float(parts[k-1,2]),mean_Q=float(parts[k-1,3]),mean_weight=float(parts[k-1,4]),calls_with_weight=float(((Wq[:,k-1]>0)&M[:,k-1]).mean())))))
                    if lag==u['lag'] and on=='null':                               # no call saw its own future: rebuild every channel from its truncated record and rerun
                        for t_ in rng.choice(np.arange(len(td)//3,len(td)),size=2,replace=False):
                            cut=td[t_]; Nt=[]
                            for n in N:
                                k=int((n['days']<=cut).sum()); nn=cer.channel(n['id'],n['env'],n['days'][:k],n['r'][:k]) if k else cer.channel(n['id'],n['env'],[10**7],[0.0]); nn['Z']=cer.coordinates(nn); Nt.append(nn)
                            kt=R.i.values[t_]+1; ct=cer.channel(c['id'],c['env'],c['days'][:kt],c['r'][:kt])
                            Rt=pd.DataFrame(h7.walk(c['r'][:R.i.values[t_]+2],read)[0]); Ft,Mt=cer.features(c['days'][Rt.i.values],Nt,lag,0)
                            for n_ in Nt+[ct]: cer.prepare(n_)
                            Wt_,Et_,_=cer.edge_weights(c['days'][Rt.i.values],ct,Nt,lag,read) if frozen else (None,None,None); tdt=c['days'][Rt.i.values]; Emt,novt,_s,_m=cer.moments(tdt,ct,Nt,lag,read,perceive=nov is not None)
                            o_=cer.walk(Rt.null.values,Rt.y.values,Ft,Mt,detail=True,weights=Wt_,relax=(Et_,cer.temperatures(Et_,Mt)) if frozen else None,moments=Emt); o_=(o_[0],)+o_[4:]
                            checks.append(float(max(abs(a_[-1]-b_[t_]) for a_,b_ in zip(o_,(p,pq,pe,pt,pm)) if a_ is not None))); checks.append(float(np.nanmax(np.abs(novt[-1]-nov[t_]))) if nov is not None and not np.isnan(nov[t_,:3]).any() else 0.0)
                else:
                    o_=cer.walk(off[on],y,F,M,detail=True,weights=Wq,relax=rx,moments=Em); out=(o_[0],)+o_[4:]
                    for wname,p in zip(('reliability','measurement','relaxation','relaxation, tempered','moment'),out):
                        if p is None or not pres.any(): continue
                        b,s,n=blocksum(td[pres],(ll(p)-ll(off[on]))[pres]); ctl.append(pd.DataFrame({'universe':uname,'series_id':tid,'read':read,'offset':on,'lag':lag,'variant':var,'weighting':wname,'block':b,'calls':n,'gain_bits':s}))
    def lite(S):
        if S is None or S.get('status')!='ok': return None
        ids=['(pool)']+[n['id'] for n in N]; f=lambda v: [round(float(x),4) for x in v]
        return dict(target=tid,as_of=str(pd.Timestamp(S['as_of'],unit='D').date()),lag=S['lag'],samples=S['samples'],neighbours=ids[1:],coverage=f(S['coverage']),harmony=f(S['harmony']),edge_standard_error=f(np.nan_to_num(S['edge_standard_error'])),
                    leadership_lags_1_to_5=[f(v) for v in S['leadership']],following_lags_1_to_5=[f(v) for v in S['following']],persistence_lags_1_to_5=f(S['persistence']),partial_leadership_lags_1_to_3=[f(v) for v in S['partial_leadership']],
                    evidence={ids[k]:round(float(S['evidence'][k]),3) for k in range(len(ids))},eligible=S['eligible'],counterpoint=S['counterpoint'],rhythm=S['rhythm'],temporal_novelty=S.get('temporal_novelty'))
    return D,pd.concat(ctl,ignore_index=True),edges,{f'{uname}|{tid}|{read}|{k}':v for k,v in hashes.items()},checks,mom,lite(sig)

if __name__=='__main__':
    t0=time.time(); U,role=build(); print('built',round(time.time()-t0),'s',flush=True)
    jobs=[(un,c['id'],read) for un,u in U.items() for c in u['channels'] for read in ('MOVE','RANGE')]
    jobs.sort(key=lambda a: -len([x for x in U[a[0]]['channels'] if x['id']==a[1]][0]['r'])*(len(U[a[0]]['neighbours'][a[1]])+2))
    frames=[]; ctl=[]; edges=[]; hashes={}; checks=[]; moms=[]; sigs={}
    with Pool(2) as pool:
        for k,(D,C,E,H,X,MO,SG) in enumerate(pool.imap_unordered(task,jobs)):
            frames.append(D); ctl.append(C); edges+=E; hashes.update(H); checks+=X; moms+=MO
            if SG: sigs.setdefault(D.universe.iloc[0],{})[SG['target']]=SG
            print(k+1,len(jobs),D.universe.iloc[0],D.series_id.iloc[0],D['read'].iloc[0],len(D),round(time.time()-t0),'s',flush=True)
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
    for c in [x for x in L.columns if x.startswith(('cerq_','cere_','cert_','cerm_'))]:        # the measurement-based modes equal their offset on most calls: kept as the departure from it
        L['d_'+c]=np.round(L[c]-L['null_probability' if '_null_' in c else 'hex_probability'],6).astype(np.float32); L=L.drop(columns=c)
    C=pd.concat(ctl,ignore_index=True); frozen={'mode':FROZEN}; led=os.path.join(OUT,'cer_ledger.parquet'); con=os.path.join(OUT,'cer_controls.parquet')
    if FROZEN!='all':                                                               # carry the frozen comparators over from the committed run, and check what was recomputed against it
        OLD=pd.read_parquet(led); key=['universe','series_id','read','step']; assert len(OLD)==len(L) and (L[key].astype(str).values==OLD[key].astype(str).values).all(), 'the calls differ from the committed ledger'
        frozen['reliability, every call: largest difference from the committed calls']=float(max(np.abs(L[c].astype(float).values-OLD[c].astype(float).values).max() for c in OLD.columns if c.startswith(('cer_null','cer_hex'))))
        frozen['the null and HEX 7.0, every call: largest difference']=float(max(np.abs(L[c].values-OLD[c].values).max() for c in ('null_probability','hex_probability')))
        worst=0.0; nrows=0
        for c in [x for x in OLD.columns if x.startswith(('d_cerq_','d_cere_','d_cert_','temperature_lag','eligible_lag'))]:
            if c in L: m=L[c].notna().values; worst=max(worst,float(np.abs(L[c].astype(float).values[m]-OLD[c].astype(float).values[m]).max())) if m.any() else worst; nrows=max(nrows,int(m.sum()))
            L[c]=OLD[c].values
        frozen['measurement and relaxation, recomputed on a sample of targets: calls, largest difference']=[nrows,worst]
        OC=pd.read_parquet(con); k2=['universe','series_id','read','offset','lag','variant','weighting','block']
        for d_ in (OC,C):
            for c in ('universe','series_id','read','offset','variant','weighting'): d_[c]=d_[c].astype(str)
        mrg=OC.merge(C[C.weighting!='moment'],on=k2,suffixes=('','_new')); frozen['controls recomputed: blocks, largest difference in bits']=[int(len(mrg)),float(np.abs(mrg.gain_bits-mrg.gain_bits_new).max())]
        C=pd.concat([OC[OC.weighting!='moment'],C[C.weighting=='moment']],ignore_index=True)
    L.drop(columns=['day']).to_parquet(led,index=False,compression='zstd',compression_level=19)
    for c in ('universe','series_id','read','offset','variant','weighting'): C[c]=C[c].astype('category')
    C.to_parquet(con,index=False,compression='zstd',compression_level=19)
    json.dump(moms,open(os.path.join(OUT,'cer_moment_edges.json'),'w'))
    for un,sg in sigs.items(): json.dump(sg,open(os.path.join(OUT,'cer_moment_'+un.replace(' x ','_x_')+'.json'),'w'),default=lambda o: o.tolist() if hasattr(o,'tolist') else str(o))   # the signature of the last moment each target met
    if FROZEN=='all':
        json.dump(edges,open(os.path.join(OUT,'cer_edges.json'),'w'))
        for un,u in U.items():                                                     # the descriptive graph, as of the last day of the universe
            G=cer.graph(u['channels'],int(max(c['days'][-1] for c in u['channels'])))
            for e in G['edges']:
                if 'controls' in e: e['controls']=len(e['controls'])
            json.dump(G,open(os.path.join(OUT,'cer_graph_'+un.replace(' x ','_x_')+'.json'),'w')); print('graph',un,len(G['edges']),round(time.time()-t0),'s',flush=True)
    H7=pd.read_parquet(os.path.join(HERE,'replay','hex7_ledger.parquet')); S43,_=series_list(); worst=0.0; ncalls=0                # HEX 7.0 itself: all 43 series against its committed ledger
    for cls,rl,sid,dt,rr in S43:
        for read in ('MOVE','RANGE'):
            D=pd.DataFrame(h7.walk(rr,read)[0]).set_index('i'); G=H7[(H7.series_id==sid)&(H7['read']==read)].set_index('step'); m=D.join(G[['hex_probability','null_probability']],how='inner'); assert len(m)==len(G)
            worst=max(worst,float((m.p-m.hex_probability).abs().max()),float((m.null-m.null_probability).abs().max())); ncalls+=len(m)
    meta={'rows':int(len(L)),'targets':int(L.groupby(['universe','series_id'],observed=True).ngroups),'cer_version':cer.VERSION,'code_hash':CODE_HASH,'controls: displacement in days':{k:v for k,v in SHIFTS.items() if v},
          'no-future check: truncated reruns':len(checks),'largest difference':float(max(checks)),'HEX 7.0 against its committed ledger':{'series':len(S43),'calls':int(ncalls),'largest difference':worst},'frozen comparators':frozen,'state hashes':hashes,'seconds':round(time.time()-t0)}
    json.dump(meta,open(os.path.join(OUT,'cer_meta.json'),'w'),indent=1); print(json.dumps({k:v for k,v in meta.items() if k!='state hashes'}))
