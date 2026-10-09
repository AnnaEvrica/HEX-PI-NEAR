# Reference walk of HEX 7.0 with the clock (hex7core.py, days given), for
# tests/parity.mjs. Real daily Bitcoin bars with their dates.
import numpy as np, pandas as pd, json, os
import hex7core as h7
HERE=os.path.dirname(os.path.abspath(__file__)); T=os.path.join(HERE,'..','tests')
b=pd.read_csv(os.path.join(T,'backend-smoke','BTC_daily.csv'),parse_dates=['date']); c=b.close.values.astype(float)
r=np.log(c[1:]/c[:-1]); days=((b.date.values[1:]-np.datetime64('1970-01-01'))//np.timedelta64(1,'D')).astype(int)
e={'returns':[float(x) for x in r],'days':[int(d) for d in days]}
for read in ('MOVE','RANGE'):
    rows,fin=h7.walk(r,read,days=days)
    e[read]={'i':[x['i'] for x in rows],'p':[x['p'] for x in rows],'y':[x['y'] for x in rows],'null':[x['null'] for x in rows],'final':[fin['p'],fin['null'],fin['rank'],fin['cross'],fin['clock']],
             'beta':[float(v) for v in fin['beta']],'beta_clock':[float(v) for v in fin['beta_clock']],'influence':[float(v) for v in fin['influence']],'changed':int(sum(abs(x['p']-x['p3'])>1e-6 for x in rows))}
json.dump({'bitcoin':e},open(os.path.join(T,'parity_hex7_clock_reference.json'),'w'))
print(len(r),{rd:(len(e[rd]['i']),e[rd]['changed'],[round(v,4) for v in e[rd]['influence']]) for rd in ('MOVE','RANGE')})
