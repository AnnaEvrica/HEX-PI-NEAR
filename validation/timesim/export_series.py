# Writes one CSV (date, close) per market series from 1 January 2016, for the time simulation.
#   python3 export_series.py <out dir>      (needs the data/ directory used by the other validation scripts)
import sys, os, pandas as pd
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from hexg import load_all
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
for k, s in load_all().items():
    s = s[pd.to_datetime(s.index) >= pd.Timestamp('2016-01-01')]
    pd.DataFrame({'date': pd.to_datetime(s.index).strftime('%Y-%m-%d'), 'close': s.values}).to_csv(os.path.join(out, f'{k}.csv'), index=False)
