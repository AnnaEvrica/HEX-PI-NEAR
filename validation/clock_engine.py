# ===========================================================================
# The clock in the engine (prereg_clock_engine.md). Replays every series
# through hex7core.walk itself: without dates, with dates, and with dates
# dealt out in a random order (the control).
#   python3 clock_engine.py -> clock_engine/ledger.parquet (not kept in the
#   repository), clock_engine/report.json
# ===========================================================================
import os; os.environ.setdefault('OMP_NUM_THREADS','1'); os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
import numpy as np, pandas as pd, json, time, multiprocessing as mp
import hex7core as h7, cer_replay as R
from memory_replay import interval, ll
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'clock_engine')
def job(a):
    sid,read=a; cls,dt,r=next((c,d,x) for c,_,s,d,x in job.S if s==sid); days=None if dt is None else R.days(dt)
    d=pd.DataFrame([(x['i'],x['y'],x['null'],x['p']) for x in h7.walk(r,read)[0]],columns=['step','y','p_null','p_plain']); d['series_id']=sid; d['read']=read; d['class']=cls
    if days is None: d['p_clock']=d.p_plain; d['p_three']=d.p_plain; d['p_control']=d.p_plain; d['day']=d.step
    else:
        w=h7.walk(r,read,days=days)[0]; d['p_clock']=[x['p'] for x in w]; d['p_three']=[x['p3'] for x in w]
        d['p_control']=[x['p'] for x in h7.walk(r,read,days=np.random.default_rng(11).permutation(days))[0]]; d['day']=np.asarray(days)[d.step.values]
    return d
def init(): job.S,_=R.series_list()
def cut_check(S):
    """E5: a series cut at step k gives the same earlier calls, and its final call is the full series' call at k."""
    worst=0.0; n=0
    for sid in ('BTC-USD','VIX','Chicago'):
        cls,dt,r=next((c,d,x) for c,_,s,d,x in S if s==sid); days=R.days(dt); r=np.asarray(r,float)[:1500]; days=np.asarray(days)[:1500]
        for read in ('MOVE','RANGE'):
            full=h7.walk(r,read,days=days)[0]; byi={x['i']:x['p'] for x in full}
            for k in (400,777,1200):
                rows,fin=h7.walk(r[:k+1],read,days=days[:k+1]); worst=max([worst,abs(fin['p']-byi[k])]+[abs(x['p']-byi[x['i']]) for x in rows]); n+=len(rows)+1
    return worst,n
if __name__=='__main__':
    t0=time.time(); os.makedirs(OUT,exist_ok=True); S,_=R.series_list(); H=pd.read_parquet(os.path.join(HERE,'replay','hex7_ledger.parquet')); key=['series_id','read','step']; rep={}
    sids=[s[2] for s in S]; rep['series']=len(sids)
    with mp.Pool(4,initializer=init) as pool: L=pd.concat(pool.map(job,[(s,rd) for s in sids for rd in ('MOVE','RANGE')],chunksize=1),ignore_index=True)
    L=L.merge(H[key+['hex_probability']],on=key,how='inner'); rep['calls']=int(len(L))
    rep['E1_no_dates_against_committed_ledger']=float((L.p_plain-L.hex_probability).abs().max()); rep['E1_three_voice_call_inside_dated_walk_against_ledger']=float((L.p_three-L.hex_probability).abs().max())
    rp=os.path.join(HERE,'clock','ledger.parquet')
    if os.path.exists(rp):
        Q=pd.read_parquet(rp)[key+['p_clock','p_control']].rename(columns={'p_clock':'r_clock','p_control':'r_control'}); M=L.merge(Q,on=key,how='inner')
        rep['E2_against_research_copy']=dict(calls=int(len(M)),clock=float((M.p_clock-M.r_clock).abs().max()),control=float((M.p_control-M.r_control).abs().max()))
    rc=L[L['class']=='racing']; rep['E3_racing_largest_change']=float((rc.p_clock-rc.hex_probability).abs().max()); rep['E3_racing_calls']=int(len(rc))
    w,n=cut_check(S); rep['E5_cut_largest_difference']=w; rep['E5_calls_compared']=n
    L['asset']=[R.env_of(s) if c=='markets' else c for s,c in zip(L.series_id,L['class'])]; L['bday']=np.where(L['class']=='racing',L.step.values+100000*pd.factorize(L.series_id)[0],L.day.values)
    L['half']=L.groupby(['series_id','read']).step.transform(lambda s: (s>s.median()).astype(int)); L.to_parquet(os.path.join(OUT,'ledger.parquet'),index=False); rng=np.random.default_rng(11); side=lambda v: (np.asarray(v)>=0.5).astype(int)
    def cell(g):
        y=g.y.values; b=ll(g.p_plain.values,y); fl=side(g.p_plain)!=side(g.p_clock)
        return dict(calls=int(len(g)),hex_over_null=round(float((b-ll(g.p_null.values,y)).mean()),5),clock=interval(g.bday.values,ll(g.p_clock.values,y)-b,rng),control=interval(g.bday.values,ll(g.p_control.values,y)-b,rng),net=interval(g.bday.values,ll(g.p_clock.values,y)-ll(g.p_control.values,y),rng),
            share_right_hex=round(float((side(g.p_plain)==y).mean()),4),share_right_clock=round(float((side(g.p_clock)==y).mean()),4),side_changed=int(fl.sum()),changed_right_with_clock=round(float((side(g.p_clock)[fl]==y[fl]).mean()),4) if fl.any() else None,
            mean_change_in_probability=round(float((g.p_clock-g.p_plain).abs().mean()),5),largest_change_in_probability=round(float((g.p_clock-g.p_plain).abs().max()),5))
    rep['by_class']={f'{c} {rd}':cell(g) for (c,rd),g in L.groupby(['class','read'])}; rep['by_asset']={f'{a} {rd}':cell(g) for (a,rd),g in L.groupby(['asset','read'])}
    rep['E4_control_range']=[min(v['control'][0] for v in rep['by_class'].values()),max(v['control'][0] for v in rep['by_class'].values())]
    rep['E7_halves']={f'{a} {rd} {"later" if h else "earlier"}':interval(g.bday.values,ll(g.p_clock.values,g.y.values)-ll(g.p_control.values,g.y.values),rng) for (a,rd,h),g in L[L['class']!='racing'].groupby(['asset','read','half'])}
    D=L[L['class']!='racing']; per=D.groupby(['series_id','read']).apply(lambda g: float((ll(g.p_clock.values,g.y.values)-ll(g.p_control.values,g.y.values)).mean()))
    rep['by_series']={f'{s} {rd}':round(v,5) for (s,rd),v in per.items()}; rep['series_reads_above_zero']=[int((per>0).sum()),int(len(per))]
    rep['seconds']=round(time.time()-t0); json.dump(rep,open(os.path.join(OUT,'report.json'),'w'),indent=1)
    print(json.dumps({k:v for k,v in rep.items() if k not in ('by_class','by_asset','by_series')},indent=1))
    for sec in ('by_class','by_asset'):
        print('==',sec)
        for k,v in rep[sec].items(): print(f"{k:22s}{v['calls']:6d} hex/null {v['hex_over_null']:+.4f} net {v['net']} ctl {v['control'][0]:+.5f} right {v['share_right_hex']}->{v['share_right_clock']} changed {v['side_changed']} right {v['changed_right_with_clock']} meandp {v['mean_change_in_probability']}")
