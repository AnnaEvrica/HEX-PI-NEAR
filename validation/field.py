# ===========================================================================
# Electromagnetic pull ("symmetry field") on the v5.5 probability layer.
#
# Each state carries a charge = its decayed residual evidence (D) and mass (N).
# States attract evidence from their partners in the 64-hypercube:
#   Coulomb pull   neighbours at Hamming distance d (same consensus bit),
#                  weight 1/d²            (sign +: similar patterns behave alike)
#   Mirror pull    the complement pattern (every line flipped),
#                  weight 1, sign −       (a falling pattern mirrors a rising one)
# Pooled estimate for state s:
#   p_s = b + (D_s + α Σ_j w_sj σ_sj D_j) / (N_s + α Σ_j w_sj N_j + K)
# Motivation: α is not fixed. Hex keeps four field strengths α ∈ {0, ¼, 1, 4}
# and leans toward the one whose symmetric world has been explaining the
# decayed evidence best (likelihood weights, forgetting γ = 0.999) — it changes
# its own baseline as it goes. α = 0 keeps the unpulled engine as a fallback.
# Selection fixed on 2000–2015; scored 2016-01 → 2026-09; shuffled null.
# ===========================================================================
import numpy as np, pandas as pd, math, json
from hexg import load_all, shuffled, SPLIT
from patched import M, key_dir
from sklearn.isotonic import IsotonicRegression
def recalibrate(df,col,ycol):
    df=df.copy(); df[col+'_cal']=np.nan
    for Y in range(2000,2027):
        tr=df[(df.t<pd.Timestamp(f'{Y}-01-01'))&df[col].notna()]
        te=(df.t.dt.year==Y)&df[col].notna()
        if len(tr)<2000 or not te.any(): continue
        iso=IsotonicRegression(out_of_bounds='clip',y_min=.01,y_max=.99).fit(tr[col],tr[ycol])
        df.loc[te,col+'_cal']=iso.predict(df.loc[te,col])
    return df
LAM=0.999; K=100; ALPHAS=(0.0,0.25,1.0,4.0); G=0.999

def field_matrix(bits, mirror, consensus):
    S=1<<bits; n=S*(2 if consensus else 1); W=np.zeros((n,n))
    for s in range(n):
        ms,cs=(s>>1,s&1) if consensus else (s,0)
        for t in range(n):
            mt,ct=(t>>1,t&1) if consensus else (t,0)
            if s==t or cs!=ct: continue
            d=bin(ms^mt).count('1')
            if mirror and mt==(S-1)^ms: W[s,t]-=1.0            # mirror partner, opposite sign
            elif d<=2: W[s,t]+=1.0/d**2                         # Coulomb neighbours
    return W
WD=field_matrix(6,True,True); WM=field_matrix(6,False,False)
AW_D=np.abs(WD); AW_M=np.abs(WM)

def run_series(x):
    r=np.diff(np.log(x)); n=len(r); a=np.abs(r)
    med=pd.Series(a).expanding(20).median().values
    res=[]
    Dd=np.zeros(128);Nd=np.zeros(128);bu=bn=0.
    Dm=np.zeros(64);Nm=np.zeros(64);mu_=mn=0.
    lld=np.zeros(len(ALPHAS)); llm=np.zeros(len(ALPHAS))
    for i in range(12,n-1):
        s=key_dir(r,i); b=(bu+1)/(bn+2)
        pull_D=WD[s]@Dd; pull_N=AW_D[s]@Nd
        P=np.clip([b+(Dd[s]+al*pull_D)/(Nd[s]+al*pull_N+K) for al in ALPHAS],.01,.99)
        w=np.exp(lld-lld.max()); p=float(w@P/w.sum()); p0=P[0]
        y=int(r[i+1]>0)
        sm=int(''.join('1' if a[j]>med[j-1] else '0' for j in range(i-5,i+1)),2) if i>25 else None
        bm=(mu_+1)/(mn+2); pm=pm0=np.nan; ym=int(a[i+1]>med[i])
        if sm is not None:
            Q=np.clip([bm+(Dm[sm]+al*(WM[sm]@Dm))/(Nm[sm]+al*(AW_M[sm]@Nm)+K) for al in ALPHAS],.01,.99)
            wm=np.exp(llm-llm.max()); pm=float(wm@Q/wm.sum()); pm0=Q[0]
            llm=G*llm+np.log(np.where(ym,Q,1-Q))
            Dm*=LAM;Nm*=LAM;Dm[sm]+=ym-bm;Nm[sm]+=1;mu_=mu_*LAM+ym;mn=mn*LAM+1
        lld=G*lld+np.log(np.where(y,P,1-P))
        Dd*=LAM;Nd*=LAM;Dd[s]+=y-b;Nd[s]+=1;bu=bu*LAM+y;bn=bn*LAM+1
        res.append((i+1,p,p0,y,pm,pm0,ym,float(w[2:].sum()/w.sum())))
    return res

def build(S):
    rows=[]
    for k,s in S.items():
        idx=pd.to_datetime(s.index)
        for (j,p,p0,y,pm,pm0,ym,share) in run_series(s.values):
            rows.append((k,idx[j],1,p,p0,y,pm,pm0,ym,share))
    return pd.DataFrame(rows,columns=['id','t','h','p_field','p_plain','y_dir','m_field','m_plain','y_mag','strong_field_weight'])

if __name__=='__main__':
    out={}
    for lab,SS in (('real',load_all()),('shuffled',shuffled(load_all(),11))):
        D=build(SS)
        for c,yc in (('p_field','y_dir'),('p_plain','y_dir'),('m_field','y_mag'),('m_plain','y_mag')):
            D=recalibrate(D,c,yc)
        res={}
        for per,(lo,hi) in (('select 2000-2015',('2000-01-01','2016-01-01')),('test 2016-2026',('2016-01-01','2026-12-31'))):
            T=D[(D.t>=lo)&(D.t<hi)].dropna(subset=['p_field_cal','m_field_cal'])
            ref=np.full(len(T),T.y_dir.mean()); refm=np.full(len(T),T.y_mag.mean())
            res[per]={'n':len(T),
              'direction plain':M(T.p_plain_cal.values,T.y_dir.values,ref),
              'direction + field':M(T.p_field_cal.values,T.y_dir.values,ref),
              'big move plain':M(T.m_plain_cal.values,T.y_mag.values,refm),
              'big move + field':M(T.m_field_cal.values,T.y_mag.values,refm),
              'avg weight on strong field (α≥1)':round(float(T.strong_field_weight.mean()),3)}
            if per.startswith('test'):
                rng=np.random.default_rng(0); mo=T.t.dt.to_period('M').values; um=np.unique(mo)
                for nm,(a_,b_,yc) in {'direction':('p_field_cal','p_plain_cal','y_dir'),'big move':('m_field_cal','m_plain_cal','y_mag')}.items():
                    d=((T[a_]-T[yc])**2-(T[b_]-T[yc])**2).values; grp={u:d[mo==u] for u in um}
                    bs=[np.concatenate([grp[u] for u in rng.choice(um,len(um))]).mean() for _ in range(1000)]
                    res[per][f'{nm}: field minus plain Brier']=[round(d.mean(),6),[round(np.percentile(bs,2.5),6),round(np.percentile(bs,97.5),6)]]
        out[lab]=res; print(lab); [print(' ',k,v) for k,v in res.items()]
    json.dump(out,open('field_results.json','w'),indent=1,default=float)
