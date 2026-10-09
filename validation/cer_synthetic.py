# ===========================================================================
# CER on signals whose relationships are known because they were built in.
# Ten tests (prereg_cer.md; the brief's section 8). Each prints PASS or FAIL
# with the numbers it was judged on. Also writes tests/cer_reference.json:
# the same signals and this implementation's answers, for tests/cer.mjs to
# hold base44/shared/cer/*.ts to.
#   python3 cer_synthetic.py
# ===========================================================================
import numpy as np, json, os, hashlib, math
import cercore as cer, hex7core as h7
HERE=os.path.dirname(os.path.abspath(__file__)); LN2=math.log(2); bad=0; REF={'measure':[],'infer':[],'asof':[]}
def check(name, ok, **nums):
    global bad; bad+=not ok; print('PASS' if ok else 'FAIL',name,json.dumps({k:(round(v,4) if isinstance(v,float) else v) for k,v in nums.items()}))
def ar(rng,n,phi=0.5):
    e=rng.standard_normal(n); x=np.zeros(n)
    for t in range(1,n): x[t]=phi*x[t-1]+e[t]
    return x
def ch(cid,changes,env='lab',unit='',days=None,source='synthetic'):
    c=cer.channel(cid,env,np.arange(len(changes)) if days is None else days,changes,unit,source); c['Z']=cer.coordinates(c); return c
def get(E,typ,band=None): return [e for e in E if e['type']==typ and (band is None or e.get('band')==list(band))][0]
def keep(label,t,n,others,upto):
    """Record a case for the TypeScript parity test."""
    js=lambda c: dict(id=c['id'],env=c['env'],days=[int(d) for d in c['days']],changes=[float(x) for x in c['r']],unit=c['unit'],source=c['source'])
    REF['measure'].append(dict(label=label,target=js(t),neighbour=js(n),others=[js(o) for o in others],upto=int(upto),edges=cer.edges(t,n,others,upto)))
def infer(target_changes, neighbours, offset=0.5, lag=0):
    """Calls on the direction of the target's next change, from the neighbours only. Returns gain in bits per call, shares through time, p."""
    n=len(target_changes); days=np.arange(n-1); y=(target_changes[1:]>0).astype(int); F,M=cer.features(days,neighbours,lag); off=np.full(n-1,offset)
    p,I,W,hsh=cer.walk(off,y,F,M,detail=True); bits=lambda q: (np.log(np.where(y==1,q,1-q))-np.log(np.where(y==1,off,1-off)))/LN2
    return float(bits(p).mean()),I,p,y,F,M,[float(bits(W[:,k]).mean()) for k in range(W.shape[1])],hsh

# 1. independent signals: nothing to find, and CER has to say so
rng=np.random.default_rng(101); flags=bands=0
for k in range(30):
    a=ch('a',ar(rng,800)); b=ch('b',ar(rng,800)); E=cer.edges(a,b,[],799); flags+=get(E,'rank-xcorr')['related']; bands+=sum(e['coherent'] for e in E if e['type']=='coherence')
    if k==0: keep('independent',a,b,[],799)
a=ar(rng,3001); g,I,p,y,F,M,eg,_=infer(a,[ch('b',ar(rng,3001)),ch('c',ar(rng,3001))])
check('1 independent signals',flags<=5 and bands<=10 and -0.004<g<0.002 and max(eg)<0.002,pairs_called_related_of_30=int(flags),bands_called_coherent_of_90=int(bands),gain_bits_per_call=g,each_edge_alone_bits_per_call=[round(v,4) for v in eg[2:]])

# 2. two synchronised oscillators
rng=np.random.default_rng(102); t=np.arange(800); a=ch('a',np.sin(2*np.pi*t/16)+0.5*rng.standard_normal(800)); b=ch('b',np.sin(2*np.pi*t/16)+0.5*rng.standard_normal(800)); E=cer.edges(a,b,[],799); c=get(E,'coherence',(5,20)); x=get(E,'rank-xcorr')
check('2 synchronised oscillators',c['coherent'] and abs(c['phase'])<0.3 and x['related'] and x['lag']==0,coherence=c['coherence'],threshold=c['threshold'],phase=c['phase'],period=c['period'],lag=x['lag']); keep('synchronised',a,b,[],799)

# 3. the same with a quarter-period offset: the neighbour leads by 4
a=ch('a',np.sin(2*np.pi*(t-4)/16)+0.5*rng.standard_normal(800)); E=cer.edges(a,b,[],799); c=get(E,'coherence',(5,20))
check('3 phase offset',c['coherent'] and abs(c['neighbour_leads_by']-4)<0.7 and abs(c['phase']+math.pi/2)<0.3,phase=c['phase'],neighbour_leads_by=c['neighbour_leads_by']); keep('phase offset',a,b,[],799)

# 4. a known delay; and prediction from a neighbour that leads
rng=np.random.default_rng(104); bb=ar(rng,810); a=ch('a',0.8*np.r_[np.zeros(3),bb[:-3]][10:]+0.6*rng.standard_normal(800)); b=ch('b',bb[10:]); x=get(cer.edges(a,b,[],799),'rank-xcorr'); keep('delay of 3',a,b,[],799)
lead=ar(rng,1500); tgt=0.8*np.r_[0,lead[:-1]]+0.6*rng.standard_normal(1500); decoy=ar(rng,1500); N=[ch('lead',lead),ch('decoy',decoy)]; g,I,p,y,F,M,eg,hsh=infer(tgt,N)
check('4 lagged signals',x['related'] and x['lag']==3 and g>0.05 and eg[2]>0.05 and eg[3]<0.002 and I[-1,2]>0.5 and I[-1,3]<0.25,delay_found=x['lag'],strength=x['strength'],gain_bits_per_call=g,leading_edge_alone=eg[2],decoy_edge_alone=eg[3],share_leading_edge=float(I[-1,2]),share_decoy_edge=float(I[-1,3]))
REF['infer'].append(dict(label='leading neighbour and a decoy',days=list(range(1499)),y=[int(v) for v in y],offset=[0.5]*1499,lag=0,neighbours=[dict(id=c['id'],days=[int(d) for d in c['days']],changes=[float(v) for v in c['r']]) for c in N],p=[float(v) for v in p],share=[float(v) for v in I[-1]],state_hash=hsh))

# 5. a shared driver: two servers in one room. The ambient temperature moves the heat of server A and the voltage across the mycelium on server B.
rng=np.random.default_rng(105); amb=ar(rng,800,0.7); heat=ch('serverA.heat',amb+0.7*rng.standard_normal(800),'server A','W'); volt=ch('serverB.mycelium_voltage',amb+0.7*rng.standard_normal(800),'server B','mV'); room=ch('room.temperature',amb+0.05*rng.standard_normal(800),'room','degC')
E=cer.edges(volt,heat,[room],799); raw=get(E,'rank-xcorr'); par=get(E,'partial-rank-xcorr'); keep('shared driver',volt,heat,[room],799)
load=ar(rng,800); direct=ch('serverB.mycelium_voltage',0.6*load+0.8*rng.standard_normal(800),'server B','mV'); cpu=ch('serverB.cpu_load',load,'server B','%'); E2=cer.edges(direct,cpu,[room],799); par2=get(E2,'partial-rank-xcorr'); keep('direct, driver unrelated',direct,cpu,[room],799)
check('5 shared driver',raw['related'] and raw['strength']>0.5 and abs(par['strength'])<0.12 and par2['related'] and par2['strength']>0.4,raw=raw['strength'],after_removing_room_temperature=par['strength'],a_direct_link_after_the_same_removal=par2['strength'])

# 6. a relationship that stops: coupled for 800 steps, then not
rng=np.random.default_rng(106); bb=ar(rng,1600); e=rng.standard_normal(1600); aa=np.where(np.arange(1600)<800,0.8*bb+0.6*e,ar(rng,1600)); a=ch('a',aa); b=ch('b',bb); early=get(cer.edges(a,b,[],799),'rank-xcorr'); late=get(cer.edges(a,b,[],1599),'rank-xcorr')
lead=ar(rng,2400); tgt=np.where(np.arange(2400)<1200,0.8*np.r_[0,lead[:-1]]+0.6*rng.standard_normal(2400),ar(rng,2400)); g,I,p,y,*_=infer(tgt,[ch('lead',lead)]); gb=(np.log(np.where(y==1,p,1-p))-math.log(0.5))/LN2
check('6 nonstationary relationship',early['related'] and early['strength']>0.5 and abs(late['strength'])<0.15 and I[1199,0]<0.05 and I[-1,0]>0.4 and gb[:1200].mean()>0.05 and gb[-600:].mean()>-0.01,strength_while_coupled=early['strength'],strength_after=late['strength'],
      share_with_the_offset_while_coupled=float(I[1199,0]),share_with_the_offset_at_the_end=float(I[-1,0]),gain_while_coupled=float(gb[:1200].mean()),gain_in_the_300_calls_after_the_break=float(gb[1200:1500].mean()),gain_in_the_last_600_calls=float(gb[-600:].mean())); keep('after the relationship stopped',a,b,[],1599)

# 7. missing and asynchronous observations
rng=np.random.default_rng(107); n=1200; lat=np.cumsum(ar(rng,n)); dj=np.array([d for d in range(n) if d%7 not in (5,6) and not 600<=d<640]); b=cer.channel('b','field',dj,np.diff(np.r_[0,lat[dj]])); b['Z']=cer.coordinates(b)
a=ch('a',np.diff(np.r_[0,0.8*lat+np.cumsum(0.6*rng.standard_normal(n))])); d,ca,cb=cer.pair(a,b,n-1); x=get(cer.edges(a,b,[],n-1),'rank-xcorr'); keep('asynchronous with a gap',a,b,[],n-1)
ok=True; cases=[]
for lag in (0,1):
    k=cer.asof(np.arange(n),dj,lag); m=k>=0; q=np.arange(n)-lag; ok&=bool((dj[k[m]]<=q[m]).all() and (q[m]-dj[k[m]]<=cer.STALE).all() and k[620]==-1 and not m[q<0].any()); cases.append(dict(tdays=list(range(n)),jdays=[int(v) for v in dj],lag=lag,shift=0,k=[int(v) for v in k]))
k=cer.asof(np.arange(n),dj,1,400); cases.append(dict(tdays=list(range(n)),jdays=[int(v) for v in dj],lag=1,shift=400,k=[int(v) for v in k])); REF['asof']=cases
check('7 missing and asynchronous',ok and set(d)<=set(dj) and x['related'] and x['lag']==0 and x['strength']>0.4,shared_days=int(len(d)),strength=x['strength'],no_observation_later_than_the_call=bool(ok),absent_inside_the_gap=bool(cer.asof(np.arange(n),dj,0)[620]==-1))

# 8. noise and sensor artefacts
rng=np.random.default_rng(108); bb=ar(rng,800); aa=0.8*bb+0.6*rng.standard_normal(800); clean=get(cer.edges(ch('a',aa),ch('b',bb),[],799),'rank-xcorr'); sp=bb.copy(); idx=rng.choice(800,8,replace=False); sp[idx]*=1000
dirty=get(cer.edges(ch('a',aa),ch('b',sp),[],799),'rank-xcorr'); pear=float(np.corrcoef(aa,sp)[0,1]); stuck=cer.edges(ch('a',aa),ch('stuck',np.zeros(800)),[],799)[0]; keep('spikes',ch('a',aa),ch('b',sp),[],799); keep('stuck sensor',ch('a',aa),ch('stuck',np.zeros(800)),[],799)
check('8 noise and sensor artefacts',abs(clean['strength']-dirty['strength'])<0.05 and abs(pear)<0.3 and stuck['status']=='insufficient variation',clean=clean['strength'],with_spikes=dirty['strength'],ordinary_correlation_with_spikes=pear,stuck_sensor=stuck['status'])

# 9. no call sees its own future
rng=np.random.default_rng(109); lead=ar(rng,1200); tgt=0.8*np.r_[0,lead[:-1]]+0.6*rng.standard_normal(1200); nb=ch('lead',lead); g,I,p,y,F,M,_e,_=infer(tgt,[nb]); cut=700
pt=cer.walk(np.full(cut,0.5),y[:cut],*cer.features(np.arange(cut),[ch('lead',lead[:cut])])); d1=float(np.abs(pt-p[:cut]).max())
alt=lead.copy(); alt[cut:]=rng.standard_normal(1200-cut)*50; F2,M2=cer.features(np.arange(1199),[ch('lead',alt)]); d2=float(np.abs(F2[:cut]-F[:cut]).max()); p2=cer.walk(np.full(1199,0.5),y,F2,M2); d3=float(np.abs(p2[:cut]-p[:cut]).max())
check('9 no future-data leakage',d1==0 and d2==0 and d3==0,truncated_history=d1,coordinates_after_changing_the_future=d2,calls_after_changing_the_future=d3)

# 10. the same input gives the same answer, to the bit
rng=np.random.default_rng(110); C=[ch(k,ar(rng,500)) for k in 'abc']; h=lambda: hashlib.sha256(json.dumps(cer.graph(C,499),sort_keys=True).encode()).hexdigest()[:16]; h1,h2=h(),h()
s1=infer(tgt,[nb])[-1]; s2=infer(tgt,[nb])[-1]
check('10 deterministic replay',h1==h2 and s1==s2,graph_hash=h1,state_hash=s1)

json.dump(REF,open(os.path.join(HERE,'..','tests','cer_reference.json'),'w')); print(f"{bad} FAILED" if bad else 'ALL PASSED'); raise SystemExit(1 if bad else 0)
