# ===========================================================================
# Can CER perceive distinct relational moments? Tested on built configurations
# whose structure is known, and kept apart from forecasting: nothing here is
# scored on log loss or accuracy of a prediction (prereg_cer.md, fourth
# experiment; the directive's section 8).
#   python3 cer_perception.py  -> cer/perception.json
# Each block states what was built, what the signature has to show, and what
# a same-step correlation alone would have shown.
# ===========================================================================
import numpy as np, json, os, math
import cercore as cer
HERE=os.path.dirname(os.path.abspath(__file__)); OUT={}; bad=0; TRIALS=30
def ar(rng,n,phi=0.5):
    e=rng.standard_normal(n); x=np.zeros(n)
    for t in range(1,n): x[t]=phi*x[t-1]+e[t]
    return x
def ch(cid,changes,days=None): return cer.prepare(cer.channel(cid,'lab',np.arange(len(changes)) if days is None else days,changes))
def check(name, ok, **nums):
    global bad; bad+=not ok; OUT[name]=dict(passed=bool(ok),**nums); print('PASS' if ok else 'FAIL',name,json.dumps({k:(round(v,4) if isinstance(v,float) else v) for k,v in nums.items()}))
rate=lambda v: float(np.mean(v))

# 1. identical marginals, different relationships in time: the neighbour one step before the target, three steps before, or one step after
rng=np.random.default_rng(201); right=0; plain=0; n=900
for trial in range(TRIALS):
    for truth in ('leads by 1','leads by 3','follows by 1'):
        b=rng.standard_normal(n+4); a=0.7*{'leads by 1':b[3:-1],'leads by 3':b[1:-3],'follows by 1':b[5:]}[truth][:n-1]+0.7*rng.standard_normal(n-1); S=cer.moment(ch('a',a),[ch('b',b[4:4+n-1])],n-2)
        L=S['leadership'][0]; Fw=S['following'][0]; k=int(np.abs(np.r_[L,Fw]).argmax()); said=f'leads by {k+1}' if k<cer.MAXLAG else f'follows by {k-cer.MAXLAG+1}'; right+=said==truth; plain+=abs(S['harmony'][0])>1.96*S['edge_standard_error'][0]
check('1 identical marginals, different timing',right==3*TRIALS and plain<=0.12*3*TRIALS,named_correctly=f'{right} of {3*TRIALS}',same_step_correlation_saw_anything=f'{plain} of {3*TRIALS}')

# 2. the same ordinary correlation, different phase structure: moving together at once, or sharing a rhythm a sixth of a period apart
rng=np.random.default_rng(202); sep=0; rr=[]; t=np.arange(900)
for trial in range(TRIALS):
    b1=rng.standard_normal(900); a1=0.417*b1+math.sqrt(1-0.417**2)*rng.standard_normal(900); ph=rng.uniform(0,2*math.pi)
    b2=math.sqrt(2)*np.sin(2*math.pi*t/16+ph)+0.45*rng.standard_normal(900); a2=math.sqrt(2)*np.sin(2*math.pi*(t-16/6)/16+ph)+0.45*rng.standard_normal(900)
    S1=cer.moment(ch('a',a1),[ch('b',b1)],899); S2=cer.moment(ch('a',a2),[ch('b',b2)],899); rr.append((float(S1['harmony'][0]),float(S2['harmony'][0])))
    e1=[e for e in S1['rhythm']['b'] if e['band']==[5,20]][0]; e2=[e for e in S2['rhythm']['b'] if e['band']==[5,20]][0]
    sep+=bool((not e1['coherent'] or abs(e1['neighbour_leads_by'])<2*e1['lead_standard_error']) and e2['coherent'] and abs(e2['neighbour_leads_by']-16/6)<2*e2['lead_standard_error'] and e2['neighbour_leads_by']>2*e2['lead_standard_error'])
m1,m2=np.mean(rr,0)
check('2 equal correlation, different phase',sep>=TRIALS-1 and abs(m1-m2)<0.08,separated_by_phase=f'{sep} of {TRIALS}',same_step_correlation_of_each=[round(float(m1),3),round(float(m2),3)],lead_built_in=round(16/6,2))

# 3. coupling through a shared driver at the same step, against a neighbour that really moves first
rng=np.random.default_rng(203); sens=spec=seen=0; n=900
for trial in range(TRIALS):
    g=rng.standard_normal(n); first=rng.standard_normal(n); a=g+0.5*np.r_[0,first[:-1]]+0.6*rng.standard_normal(n); S=cer.moment(ch('a',a),[ch('shares the driver',g+0.6*rng.standard_normal(n)),ch('moves first',first)],n-1)
    sens+='moves first' in S['eligible']; spec+='shares the driver' not in S['eligible']; seen+=abs(S['harmony'][0])>0.3
check('3 shared driver against a real lead',sens>=TRIALS-1 and spec>=TRIALS-2 and seen==TRIALS,leader_eligible=f'{sens} of {TRIALS}',driver_sharer_kept_out_of_the_forecast=f'{spec} of {TRIALS}',driver_sharer_still_perceived=f'{seen} of {TRIALS}')

# 4. two independent signals whose joint configuration, and neither alone, carries the structure
rng=np.random.default_rng(204); found=alone=false=0; n=900
for trial in range(TRIALS):
    x=[rng.standard_normal(n) for _ in range(4)]; a=0.7*np.r_[0,(x[0]*x[1])[:-1]]+0.7*rng.standard_normal(n); S=cer.moment(ch('a',a),[ch(f'n{k}',x[k]) for k in range(4)],n-1); c=S['counterpoint']['one_step_earlier']
    found+=bool(c['tail']<0.01 and set(c['pair'])=={'n0','n1'}); alone+=bool(set(S['eligible'])&{'n0','n1'})
    S0=cer.moment(ch('a',rng.standard_normal(n)),[ch(f'n{k}',rng.standard_normal(n)) for k in range(4)],n-1); false+=S0['counterpoint']['one_step_earlier']['tail']<0.01
check('4 jointly informative configuration',found>=TRIALS-1 and false<=2,pair_found=f'{found} of {TRIALS}',either_signal_alone_looked_informative=f'{alone} of {TRIALS}',found_in_pure_noise=f'{false} of {TRIALS}')

# 5. a new combination of familiar features: two channels that move together, moving apart on a few days, each by an ordinary amount
rng=np.random.default_rng(205); hits=[]; mid=[]; fa=[]; intr=[]; n=1500
for trial in range(TRIALS):
    g=rng.standard_normal(n); a=g+0.3*rng.standard_normal(n); b=g+0.3*rng.standard_normal(n); odd=rng.choice(np.arange(800,n),20,replace=False); b[odd]=-a[odd]
    T=ch('a',a); N=[ch('b',b)]; td=np.arange(800,n); E,nov,S,_=cer.moments(td,T,N,0,'MOVE',perceive=True); isodd=np.isin(td,odd); size=np.abs(a[td])/a.std(); big=size>1
    hits.append(rate(nov[isodd&big,2]>3.0)); mid.append(rate(nov[isodd&(size>0.5)&~big,2]>3.0)); fa.append(rate(nov[~isodd,2]>3.0)); intr.append(rate(nov[isodd,0]<0.05))
check('5 novel combination of familiar features',np.mean(hits)>0.9 and np.mean(fa)<0.03,flagged_when_built_in_moves_above_one_sd=float(np.mean(hits)),moves_of_half_to_one_sd=float(np.nanmean(mid)),flagged_otherwise=float(np.mean(fa)),the_same_days_by_intrinsic_novelty_alone=float(np.mean(intr)),threshold='relational surprisal above 3 nats')

# 6. a relational transition inside ordinary-looking measurements: the relation reverses, each marginal stays what it was
rng=np.random.default_rng(206); before=[]; after=0; delay=[]; n=3200; cut=1600
for trial in range(TRIALS):
    b=rng.standard_normal(n); e=rng.standard_normal(n); a=np.where(np.arange(n)<cut,0.6,-0.6)*b+0.8*e; td=np.arange(26,n-1); E,nov,S,_=cer.moments(td,ch('a',a),[ch('b',b)],0,'MOVE',perceive=True)
    tick=np.arange(0,len(td),cer.RECOMPUTE); tail=nov[tick,3]; day=td[tick]; ok=~np.isnan(tail); before.append(rate(tail[ok&(day<cut)]<0.01)) if (ok&(day<cut)).any() else None
    hit=np.where(ok&(day>=cut)&(tail<0.01))[0]; after+=len(hit)>0; delay.append(int(day[hit[0]]-cut)) if len(hit) else None
check('6 relational transition',after==TRIALS and np.mean(before)<0.03,transition_detected=f'{after} of {TRIALS}',observations_until_detected_median=float(np.median(delay)),flagged_before_any_change=float(np.mean(before)))

# 7. noise and an unchanged configuration must not look novel
rng=np.random.default_rng(207); R={k:[] for k in ('intrinsic','joint','temporal','eligible','counterpoint','harmony within two standard errors')}; n=1700; dec=np.zeros(10)
for trial in range(TRIALS):
    phi=0.0 if trial%2 else 0.5; T=ch('a',ar(rng,n,phi)); N=[ch(f'n{k}',ar(rng,n,phi)) for k in range(4)]; td=np.arange(26,n-1); E,nov,S,sm=cer.moments(td,T,N,0,'MOVE',perceive=True); ok=~np.isnan(nov[:,0]); tick=np.arange(0,len(td),cer.RECOMPUTE); tt=nov[tick,3]
    R['intrinsic'].append(rate(nov[ok,0]<0.05)); R['joint'].append(rate(nov[ok,1]<0.05)); R['temporal'].append(rate(tt[~np.isnan(tt)]<0.05)); R['eligible'].append(rate(E[:,1:]>0)); dec+=np.histogram(nov[ok,1],bins=10,range=(0,1))[0]
    R['counterpoint'].append(float(S['counterpoint']['one_step_earlier']['tail']<0.05)); R['harmony within two standard errors'].append(rate(np.abs(S['harmony'])<1.96*S['edge_standard_error']))
r={k:float(np.mean(v)) for k,v in R.items()}
check('7 noise and an unchanged configuration',0.02<=r['intrinsic']<=0.08 and 0.02<=r['joint']<=0.08 and r['temporal']<=0.10 and r['eligible']<0.02,share_of_calls_with_intrinsic_tail_below_5pct=r['intrinsic'],with_joint_tail_below_5pct=r['joint'],share_of_measurements_with_temporal_tail_below_5pct=r['temporal'],
      share_of_edge_calls_eligible=r['eligible'],counterpoint_tail_below_5pct=r['counterpoint'],harmony_within_two_standard_errors=r['harmony within two standard errors'],joint_tail_by_tenths=[round(float(x),3) for x in dec/dec.sum()])

# 8. a change of sampling: the leader of test 3 observed only on every other step, leading by two
rng=np.random.default_rng(208); sens=0; n=1800
for trial in range(TRIALS):
    first=rng.standard_normal(n); a=0.6*np.r_[0,0,first[:-2]]+0.8*rng.standard_normal(n); d2=np.arange(0,n,2); lvl=np.cumsum(first); S=cer.moment(ch('a',a),[ch('moves first',np.diff(np.r_[0,lvl[d2]]),days=d2),ch('decoy',rng.standard_normal(n))],n-1)
    sens+=('moves first' in S['eligible']) and ('decoy' not in S['eligible'])
check('8 half the sampling rate',sens>=TRIALS-3,leader_eligible_and_decoy_not=f'{sens} of {TRIALS}')

json.dump(OUT,open(os.path.join(HERE,'cer','perception.json'),'w'),indent=1); print(f'{bad} FAILED' if bad else 'ALL PASSED'); raise SystemExit(1 if bad else 0)
