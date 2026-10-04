# ===========================================================================
# Third core experiment (predictions in prereg_core3.md).
# Continuous dyadic-rank core with a rank-conditioned null; MOVE / RANGE / LEVEL.
# Every model is offset by a null and learns only the residual.
# ===========================================================================
import numpy as np, pandas as pd, json, os, sys, math
from precision import walk as hex_walk, datasets, forward_rank, HERE
from core2 import OL, features as line_features, LL, boot, clip
WINS=(2,4,8,16,32,64); NW=len(WINS)+1; BLK=(1,2,3,4,5); NB=len(BLK)
lg=lambda p: math.log(min(max(p,1e-6),1-1e-6)/(1-min(max(p,1e-6),1-1e-6)))

def rank_feats(v):
    """Centred ranks in [-1,1], row i using v[0..i] only. W: rank of v[i] within its last w values (w=2..64, all).
    B: all-history rank of the mean of the last 2^k values (k=1..5)."""
    s=pd.Series(np.asarray(v,float)); n=len(s); cols=[]
    for w in WINS: cols.append(2*(s.rolling(w).rank()-0.5)/w-1)
    cnt=np.arange(1,n+1); cols.append(2*(s.expanding().rank()-0.5)/cnt-1)
    W=np.nan_to_num(np.stack([c.values for c in cols],1))
    cols=[]
    for k in BLK:
        m=s.rolling(2**k).mean(); c=m.notna().cumsum().replace(0,np.nan); cols.append(2*(m.expanding().rank()-0.5)/c-1)
    B=np.nan_to_num(np.stack([c.values for c in cols],1))
    return W,B

def prepare(r):
    r=np.asarray(r,float); n=len(r); x=np.cumsum(r); a=np.abs(r)
    sx=pd.Series(x); sa=pd.Series(a)
    med_a=sa.expanding(20).median().values; med_x=sx.expanding(20).median().values
    gmax=sx.expanding().rank(method='max').values; cnt=np.arange(1,n+1)
    q_rank=(cnt-gmax+1)/(cnt+1)                                   # exchangeable levels: P(next > present)
    Wx,Bx=rank_feats(x); Wa,Ba=rank_feats(a)
    mabs=sa.expanding().mean().shift(1).values
    mag_r=np.nan_to_num(np.tanh(r/np.where(mabs>0,mabs,np.nan)))
    mag_a=np.nan_to_num(np.tanh(np.log((a+1e-12)/np.where(med_a>0,med_a,np.nan))))
    Xd,Xs,_=line_features(r)
    return dict(r=r,x=x,a=a,med_a=med_a,med_x=med_x,q_rank=q_rank,Wx=Wx,Bx=Bx,Wa=Wa,Ba=Ba,mag_r=mag_r,mag_a=mag_a,Ld=Xd[:,:3].reshape(n,-1),Ls=Xs[:,:3].reshape(n,-1))

READS=('MOVE','RANGE','LEVEL')
def model_set(read,F,extra=None):
    """name -> (dimension, feature fn, offset name)."""
    W,B,L,mag=(F['Wa'],F['Ba'],F['Ls'],F['mag_a']) if read=='RANGE' else (F['Wx'],F['Bx'],F['Ld'],F['mag_r'])
    M={'M1w':(NW,lambda i: W[i],'M0'),'M1b':(NB,lambda i: B[i],'M0'),'M1':(NW+NB,lambda i: np.r_[W[i],B[i]],'M0'),
       'M2':(NW+NB+18,lambda i: np.r_[W[i],B[i],L[i]],'M0'),'M1+mag':(NW+NB+1,lambda i: np.r_[W[i],B[i],mag[i]],'M0'),
       'lines':(18,lambda i: L[i],'base'),'ranks/base':(NW+NB,lambda i: np.r_[W[i],B[i]],'base')}
    if extra: M.update(extra(read,F))
    return M

def series_run(r,tabs,reads=READS,hex62=True,extra=None,priors=None,first=26):
    F=prepare(r); n=len(r); rows=hex_walk(r,tabs,lenses=False) if hex62 else None; out={}
    for read in reads:
        spec=model_set(read,F,extra); mods={m:(OL(d),f,o) for m,(d,f,o) in spec.items()}
        if priors:
            for nm,(mu,var) in priors[read].items(): mods[f'prior:{nm}']=(OL(NW+NB,mu=mu,var=var),spec['M1'][1],'M0')
        pn=[m for m in mods if m.startswith('prior:')]+(['M1'] if priors else []); llp=np.zeros(len(pn))
        u=cn=0.0; pers=np.zeros((2,2)); lln=np.zeros(2); rec=[]
        for i in range(first,n-1):
            if read=='MOVE': y=int(r[i+1]>0); alt=float(clip(F['q_rank'][i]))
            elif read=='RANGE':
                if np.isnan(F['med_a'][i]): continue
                y=int(F['a'][i+1]>F['med_a'][i]); alt=None
            else:
                y=int(F['x'][i+1]>F['med_x'][i]); s=int(F['x'][i]>F['med_x'][i]); alt=float(clip((pers[s,1]+1)/(pers[s].sum()+2)))
            base=float(clip((u+1)/(cn+2)))
            if alt is None: m0=base
            else:
                w=np.exp(lln-lln.max()); w/=w.sum(); m0=float(w[0]*base+w[1]*alt)
            off={'base':lg(base),'M0':lg(m0)}
            xs={m:f(i) for m,(o,f,k) in mods.items()}; ps={m:o.predict(xs[m],off[k]) for m,(o,f,k) in mods.items()}
            row={'i':i,'y':y,'base':base,'M0':m0,**ps}
            if alt is not None: row['alt']=alt
            if hex62 and read!='LEVEL':
                j=i-12; pc=0 if read=='MOVE' else 3
                row['hex62']=float(clip(rows[j,pc])) if j<len(rows) and not np.isnan(rows[j,pc]) else base
            if pn:
                v=np.array([ps[m] for m in pn]); w=np.exp(llp-llp.max()); w/=w.sum(); row['priormix']=float(w@v); llp=llp+np.log(np.where(y,v,1-v))
            rec.append(row)
            for m,(o,f,k) in mods.items(): o.update(xs[m],y)
            u+=y; cn+=1
            if alt is not None:
                lln+=np.log(np.where(y,[base,alt],[1-base,1-alt]))
                if read=='LEVEL': pers[s,y]+=1
        out[read]=pd.DataFrame(rec); out[read+'_coef']=mods['M1'][0].th[4].copy()
    return out

def skill(D,m,ref='base'): return round(float(1-LL(D,m).mean()/LL(D,ref).mean())*100,2)
def pair(D,a,b,rng,groups=None): d=LL(D,a)-LL(D,b); return [round(float(d.mean())*1000,2)]+boot(d,rng,groups)
def prec(frames,m,q,ref):
    D=pd.concat(frames,ignore_index=True); rk=np.concatenate([forward_rank(np.abs(f[m].values-0.5)) for f in frames]); t=rk>=q if q>0 else np.ones(len(D),bool)
    right=((D[m].values>=0.5).astype(int)==D.y.values); nul=((D[ref].values>=0.5).astype(int)==D.y.values)
    return {'precision':round(float(right[t].mean())*100,1),'coverage':round(float(t.mean())*100,1),'null rule':round(float(nul[t].mean())*100,1)}

def transform(r,start,mode,rng):
    if mode is None: return r
    if mode=='changes': return np.concatenate([r[:start],rng.permutation(r[start:])]) if start else rng.permutation(r)
    x=np.cumsum(r); x=np.concatenate([x[:start],rng.permutation(x[start:])]) if start else rng.permutation(x)   # 'levels'
    return np.diff(np.r_[0.0,x])

def collect(DS,tabs,doms,mode=None,rng=None,**kw):
    out={}
    for dom in doms:
        fr={k:[] for k in READS}; gid={k:[] for k in READS}
        for g,(name,r,start) in enumerate(DS[dom]):
            res=series_run(transform(r,start,mode,rng),tabs,**kw)
            for read in READS:
                if read not in res: continue
                f=res[read]; f=f[f.i>=max(26,start)]
                if len(f): fr[read].append(f); gid[read].append(np.full(len(f),g))
        out[dom]=(fr,gid); print(' ',dom,mode,'done',flush=True)
    return out

def table(res,rng,full=True):
    T={}
    for dom,(fr,gid) in res.items():
        for read in READS:
            if not fr[read]: continue
            D=pd.concat(fr[read],ignore_index=True); G=np.concatenate(gid[read]) if dom=='racing' else None
            names=[c for c in D.columns if c not in ('i','y','base')]
            e={'steps':len(D),'skill % over base rate':{m:skill(D,m) for m in names},
               'null over base (x1000 nats, positive = null better)':pair(D,'base','M0',rng,G),
               'STRUCTURE: M1 over null':pair(D,'M0','M1',rng,G)}
            if full:
                e.update({'window ranks alone over null':pair(D,'M0','M1w',rng,G),'block ranks alone over null':pair(D,'M0','M1b',rng,G),
                          'lines on top of ranks (M2 over M1)':pair(D,'M1','M2',rng,G),'magnitude on top of ranks':pair(D,'M1','M1+mag',rng,G),
                          'M1 over lines-only':pair(D,'lines','M1',rng,G)})
                if 'hex62' in D: e['M1 over 6.2']=pair(D,'hex62','M1',rng,G); e['6.2 over null']=pair(D,'M0','hex62',rng,G)
                e['precision']={m:{lab:prec(fr[read],m,q,'M0') for lab,q in (('all',0),('strongest 25%',0.75),('strongest 10%',0.9))} for m in ['M0','M1']+(['hex62'] if 'hex62' in D else [])}
            T[f'{dom} {read}']=e; print(dom,read,json.dumps(e),flush=True)
    return T

if __name__=='__main__':
    mode=sys.argv[1] if len(sys.argv)>1 else 'real'; rng=np.random.default_rng(31); DS,tabs=datasets()
    if mode=='real': OUT=table(collect(DS,tabs,('racing','weather','markets')),rng)
    else: OUT=table(collect(DS,tabs,('racing','weather','markets'),mode=mode,rng=rng,hex62=False),rng,full=False)
    json.dump(OUT,open(os.path.join(HERE,f'core3_{mode}.json'),'w'),indent=1)
