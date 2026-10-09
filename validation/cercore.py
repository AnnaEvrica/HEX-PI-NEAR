# ===========================================================================
# CER — Cross-Environment Resonance. Reference implementation
# (base44/shared/cer/*.ts must match this to rounding; see cer_synthetic.py
# and tests/cer.mjs). Specification: prereg_cer.md. Mathematics: docs/CER.md.
#
# CER reads across channels. It does not touch HEX: it imports the engine's
# own rank coordinates and its two learning rules and changes neither.
#
#   measure   how two channels relate, three ways, kept apart:
#               rank cross-correlation at lags 0..5 (surrogate threshold)
#               the same with the shared driver removed
#               coherence in three bands (phase only where coherent)
#   infer     one expert per edge and one for the pool,
#               logit p_j = logit(offset) + gamma_j . Z_j
#             mixed with the offset by reversible influence. The offset is
#             the null (standalone) or HEX's call (fusion candidate).
#   graph     edge i <- j carries each measured relation, and the share of
#             the call the edge's expert holds. Association, never cause.
# Every quantity for a call dated d uses observations dated d or earlier.
# Order per step: predict, (outcome arrives), score, learn.
# ===========================================================================
import numpy as np, pandas as pd, math, hashlib
import hex7core as h7
VERSION='cer-0.1'
NC=2*h7.NZ                       # coordinates per channel: 7 for the level, 7 for the size of the change
STALE=7                          # a neighbour's observation older than this many calendar days is absent
WINDOW=750; MINOBS=200           # descriptive graph: trailing aligned observations, and the fewest it will read
MAXLAG=5; NSUR=200; ACF=20       # lags tested; circular-shift surrogates; lags in the Bartlett standard error
SEG=128; BANDS=((2,5),(5,20),(20,64)); ALPHA=0.05    # Welch segment; bands as periods in observations
rnd=lambda x: int(math.floor(x+0.5))

# ---- channels and alignment -------------------------------------------------
def channel(cid, env, days, changes, unit='', source=''):
    """One signal: integer days (since 1970-01-01), its changes, and where it came from. The level is the running sum of the changes."""
    r=np.asarray(changes,float); return dict(id=cid,env=env,days=np.asarray(days,np.int64),r=r,level=np.cumsum(r),unit=unit,source=source)
def coordinates(ch):
    """Z for every observation of a channel: exactly HEX's ranks, of the level and of the size of the change."""
    return np.hstack([h7.ranks(ch['level']),h7.ranks(np.abs(ch['r']))])
def asof(tdays, jdays, lag=0, shift=0, stale=STALE):
    """For each target day, the index of the neighbour's latest observation dated no later than (day - lag); -1 when there is none within `stale` days.
    shift != 0 is the control: the neighbour's record is displaced by that many days, circularly within its own span."""
    q=np.asarray(tdays,np.int64)-lag; lo,hi=int(jdays[0]),int(jdays[-1]); ok=(q>=lo)&(q<=hi+(0 if shift else stale))
    if shift: q=lo+np.mod(q-lo+shift,hi-lo+1)
    k=np.searchsorted(jdays,q,side='right')-1; ok&=k>=0; kk=np.maximum(k,0); ok&=(q-jdays[kk])<=stale
    return np.where(ok,kk,-1)
def features(tdays, neighbours, lag=0, shift=0):
    """(calls, neighbours, 14) coordinates of each neighbour as known at each call, zero where absent; and the presence mask."""
    F=np.zeros((len(tdays),len(neighbours),NC)); M=np.zeros((len(tdays),len(neighbours)),bool)
    for j,ch in enumerate(neighbours):
        k=asof(tdays,ch['days'],lag,shift); m=k>=0; F[m,j]=ch['Z'][k[m]]; M[:,j]=m
    return F,M

# ---- inference --------------------------------------------------------------
def walk(offset, y, F, M, detail=False):
    """One target, one read, one pass over its calls.
    offset[t]: the probability CER starts from (the null, or HEX's call). y[t]: what happened. F, M: from features().
    Returns p[t]; with detail also what each expert said on its own, V[t] = [offset, pool, edge 1..K], the share of each call each held,
    and a hash of the learned state."""
    n,K,_=F.shape; R=h7.Residual(K+1,NC); A=h7.Share(K+2); X=np.zeros((K+1,NC)); p=np.zeros(n); I=np.zeros((n,K+2)) if detail else None; W=np.zeros((n,K+2)) if detail else None
    for t in range(n):
        m=M[t]; X[0]=F[t][m].mean(0) if m.any() else 0.0; X[1:]=F[t]
        V=np.r_[offset[t],R.predict(X,h7.lg(offset[t]))]; p[t]=A.predict(V)
        if detail: I[t]=A.influence(); W[t]=V
        R.update(int(y[t])); A.update(V,int(y[t]))
    if not detail: return p
    return p,I,W,hashlib.sha256(b''.join(np.ascontiguousarray(v).tobytes() for v in (R.th,R.ll,A.w,A.ll))).hexdigest()[:16]

# ---- measurement ------------------------------------------------------------
def zrank(v):
    """Midranks, centred and scaled to unit variance. A constant gives zeros."""
    r=pd.Series(np.asarray(v,float)).rank().values; r=r-r.mean(); s=math.sqrt(float((r*r).mean())); return r/s if s>0 else r*0
def lagcorr(u, v, maxlag=MAXLAG):
    """rho[l]: correlation of the target u at t with the neighbour v at t - l (the neighbour leads by l)."""
    n=len(u); out=np.zeros(maxlag+1)
    for l in range(maxlag+1):
        a=u[l:]; b=v[:n-l]; a=a-a.mean(); b=b-b.mean(); d=math.sqrt(float((a*a).sum()*(b*b).sum())); out[l]=float((a*b).sum())/d if d>0 else 0.0
    return out
def bartlett(u, v, m=ACF):
    """Standard error of a cross-correlation between two autocorrelated series (Bartlett, 1946)."""
    n=len(u); su=float((u*u).sum()); sv=float((v*v).sum())
    if su<=0 or sv<=0: return float('nan')
    return math.sqrt(max(1e-12,1+2*sum(float((u[k:]*u[:n-k]).sum())/su*float((v[k:]*v[:n-k]).sum())/sv for k in range(1,m+1)))/n)
def surrogate(u, v, maxlag=MAXLAG, B=NSUR):
    """The largest |rho| over the lags, against the same statistic with the neighbour circularly shifted B ways.
    A shift keeps the neighbour's own autocorrelation and breaks only its alignment with the target."""
    rho=lagcorr(u,v,maxlag); stat=float(np.abs(rho).max()); n=len(u)
    sur=sorted(float(np.abs(lagcorr(u,np.roll(v,rnd(n*(0.1+0.8*b/(B-1)))),maxlag)).max()) for b in range(B))
    return rho,stat,sur[int(math.ceil((1-ALPHA)*B))-1],(1+sum(s>=stat for s in sur))/(B+1)
def residual(u, g):
    """u with the shared driver g taken out (least squares; both are centred)."""
    gg=float((g*g).sum()); return u-(float((u*g).sum())/gg)*g if gg>0 else u
def coherence(a, b):
    """Welch magnitude-squared coherence of two aligned series, by band: the highest coherence among the band's frequencies, against the
    no-relationship threshold 1 - (alpha/m)^(1/(K-1)), m the number of frequencies in the band and K the effective number of independent
    segments (0.947 per half-overlapped Hann segment). Phase and the lag it implies are given only where the band clears the threshold."""
    n=len(a); step=SEG//2; cnt=(n-SEG)//step+1 if n>=SEG else 0
    if cnt<4: return [dict(band=list(bd),status='insufficient data') for bd in BANDS]
    w=0.5-0.5*np.cos(2*np.pi*np.arange(SEG)/SEG); Pxx=np.zeros(SEG//2+1); Pyy=np.zeros(SEG//2+1); Pxy=np.zeros(SEG//2+1,complex)
    for s in range(cnt):
        x=a[s*step:s*step+SEG]; y=b[s*step:s*step+SEG]; X=np.fft.rfft((x-x.mean())*w); Y=np.fft.rfft((y-y.mean())*w); Pxx+=np.abs(X)**2; Pyy+=np.abs(Y)**2; Pxy+=X*np.conj(Y)
    keff=0.947*cnt; out=[]
    with np.errstate(invalid='ignore',divide='ignore'): msc=np.where((Pxx>0)&(Pyy>0),np.abs(Pxy)**2/(Pxx*Pyy),0.0)
    for lo,hi in BANDS:
        ks=[k for k in range(1,SEG//2+1) if lo<=SEG/k<hi]; thr=1-(ALPHA/len(ks))**(1/(keff-1)); k=ks[int(np.argmax(msc[ks]))]; c=float(msc[k])
        e=dict(band=[lo,hi],status='ok',coherence=c,mean_coherence=float(np.mean(msc[ks])),threshold=float(thr),segments=int(cnt),frequencies=len(ks),period=SEG/k,coherent=bool(c>thr))
        if c>thr: ph=float(np.angle(Pxy[k])); e.update(phase=ph,neighbour_leads_by=-ph*SEG/(2*math.pi*k))   # x(t) = y(t - tau)  =>  phase = -2 pi f tau
        else: e.update(phase='not supported',neighbour_leads_by='not supported')
        out.append(e)
    return out
def pair(ci, cj, upto, window=WINDOW):
    """Both channels on the days they share, up to and including `upto`: the shared days, and the changes between consecutive shared days."""
    d=np.intersect1d(ci['days'][ci['days']<=upto],cj['days'][cj['days']<=upto])[-(window+1):]
    if len(d)<2: return d,np.zeros(0),np.zeros(0)
    return d,np.diff(ci['level'][np.searchsorted(ci['days'],d)]),np.diff(cj['level'][np.searchsorted(cj['days'],d)])
def driver(days, others):
    """The shared driver on the given days: the mean of the other channels' ranked changes (each read as of the day; absent where stale)."""
    if not len(others) or len(days)<2: return None
    acc=np.zeros(len(days)-1); cnt=np.zeros(len(days)-1)
    for ch in others:
        k=asof(days,ch['days']); m=k>=0; lv=np.where(m,ch['level'][np.maximum(k,0)],np.nan); c=np.diff(lv); ok=~np.isnan(c)
        if ok.sum()<MINOBS//2: continue
        z=np.zeros(len(c)); z[ok]=zrank(c[ok]); acc+=z; cnt+=ok
    if not cnt.any(): return None
    g=np.where(cnt>0,acc/np.maximum(cnt,1),0.0); g=g-g.mean(); return g
def edges(target, neighbour, others, upto, window=WINDOW):
    """Every measured relation of one ordered pair (target <- neighbour) on the trailing window. Each is its own edge; they are not combined."""
    d,a,b=pair(target,neighbour,upto,window); base=dict(target=target['id'],source=neighbour['id'],method=VERSION,samples=int(len(a)),window=[int(d[0]),int(d[-1])] if len(d) else None)
    if len(a)<MINOBS: return [dict(base,type='rank-xcorr',status='insufficient data')]
    if len(set(np.round(a,12)))<3 or len(set(np.round(b,12)))<3: return [dict(base,type='rank-xcorr',status='insufficient variation')]
    span=int(d[-1]-d[0])+1; base['coverage']=round(len(d)/span,4); u=zrank(a); v=zrank(b); out=[]
    rho,stat,thr,pv=surrogate(u,v); l=int(np.abs(rho).argmax())
    out.append(dict(base,type='rank-xcorr',status='ok',strength=float(rho[l]),lag=l,by_lag=[float(x) for x in rho],standard_error=bartlett(u,v),threshold=thr,p_value=pv,related=bool(stat>thr)))
    g=driver(d,others)
    if g is None: out.append(dict(base,type='partial-rank-xcorr',status='no other channel'))
    else:
        ru=residual(u-u.mean(),g); rv=residual(v-v.mean(),g); rho,stat,thr,pv=surrogate(ru,rv); l=int(np.abs(rho).argmax())
        out.append(dict(base,type='partial-rank-xcorr',status='ok',strength=float(rho[l]),lag=l,by_lag=[float(x) for x in rho],standard_error=bartlett(ru,rv),threshold=thr,p_value=pv,related=bool(stat>thr),controls=[o['id'] for o in others]))
    for e in coherence(u,v): out.append(dict(base,type='coherence',**e))
    return out
def graph(channels, upto, window=WINDOW):
    """G_t = (V, E, W): every channel a node, every ordered pair its measured edges."""
    E=[]
    for ti in channels:
        for nj in channels:
            if ti is nj: continue
            E+=edges(ti,nj,[c for c in channels if c is not ti and c is not nj],upto,window)
    return dict(method=VERSION,as_of=int(upto),nodes=[dict(id=c['id'],environment=c['env'],unit=c['unit'],source=c['source'],observations=int((c['days']<=upto).sum())) for c in channels],edges=E)
