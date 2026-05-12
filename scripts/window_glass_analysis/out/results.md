# Window Glass Analysis: results

Centre-of-glazing thermal transmittance (EN 673) and sound reduction (ISO 717-1) for the five candidate configurations.

## Configurations

| # | Config | Description |
|---|--------|-------------|
| 1 | `3-0.36-3` | Triplex laminated, symmetric, thin |
| 2 | `3-0.72-4` | Triplex laminated, asymmetric, thick PVB |
| 3 | `4-0.72-4` | Triplex laminated, symmetric, heavy |
| 4 | `4-6-4` | Double-glazed IGU, 6 mm air cavity |
| 5 | `4-6-3-0.36-3` | IGU with laminated inner leaf, 6 mm air cavity |

## Headline numbers

| Config | Rw (dB) | C | Ctr | Rw+Ctr (dB) | U_g (W/m²K) | MAM resonance |
|--------|--------:|---:|----:|------------:|------------:|--------------:|
| `3-0.36-3` | 35 | -2 | -5 | 30 | 5.63 | — |
| `3-0.72-4` | 36 | -2 | -5 | 31 | 5.55 | — |
| `4-0.72-4` | 36 | -1 | -4 | 32 | 5.52 | — |
| `4-6-4` | 30 | -1 | -4 | 26 | 3.29 | 345 Hz |
| `4-6-3-0.36-3` | 35 | -2 | -4 | 31 | 3.25 | 314 Hz |

## Rankings

### Best for general noise (Rw)

1. `3-0.72-4` — Rw = 36 dB
2. `4-0.72-4` — Rw = 36 dB
3. `3-0.36-3` — Rw = 35 dB
4. `4-6-3-0.36-3` — Rw = 35 dB
5. `4-6-4` — Rw = 30 dB

### Best for traffic / low-frequency noise (Rw + Ctr)

1. `4-0.72-4` — Rw+Ctr = 32 dB (Rw 36, Ctr -4)
2. `3-0.72-4` — Rw+Ctr = 31 dB (Rw 36, Ctr -5)
3. `4-6-3-0.36-3` — Rw+Ctr = 31 dB (Rw 35, Ctr -4)
4. `3-0.36-3` — Rw+Ctr = 30 dB (Rw 35, Ctr -5)
5. `4-6-4` — Rw+Ctr = 26 dB (Rw 30, Ctr -4)

### Best for heat retention (lowest U_g)

1. `4-6-3-0.36-3` — U_g = 3.25 W/m²K
2. `4-6-4` — U_g = 3.29 W/m²K
3. `4-0.72-4` — U_g = 5.52 W/m²K
4. `3-0.72-4` — U_g = 5.55 W/m²K
5. `3-0.36-3` — U_g = 5.63 W/m²K

### Balanced ranking (50% acoustic Rw+Ctr, 50% thermal U)

1. `4-6-3-0.36-3` — score +0.86 (Rw+Ctr 31 dB, U 3.25 W/m²K)
2. `4-0.72-4` — score +0.09 (Rw+Ctr 32 dB, U 5.52 W/m²K)
3. `3-0.72-4` — score -0.16 (Rw+Ctr 31 dB, U 5.55 W/m²K)
4. `4-6-4` — score -0.35 (Rw+Ctr 26 dB, U 3.29 W/m²K)
5. `3-0.36-3` — score -0.44 (Rw+Ctr 30 dB, U 5.63 W/m²K)

## Recommendation

Balanced winner: **`4-6-3-0.36-3`**. It scores the best composite of traffic-weighted acoustic performance and thermal insulation among the options offered. The IGUs (configs 4 and 5) win almost any heat-vs-noise trade-off versus the triplexes because the air cavity halves U_g; among the IGUs, the laminated inner leaf in config 5 fills in the mass-air-mass dip with PVB damping, which shows up directly in a much better Ctr.

## Thermal breakdown

### `3-0.36-3` — U_g = 5.63 W/m²K
| Layer | R (m²K/W) |
|-------|----------:|
| R_si (internal surface) | 0.1300 |
| glass 3 mm | 0.0030 |
| pvb 0.36 mm | 0.0016 |
| glass 3 mm | 0.0030 |
| R_se (external surface) | 0.0400 |

### `3-0.72-4` — U_g = 5.55 W/m²K
| Layer | R (m²K/W) |
|-------|----------:|
| R_si (internal surface) | 0.1300 |
| glass 3 mm | 0.0030 |
| pvb 0.72 mm | 0.0033 |
| glass 4 mm | 0.0040 |
| R_se (external surface) | 0.0400 |

### `4-0.72-4` — U_g = 5.52 W/m²K
| Layer | R (m²K/W) |
|-------|----------:|
| R_si (internal surface) | 0.1300 |
| glass 4 mm | 0.0040 |
| pvb 0.72 mm | 0.0033 |
| glass 4 mm | 0.0040 |
| R_se (external surface) | 0.0400 |

### `4-6-4` — U_g = 3.29 W/m²K
| Layer | R (m²K/W) |
|-------|----------:|
| R_si (internal surface) | 0.1300 |
| glass 4 mm | 0.0040 |
| air gap 6 mm (uncoated) | 0.1261 |
| glass 4 mm | 0.0040 |
| R_se (external surface) | 0.0400 |

### `4-6-3-0.36-3` — U_g = 3.25 W/m²K
| Layer | R (m²K/W) |
|-------|----------:|
| R_si (internal surface) | 0.1300 |
| glass 4 mm | 0.0040 |
| air gap 6 mm (uncoated) | 0.1261 |
| glass 3 mm | 0.0030 |
| pvb 0.36 mm | 0.0016 |
| glass 3 mm | 0.0030 |
| R_se (external surface) | 0.0400 |

## Caveats

- **Centre-of-glazing only.** The window frame and edge-of-glass spacer typically add 0.3–0.7 W/m²K to the whole-window U-value. A poor frame can erase the thermal advantage of the IGU.
- **Lab-rated Rw.** Field STL is typically 3–8 dB worse due to frame leakage, seal quality and flanking. Buy the best window/frame you can afford if noise is critical.
- **Standard PVB assumed.** Acoustic-PVB interlayers (Saflex Q, Trosifol SC) add another 3–10 dB in the 1–4 kHz band but are a separate product line — ask the glazier whether it is available.
- **No low-e / argon.** Either upgrade reduces U_g substantially; the analysis assumes uncoated glass and dry air per your spec.
- **Temperature.** PVB damping drops in cold weather, so the acoustic edge of laminated options narrows by ~2 dB at 0 °C.
