# ===========================================================================
# Market RANGE: where does the 6.2 engine's remaining lead live?
#  (1) take 6.2 apart: tables, symmetry field, decay removed one at a time
#  (2) add ONE 6.2 mechanism at a time to the rank core
#  (3) cold start: rank core with coefficient priors vs 6.2's 64-state tables
# Predictions: prereg_core3.md, item 7.
# ===========================================================================
import numpy as np, pandas as pd, json, os, sys, itertools
from precision import keys, datasets, HERE, WM, AWM
from pretrain import load_families, train_tables, FAMILIES, K
from core3 import series_run, skill, pair, LL, clip, NW, NB, lg
from core2 import OL
PAIRS=list(itertools.combinations(range(6),2))

def hex_size(r,tables,alphas=(0.0,0.25,1.0,4.0),lam=0.999,G=0.999):
    """6.2 size read with parts switchable. Returns p[i], b[i] for the call made at step i (nan if not ready)."""
    r,a,med,kd,km,kw=keys(r); n=len(r); dM=[np.zeros(64)]+[t['size'] for t in tables]; nf=len(dM); na=len(alphas)
    w0=np.concatenate([np.full(na,0.5/na)]+[np.full(na,0.5/max(1,nf-1)/na) for _ in range(nf-1)]) if nf>1 else np.full(na,1/na)
    lw0=np.log(w0); ll=np.zeros(len(w0)); Dm=np.zeros(64); Nm=np.zeros(64); mu=mn=0.; P=np.full(n,np.nan); Bb=np.full(n,np.nan)
    for i in range(12,n-1):
        if not (km[i]>=0 and not np.isnan(med[i])): continue
        s=km[i]; b=(mu+1)/(mn+2); qd=WM[s]@Dm; qn=AWM[s]@Nm
        Q=np.clip([b+(Dm[s]+al*qd+K*d[s])/(Nm[s]+al*qn+K) for d in dM for al in alphas],.01,.99)
        z=ll+lw0; w=np.exp(z-z.max()); w/=w.sum(); P[i]=float(w@Q); Bb[i]=b; y=int(a[i+1]>med[i])
        ll=G*ll+np.log(np.where(y,Q,1-Q)); Dm*=lam; Nm*=lam; Dm[s]+=y-b; Nm[s]+=1; mu=mu*lam+y; mn=mn*lam+1
    return P,Bb,km

VAR={'6.2 full':{}, '6.2 no tables':{'tables':[]}, '6.2 no field':{'alphas':(0.0,)}, '6.2 no decay':{'lam':1.0,'G':1.0},
     '6.2 bare cells':{'tables':[],'alphas':(0.0,)}, '6.2 bare cells, no decay':{'tables':[],'alphas':(0.0,),'lam':1.0,'G':1.0}}

def run_series(r,tabs,priors=None):
    H={}
    for nm,kw in VAR.items(): H[nm]=hex_size(r,kw.get('tables',tabs),kw.get('alphas',(0.0,0.25,1.0,4.0)),kw.get('lam',0.999),kw.get('G',0.999))
    km=H['6.2 full'][2]
    def resid(nm):
        P,B,_=H[nm]; return np.array([lg(p)-lg(b) if not np.isnan(p) else 0.0 for p,b in zip(P,B)])
    Rc,Rf,Rt=resid('6.2 bare cells'),resid('6.2 no tables'),resid('6.2 full')
    dl=np.array([[t['size'][k]*10 if k>=0 else 0.0 for t in tabs] for k in km])
    def extra(read,F):
        W,B=F['Wa'],F['Ba']; L0=F['Ls'][:,:6]; base=lambda i: np.r_[W[i],B[i]]
        return {'core + size lines (scale 1)':(NW+NB+6,lambda i: np.r_[base(i),L0[i]],'M0'),
                'core + line pairs':(NW+NB+21,lambda i: np.r_[base(i),L0[i],[L0[i,p]*L0[i,q] for p,q in PAIRS]],'M0'),
                'core + 64-state cell':(NW+NB+1,lambda i: np.r_[base(i),Rc[i]],'M0'),
                'core + cell with field':(NW+NB+1,lambda i: np.r_[base(i),Rf[i]],'M0'),
                'core + full 6.2 read':(NW+NB+1,lambda i: np.r_[base(i),Rt[i]],'M0'),
                'core + pre-trained table values':(NW+NB+len(tabs),lambda i: np.r_[base(i),dl[i]],'M0')}
    D=series_run(r,tabs,reads=('RANGE',),hex62=False,extra=extra,priors=priors)['RANGE']
    for nm in VAR: p=H[nm][0][D.i.values]; D[nm]=np.where(np.isnan(p),D.base.values,clip(p))
    return D

def main():
    rng=np.random.default_rng(41); DS,tabs=datasets(); OUT={}
    fr=[]
    for name,r,start in DS['markets']:
        D=run_series(r,tabs); fr.append(D[D.i>=max(26,start)]); print(' ',name,flush=True)
    D=pd.concat(fr,ignore_index=True); cols=[c for c in D.columns if c not in('i','y','base')]
    A={'steps':len(D),'skill % over base rate':{m:skill(D,m) for m in cols}}
    A['taking 6.2 apart (x1000 nats lost by removing; positive = the part helps)']={k:pair(D,k,'6.2 full',rng) for k in VAR if k!='6.2 full'}
    A['adding one 6.2 mechanism to the rank core (positive = it helps)']={k:pair(D,'M1',k,rng) for k in cols if k.startswith('core +')}
    A['rank core vs 6.2 (positive = core better)']={'M1 over 6.2 full':pair(D,'6.2 full','M1',rng),'M2 over 6.2 full':pair(D,'6.2 full','M2',rng),'core + full 6.2 read over 6.2 full':pair(D,'6.2 full','core + full 6.2 read',rng)}
    OUT['A warm (scored 2016-2026, each series walked from its start)']=A; print(json.dumps(A),flush=True)
    # ---- cold start with coefficient priors, all families, MOVE and RANGE
    F=load_families(); tabs_all=[train_tables(F[f]['train']) for f in FAMILIES]; pri={'MOVE':{},'RANGE':{}}
    for fam in FAMILIES:
        co={'MOVE':[], 'RANGE':[]}
        for rr in F[fam]['train']:
            for seg in [rr[i:i+2000] for i in range(0,len(rr),2000) if len(rr[i:i+2000])>=600][:12]:
                o=series_run(seg,[],reads=('MOVE','RANGE'),hex62=False)
                for rd in co: co[rd].append(o[rd+'_coef'])
        for rd in co:
            Am=np.array(co[rd]); pri[rd][fam]=(Am.mean(0),np.maximum(Am.var(0),1e-4) if len(Am)>1 else np.full(NW+NB,0.05))
        print('  priors',fam,len(co['MOVE']),flush=True)
    OUT['B prior means (7 window ranks, 5 block ranks)']={rd:{f:[round(float(v),3) for v in pri[rd][f][0]] for f in pri[rd]} for rd in pri}
    LC={}
    for fam in FAMILIES:
        acc={}
        for name,r in F[fam]['test']:
            if len(r)<1100: continue
            o=series_run(r,tabs_all,reads=('MOVE','RANGE'),hex62=True,priors=pri); o0=series_run(r,[],reads=('MOVE','RANGE'),hex62=True)
            for rd in ('MOVE','RANGE'):
                Dx=o[rd]; D0=o0[rd]
                for T in (25,50,100,250,500,1000):
                    d=acc.setdefault((rd,T),{})
                    for lab,(Dd,m) in {'null':(Dx,'M0'),'6.2 with 64-state tables':(Dx,'hex62'),'6.2 from nothing':(D0,'hex62'),'rank core, no prior':(Dx,'M1'),'rank core, coefficient priors':(Dx,'priormix')}.items():
                        d.setdefault(lab,[]).append(float((LL(Dd,m)[:T]-LL(Dd,'base')[:T]).mean())*1000)
        LC[fam]={f'{rd} first {T}':{k:round(float(np.mean(v)),1) for k,v in d.items()} for (rd,T),d in acc.items()}
        print('learning',fam,json.dumps(LC[fam]),flush=True)
    OUT['C learning curves (mean log-loss difference vs base rate x1000; negative is better)']=LC
    json.dump(OUT,open(os.path.join(HERE,'core3_ablate.json'),'w'),indent=1)
if __name__=='__main__': main()
