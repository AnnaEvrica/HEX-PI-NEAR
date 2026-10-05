# Reads the replay ledger and writes the numbers and charts (replay/report.json, replay/*.png).
import numpy as np, pandas as pd, json, os
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'replay'); LN2=np.log(2); rng=np.random.default_rng(23)
L=pd.read_parquet(os.path.join(OUT,'hex7_ledger.parquet'))
for c in ('series_id','class','role','read'): L[c]=L[c].astype(str)
y=L.outcome.values.astype(int); ls=lambda c: np.log(np.where(y==1,L[c].values.astype(float),1-L[c].values.astype(float)))            # log score: ln of the probability given to what happened
L['g0']=ls('hex_probability')-ls('null_probability'); L['g65']=ls('hex_probability')-ls('legacy_65_probability'); L['lg']=ls('hex_probability')-ls('frozen_probability'); L['gs']=ls('shown_probability')-ls('hex_probability')
L['brier_hex']=(L.hex_probability-y)**2; L['brier_null']=(L.null_probability-y)**2; L['correct_hex']=((L.hex_probability>=.5).astype(int)==y).astype(int); L['correct_null']=((L.null_probability>=.5).astype(int)==y).astype(int)
AGES=[('1-100',1,100),('101-250',101,250),('251-500',251,500),('501-1000',501,1000),('1001+',1001,10**9)]
def blocks(D):
    if D.date.notna().all(): return ((D.date-D.date.min()).dt.days//20).astype(str).values                 # 20 calendar days; calls on the same days stay together
    return D.series_id.values                                                                                 # undated (racing): the series is the block
def gain(D,col,B=2000):
    """Bits per call with a 95% interval from a block bootstrap, call-weighted and as a macro-average over series."""
    D=D[D[col].notna()]
    if not len(D): return None
    b=pd.factorize(blocks(D))[0]; s=pd.factorize(D.series_id.values)[0]; nb=b.max()+1; ns=s.max()+1; S=np.zeros((nb,ns)); N=np.zeros((nb,ns)); np.add.at(S,(b,s),D[col].values); np.add.at(N,(b,s),1)
    idx=rng.integers(0,nb,(B,nb)); Sb=S[idx].sum(1); Nb=N[idx].sum(1); tot=Sb.sum(1)/Nb.sum(1)/LN2
    with np.errstate(invalid='ignore',divide='ignore'): mac=np.nanmean(np.where(Nb>0,Sb/Nb,np.nan),1)/LN2
    r=lambda v: round(float(v),5)
    return {'bits per call':r(D[col].mean()/LN2),'95% interval':[r(np.percentile(tot,2.5)),r(np.percentile(tot,97.5))],'total bits':round(float(D[col].sum()/LN2),1),
            'macro-average over series':r((D.groupby('series_id')[col].mean()/LN2).mean()),'macro 95% interval':[r(np.nanpercentile(mac,2.5)),r(np.nanpercentile(mac,97.5))],'calls':int(len(D)),'series':int(ns)}
def ece(p,y):
    b=np.minimum(9,np.floor(p*10)).astype(int); return round(float(sum(abs(p[b==k].mean()-y[b==k].mean())*(b==k).mean() for k in range(10) if (b==k).any())),4)
def basics(D):
    y=D.outcome.values; p=D.hex_probability.values; s=np.abs(p-.5); t=s>=np.quantile(s,.9)
    return {'calls':int(len(D)),'right %':round(float(D.correct_hex.mean())*100,2),'expected (the null) right %':round(float(D.correct_null.mean())*100,2),'6.5 right %':round(float(((D.legacy_65_probability.dropna()>=.5).astype(int)==D.outcome[D.legacy_65_probability.notna()]).mean())*100,2),
            'Brier skill over the null %':round(float(1-D.brier_hex.mean()/D.brier_null.mean())*100,2),'calibration error':ece(p,y),'strongest tenth: stated, right %':[round(float(np.maximum(p,1-p)[t].mean())*100,1),round(float(D.correct_hex.values[t].mean())*100,1)]}
def block(D):
    e=basics(D); e['information gain over the null']=gain(D,'g0'); e['over 6.5']=gain(D,'g65'); e['learning gain (learning against frozen after 500 calls)']=gain(D[D.experience_count>500],'lg')
    e['by series']={sid:{'calls':int(len(G)),'bits per call over the null':round(float(G.g0.mean()/LN2),5),'over 6.5':round(float(G.g65.mean()/LN2),5),'right %':round(float(G.correct_hex.mean())*100,1),'expected right %':round(float(G.correct_null.mean())*100,1)} for sid,G in D.groupby('series_id')}
    e['by experience']={lab:{'calls':int(len(G)),'bits per call over the null':round(float(G.g0.mean()/LN2),5),'Brier skill %':round(float(1-G.brier_hex.mean()/G.brier_null.mean())*100,2),'right % minus expected':round(float((G.correct_hex.mean()-G.correct_null.mean())*100),2),'calibration error':ece(G.hex_probability.values,G.outcome.values)} for lab,lo,hi in AGES for G in [D[(D.experience_count>=lo)&(D.experience_count<=hi)]] if len(G)}
    return e
R={'ledger rows':int(len(L)),'meta':json.load(open(os.path.join(OUT,'replay_meta.json')))}
GROUPS={'markets, development (17 series, 2016-2026)':(L['class']=='markets')&(L.role=='development'),'currencies never used before (10 series, 2016-2026)':(L['class']=='markets')&(L.role=='replication'),
        'temperature, development (Chicago)':(L['class']=='weather')&(L.role=='development'),'temperature never used before (3 stations)':(L['class']=='weather')&(L.role=='replication'),'racing, development':L['class']=='racing'}
for nm,m in GROUPS.items(): R[nm]={read:block(L[m&(L['read']==read)]) for read in ('RANGE','MOVE')}
M=L[GROUPS['markets, development (17 series, 2016-2026)']].copy(); R['strength map over the engine\'s own probability (markets, development)']={read:gain(M[M['read']==read],'gs') for read in ('RANGE','MOVE')}
R['by year (markets, development)']={read:{int(yv):{'calls':int(len(G)),'bits per call over the null':round(float(G.g0.mean()/LN2),5),'over 6.5':round(float(G.g65.mean()/LN2),5),'right %':round(float(G.correct_hex.mean())*100,1),'expected right %':round(float(G.correct_null.mean())*100,1)} for yv,G in M[M['read']==read].groupby(M.date.dt.year)} for read in ('RANGE','MOVE')}
# which version would the ledger show: the product's rule, on information gain, day by day
def rule(D):
    """base44/shared/ledger.ts: decide. Per-call mean of ln p7(y) - ln p65(y) with days as clusters; 300 calls, 60 days, 1.96 standard errors."""
    D=D[D.g65.notna()].copy(); D['c65']=((D.legacy_65_probability>=.5).astype(int)==D.outcome).astype(int)
    days=D.groupby('outcome_date').agg(n=('g65','size'),s=('g65','sum'),hk=('correct_hex','sum'),hc=('c65','sum'))
    live='6.5'; ev=[]; N=nd=0; S=SS=SN=NN=0.; hk=hc=0
    for d,r in days.iterrows():
        N+=r.n; nd+=1; S+=r.s; SS+=r.s**2; SN+=r.s*r.n; NN+=r.n**2; hk+=r.hk; hc+=r.hc
        if N<300 or nd<60: continue
        m=S/N; se=np.sqrt(max(0,SS-2*m*SN+m*m*NN)*nd/(nd-1))/N
        if live=='6.5' and m-1.96*se>0 and hk>=hc: live='7.0'; ev.append([str(d.date()),'7.0 shown'])
        elif live=='7.0' and m+1.96*se<0: live='6.5'; ev.append([str(d.date()),'back to 6.5'])
    return {'events':ev,'shown at the end':live,'7.0 over 6.5, bits per call':round(float(m/LN2),5),'interval by the rule':[round(float((m-1.96*se)/LN2),5),round(float((m+1.96*se)/LN2),5)]}
R['which version the ledger would show, starting from 6.5 (markets, development)']={read:rule(M[M['read']==read]) for read in ('RANGE','MOVE')}
R['status']={read:('verified signal' if R['markets, development (17 series, 2016-2026)'][read]['information gain over the null']['95% interval'][0]>0 else 'no verified signal') for read in ('RANGE','MOVE')}
json.dump(R,open(os.path.join(OUT,'report.json'),'w'),indent=1)
# ---- charts
INK='#0b0b0b'; MUTE='#52514e'; C={'RANGE':'#2a78d6','MOVE':'#eb6834'}; NAME={'RANGE':'Move size','MOVE':'Direction'}
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':9,'axes.edgecolor':'#c9c8c2','axes.labelcolor':MUTE,'xtick.color':MUTE,'ytick.color':MUTE,'axes.spines.top':False,'axes.spines.right':False,'figure.facecolor':'#fcfcfb','axes.facecolor':'#fcfcfb','savefig.facecolor':'#fcfcfb'})
def line(col,title,fn,ylabel,roll=None,sub=None):
    f,ax=plt.subplots(figsize=(7.2,3.1)); ax.axhline(0,color='#c9c8c2',lw=0.8)
    for read in ('RANGE','MOVE'):
        D=M[(M['read']==read)&M[col].notna()]; D=D[D.experience_count>500] if sub else D; D=D.sort_values(['outcome_date','series_id'])
        v=(D[col].rolling(roll).mean()/LN2) if roll else D[col].cumsum()/LN2; ax.plot(D.outcome_date.values,v.values,color=C[read],lw=1.6,label=NAME[read]); last=v.dropna().iloc[-1]
        ax.annotate(f"{NAME[read]}  {last:+.4f}" if roll else f"{NAME[read]}  {(last if abs(last)>=0.5 else 0):+.0f} bits".replace("+0 bits","0 bits"),(D.outcome_date.values[-1],last),xytext=(6,0),textcoords='offset points',va='center',fontsize=8.5,color=INK)
    ax.set_title(title,loc='left',fontsize=10.5,color=INK,pad=10); ax.set_ylabel(ylabel); ax.grid(axis='y',color='#ecebe6',lw=0.6); ax.legend(frameon=False,loc='upper left',fontsize=8.5); ax.margins(x=0.01); f.subplots_adjust(right=0.80,left=0.10,bottom=0.12,top=0.86); f.savefig(os.path.join(OUT,fn),dpi=200); plt.close(f)
line('g0','Information gained over the null, 17 markets, from nothing in January 2016','chart_gain_vs_null.png','cumulative bits')
line('g65','Information gained by 7.0 over 6.5 on the same calls','chart_gain_vs_65.png','cumulative bits')
line('g0','Is the edge alive: gain over the null across the latest 2,000 calls','chart_rolling.png','bits per call',roll=2000)
line('lg','Learning gain: the engine left to learn against itself frozen after 500 calls','chart_learning.png','cumulative bits',sub=True)
f,ax=plt.subplots(figsize=(7.2,3.0)); ax.axhline(0,color='#c9c8c2',lw=0.8); labs=[a[0] for a in AGES]; xx=np.arange(len(labs))
for k,read in enumerate(('RANGE','MOVE')):
    v=[R['markets, development (17 series, 2016-2026)'][read]['by experience'][l]['bits per call over the null'] for l in labs]; bars=ax.bar(xx+(k-.5)*0.36,v,0.32,color=C[read],label=NAME[read])
    for x_,v_ in zip(xx+(k-.5)*0.36,v): ax.annotate(f'{v_:+.4f}',(x_,v_),xytext=(0,3 if v_>=0 else -9),textcoords='offset points',ha='center',fontsize=7.5,color=INK)
ax.set_xticks(xx); ax.set_xticklabels(labs); ax.set_xlabel('calls the engine had already made on the series'); ax.set_ylabel('bits per call over the null'); ax.set_title('Skill by experience on a series, 17 markets',loc='left',fontsize=10.5,color=INK,pad=10); ax.grid(axis='y',color='#ecebe6',lw=0.6); ax.legend(frameon=False,fontsize=8.5,loc='upper left'); f.subplots_adjust(left=0.11,right=0.97,bottom=0.17,top=0.86); f.savefig(os.path.join(OUT,'chart_experience.png'),dpi=200); plt.close(f)
def show(nm):
    for read in ('RANGE','MOVE'):
        e=R[nm][read]; print(f"{nm} | {read}: n={e['calls']} right {e['right %']} vs expected {e['expected (the null) right %']} (6.5 {e['6.5 right %']}) | vs null {e['information gain over the null']['bits per call']} {e['information gain over the null']['95% interval']} macro {e['information gain over the null']['macro-average over series']} {e['information gain over the null']['macro 95% interval']} total {e['information gain over the null']['total bits']} | vs 6.5 {e['over 6.5']['bits per call']} {e['over 6.5']['95% interval']} | learning {e['learning gain (learning against frozen after 500 calls)'] and (e['learning gain (learning against frozen after 500 calls)']['bits per call'],e['learning gain (learning against frozen after 500 calls)']['95% interval'])} | brier skill {e['Brier skill over the null %']} ece {e['calibration error']} top10 {e['strongest tenth: stated, right %']}")
for nm in GROUPS: show(nm)
print(json.dumps(R["strength map over the engine's own probability (markets, development)"])); print(json.dumps(R['which version the ledger would show, starting from 6.5 (markets, development)'])); print(R['status'])
for read in ('RANGE','MOVE'): print(read,'experience',json.dumps(R['markets, development (17 series, 2016-2026)'][read]['by experience'])); print(read,'year',json.dumps(R['by year (markets, development)'][read]))
for nm in ('currencies never used before (10 series, 2016-2026)','temperature never used before (3 stations)'):
    for read in ('RANGE','MOVE'): print(nm,read,json.dumps(R[nm][read]['by series']))
