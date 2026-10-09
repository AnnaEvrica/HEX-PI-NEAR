# ===========================================================================
# CER on signals whose relationships are known because they were built in.
# Twelve tests (prereg_cer.md; the brief's section 8, the measured edge weight, and the relaxation). Each prints PASS or FAIL
# with the numbers it was judged on. Also writes tests/cer_reference.json:
# the same signals and this implementation's answers, for tests/cer.mjs to
# hold base44/shared/cer/*.ts to.
#   python3 cer_synthetic.py
# ===========================================================================
import numpy as np, json, os, hashlib, math
import cercore as cer, hex7core as h7
HERE=os.path.dirname(os.path.abspath(__file__)); LN2=math.log(2); bad=0; REF={'measure':[],'infer':[],'asof':[],'weight':[]}
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
    p,I,W,hsh,*_=cer.walk(off,y,F,M,detail=True); bits=lambda q: (np.log(np.where(y==1,q,1-q))-np.log(np.where(y==1,off,1-off)))/LN2
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
lead=ar(rng,1500); tgt4=tgt=0.8*np.r_[0,lead[:-1]]+0.6*rng.standard_normal(1500); decoy=ar(rng,1500); N=[ch('lead',lead),ch('decoy',decoy)]; g,I,p,y,F,M,eg,hsh=infer(tgt,N)
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

# 11. the measured edge weight w = A.L.C.Q: from the present window only, with no outcome in it
js=lambda c: dict(id=c['id'],env=c['env'],days=[int(d) for d in c['days']],changes=[float(x) for x in c['r']],unit=c['unit'],source=c['source'])
def weigh(label,tg,nb,others,upto,lead=1,read='MOVE'):
    e=cer.edge_weight(tg,nb,others,upto,lead,read); REF['weight'].append(dict(label=label,target=js(tg),neighbour=js(nb),others=[js(o) for o in others],upto=int(upto),lead=lead,read=read,weight=e)); return e
T4=ch('target',tgt4); wl=weigh('a neighbour that leads',T4,N[0],[N[1]],1499); wd=weigh('a decoy',T4,N[1],[N[0]],1499)
rng=np.random.default_rng(111); e0=rng.standard_normal(800); same=ch('same moment',0.8*e0+0.6*rng.standard_normal(800)); T0=ch('target',e0); ws=weigh('related only at the same moment',T0,same,[],799); xs=get(cer.edges(T0,same,[],799),'rank-xcorr')
wr=weigh('lead that is only the shared driver',volt,heat,[room],799); wn=weigh('the same with the driver not measured',volt,heat,[],799)
half=cer.channel('half',  'lab',np.arange(1500)[::2],np.add.reduceat(N[0]['r'],np.arange(0,1500,2))); wq=weigh('a neighbour observed every other tick',T4,half,[],1499); wz=weigh('sizes of moves',T4,N[0],[N[1]],1499,1,'RANGE')
td=np.arange(1499); F,M=cer.features(td,N,0); Wm,Em,parts=cer.edge_weights(td,T4,N,0); Tm=cer.temperatures(Em,M); y4=(tgt4[1:]>0).astype(int); pr,pm,pe4,pt4=cer.walk(np.full(1499,0.5),y4,F,M,weights=Wm,relax=(Em,Tm)); gm=float(((np.log(np.where(y4==1,pm,1-pm))-math.log(0.5))/LN2).mean()); first=int(np.argmax(Wm[:,0]>0))
Wt,_e,_p=cer.edge_weights(td[:900],ch('target',tgt4[:901]),[ch('lead',N[0]['r'][:901]),ch('decoy',N[1]['r'][:901])],0); d11=float(np.abs(Wt-Wm[:900]).max())
check('11 edge weight from present measurement',wl['w']>0.3 and wd['w']==0 and ws['A']>0.5 and ws['w']==0 and xs['related'] and wr['C']<0.25 and wr['w']<0.5*wn['w'] and wq['Q']<0.6 and gm>0.05 and Wm[:,1].max()==0 and d11==0,
      leading=wl['w'],decoy=wd['w'],same_moment_A=ws['A'],same_moment_w=ws['w'],same_moment_in_descriptive_graph=bool(xs['related']),driver_only_C=wr['C'],driver_only_w=wr['w'],driver_unmeasured_w=wn['w'],every_other_tick_Q=wq['Q'],
      gain_bits_per_call=gm,first_call_with_weight=first,weights_on_truncated_history=d11)
REF['infer'].append(dict(label='the same, each edge heard at its measured weight',days=list(range(1499)),y=[int(v) for v in y4],offset=[0.5]*1499,lag=0,target=js(T4),neighbours=[dict(id=c['id'],days=[int(d) for d in c['days']],changes=[float(v) for v in c['r']]) for c in N],p=[float(v) for v in pr],pq=[float(v) for v in pm],pe=[float(v) for v in pe4],pt=[float(v) for v in pt4],W_last=[float(v) for v in Wm[-1]]))

# 12. relaxation: the maximum-entropy distribution over interpretations, and its temperature
bitsof=lambda q,yy: float(((np.log(np.where(yy==1,q,1-q))-math.log(0.5))/LN2).mean())
rng=np.random.default_rng(112); hit=quiet=0; g12={'reliability':[],'measurement':[],'relaxation':[]}; gnone=[]
for trial in range(12):                                                           # one weak real lead among three decoys; then four decoys and nothing real
    ld=ar(rng,1200); tg=0.35*np.r_[0,ld[:-1]]+rng.standard_normal(1200); NB=[ch('lead',ld)]+[ch(f'decoy{k}',ar(rng,1200)) for k in range(3)]; TG=ch('target',tg); tdd=np.arange(1199); F,M=cer.features(tdd,NB,0)
    W_,E_,_=cer.edge_weights(tdd,TG,NB,0); yy=(tg[1:]>0).astype(int); a_,b_,c_,_d=cer.walk(np.full(1199,0.5),yy,F,M,weights=W_,relax=(E_,np.ones(1199))); P=cer.interpretations(E_[-1],M[-1],1.0); hit+=int(P.argmax()==1)
    for k,v in zip(g12,(a_,b_,c_)): g12[k].append(bitsof(v,yy))
    NB=[ch(f'decoy{k}',ar(rng,1200)) for k in range(4)]; tg=ar(rng,1200); F,M=cer.features(tdd,NB,0); W_,E_,_=cer.edge_weights(tdd,ch('target',tg),NB,0); yy=(tg[1:]>0).astype(int)
    c_=cer.walk(np.full(1199,0.5),yy,F,M,weights=W_,relax=(E_,np.ones(1199)))[2]; gnone.append(bitsof(c_,yy)); quiet+=int(cer.interpretations(E_[-1],M[-1],1.0)[0]>0.9)
n12=4200; la=ar(rng,n12); lb=ar(rng,n12); sw=(np.arange(n12)//700)%2==0; tg=np.where(sw,0.8*np.r_[0,la[:-1]],0.8*np.r_[0,lb[:-1]])+0.6*rng.standard_normal(n12); NB=[ch('a',la),ch('b',lb)]; tdd=np.arange(n12-1); F,M=cer.features(tdd,NB,0)
W_,E_,_=cer.edge_weights(tdd,ch('target',tg),NB,0); Tsw=cer.temperatures(E_,M); st=0.8*np.r_[0,la[:-1]]+0.6*rng.standard_normal(n12); Es=cer.edge_weights(tdd,ch('target',st),NB,0)[1]; Tst=cer.temperatures(Es,M)
G=np.mean; check('12 relaxation over interpretations',hit>=10 and quiet>=10 and G(g12['relaxation'])>0 and abs(G(gnone))<0.002 and Tsw[-1]>1 and Tst[-1]==1 and abs(float(cer.interpretations(np.array([3.0,0.0,1.0]),np.array([True,True,True]),1.0).sum())-1)<1e-12,
      weak_lead_named_of_12=int(hit),nothing_held_above_90pct_of_12=int(quiet),gain_reliability=float(G(g12['reliability'])),gain_measured_weight=float(G(g12['measurement'])),gain_relaxation=float(G(g12['relaxation'])),gain_with_nothing_real=float(G(gnone)),
      temperature_when_the_relationship_keeps_switching=float(Tsw[-1]),temperature_when_it_is_steady=float(Tst[-1]))
REF['relax']=dict(E=[[float(v) for v in r_] for r_ in E_[::25]],M=[[bool(v) for v in r_] for r_ in M[::25]],T=[float(v) for v in Tsw[::25]],interp=[float(v) for v in cer.interpretations(np.array([3.0,0.0,1.0,7.5]),np.array([True,True,False,True]),2.0)])

# the shadow walk-forward (base44/shared/cer/replay.ts): HEX's own calls, then CER beside them, strict arm
import pandas as pd
for read in ('MOVE','RANGE'):
    tgt=tgt4; R=pd.DataFrame(h7.walk(tgt,read)[0]); NS=N; F,M=cer.features(R.i.values,NS,1); Wsh,Esh,_=cer.edge_weights(R.i.values,T4,NS,1,read); rsh=(Esh,cer.temperatures(Esh,M))
    REF.setdefault('shadow',[]).append(dict(read=read,lag=1,target=[float(v) for v in tgt],neighbours=[dict(id=c['id'],days=[int(d) for d in c['days']],changes=[float(v) for v in c['r']]) for c in N],
        i=[int(v) for v in R.i],null=[float(v) for v in R.null],hex=[float(v) for v in R.p],**dict(zip(('cer','cerq','cere','cert'),([float(v) for v in a_] for a_ in cer.walk(R.null.values,R.y.values,F,M,weights=Wsh,relax=rsh)))),**dict(zip(('fusion','fusionq','fusione','fusiont'),([float(v) for v in a_] for a_ in cer.walk(R.p.values,R.y.values,F,M,weights=Wsh,relax=rsh))))))
json.dump(REF,open(os.path.join(HERE,'..','tests','cer_reference.json'),'w')); print(f"{bad} FAILED" if bad else 'ALL PASSED'); raise SystemExit(1 if bad else 0)
