# ===========================================================================
# The Learning Module, stage 5: Experiential Integration. Reference
# implementation (base44/shared/experience.ts must match this to rounding;
# tests/experience.mjs). Specification: prereg_experience.md.
#
#   signature   the moment that is remembered: Sigma = (X, G, Phi, U), no novelty inside
#   distance    how many resolvable steps apart two moments of a series are:
#               every difference multiplied by the precision it can be resolved with
#   affinity    exp(-d^2 / 2): continuous, never a class
#   experience  for one moment against the library: individuality, affinity, transition
#   nightly     the night's summary, numbers only
# Pure functions. Nothing here predicts, and nothing here feeds HEX, CER's
# weights or governance.
# ===========================================================================
import numpy as np, math, json, hashlib
import cercore as cer
SIGNATURE_VERSION='sig-1'; DISTANCE_VERSION='dist-1'; BANDWIDTH_VERSION='bw-1'; METRIC_VERSION='exp-1'
REFERENCE=250; DISPERSION_WINDOW=30; LEAD_LAGS=3; MIN_TERMS=3; TIERS=20
fz=lambda r: math.atanh(min(0.999,max(-0.999,r)))
r6=lambda v: math.floor(float(v)*1e6+0.5)/1e6      # six decimals: far finer than any of these can be resolved, and half the storage
def tier(seq):
    """How many times a moment's ordinal in its series divides by two. Tier >= j keeps one moment in 2^j, evenly, for ever."""
    t=0
    while seq>0 and seq%2==0 and t<TIERS: seq//=2; t+=1
    return t
def signature(S, step, z, present, ids):
    """The compact, comparable form of a moment S (cercore.moment) at a call: z and present are the target first, then each neighbour."""
    if S.get('status')!='ok': return None
    m=S['measurable']; ch=[ids[j] for j in range(len(ids)) if m[j]]; n=int(S['samples'])
    return dict(v=SIGNATURE_VERSION,cer=S['method'],target=S['target'],as_of=int(S['as_of']),step=int(step),samples=n,lag=int(S['lag']),segments=int((n-cer.SEG)//(cer.SEG//2)+1) if n>=cer.SEG else 0,channels=ch,
        x={k:r6(v) for k,v,p in zip([S['target']]+list(ids),z,present) if p},
        harmony={ids[j]:r6(S['harmony'][j]) for j in range(len(ids)) if m[j]},se={ids[j]:r6(S['edge_standard_error'][j]) for j in range(len(ids)) if m[j]},
        lead={ids[j]:[r6(v) for v in S['leadership'][j][:LEAD_LAGS]] for j in range(len(ids)) if m[j]},own=[r6(v) for v in S['persistence']],
        rhythm={k:[[r6(b['coherence']),(r6(b['phase']) if b['coherent'] else None),(r6(b['phase_standard_error']) if b['coherent'] else None)] if b['status']=='ok' else None for b in bands] for k,bands in S['rhythm'].items()})
def canonical(o): return json.dumps(o,sort_keys=True,separators=(',',':'))
def digest(o): return hashlib.sha256(canonical(o).encode()).hexdigest()[:32]
def wrap(a): return math.atan2(math.sin(a),math.cos(a))
def distance(si, sj):
    """How many resolvable steps apart two moments of one series are, by component and in all. None-valued where they cannot be compared."""
    out=dict(version=DISTANCE_VERSION,comparable=False,d=None,terms=0,shared=0,overlap=None,components={})
    if si is None or sj is None or si['target']!=sj['target'] or si['v']!=sj['v']: return out
    shared=[c for c in si['channels'] if c in sj['harmony']]; n=min(si['samples'],sj['samples']); o=max(0.0,n-abs(si['step']-sj['step']))/n; w=max(1-o,1.0/n); out.update(shared=len(shared),overlap=o)
    if len(shared)*2<min(len(si['channels']),len(sj['channels'])): return out
    T={'state':[(si['x'][c]-sj['x'][c])**2/2 for c in si['x'] if c in sj['x']],
       'harmony':[(fz(si['harmony'][c])-fz(sj['harmony'][c]))**2/((si['se'][c]**2+sj['se'][c]**2)*w) for c in shared],
       'leadership':[(fz(a)-fz(b))**2/((si['se'][c]**2+sj['se'][c]**2)*w) for c in shared for a,b in zip(si['lead'][c],sj['lead'][c])],
       'persistence':[(fz(a)-fz(b))**2/((1/(si['samples']-3)+1/(sj['samples']-3))*w) for a,b in zip(si['own'],sj['own'])],'rhythm':[],'phase':[]}
    K=0.947*min(si['segments'],sj['segments'])
    for c in (shared if o==0 else []):                                  # a spectral estimate moves with where its segments fall, so it is compared only between windows that share nothing
        for a,b in zip(si['rhythm'].get(c,[]),sj['rhythm'].get(c,[])):
            if a is None or b is None or K<=0: continue
            if a[1] is not None or b[1] is not None: T['rhythm'].append((fz(math.sqrt(a[0]))-fz(math.sqrt(b[0])))**2*K/w)
            if a[1] is not None and b[1] is not None: T['phase'].append(wrap(a[1]-b[1])**2/((a[2]**2+b[2]**2)*w))
    tot=sum(sum(v) for v in T.values()); m=sum(len(v) for v in T.values())
    if m<MIN_TERMS: return out
    out.update(comparable=True,terms=m,d=math.sqrt(tot/m),components={k:[math.sqrt(sum(v)/len(v)),len(v)] for k,v in T.items() if v}); return out
def affinity(d): return math.exp(-d*d/2)
def quantile(v, q):
    v=sorted(v); k=(len(v)-1)*q; lo=int(math.floor(k)); hi=min(lo+1,len(v)-1); return v[lo]+(v[hi]-v[lo])*(k-lo)
def experience(sig, history):
    """One moment against the library. history: earlier moments of the same series, most recent first, each dict(id, as_of, signature, seq);
    seq is the moment's ordinal in its series (1 for the first) and defaults to its place in the list. history[0] is the previous moment.
    Individuality and affinity are taken against a reference of fixed size spread evenly over all of that past, so they do not shrink
    merely because the library grows, and a configuration that returns after years can still be recognised. The reference is drawn from
    the moments of tier >= j, j the largest for which at least REFERENCE of them exist, so the library never has to be read whole: the
    result is the same whether `history` holds every earlier moment or only those tiers and the previous one.
    Transition is to the previous moment. Each is None where no comparison supports it."""
    E=dict(metric=METRIC_VERSION,distance=DISTANCE_VERSION,bandwidth=BANDWIDTH_VERSION,individuality=None,nearest_prior=None,nearest_components=None,reference_count=0,reference_full=False,incomparable=0,
           affinity_nearest=None,affinity_median=None,affinity_quartiles=None,transition=None,transition_components=None,transition_days=None,transition_rate=None,previous=None)
    ref=[]; seqs=[h.get('seq',len(history)-i) for i,h in enumerate(history)]; n=seqs[0] if history else 0; j=0
    while (n>>(j+1))>=REFERENCE: j+=1
    cand=[h for h,q in zip(history,seqs) if tier(q)>=j]; c=len(cand); pick=cand if c<=REFERENCE else [cand[int(math.floor(k*(c-1)/(REFERENCE-1)+0.5))] for k in range(REFERENCE)]
    for h in pick:
        D=distance(sig,h['signature'])
        if D['comparable']: ref.append((D,h))
        else: E['incomparable']+=1
    if ref:
        D,h=min(ref,key=lambda x: x[0]['d']); aff=[affinity(x[0]['d']) for x in ref]
        E.update(individuality=D['d'],nearest_prior=h['id'],nearest_components=D['components'],reference_count=len(ref),reference_full=n>=REFERENCE,
                 affinity_nearest=affinity(D['d']),affinity_median=quantile(aff,0.5),affinity_quartiles=[quantile(aff,0.25),quantile(aff,0.75)])
    if history:
        D=distance(sig,history[0]['signature']); days=sig['as_of']-history[0]['as_of']; E.update(previous=history[0]['id'],transition_days=int(days))
        if D['comparable']: E.update(transition=D['d'],transition_components=D['components'],transition_rate=D['d']/days if days>0 else None)
    return E
def nightly(rows, recent):
    """The night's summary. rows: tonight's moments, each dict(series, experience E, channels). recent: per series, its last moments' signatures
    (tonight's first), for dispersion. Numbers only."""
    def dist(v): return None if not v else dict(median=quantile(v,0.5),p90=quantile(v,0.9),max=max(v),count=len(v))
    I=[r['E']['individuality'] for r in rows if r['E']['individuality'] is not None]; T=[r['E']['transition'] for r in rows if r['E']['transition'] is not None]
    V=[r['E']['transition_rate'] for r in rows if r['E']['transition_rate'] is not None]; A=[r['E']['affinity_nearest'] for r in rows if r['E']['affinity_nearest'] is not None]; Am=[r['E']['affinity_median'] for r in rows if r['E']['affinity_median'] is not None]
    pairs=[]
    for sigs in recent.values():
        s=sigs[:DISPERSION_WINDOW]
        for a in range(len(s)):
            for b in range(a+1,len(s)):
                D=distance(s[a],s[b])
                if D['comparable']: pairs.append(D['d'])
    return dict(moment_count=len(rows),individuality=dict(dist(I) or {},unavailable=len(rows)-len(I)) ,transitions=dict(dist(T) or {},unavailable=len(rows)-len(T),median_rate=quantile(V,0.5) if V else None,median_days=quantile([r['E']['transition_days'] for r in rows if r['E']['transition_days'] is not None],0.5) if any(r['E']['transition_days'] is not None for r in rows) else None),
        affinities=dict(nearest_median=quantile(A,0.5) if A else None,strongest=max(A) if A else None,median_quartiles=[quantile(Am,0.25),quantile(Am,0.5),quantile(Am,0.75)] if Am else None),
        dispersion=dict(median=quantile(pairs,0.5) if pairs else None,pairs=len(pairs),rule=f'last-{DISPERSION_WINDOW}-per-series-all-pairs'),
        continuity=dict(nearest_is_previous=sum(1 for r in rows if r['E']['nearest_prior'] is not None and r['E']['nearest_prior']==r['E']['previous']),with_nearest=len(I)),
        measurement_coverage=dict(moments=len(rows),incomparable=sum(r['E']['incomparable'] for r in rows),channels_median=quantile([len(r['channels']) for r in rows],0.5) if rows else None),
        metric_version=METRIC_VERSION,distance_version=DISTANCE_VERSION,bandwidth_version=BANDWIDTH_VERSION,signature_version=SIGNATURE_VERSION)
def moment_of(target, neighbours, upto):
    """Perceive the moment of `target` at `upto` (values of the same date) and return (signature, novelty). Channels must be prepared."""
    S=cer.moment(target,neighbours,upto,0,'MOVE')
    if S['status']!='ok': return None,None
    ti=int(np.searchsorted(target['days'],upto,side='right'))-1; kid=[int(cer.asof(np.array([upto]),c['days'],0)[0]) for c in neighbours]; pr=np.r_[True,[k>=0 for k in kid]]
    z=np.r_[target['ns'][ti],[c['ns'][k] if k>=0 else 0.0 for c,k in zip(neighbours,kid)]]; tl=np.r_[target['tail'][ti],[c['tail'][k] if k>=0 else 1.0 for c,k in zip(neighbours,kid)]]
    nv=cer.novelty(S,z,tl,pr); return signature(S,ti,z,pr,[c['id'] for c in neighbours]),dict(intrinsic_tail=nv[0],joint_tail=nv[1],relational_surprisal=nv[2])
