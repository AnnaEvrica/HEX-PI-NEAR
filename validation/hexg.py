# ===========================================================================
# Hex-G — geometry first. An experiment harness for the methodological pivot.
#
#  G1 Bird's-eye atlas: each series' geometric signature from all its data so
#     far (return autocorrelation at lags 1–5, Hurst exponent, 5-day variance
#     ratio). Evidence is pooled across series in proportion to how alike their
#     geometry is — families, not one pooled table.
#  G2 Event time: causal swing highs and lows (a pivot is known only after a
#     reversal of θ = 3 average daily moves).
#  G3 Relations, not bits: six continuous relations between the points —
#     amplitude ratio and duration ratio of the last two legs, the current
#     leg's progress against θ, time since the last pivot against the typical
#     leg, and the highs' and lows' relations (higher/lower, in units of θ).
#  G4 The rose unfolds coarse to fine: a binary tree 1 → 2 → 4 → … → 64 fitted
#     on pre-2016 relations only. Each petal's estimate is shrunk toward its
#     parent, so a petal only departs from the coarser view when its own
#     evidence carries it.
#  G5 Calls at horizon h (1 and 5 bars): P(up) = drift_h + shrunk residual of
#     the deepest petal; 80% band from the petal's volatility-normalised
#     returns.
# Walk-forward in date order over all series; pooled evidence becomes visible
# to other series only on the next date.
# ===========================================================================
import numpy as np, pandas as pd, math, json, sys
import os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'data','')
SPLIT='2016-01-01'

def load_all():
    o={}
    b=pd.read_csv(D+'BTC_daily.csv'); b=b[b.date>='2013-01-01']; o['BTC-USD']=b.set_index('date')['close']
    for k,f in [('WTI','oil-prices-wti-daily.csv'),('BRENT','oil-prices-brent-daily.csv'),('NATGAS','natural-gas-daily.csv')]:
        o[k]=pd.read_csv(D+f).set_index('Date')['Price']
    o['VIX']=pd.read_csv(D+'finance-vix-vix-daily.csv').set_index('DATE')['CLOSE']
    fx=pd.read_csv(D+'exchange-rates-daily.csv')
    for c in ['Australia','Canada','Switzerland','Japan','United Kingdom','New Zealand','Sweden','Norway','Euro','Mexico','India','South Africa']:
        o['FX-'+c.replace(' ','')]=fx[fx.Country==c].set_index('Date')['Exchange rate']
    for k in o:
        s=pd.to_numeric(o[k],errors='coerce'); s=s[s>0].sort_index(); o[k]=s[~s.index.duplicated()]
        o[k]=o[k][o[k].index<='2026-09-30']
    return o

def shuffled(S, seed):
    rng=np.random.default_rng(seed); out={}
    for k,s in S.items():
        r=np.diff(np.log(s.values)).copy(); rng.shuffle(r)
        out[k]=pd.Series(np.exp(np.log(s.values[0])+np.concatenate([[0],np.cumsum(r)])),index=s.index)
    return out

# ---------------- per-series causal geometry ---------------------------------
def features(s):
    """Return per-bar relational features (NaN until defined), plus vol and signature inputs."""
    x=s.values; n=len(x); lx=np.log(x)
    F=np.full((n,6),np.nan); sig=np.zeros(n); a=None
    d=0; hi=lo=x[0]; hiI=loI=0
    piv=[]  # (index_of_extreme, price, type)
    for i in range(1,n):
        r=abs(lx[i]-lx[i-1]); a=r if a is None else a+(2/21)*(r-a); th=max(3*a,1e-5); sig[i]=a*1.2533
        if d>=0 and x[i]>hi: hi,hiI=x[i],i
        if d<=0 and x[i]<lo: lo,loI=x[i],i
        if d>=0 and hiI<i and x[i]<=hi*math.exp(-th) and (d==1 or d==0):
            piv.append((hiI,hi,'H')); d=-1; lo,loI=x[i],i
        elif d<=0 and loI<i and x[i]>=lo*math.exp(th):
            piv.append((loI,lo,'L')); d=1; hi,hiI=x[i],i
        if len(piv)>=4:
            p0,p1,p2,p3=piv[-4],piv[-3],piv[-2],piv[-1]
            leg1=abs(math.log(p3[1]/p2[1])); leg2=abs(math.log(p2[1]/p1[1]))
            dur1=max(1,p3[0]-p2[0]); dur2=max(1,p2[0]-p1[0])
            meandur=np.mean([piv[j][0]-piv[j-1][0] for j in range(max(1,len(piv)-8),len(piv))])
            Hs=[p for p in piv[-4:] if p[2]=='H']; Ls=[p for p in piv[-4:] if p[2]=='L']
            F[i,0]=np.clip(math.log(max(leg1,1e-6)/max(leg2,1e-6)),-2,2)
            F[i,1]=np.clip(math.log(dur1/dur2),-2,2)
            F[i,2]=np.clip((lx[i]-math.log(p3[1]))/th,-4,4)
            F[i,3]=np.clip(math.log(max(1,i-p3[0])/max(meandur,1)),-3,2)
            F[i,4]=math.tanh(math.log(Hs[-1][1]/Hs[-2][1])/th) if len(Hs)>=2 else 0
            F[i,5]=math.tanh(math.log(Ls[-1][1]/Ls[-2][1])/th) if len(Ls)>=2 else 0
    return F,sig

def signature(lx, t, win=750):
    r=np.diff(lx[max(0,t-win):t+1])
    if len(r)<120: return None
    r=r-r.mean(); v=(r*r).mean()
    ac=[(r[l:]*r[:-l]).mean()/v if v>0 else 0 for l in range(1,6)]
    r5=lx[max(0,t-win)+5:t+1]-lx[max(0,t-win):t+1-5]
    vr=(np.var(r5)/(5*v)) if v>0 else 1
    return np.array(ac+[vr-1])

# ---------------- the rose: binary tree fitted on calibration relations -----
class Rose:
    def __init__(self, depth=6): self.depth=depth; self.cent={}
    def fit(self, X, seed=0):
        rng=np.random.default_rng(seed)
        self.mu=X.mean(0); self.sd=X.std(0)+1e-9
        Z=(X-self.mu)/self.sd
        def split(node, idx, lvl):
            if lvl==self.depth or len(idx)<40: return
            P=Z[idx]
            c=P[rng.choice(len(P),2,replace=False)]
            for _ in range(25):
                dd=((P[:,None,:]-c[None,:,:])**2).sum(2); lab=dd.argmin(1)
                for k in range(2):
                    if (lab==k).any(): c[k]=P[lab==k].mean(0)
            self.cent[node]=c
            for k in range(2): split(node*2+k, idx[lab==k], lvl+1)
        split(1, np.arange(len(Z)), 0)
        return self
    def path(self, f):
        z=(f-self.mu)/self.sd; node=1; out=[1]
        while node in self.cent:
            c=self.cent[node]; k=int(((z-c[0])**2).sum()>((z-c[1])**2).sum())
            node=node*2+k; out.append(node)
        return out

# ---------------- walk-forward ------------------------------------------------
def run(S, H=(1,5), k_shrink=200.0, use_family=True, depth=6, bandwidth=None, record_dates=None, rose=None, verbose=False, until=None):
    ids=list(S.keys()); feats={}; sigs={}
    for k in ids: feats[k]=features(S[k])
    if rose is None:
        Xcal=np.concatenate([feats[k][0][(S[k].index<SPLIT)&~np.isnan(feats[k][0][:,0])] for k in ids])
        rose=Rose(depth).fit(Xcal[::3])
    # events in date order
    ev=[]
    for k in ids:
        idx=S[k].index
        for i in range(len(idx)): ev.append((idx[i],k,i))
    ev.sort()
    lx={k:np.log(S[k].values) for k in ids}
    # stats[(h)][series][node] = [N, sum e, sum z, sum z2]  (z = h-bar log return / (sigma*sqrt h))
    stats={h:{k:{} for k in ids} for h in H}
    drift={h:{k:[0.0,0.0] for k in ids} for h in H}
    pending={h:{k:[] for k in ids} for h in H}   # (due_index, path, b, z_ref)
    queue=[]  # pooled updates released next date: (date, h, k, path, e, z)
    gsig={k:None for k in ids}; famw={}
    rows=[]; cur_date=None
    def famweights(k):
        if use_family=='own': return {j:(1.0 if j==k else 0.0) for j in ids}
        if not use_family: return {j:1.0 for j in ids}
        gk=gsig[k]
        if gk is None: return {j:(1.0 if j==k else 0.0) for j in ids}
        out={}
        for j in ids:
            gj=gsig[j]
            out[j]=1.0 if j==k else (0.0 if gj is None else math.exp(-((gk-gj)**2).sum()/(2*bw*bw)))
        return out
    bw=bandwidth or 0.08
    for date,k,i in ev:
        if until and date>=until: break
        if date!=cur_date:
            # release yesterday's pooled evidence
            for (dq,h,kk,path,e,z) in queue:
                for nd in path:
                    st=stats[h][kk].setdefault(nd,[0.0,0.0,0.0,0.0])
                    st[0]+=1; st[1]+=e; st[2]+=z; st[3]+=z*z
            queue=[]; cur_date=date
        F,sig=feats[k]
        # resolve pending outcomes that complete today
        for h in H:
            keep=[]
            for (due,path,b,zref,ti) in pending[h][k]:
                if due==i:
                    y=1.0 if lx[k][i]>lx[k][ti] else 0.0
                    z=max(-8.0,min(8.0,(lx[k][i]-lx[k][ti])/zref)) if zref>0 else 0.0
                    queue.append((date,h,k,path,y-b,z))
                    dr=drift[h][k]; dr[0]=0.995*dr[0]+y; dr[1]=0.995*dr[1]+1
                else: keep.append((due,path,b,zref,ti))
            pending[h][k]=keep
        if i%5==0:
            g=signature(lx[k],i)
            if g is not None: gsig[k]=g
        f=F[i]
        if np.isnan(f[0]) or sig[i]<=0: continue
        path=rose.path(f)[:depth+1]
        w=famweights(k)
        out={'id':k,'t':date,'i':i,'x':float(S[k].values[i]),'leaf':path[-1]}
        for h in H:
            dr=drift[h][k]; b=(dr[0]+1)/(dr[1]+2)
            # coarse-to-fine shrinkage down the rose
            m=0.0; zm=0.0; zv=1.0
            for nd in path:
                N=S1=Z1=Z2=0.0
                for j,wj in w.items():
                    if wj<1e-3: continue
                    st=stats[h][j].get(nd)
                    if st: N+=wj*st[0]; S1+=wj*st[1]; Z1+=wj*st[2]; Z2+=wj*st[3]
                m=(S1+k_shrink*m)/(N+k_shrink)
                zm=(Z1+k_shrink*zm)/(N+k_shrink)
                if N>30: zv=min(16.0,max(0.2,Z2/N-(Z1/N)**2))
            p=min(0.99,max(0.01,b+m))
            sh=sig[i]*math.sqrt(h)
            out[f'p{h}']=p; out[f'b{h}']=b
            out[f'lo{h}']=float(S[k].values[i]*math.exp(sh*(zm-1.2816*math.sqrt(zv))))
            out[f'hi{h}']=float(S[k].values[i]*math.exp(sh*(zm+1.2816*math.sqrt(zv))))
            out[f'pt{h}']=float(S[k].values[i]*math.exp(sh*zm))
            if i+h < len(S[k]):
                pending[h][k].append((i+h,path,b,sh,i))
                out[f'y{h}']=1 if lx[k][i+h]>lx[k][i] else 0
                out[f'xh{h}']=float(S[k].values[i+h])
        rows.append(out)
    return pd.DataFrame(rows), rose

# ---------------- metrics --------------------------------------------------------
def metrics(df, h, pcol=None, lo=None, hi=None, pt=None):
    pcol=pcol or f'p{h}'; d=df.dropna(subset=[f'y{h}',pcol]).copy()
    y=d[f'y{h}'].values; p=d[pcol].values.clip(0.01,0.99); b=d[f'b{h}'].values.clip(0.01,0.99)
    up=p>0.5
    acc=((p>0.5)==(y==1)).mean(); accb=((b>0.5)==(y==1)).mean()
    ll=-(y*np.log(p)+(1-y)*np.log(1-p)).mean(); llb=-(y*np.log(b)+(1-y)*np.log(1-b)).mean()
    br=((p-y)**2).mean(); brb=((b-y)**2).mean()
    bins=np.clip((p*10).astype(int),0,9); ece=0
    for q in range(10):
        m=bins==q
        if m.any(): ece+=m.mean()*abs(y[m].mean()-p[m].mean())
    out={'n':int(len(d)),'accuracy':round(acc,4),'drift_accuracy':round(accb,4),
         'precision_up':round(float(y[up].mean()),4) if up.any() else None,'up_calls':int(up.sum()),
         'precision_down':round(float(1-y[~up].mean()),4) if (~up).any() else None,'down_calls':int((~up).sum()),
         'brier':round(br,5),'brier_skill_vs_drift':round(1-br/brb,5),'log_loss':round(ll,5),'log_loss_drift':round(llb,5),'ece':round(ece,4)}
    if lo and hi:
        xh=d[f'xh{h}'].values; L=d[lo].values; Hh=d[hi].values; x=d['x'].values
        out['band80_coverage']=round(float(((xh>=L)&(xh<=Hh)).mean()),4)
        out['band80_mean_width_pct']=round(float(((Hh-L)/x).mean()*100),3)
    if pt:
        xh=d[f'xh{h}'].values; x=d['x'].values; P=d[pt].values
        out['point_mae_pct']=round(float((abs(P-xh)/x).mean()*100),4)
        out['random_walk_mae_pct']=round(float((abs(x-xh)/x).mean()*100),4)
    return out

if __name__=='__main__':
    S=load_all()
    df,rose=run(S)
    t=df[df.t>=SPLIT]
    for h in (1,5): print(h, metrics(t,h,lo=f'lo{h}',hi=f'hi{h}',pt=f'pt{h}'))
