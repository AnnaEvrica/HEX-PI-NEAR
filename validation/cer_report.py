# Reads the CER shadow replay (cer/cer_ledger.parquet, cer_controls.parquet, cer_edges.json, cer_graph_*.json)
# and writes every number and chart (cer/report.json, cer/chart_*.png).   python3 cer_report.py
import numpy as np, pandas as pd, json, os, math
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt, matplotlib.dates
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'cer'); LN2=math.log(2); rng=np.random.default_rng(29); BLOCK=20
L=pd.read_parquet(os.path.join(OUT,'cer_ledger.parquet')); C=pd.read_parquet(os.path.join(OUT,'cer_controls.parquet')); E=pd.DataFrame(json.load(open(os.path.join(OUT,'cer_edges.json'))))
for c in ('universe','series_id','read','class','role'): L[c]=L[c].astype(str)
for c in [x for x in L.columns if x.startswith('d_')]: L[c[2:]]=L['null_probability' if '_null_' in c else 'hex_probability']+L[c].astype(float)      # stored as the departure from the offset
for c in ('universe','series_id','read','offset','variant','weighting'): C[c]=C[c].astype(str)
CALL=C; C=C[C.weighting=='reliability']                      # the controls of each weighting
L['block']=(L.date.values.astype('datetime64[D]').astype(np.int64))//BLOCK; y=L.outcome.values.astype(int)
ls=lambda c: np.log(np.where(y==1,L[c].values.astype(float),1-L[c].values.astype(float)))/LN2          # log score in bits: log2 of the probability given to what happened
for c in ['null_probability','hex_probability']+[f'{w}_{o}_lag{l}' for w in ('cer','cerq','cere','cert') for o in ('null','hex') for l in (0,1)]: L['s_'+c]=ls(c)
r5=lambda v: round(float(v),5)
def gain(T):
    """T: rows of (block, series_id, s = summed gain in bits, n = calls). Bits per call, 95% interval from a bootstrap over 20-day blocks, call-weighted and as a macro-average over series."""
    T=T[T.n>0]
    if not len(T): return None
    b=pd.factorize(T.block.values)[0]; s=pd.factorize(T.series_id.values)[0]; nb=b.max()+1; ns=s.max()+1; S=np.zeros((nb,ns)); N=np.zeros((nb,ns)); np.add.at(S,(b,s),T.s.values); np.add.at(N,(b,s),T.n.values)
    idx=rng.integers(0,nb,(2000,nb)); Sb=S[idx].sum(1); Nb=N[idx].sum(1); tot=Sb.sum(1)/Nb.sum(1)
    with np.errstate(invalid='ignore',divide='ignore'): mac=np.nanmean(np.where(Nb>0,Sb/Nb,np.nan),1); per=S.sum(0)/N.sum(0)
    lo,hi=np.percentile(tot,[2.5,97.5]); return {'bits per call':r5(S.sum()/N.sum()),'95% interval':[r5(lo),r5(hi)],'clear of zero':bool(lo>0 or hi<0),'total bits':round(float(S.sum()),1),
            'macro-average over series':r5(per.mean()),'macro 95% interval':[r5(np.nanpercentile(mac,2.5)),r5(np.nanpercentile(mac,97.5))],'calls':int(N.sum()),'series':int(ns)}
def calls(D,a,b):
    """Gain of column a over column b on the calls of D."""
    T=D.assign(g=D['s_'+a]-D['s_'+b]).groupby(['block','series_id'],observed=True).g.agg(s='sum',n='size').reset_index(); return gain(T)
def ece(p,yy):
    b=np.minimum(9,np.floor(p*10)).astype(int); return round(float(sum(abs(p[b==k].mean()-yy[b==k].mean())*(b==k).mean() for k in range(10) if (b==k).any())),4)
def basics(D,c):
    p=D[c].values.astype(float); yy=D.outcome.values.astype(int); q=D.null_probability.values; s=np.abs(p-.5); t=s>=np.quantile(s,.9); ok=((p>=.5).astype(int)==yy)
    return {'right %':round(float(ok.mean())*100,2),'Brier skill over the null %':round(float(1-((p-yy)**2).mean()/((q-yy)**2).mean())*100,2),'calibration error':ece(p,yy),'strongest tenth: stated, right %':[round(float(np.maximum(p,1-p)[t].mean())*100,1),round(float(ok[t].mean())*100,1)]}
def product_rule(D,a,b):
    """base44/shared/ledger.ts: the per-call mean with days as clusters and a normal 95% interval."""
    g=(D['s_'+a]-D['s_'+b]); d=g.groupby(D.outcome_date.values).agg(['sum','size']); N=d['size'].sum(); nd=len(d); m=d['sum'].sum()/N; se=math.sqrt(max(0,((d['sum']-m*d['size'])**2).sum())*nd/(nd-1))/N
    return {'bits per call':r5(m),'95% interval':[r5(m-1.96*se),r5(m+1.96*se)],'clear of zero':bool(m-1.96*se>0 or m+1.96*se<0)}
MODES=(('measured weight (cer-0.2)','cerq','measurement'),('maximum entropy, T = 1 (cer-0.3)','cere','relaxation'),('maximum entropy, validated temperature (cer-0.3)','cert','relaxation, tempered'))
def block(D,uni,sids,read,lag):
    D=D[D[f'present_lag{lag}']>0]; cn,cf=f'cer_null_lag{lag}',f'cer_hex_lag{lag}'
    if not len(D): return None
    e={'calls':int(len(D)),'series':int(D.series_id.nunique()),'HEX 7.0 over the null':calls(D,'hex_probability','null_probability'),'CER standalone over the null':calls(D,cn,'null_probability'),'CER standalone over HEX 7.0':calls(D,cn,'hex_probability'),
       'fusion candidate over HEX 7.0':calls(D,cf,'hex_probability'),'fusion candidate over HEX 7.0, by the product\'s rule':product_rule(D,cf,'hex_probability'),'fusion candidate over the null':calls(D,cf,'null_probability')}
    K=C[(C.universe==uni)&C.series_id.isin(sids)&(C['read']==read)&(C.lag==lag)].rename(columns={'gain_bits':'s','calls':'n'})
    def net(on,col,base):
        A=D.assign(g=D['s_'+col]-D['s_'+base]).groupby(['block','series_id'],observed=True).g.agg(s='sum',n='size'); B=K[K.offset==on].groupby(['block','series_id'],observed=True).s.sum()/3
        A['s']=A.s-B.reindex(A.index).fillna(0.0); return gain(A.reset_index())
    e['real minus the mean of its three controls']={'standalone':net('null',cn,'null_probability'),'fusion candidate':net('hex',cf,'hex_probability')}
    e['controls']={v:{'standalone over the null':gain(K[(K.variant==v)&(K.offset=='null')]),'fusion candidate over HEX 7.0':gain(K[(K.variant==v)&(K.offset=='hex')])} for v in ('C1','C2','C3')}
    e['precision']={'the null':basics(D,'null_probability'),'HEX 7.0':basics(D,'hex_probability'),'CER standalone':basics(D,cn),'fusion candidate':basics(D,cf)}
    for mname,pre,wn in MODES:
        qn,qf=f'{pre}_null_lag{lag}',f'{pre}_hex_lag{lag}'; KQ=CALL[(CALL.weighting==wn)&(CALL.universe==uni)&CALL.series_id.isin(sids)&(CALL['read']==read)&(CALL.lag==lag)].rename(columns={'gain_bits':'s','calls':'n'})
        def netq(on,col,base):
            A=D.assign(g=D['s_'+col]-D['s_'+base]).groupby(['block','series_id'],observed=True).g.agg(s='sum',n='size'); B=KQ[KQ.offset==on].groupby(['block','series_id'],observed=True).s.sum()/3
            A['s']=A.s-B.reindex(A.index).fillna(0.0); return gain(A.reset_index())
        e[mname]={'CER standalone over the null':calls(D,qn,'null_probability'),'fusion candidate over HEX 7.0':calls(D,qf,'hex_probability'),'fusion candidate over HEX 7.0, by the product\'s rule':product_rule(D,qf,'hex_probability'),
            'fusion: this mode minus the original, same calls':calls(D,qf,cf),'standalone: this mode minus the original, same calls':calls(D,qn,cn),
            'controls':({v:{'standalone over the null':gain(KQ[(KQ.variant==v)&(KQ.offset=='null')]),'fusion candidate over HEX 7.0':gain(KQ[(KQ.variant==v)&(KQ.offset=='hex')])} for v in ('C1','C2','C3')} if len(KQ) else 'run on the arm that counts only'),
            'real minus the mean of its three controls':({'standalone':netq('null',qn,'null_probability'),'fusion candidate':netq('hex',qf,'hex_probability')} if len(KQ) else None),
            'precision':{'CER standalone':basics(D,qn),'fusion candidate':basics(D,qf)},
            'by series, fusion over HEX':{sid:r5((G['s_'+qf]-G.s_hex_probability).mean()) for sid,G in D.groupby('series_id')}}
    tv=D[f'temperature_lag{lag}'].round(0).astype(int).value_counts(normalize=True).sort_index(); e['relaxation: share of calls at each temperature %']={int(k):round(float(v)*100,1) for k,v in tv.items()}
    e['relaxation: edges eligible per call, mean; share of calls with none %']=[round(float(D[f'eligible_lag{lag}'].mean()),3),round(float((D[f'eligible_lag{lag}']==0).mean())*100,1)]
    e['by series']={sid:{'calls':int(len(G)),'HEX over the null':r5((G.s_hex_probability-G.s_null_probability).mean()),'CER standalone over the null':r5((G['s_'+cn]-G.s_null_probability).mean()),'fusion over HEX':r5((G['s_'+cf]-G.s_hex_probability).mean()),
                         'right %: null, HEX, CER, fusion':[round(float(((G[c]>=.5).astype(int)==G.outcome).mean())*100,1) for c in ('null_probability','hex_probability',cn,cf)]} for sid,G in D.groupby('series_id')}
    return e
MK=L[L.universe=='markets']; dev=sorted(MK[MK.role=='development'].series_id.unique()); rep=sorted(MK[MK.role=='replication'].series_id.unique()); WX=sorted(L[L.universe=='temperature'].series_id.unique())
GROUPS={'markets':{'development (17 series)':dev,'development without bitcoin (16 series)':[s for s in dev if not s.startswith('BTC')],'currencies never used before (10 series)':rep},
        'temperature':{**{'all four stations':WX},**{s:[s] for s in WX}},
        'energy x temperature':{'energy targets, temperature neighbours':['NATGAS','WTI','BRENT'],'temperature targets, energy neighbours':['Chicago','Seattle']}}
PRIMARY={'markets':1,'temperature':0,'energy x temperature':1}; NAME={'RANGE':'move size','MOVE':'direction'}
R={'meta':json.load(open(os.path.join(OUT,'cer_meta.json'))),'ledger rows':int(len(L)),'the arm that counts':{u:('strict (lag 1)' if l else 'same date (lag 0)') for u,l in PRIMARY.items()}}; R['meta'].pop('state hashes',None)
for uni,G in GROUPS.items():
    R[uni]={}
    for gname,sids in G.items():
        D=L[(L.universe==uni)&L.series_id.isin(sids)]; R[uni][gname]={NAME[read]:{('strict (lag 1)' if lag else 'same date (lag 0)'):block(D[D['read']==read],uni,sids,read,lag) for lag in (1,0)} for read in ('RANGE','MOVE')}
fx=[s_ for s_ in dev+rep if s_.startswith('FX-')]; D=MK[MK.series_id.isin(fx)&(MK['read']=='MOVE')]
R['currency series, direction, fusion candidate over HEX 7.0: same date against strict']={'series':len(fx),'same date':calls(D[D.present_lag0>0],'cer_hex_lag0','hex_probability'),'strict':calls(D[D.present_lag1>0],'cer_hex_lag1','hex_probability'),
    'by series, same date then strict':{k:[r5((G.s_cer_hex_lag0-G.s_hex_probability).mean()),r5((G.s_cer_hex_lag1-G.s_hex_probability).mean())] for k,G in D.groupby('series_id')}}
MK2=MK.assign(experience=MK.groupby(['series_id','read']).cumcount()+1); A=MK2[(MK2.experience>500)&MK2.series_id.isin(dev)&(MK2.present_lag1>0)]; K5=C[(C.universe=='markets')&C.series_id.isin(dev)&(C.lag==1)&(C.offset=='hex')]
first=MK2[MK2.experience==501].set_index(['series_id','read']).block
R['after the run: development markets, strict, calls after the first 500 on each series']={NAME[read]:{'fusion candidate over HEX 7.0':calls(A[A['read']==read],'cer_hex_lag1','hex_probability'),
    'controls (20-day blocks after the 500th call)':{v:gain(K5[(K5['read']==read)&(K5.variant==v)&(K5.block>K5.series_id.map(lambda s_: first.get((s_,read),10**9)))].rename(columns={'gain_bits':'s','calls':'n'}))['bits per call'] for v in ('C1','C2','C3')}} for read in ('RANGE','MOVE')}
if os.path.exists(os.path.join(OUT,'diagnostic.json')): R['after the run: what the displaced temperature neighbours carry']=json.load(open(os.path.join(OUT,'diagnostic.json')))
# ---- edges: each edge's own expert, scored alone against the offset
ok=E[E.status=='ok'].copy(); R['edges']={}
for uni in GROUPS:
    R['edges'][uni]={}
    for read in ('RANGE','MOVE'):
        for on,oname in (('null','standalone'),('hex','fusion candidate')):
            for lag in (1,0):
                X=ok[(ok.universe==uni)&(ok['read']==read)&(ok.offset==on)&(ok.lag==lag)]; ed=X[X.source!='(pool)']; po=X[X.source=='(pool)']
                top=ed.sort_values('bits_per_call',ascending=False).head(8)
                R['edges'][uni][f"{NAME[read]} | {oname} | {'strict' if lag else 'same date'}"]={'edges':int(len(ed)),'predictive (interval above zero)':int(ed.predictive.sum()),'expected by chance at 2.5%':round(len(ed)*0.025,1),
                    'holding more than the starting share at the end':int((ed.share_at_the_end>ed.starting_share).sum()),'pools predictive':f"{int(po.predictive.sum())} of {len(po)}",
                    'largest':[{'edge':f"{r.target} <- {r.source}",'bits per call':r5(r.bits_per_call),'interval':[r5(r.low),r5(r.high)],'share at the end':round(r.share_at_the_end,3),'calls':int(r.calls)} for r in top.itertuples()]}
R['measured edge weights (cer-0.2)']={}
for uni in GROUPS:
    for read in ('RANGE','MOVE'):
        for lag in (1,0):
            X=ok[(ok.universe==uni)&(ok['read']==read)&(ok.offset=='hex')&(ok.lag==lag)&(ok.source!='(pool)')]
            if 'mean_weight' not in X or not len(X): continue
            top=X.sort_values('mean_weight',ascending=False).head(8)
            R['measured edge weights (cer-0.2)'][f"{uni} | {NAME[read]} | {'strict' if lag else 'same date'}"]={'edges':int(len(X)),'edges that ever carried weight':int((X.calls_with_weight>0).sum()),'share of edge-calls with weight %':round(float((X.calls_with_weight*X.calls).sum()/X.calls.sum())*100,2),
                'mean A, L, C, Q over edges':[round(float(X[c].mean()),3) for c in ('mean_A','mean_L','mean_C','mean_Q')],
                'heaviest':[{'edge':f"{r.target} <- {r.source}",'mean weight':round(r.mean_weight,3),'A':round(r.mean_A,3),'L':round(r.mean_L,3),'C':round(r.mean_C,3),'Q':round(r.mean_Q,3),'share of calls with weight':round(r.calls_with_weight,3),'its expert alone, bits per call':r5(r.bits_per_call)} for r in top.itertuples()]}
T=ok[(ok.universe=='temperature')&(ok.lag==0)&(ok.offset=='hex')]; R['edges']['temperature, every edge (fusion candidate, same date)']={NAME[read]:{f"{r.target} <- {r.source}":{'bits per call':r5(r.bits_per_call),'interval':[r5(r.low),r5(r.high)],'predictive':bool(r.predictive),'share at the end':round(r.share_at_the_end,3),'starting share':round(r.starting_share,3),'calls':int(r.calls)} for r in T[T['read']==read].itertuples()} for read in ('RANGE','MOVE')}
X=ok[(ok.universe=='energy x temperature')&(ok.lag==1)&(ok.offset=='hex')]; R['edges']['energy x temperature, every edge (fusion candidate, strict)']={NAME[read]:{f"{r.target} <- {r.source}":{'bits per call':r5(r.bits_per_call),'interval':[r5(r.low),r5(r.high)],'predictive':bool(r.predictive),'calls':int(r.calls)} for r in X[X['read']==read].itertuples()} for read in ('RANGE','MOVE')}
# ---- the descriptive graph
R['descriptive graph']={}
for uni in GROUPS:
    G=json.load(open(os.path.join(OUT,'cer_graph_'+uni.replace(' x ','_x_')+'.json'))); ed=pd.DataFrame(G['edges']); x=ed[(ed.type=='rank-xcorr')&(ed.status=='ok')]; p=ed[(ed.type=='partial-rank-xcorr')&(ed.status=='ok')]; c=ed[(ed.type=='coherence')&(ed.status=='ok')]
    coh=c.groupby(['target','source']).coherent.any() if len(c) else pd.Series(dtype=bool)
    R['descriptive graph'][uni]={'as of':str(pd.Timestamp(G['as_of'],unit='D').date()),'channels':len(G['nodes']),'ordered pairs':int(ed.groupby(['target','source']).ngroups),'pairs that could be read':int(len(x)),
        'rank cross-correlation: related':int(x.related.sum()),'of which strongest at lag 0':int((x[x.related==True].lag==0).sum()),'still related with the shared driver removed':int(p.related.sum()) if len(p) else 0,
        'coherent in at least one band':int(coh.sum()),'median |strength|, raw and with the driver removed':[round(float(x.strength.abs().median()),3),round(float(p.strength.abs().median()),3) if len(p) else None],
        'strongest':[{'edge':f"{r.target} <- {r.source}",'strength':round(r.strength,3),'lag':int(r.lag),'with the driver removed':(lambda q: round(float(q.strength.iloc[0]),3) if len(q) else None)(p[(p.target==r.target)&(p.source==r.source)])} for r in x.reindex(x.strength.abs().sort_values(ascending=False).index).head(6).itertuples()]}
json.dump(R,open(os.path.join(OUT,'report.json'),'w'),indent=1)
# ---- charts: the fusion candidate's cumulative gain over HEX 7.0, the real record against the three displaced records
INK='#0b0b0b'; MUTE='#52514e'; COL={'RANGE':'#2a78d6','MOVE':'#eb6834'}
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':9,'axes.edgecolor':'#c9c8c2','axes.labelcolor':MUTE,'xtick.color':MUTE,'ytick.color':MUTE,'axes.spines.top':False,'axes.spines.right':False,'figure.facecolor':'#fcfcfb','axes.facecolor':'#fcfcfb','savefig.facecolor':'#fcfcfb'})
def chart(uni,sids,lag,title,fn):
    f,axs=plt.subplots(1,2,figsize=(9.6,3.3),sharex=True)
    for ax,read in zip(axs,('RANGE','MOVE')):
        ax.axhline(0,color='#c9c8c2',lw=0.8); D=L[(L.universe==uni)&L.series_id.isin(sids)&(L['read']==read)&(L[f'present_lag{lag}']>0)]
        g=(D[f's_cer_hex_lag{lag}']-D.s_hex_probability).groupby(D.block).sum().sort_index(); x=pd.to_datetime(g.index.values*BLOCK,unit='D')
        K=C[(C.universe==uni)&C.series_id.isin(sids)&(C['read']==read)&(C.lag==lag)&(C.offset=='hex')]
        for v in ('C1','C2','C3'):
            k=K[K.variant==v].groupby('block').gain_bits.sum().sort_index(); ax.plot(pd.to_datetime(k.index.values*BLOCK,unit='D'),k.cumsum().values,color='#a5a49e',lw=1.0,label='cer-0.1 on records displaced in time' if v=='C1' else None)
        ends=[]
        for pre,lab,col,ls_ in (('cer','by past success (cer-0.1)',COL[read],'-'),('cerq','by measured weight (cer-0.2)','#7a7974',(0,(4,2))),('cere','maximum entropy, T = 1 (cer-0.3)',INK,'-')):
            gg=(D[f's_{pre}_hex_lag{lag}']-D.s_hex_probability).groupby(D.block).sum().sort_index().cumsum(); ax.plot(x,gg.values,color=col,lw=1.7 if pre!='cerq' else 1.3,ls=ls_,label=lab); ends.append((gg.iloc[-1],col))
        span=max(1e-9,ax.get_ylim()[1]-ax.get_ylim()[0]); placed=[]
        for v,col in sorted(ends):
            yv=v if not placed or v-placed[-1]>0.06*span else placed[-1]+0.06*span; placed.append(yv); ax.annotate(f"{v:+.0f} bits",(x[-1],yv),xytext=(5,0),textcoords='offset points',va='center',fontsize=8,color=col)
        ax.set_title(NAME[read].capitalize(),loc='left',fontsize=9.5,color=INK); ax.grid(axis='y',color='#ecebe6',lw=0.6); ax.margins(x=0.01); loc=matplotlib.dates.AutoDateLocator(maxticks=7); ax.xaxis.set_major_locator(loc); ax.xaxis.set_major_formatter(matplotlib.dates.DateFormatter('%Y'))
        if read=='RANGE': ax.set_ylabel('cumulative bits over HEX 7.0'); ax.legend(frameon=False,loc='best',fontsize=7.5)
    f.suptitle(title,x=0.07,ha='left',fontsize=10.5,color=INK); f.subplots_adjust(left=0.07,right=0.92,bottom=0.1,top=0.82,wspace=0.34); f.savefig(os.path.join(OUT,fn),dpi=200); plt.close(f)
chart('markets',dev,1,'Fusion candidate over HEX 7.0: 17 markets, neighbours read strictly before the call','chart_cer_markets.png')
chart('markets',dev,0,'The same with same-date values allowed (diagnostic: series are fixed at different times of day)','chart_cer_markets_same_date.png')
chart('temperature',WX,0,'Fusion candidate over HEX 7.0: four temperature stations, same date','chart_cer_temperature.png')
chart('energy x temperature',['NATGAS','WTI','BRENT','Chicago','Seattle'],1,'Fusion candidate over HEX 7.0: energy x temperature, 1997-2015, strict','chart_cer_energy_temperature.png')
# ---- print
def line(uni,gname,read,arm):
    e=R[uni][gname][read][arm]
    if not e: return
    f=lambda g: f"{g['bits per call']:+.5f} [{g['95% interval'][0]:+.5f}, {g['95% interval'][1]:+.5f}] macro {g['macro-average over series']:+.5f}" if g else 'n/a'
    pr=e['precision']; print(f"{uni} | {gname} | {read} | {arm} | n={e['calls']}\n   HEX/null {f(e['HEX 7.0 over the null'])}\n   CER/null {f(e['CER standalone over the null'])}\n   CER/HEX  {f(e['CER standalone over HEX 7.0'])}\n   FUS/HEX  {f(e['fusion candidate over HEX 7.0'])}  product rule {e['fusion candidate over HEX 7.0, by the product' + chr(39) + 's rule']['95% interval']}")
    for mname,_p,_w in MODES:
        q=e[mname]; print('   '+mname+': CER/null',f(q['CER standalone over the null']),'| FUS/HEX',f(q['fusion candidate over HEX 7.0']),'| minus original',f(q['fusion: this mode minus the original, same calls']),'| ctl',[q['controls'][v]['fusion candidate over HEX 7.0']['bits per call'] for v in ('C1','C2','C3')] if isinstance(q['controls'],dict) else '-','| net',f(q['real minus the mean of its three controls']['fusion candidate']) if q['real minus the mean of its three controls'] else '-','| right',q['precision']['fusion candidate']['right %'],q['precision']['fusion candidate']['strongest tenth: stated, right %'],'ece',q['precision']['fusion candidate']['calibration error'])
    print('   T shares',e['relaxation: share of calls at each temperature %'],'eligible',e['relaxation: edges eligible per call, mean; share of calls with none %'])
    nt=e['real minus the mean of its three controls']; print('   NET of controls: CER',f(nt['standalone']),'| FUS',f(nt['fusion candidate']))
    print('   controls CER/null:',[e['controls'][v]['standalone over the null']['bits per call'] for v in e['controls']],[e['controls'][v]['standalone over the null']['95% interval'] for v in e['controls']],'\n   controls FUS/HEX :',[e['controls'][v]['fusion candidate over HEX 7.0']['bits per call'] for v in e['controls']],[e['controls'][v]['fusion candidate over HEX 7.0']['95% interval'] for v in e['controls']])
    print('   right %: null',pr['the null']['right %'],'HEX',pr['HEX 7.0']['right %'],'CER',pr['CER standalone']['right %'],'fusion',pr['fusion candidate']['right %'],'| top tenth HEX',pr['HEX 7.0']['strongest tenth: stated, right %'],'fusion',pr['fusion candidate']['strongest tenth: stated, right %'],'| ece HEX',pr['HEX 7.0']['calibration error'],'fusion',pr['fusion candidate']['calibration error'])
for uni,G in GROUPS.items():
    for gname in G:
        for read in ('move size','direction'):
            for arm in ('strict (lag 1)','same date (lag 0)'): line(uni,gname,read,arm)
for k,v in R['edges'].items():
    if isinstance(v,dict) and 'markets' not in k and 'every edge' in k: print(k,json.dumps(v))
    elif not 'every edge' in k:
        for kk,vv in v.items(): print(k,'|',kk,'|',{a:b for a,b in vv.items() if a!='largest'},'\n      ',[(t['edge'],t['bits per call'],t['interval']) for t in vv['largest'][:4]])
for k,v in R['measured edge weights (cer-0.2)'].items(): print('W',k,{a:b for a,b in v.items() if a!='heaviest'},[(h['edge'],h['mean weight'],h['share of calls with weight'],h['its expert alone, bits per call']) for h in v['heaviest'][:4]])
print(json.dumps(R['after the run: development markets, strict, calls after the first 500 on each series']))
print(json.dumps(R['currency series, direction, fusion candidate over HEX 7.0: same date against strict']))
print(json.dumps({k:{a:b for a,b in v.items() if a!='strongest'} for k,v in R['descriptive graph'].items()})); print(R['meta'])
