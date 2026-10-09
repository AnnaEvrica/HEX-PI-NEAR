# ===========================================================================
# Sampled real moments from experience_replay.mjs (the product code, night by
# night), perceived again here by the reference implementation from the same
# series: signature, novelty and transition must agree to rounding.
#   node experience_replay.mjs && python3 experience_check.py
# ===========================================================================
import json, os, numpy as np
import cercore as cer, experience as ex
HERE=os.path.dirname(os.path.abspath(__file__)); S=json.load(open(os.path.join(HERE,'data','markets_channels.json'))); K=json.load(open(os.path.join(HERE,'data','experience_check.json')))
C={s['ticker']:cer.prepare(cer.channel(s['ticker'],'market',np.array(s['days']),np.array(s['returns']))) for s in S}
def diff(a,b):
    if isinstance(a,(int,float)) and isinstance(b,(int,float)) and not isinstance(a,bool): return abs(a-b)
    if isinstance(a,list) and isinstance(b,list): return max([diff(x,y) for x,y in zip(a,b)]+[0.0]) if len(a)==len(b) else 1.0
    if isinstance(a,dict) and isinstance(b,dict): return max([diff(a[k],b[k]) for k in a]+[0.0]) if sorted(a)==sorted(b) else 1.0
    return 0.0 if a==b else 1.0
worst=dict(signature=0.0,novelty=0.0,transition=0.0); n=0
for k in K:
    t=C[k['series_id']]; sig,nov=ex.moment_of(t,[c for i,c in C.items() if i!=k['series_id']],k['as_of_day']); sig['step']=k['step']; n+=1
    worst['signature']=max(worst['signature'],diff(json.loads(json.dumps(sig)),k['signature'])); worst['novelty']=max(worst['novelty'],diff([float(nov['intrinsic_tail']),float(nov['joint_tail']),float(nov['relational_surprisal'])],k['novelty']))
    if k['previous'] is not None and k['transition'] is not None: worst['transition']=max(worst['transition'],abs(ex.distance(sig,k['previous'])['d']-k['transition']))
ok=all(v<1e-6 for v in worst.values()); out=dict(moments_recomputed=n,largest_difference=worst,passed=ok)
json.dump(out,open(os.path.join(HERE,'experience','reference_check.json'),'w'),indent=1); print('PASS' if ok else 'FAIL',json.dumps(out)); raise SystemExit(0 if ok else 1)
