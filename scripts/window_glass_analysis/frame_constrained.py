"""Quick analysis of the user's frame-constrained configs."""
import sys
sys.path.insert(0, '/home/user/cookbook/scripts/window_glass_analysis')

from configurations import GlazingConfig, Layer
from window_acoustics import (
    ISO_BANDS_HZ, rw_and_adaptation_terms, stl_curve, mass_air_mass_frequency
)
from window_thermal import u_value


def total_thickness_mm(cfg: GlazingConfig) -> float:
    return sum(l.thickness_mm for l in cfg.layers)


configs = [
    # Group A — frame holds <= 14 mm total
    ("A (<=14mm)", "4-6-4",          (Layer("glass", 4), Layer("air", 6), Layer("glass", 4))),
    ("A (<=14mm)", "(3-0.76-3)-3-4", (Layer("glass", 3), Layer("pvb", 0.76), Layer("glass", 3), Layer("air", 3), Layer("glass", 4))),
    ("A (<=14mm)", "4-0.76-4",       (Layer("glass", 4), Layer("pvb", 0.76), Layer("glass", 4))),
    ("A (<=14mm)", "3-0.76-3",       (Layer("glass", 3), Layer("pvb", 0.76), Layer("glass", 3))),
    # Group B — frame holds 34-45 mm
    ("B (34-45mm)", "(3-0.76-3)-10-5",            (Layer("glass", 3), Layer("pvb", 0.76), Layer("glass", 3), Layer("air", 10), Layer("glass", 5))),
    ("B (34-45mm)", "(3-0.76-3)-16-(3-0.76-3)",   (Layer("glass", 3), Layer("pvb", 0.76), Layer("glass", 3), Layer("air", 16), Layer("glass", 3), Layer("pvb", 0.76), Layer("glass", 3))),
    ("B (34-45mm)", "(4-0.76-4)-16-4",            (Layer("glass", 4), Layer("pvb", 0.76), Layer("glass", 4), Layer("air", 16), Layer("glass", 4))),
    ("B (34-45mm)", "(3-0.76-3)-20-4",            (Layer("glass", 3), Layer("pvb", 0.76), Layer("glass", 3), Layer("air", 20), Layer("glass", 4))),
]


print(f"{'Group':12s} {'Config':32s} {'mm':>5s} {'Rw':>4s} {'Ctr':>4s} {'Rw+Ctr':>7s} {'U_g':>6s} {'f0_MAM':>7s}")
print("-" * 90)
for group, name, layers in configs:
    cfg = GlazingConfig(name=name, layers=layers)
    stl = stl_curve(cfg, ISO_BANDS_HZ)
    rw, C, Ctr = rw_and_adaptation_terms(stl)
    therm = u_value(cfg)
    f0 = mass_air_mass_frequency(cfg)
    f0s = f"{f0:.0f}" if f0 is not None else "--"
    print(f"{group:12s} {name:32s} {total_thickness_mm(cfg):5.1f} {rw:4.0f} {Ctr:+4.0f} {rw+Ctr:7.0f} {therm.U:6.2f} {f0s:>7s}")
