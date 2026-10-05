# ===========================================================================
# HEX PI 7.0 as proposed (prereg_hex7.md). Prediction only.
#   logit p = logit q0 + beta . Z          q0: the null engine; Z: continuous ranks
# with a small hierarchy of hypotheses, reversible influence (fixed share),
# shadow-tested interactions ("resonance"), optional calibration, and an
# amplitude (interference) challenger. Compared with the null, 6.2, 6.4, 6.5
# on the same calls.          python3 hex7.py [MOVE|RANGE|all]
# ===========================================================================
import numpy as np, pandas as pd, json, os, sys, math, itertools
from precision import datasets, walk as hex62, calibrate_forward, HERE
from core2 import boot
from rankcore import rank_feats, TAUS, HALF, FIRST, MIN_MED
import hexmodel as hm, hexcoupled as hc
clip=lambda p: np.clip(p,.01,.99); lg=lambda p: math.log(min(max(p,1e-6),1-1e-6)/(1-min(max(p,1e-6),1-1e-6)))
ALPHAS=(0.0,0.001,0.005,0.02,0.05); PHIS=(0.0,np.pi/4,np.pi/2,3*np.pi/4,np.pi); NZ=7

class Share:
    """Experts aggregated with reversible influence: one fixed-share mixture per switching rate, the rates mixed by likelihood. ALPHAS=(0,) is plain Bayes."""
    def __init__(s,n,alphas=ALPHAS): s.a=np.array(alphas)[:,None]; s.w=np.full((len(alphas),n),1.0/n); s.ll=np.zeros(len(alphas)); s.n=n
    def predict(s,P): s.q=s.w@P; o=np.exp(s.ll-s.ll.max()); s.o=o/o.sum(); return float(s.o@s.q)
    def update(s,P,y):
        s.ll+=np.log(np.where(y,s.q,1-s.q)); w=s.w*np.where(y,P,1-P)[None,:]; w/=w.sum(1,keepdims=True); s.w=(1-s.a)*w+s.a/s.n

class Batch:
    """Many online logistic regressions at once: model m has its own feature vector (zero-padded) and nine prior scales mixed by likelihood."""
    def __init__(s,M,d): s.M=M; s.d=d; s.T=len(TAUS); s.P=np.tile(np.stack([np.eye(d)*t for t in TAUS])[None],(M,1,1,1)); s.th=np.zeros((M,s.T,d)); s.ll=np.zeros((M,s.T))
    def predict(s,X,off):
        s.X=X; s.q=clip(1/(1+np.exp(-(off+np.einsum('mtd,md->mt',s.th,X))))); w=np.exp(s.ll-s.ll.max(1,keepdims=True)); w/=w.sum(1,keepdims=True); return (w*s.q).sum(1)
    def update(s,y):
        q=s.q; X=s.X; s.ll+=np.log(np.where(y,q,1-q)); wt=q*(1-q); Px=np.einsum('mtij,mj->mti',s.P,X); den=1+wt*np.einsum('mti,mi->mt',Px,X)
        s.P-=(wt/den)[:,:,None,None]*Px[:,:,:,None]*Px[:,:,None,:]; s.th+=np.einsum('mtij,mj->mti',s.P,X)*(y-q)[:,:,None]

OWN_PAIRS=list(itertools.combinations(range(NZ),2)); CROSS=[(i,j) for i in range(NZ) for j in range(NZ)]
def walk(r, read, null_share=False):
    """One series, one read. Returns a frame of every scored step with each method's probability."""
    r=np.asarray(r,float); n=len(r); x=np.cumsum(r); a=np.abs(r); med=pd.Series(a).expanding(MIN_MED).median().values
    own,oth=(x,a) if read=='MOVE' else (a,x); Zo=rank_feats(own)[:,:NZ]; Zx=rank_feats(oth)[:,:NZ]
    if read=='MOVE': cnt=np.arange(1,n+1); qrank=clip((cnt-pd.Series(x).expanding().rank(method='max').values+1)/(cnt+1))
    rho=np.array([1.0 if h is None else 0.5**(1.0/h) for h in HALF]); U=np.zeros(len(HALF)); N=np.zeros(len(HALF)); ne=len(HALF)+(read=='MOVE')
    nullB=Share(ne,(0.0,)); nullS=Share(ne)
    M=3+len(OWN_PAIRS)+len(CROSS); d=2*NZ+1; B=Batch(M,d); X=np.zeros((M,d))
    Eown=np.zeros(len(OWN_PAIRS)); Ecross=np.zeros(len(CROSS)); Cown=math.log(len(OWN_PAIRS)); Ccross=math.log(len(CROSS))
    aggB=Share(5,(0.0,)); aggS=Share(5); ab=Share(2,(0.0,)); llphi=np.zeros(len(PHIS)); cph=np.cos(np.array(PHIS)); rows=[]; adm_own=adm_cross=0
    for i in range(FIRST,n-1):
        if read=='RANGE' and np.isnan(med[i]): continue
        y=int(r[i+1]>0) if read=='MOVE' else int(a[i+1]>med[i])
        b=clip((U+1)/(N+2)); ex=np.r_[b,qrank[i]] if read=='MOVE' else b
        q0b=nullB.predict(ex); q0s=nullS.predict(ex); q0=q0s if null_share else q0b
        zo,zx=Zo[i],Zx[i]; X[:]=0; X[0,:NZ]=zo; X[1,NZ:2*NZ]=zx; X[2,:NZ]=zo; X[2,NZ:2*NZ]=zx
        k=3
        for (u,v) in OWN_PAIRS: X[k,:NZ]=zo; X[k,2*NZ]=zo[u]*zo[v]; k+=1
        for (u,v) in CROSS: X[k,:NZ]=zo; X[k,NZ:2*NZ]=zx; X[k,2*NZ]=zo[u]*zx[v]; k+=1
        P=B.predict(X,lg(q0)); m1,mb,m3=P[0],P[1],P[2]; po=P[3:3+len(OWN_PAIRS)]; pc=P[3+len(OWN_PAIRS):]
        jo=int(np.argmax(Eown)); m2=po[jo] if Eown[jo]>Cown else m1                      # admitted only after its prospective gain exceeds the search cost
        jc=int(np.argmax(Ecross)); mres=pc[jc] if Ecross[jc]>Ccross else m3
        adm_own+=Eown[jo]>Cown; adm_cross+=Ecross[jc]>Ccross
        V=np.array([q0,m1,m2,m3,mres]); pB=aggB.predict(V); pS=aggS.predict(V)
        AB=np.array([m1,mb]); mix=ab.predict(AB); wA,wB=ab.w[0]
        n1=wA*m1+wB*mb+2*np.sqrt(wA*wB*m1*mb)*cph; n0=wA*(1-m1)+wB*(1-mb)+2*np.sqrt(wA*wB*(1-m1)*(1-mb))*cph; pa=clip(n1/np.maximum(n1+n0,1e-12)); wp=np.exp(llphi-llphi.max()); wp/=wp.sum(); amp=float(wp@pa)
        rows.append((i,y,q0b,q0s,m1,m2,m3,mres,pB,pS,mix,amp))
        L=lambda p: math.log(p if y else 1-p)
        Eown+=np.log(np.where(y,po,1-po))-L(m1); Ecross+=np.log(np.where(y,pc,1-pc))-L(m3)
        nullB.update(ex,y); nullS.update(ex,y); B.update(y); aggB.update(V,y); aggS.update(V,y); ab.update(AB,y); llphi+=np.log(np.where(y,pa,1-pa)); U=rho*U+y; N=rho*N+1
    D=pd.DataFrame(rows,columns=['i','y','null','null_share','rank','rank_inter','rank_cross','resonance','hex7_bayes','hex7','mixAB','amplitude'])
    D.attrs['admitted']=(adm_own/max(1,len(D)),adm_cross/max(1,len(D)),OWN_PAIRS[int(np.argmax(Eown))],CROSS[int(np.argmax(Ecross))],float(Eown.max()),float(Ecross.max())); return D

def shadow_cal(p,y):
    """Calibration that may change a call (isotonic on the whole probability, earlier calls only), and the same used only while it has scored better so far."""
    c=clip(calibrate_forward(p.copy(),y)); l=lambda q: np.log(np.where(y==1,q,1-q)); lead=np.r_[0,np.cumsum(l(c)-l(p))[:-1]]; return c,np.where(lead>0,c,p)

if __name__=='__main__':
    which=sys.argv[1] if len(sys.argv)>1 else 'all'; NS=os.environ.get('NULL','bayes')=='share'
    rng=np.random.default_rng(107); DS,tabs=datasets(); OUT={}
    for dom,read in (('weather','MOVE'),('racing','MOVE'),('markets','MOVE'),('weather','RANGE'),('markets','RANGE')):
        if which not in ('all',read): continue
        fr=[]; adm=[]
        for g,(name,r,start) in enumerate(DS[dom]):
            D=walk(r,read,NS); adm.append(D.attrs['admitted']); D=D.set_index('i')
            b=D.null.reindex(range(len(r))).values
            for nm,W in (('hex64',hm.walk(r,read,base=b)[0]),('hex65',hc.walk(r,read,base=b)[0])): D[nm]=pd.Series({x[0]:x[1] for x in W})
            H=hex62(r,tabs); h=pd.Series(H[:,0 if read=='MOVE' else 3],index=np.arange(12,12+len(H))); D['hex62']=h.reindex(D.index).values; D['hex62']=np.where(np.isnan(D.hex62),D.null,clip(D.hex62))
            D=D.dropna().reset_index(); D['hex7_cal'],D['hex7_cal_shadow']=shadow_cal(D.hex7.values,D.y.values); D['g']=g; fr.append(D[D.i>=max(26,start)])
        D=pd.concat(fr,ignore_index=True); y=D.y.values; Gp=D.g.values if dom=='racing' else None; ll=lambda c: np.log(np.where(y==1,D[c].values,1-D[c].values))
        def row(c):
            p=D[c].values; s=np.abs(p-.5); t=s>=np.quantile(s,.9); hit=((p>=.5).astype(int)==y); gdiff=ll(c)-ll('null')
            return {'right %':round(float(hit.mean())*100,2),'gain over the null (x1000 nats)':[round(float(gdiff.mean())*1000,2)]+boot(gdiff,rng,Gp),'strongest tenth: stated, right':[round(float(np.maximum(p,1-p)[t].mean())*100,1),round(float(hit[t].mean())*100,1)]}
        cols=['null','null_share','hex62','hex64','hex65','rank','rank_inter','rank_cross','resonance','hex7_bayes','hex7','hex7_cal','hex7_cal_shadow','mixAB','amplitude']
        e={'calls':len(D),'methods':{c:row(c) for c in cols}}
        pr=lambda a,b: (lambda d: [round(float(d.mean())*1000,2)]+boot(d,rng,Gp))(ll(a)-ll(b))
        fl=((D.hex7_cal>=.5)!=(D.hex7>=.5)).values
        e['pairs (x1000 nats)']={'7.0 over 6.5':pr('hex7','hex65'),'7.0 over 6.4':pr('hex7','hex64'),'fixed share over plain Bayes weights (top level)':pr('hex7','hex7_bayes'),'fixed share over plain Bayes weights (null)':pr('null_share','null'),
            'admitted interaction over rank':pr('rank_inter','rank'),'resonance over additive':pr('resonance','rank_cross'),'other observable over own only':pr('rank_cross','rank'),'amplitude over classical mixture':pr('amplitude','mixAB'),'amplitude over classical interaction':pr('amplitude','resonance'),
            'calibration over none':pr('hex7_cal','hex7'),'calibration in shadow over none':pr('hex7_cal_shadow','hex7')}
        e['calls calibration changed %']=round(float(fl.mean())*100,2); e['those calls right %: before, after']=[round(float(((D.hex7>=.5).astype(int)==y)[fl].mean())*100,1),round(float(((D.hex7_cal>=.5).astype(int)==y)[fl].mean())*100,1)] if fl.any() else None
        e['share of steps with an admitted product: own, cross']=[round(float(np.mean([a[0] for a in adm])),3),round(float(np.mean([a[1] for a in adm])),3)]
        OUT[f'{dom} {read}']=e; print(dom,read,json.dumps(e),flush=True)
        json.dump(OUT,open(os.path.join(HERE,f'hex7_results_{which}{"_nullshare" if NS else ""}.json'),'w'),indent=1)
