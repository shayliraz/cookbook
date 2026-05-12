# Window Glass Analysis

Standalone physics simulation comparing five candidate window-glazing
configurations on **noise reduction** (Rw, Rw+Ctr per ISO 717-1) and
**thermal insulation** (centre-of-glazing U-value per EN 673).

Configurations evaluated (mm):

| # | Code            | Notes                                      |
|---|-----------------|--------------------------------------------|
| 1 | 3-0.36-3        | Triplex laminated (glass-PVB-glass)        |
| 2 | 3-0.72-4        | Triplex asymmetric                         |
| 3 | 4-0.72-4        | Triplex symmetric, heavier                 |
| 4 | 4-6-4           | Double-glazed IGU, 6 mm air                |
| 5 | 4-6-3-0.36-3    | IGU with laminated inner leaf              |

All glass is assumed uncoated soda-lime, all gaps are dry air, all
interlayers are standard PVB. Upgrade variants (argon, low-e, acoustic PVB)
are not modelled.

## Layout

- `configurations.py` — material constants, layer dataclasses, the five configs.
- `window_acoustics.py` — single-leaf STL (mass law + coincidence), IGU
  double-leaf model with mass-air-mass resonance, ISO 717-1 Rw / C / Ctr.
- `window_thermal.py` — EN 673 air-cavity conductance (Hollands Nu +
  Stefan-Boltzmann radiation) and total U-value.
- `calibration.py` — runs the model on five published manufacturer
  reference points and asserts that residuals stay within tolerance
  (|ΔRw| ≤ 2 dB, |ΔU| ≤ 0.3 W/m²K). Exits non-zero on failure.
- `run.py` — main analysis: writes `out/stl_curves.png`,
  `out/summary_bars.png` and `out/results.md`.

## How to run

```bash
cd scripts/window_glass_analysis
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python calibration.py    # must pass before trusting the run
.venv/bin/python run.py
```

Open `out/results.md` for the ranking + recommendation, and the two PNGs
for the curves and bar chart.

## What to look at

- **Rw** — single-number rating; good for office or speech noise.
- **Rw+Ctr** — single-number rating with low-frequency penalty; this is
  the right metric for **road / traffic noise**.
- **U_g** — centre-of-glazing heat loss; lower is better.

The simulation includes the mass-air-mass resonance dip of double-glazed
units (around 300–350 Hz for a 6 mm air gap), which is why 4-6-4 looks
worse than its higher Rw might suggest once Ctr is applied. Adding a
laminated leaf (config 5) damps that dip via PVB shear losses.

## Limitations (also stated in `out/results.md`)

- Centre-of-glazing only — frame / spacer effects not modelled.
- Lab Rw; field STL is typically 3–8 dB lower due to leakage and flanking.
- Uses standard PVB; acoustic PVB would add 3–10 dB in 1–4 kHz.
- PVB damping is temperature-dependent; model uses 20 °C.
