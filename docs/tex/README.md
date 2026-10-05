Sources of the two typeset documents in `docs/`.

- `math.tex` → `HEX-PI-7.0-mathematics.pdf`. The code listings in `snip/` are cut from `base44/` at the line numbers printed beside them; re-cut them if the source changes.
- `replay.tex` → `HEX-PI-7.0-replay-and-operations.pdf`. Its tables are filled from `validation/replay/report.json` and `validation/timesim/product_run.json`; copy `validation/replay/chart_*.png` beside it before compiling.

Compile with `pdflatex` (twice).
