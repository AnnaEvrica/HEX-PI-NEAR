# ===========================================================================
# The Learning Module, stage 5, on built signals (prereg_experience.md, E1 to
# E8). Each test prints PASS or FAIL with the numbers it was judged on, and
# the run writes tests/experience_reference.json for tests/experience.mjs to
# hold base44/shared/experience.ts to.
#   python3 experience_tests.py
# ===========================================================================
import numpy as np, json, os, math, copy
import cercore as cer, experience as ex
HERE=os.path.dirname(os.path.abspath(__file__)); bad=0; OUT={}
def check(name, ok, **nums):
    global bad; bad+=not ok; OUT[name]=dict(passed=bool(ok),**nums); print('PASS' if ok else 'FAIL',name,json.dumps({k:(round(v,4) if isinstance(v,float) else v) for k,v in nums.items()}))
def ar(rng,n,phi):
    e=rng.standard_normal(n); x=np.zeros(n)
    for t in range(1,n): x[t]=phi*x[t-1]+e[t]
    return x
def chans(series): return [cer.prepare(cer.channel(k,'lab',np.arange(len(v)),v)) for k,v in series.items()]
def library(C, days):
    """Walk a series' nights in order, building its library exactly as the nightly stage does."""
    H=[]; rows=[]
    for d in days:
        sig,nov=ex.moment_of(C[0],C[1:],d)
        if sig is None: continue
        E=ex.experience(sig,H); rid=f"{sig['target']}|{d}"; rows.append(dict(id=rid,as_of=d,signature=sig,E=E,novelty=nov)); H.insert(0,dict(id=rid,as_of=d,signature=sig,seq=len(H)+1))
    return rows
js=lambda c: dict(id=c['id'],days=[int(d) for d in c['days']],changes=[float(x) for x in c['r']])

# E1 determinism, E2 causality
rng=np.random.default_rng(301); n=1400; raw={f'c{k}':ar(rng,n,0.5) for k in range(4)}; C=chans(raw); days=list(range(900,1400,20)); R1=library(C,days); R2=library(chans(raw),days)
check('E1 determinism',ex.digest([r['signature'] for r in R1])==ex.digest([r['signature'] for r in R2]) and ex.digest([r['E'] for r in R1])==ex.digest([r['E'] for r in R2]),moments=len(R1),digest=ex.digest([r['E'] for r in R1]))
Ct=chans({k:v[:1101] for k,v in raw.items()}); Rt=library(Ct,[d for d in days if d<=1100]); k=len(Rt)
check('E2 causality',ex.digest([r['signature'] for r in Rt])==ex.digest([r['signature'] for r in R1[:k]]) and ex.digest([r['E'] for r in Rt])==ex.digest([r['E'] for r in R1[:k]]),moments_compared=k,later_observations_appended=n-1101)
REF=dict(channels=[js(c) for c in C],days=days,signatures=[r['signature'] for r in R1],experience=[r['E'] for r in R1],novelty=[r['novelty'] for r in R1],
         distances=[ex.distance(R1[-1]['signature'],r['signature']) for r in R1[:-1]])

# E3 calibration under noise: the same configuration seen twice through measurement noise is about one resolvable step from itself
res={}
for phi in (0.0,0.5):
    far=[]; near=[]; comp={}
    for seed in range(4):
        rng=np.random.default_rng(310+seed); n=2600; C=chans({f'c{k}':ar(rng,n,phi) for k in range(5)}); days=list(range(800,2600,9)); sg={d:ex.moment_of(C[0],C[1:],d)[0] for d in days+[d-1 for d in days]}
        for d in days: near.append(ex.distance(sg[d],sg[d-1])['d'])
        for a in days[::4]:
            for b in days[::4]:
                if a-b>=800:
                    D=ex.distance(sg[a],sg[b]); far.append(D['d'])
                    for kk,v in D['components'].items(): comp.setdefault(kk,[]).append(v[0])
    res[phi]=dict(disjoint=float(np.mean(far)),consecutive=float(np.mean(near)),components={kk:float(np.mean(v)) for kk,v in comp.items()})
ok=all(0.85<=res[p]['disjoint']<=1.15 for p in res) and 0.85<=res[0.0]['consecutive']<=1.15 and all(0.7<=v<=1.3 for p in res for kk,v in res[p]['components'].items() if kk!='phase')
check('E3 calibration under noise',ok,white_disjoint=res[0.0]['disjoint'],white_consecutive=res[0.0]['consecutive'],autocorrelated_disjoint=res[0.5]['disjoint'],autocorrelated_consecutive=res[0.5]['consecutive'],
      components_white={k:round(v,2) for k,v in res[0.0]['components'].items()},components_autocorrelated={k:round(v,2) for k,v in res[0.5]['components'].items()})

# E4 structure: the relation reverses, both marginals stay what they were
rng=np.random.default_rng(304); n=4000; b=rng.standard_normal(n); a=np.where(np.arange(n)<2000,0.6,-0.6)*b+0.8*rng.standard_normal(n); c2=rng.standard_normal(n); lead=np.where(np.arange(n)<2000,0.6*np.r_[0,c2[:-1]],0.6*np.r_[c2[1:],0]); a=a+lead
C=chans({'a':a,'b':b,'c':c2}); s={d:ex.moment_of(C[0],C[1:],d)[0] for d in (900,1900,2900,3900)}; within=[ex.distance(s[1900],s[900])['d'],ex.distance(s[3900],s[2900])['d']]; across=ex.distance(s[2900],s[1900])
check('E4 structural distinction',across['d']>3 and max(within)<1.6,across_the_change=across['d'],within_each_regime=[round(v,2) for v in within],components_across={k:round(v[0],1) for k,v in across['components'].items()})

# E5 phase is circular; no phase without coherence
base=copy.deepcopy(s[900]); base['rhythm']={k:[[0.2,None,None] for _ in v] for k,v in base['rhythm'].items()}                 # no band coherent anywhere, then exactly one
A_=copy.deepcopy(base); B_=copy.deepcopy(base); B_['step']+=2000; A_['rhythm']['b'][1]=[0.9,3.1,0.05]; B_['rhythm']['b'][1]=[0.9,-3.1,0.05]; D=ex.distance(A_,B_); ph=D['components']['phase'][0]*math.sqrt(2*0.05**2)
A2=copy.deepcopy(A_); A2['rhythm']['b'][1]=[0.2,None,None]; B2=copy.deepcopy(B_); B2['rhythm']['b'][1]=[0.2,None,None]; D2=ex.distance(A2,B2)
check('E5 circular phase',abs(ph-(2*math.pi-6.2))<1e-9 and D['components']['phase'][1]==1 and 'phase' not in D2['components'],difference_in_radians=ph,linear_difference_would_be=6.2,phase_term_without_coherence='phase' in D2['components'])
REF['phase_case']=dict(a=A_,b=B_,distance=D)

# E6 missing data: a channel absent from one moment contributes nothing; too little in common gives no number
full=ex.distance(s[1900],s[900]); cut=copy.deepcopy(s[900]); cut['channels'].remove('c')
for k in ('harmony','se','lead','rhythm','x'): cut[k].pop('c',None)
part=ex.distance(s[1900],cut); solo=copy.deepcopy(s[900]); solo['channels']=['p','q']
for k in ('harmony','se','lead','rhythm','x'): solo[k]={{'b':'p','c':'q'}.get(c,c):v for c,v in solo[k].items()}                    # the same moment seen through two other channels: nothing in common but the target
none=ex.distance(s[1900],solo)
check('E6 missing data',part['comparable'] and part['shared']==1 and part['components']['persistence']==full['components']['persistence'] and part['components']['harmony'][1]==1 and not none['comparable'] and none['d'] is None,
      terms_with_both_channels=full['terms'],terms_with_one=part['terms'],persistence_unchanged=part['components']['persistence']==full['components']['persistence'],too_little_in_common=dict(comparable=none['comparable'],d=none['d']))
REF['missing_case']=dict(a=s[1900],b=cut,distance=part,c=solo,none=none)

# E7 recurrence without labels: a configuration, then another, then the first again
rng=np.random.default_rng(307); n=5400; b=rng.standard_normal(n); reg=(np.arange(n)//1800)%2==0; a=np.where(reg,0.7,-0.7)*b+0.7*rng.standard_normal(n); R=library(chans({'a':a,'b':b,'c':rng.standard_normal(n)}),list(range(800,n,20)))
back=[r for r in R if r['as_of']>=3600+900]; hit=[int(r['E']['nearest_prior'].split('|')[1])<1800 or int(r['E']['nearest_prior'].split('|')[1])>=3600 for r in back]; first=[int(r['E']['nearest_prior'].split('|')[1])<1800 for r in back]
check('E7 recurrence without labels',np.mean(hit)==1.0 and np.median([r['E']['affinity_nearest'] for r in back])>0.5,returning_moments=len(back),nearest_earlier_moment_in_the_same_configuration=float(np.mean(hit)),of_which_in_its_first_appearance=float(np.mean(first)),median_nearest_affinity=float(np.median([r['E']['affinity_nearest'] for r in back])),classes_created=0)

# E8 individuality does not shrink because the library grows
rng=np.random.default_rng(308); n=7000; R=library(chans({f'c{k}':rng.standard_normal(n) for k in range(4)}),list(range(800,n,5))); full_=[r['E']['individuality'] for r in R if r['E']['reference_full']]; h=len(full_)//2; m1,m2=float(np.median(full_[:h])),float(np.median(full_[h:]))
early=[r['E']['individuality'] for r in R[20:120]]
check('E8 individuality does not shrink with the library',abs(m2/m1-1)<0.10,moments=len(R),median_first_half=m1,median_second_half=m2,ratio=m2/m1,library_size_at_the_end=len(R)-1,median_while_the_reference_was_still_filling=float(np.median(early)))

REF['nightly']=ex.nightly([dict(series='c0',E=r['E'],channels=r['signature']['channels']) for r in R1[-3:]],{'c0':[r['signature'] for r in R1[::-1]]})
REF['nightly_rows']=[dict(E=r['E'],channels=r['signature']['channels']) for r in R1[-3:]]
json.dump(json.loads(json.dumps(REF,default=lambda o: o.tolist() if hasattr(o,'tolist') else float(o))),open(os.path.join(HERE,'..','tests','experience_reference.json'),'w'))
json.dump(OUT,open(os.path.join(HERE,'experience','built_signals.json'),'w'),indent=1) if os.path.isdir(os.path.join(HERE,'experience')) else None
print(f'{bad} FAILED' if bad else 'ALL PASSED'); raise SystemExit(1 if bad else 0)
