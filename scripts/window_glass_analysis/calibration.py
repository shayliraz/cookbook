"""Calibrate the model against published manufacturer reference points.

Reference Rw values are from publicly available datasheets (Pilkington
Optiphon, Saint-Gobain Climaplus, generic 4-6-4 IGU). Reference U-values
are from Pilkington and Saint-Gobain U-value tables for uncoated glass.

The script returns non-zero exit status if any residual exceeds the
documented tolerance (|dRw| <= 2 dB, |dU| <= 0.3 W/m^2K).
"""
from __future__ import annotations

import sys
from dataclasses import dataclass

import numpy as np

from configurations import GlazingConfig, Layer
from window_acoustics import ISO_BANDS_HZ, rw_and_adaptation_terms, stl_curve
from window_thermal import u_value


@dataclass(frozen=True)
class Reference:
    label: str
    config: GlazingConfig
    rw_published: float | None
    u_published: float | None
    source: str


REFERENCES: list[Reference] = [
    Reference(
        label="Laminated 3-0.38-3 (~6.4 mm)",
        config=GlazingConfig(
            name="3-0.38-3",
            layers=(Layer("glass", 3), Layer("pvb", 0.38), Layer("glass", 3)),
        ),
        rw_published=33.0,
        u_published=5.6,
        source="Pilkington Optilam / industry consensus",
    ),
    Reference(
        label="Laminated 3-0.76-3 (Optiphon 6.8)",
        config=GlazingConfig(
            name="3-0.76-3",
            layers=(Layer("glass", 3), Layer("pvb", 0.76), Layer("glass", 3)),
        ),
        rw_published=35.0,
        u_published=5.5,
        source="Pilkington Optiphon datasheet",
    ),
    Reference(
        label="Laminated 4-0.76-4 (Optiphon 8.8)",
        config=GlazingConfig(
            name="4-0.76-4",
            layers=(Layer("glass", 4), Layer("pvb", 0.76), Layer("glass", 4)),
        ),
        rw_published=37.0,
        u_published=5.4,
        source="Pilkington Optiphon datasheet",
    ),
    Reference(
        label="IGU 4-6-4 uncoated air",
        config=GlazingConfig(
            name="4-6-4",
            layers=(Layer("glass", 4), Layer("air", 6), Layer("glass", 4)),
        ),
        rw_published=29.0,
        u_published=3.3,
        source="Saint-Gobain / Pilkington U-value tables, generic 4-6-4",
    ),
    Reference(
        label="IGU 4-12-4 uncoated air",
        config=GlazingConfig(
            name="4-12-4",
            layers=(Layer("glass", 4), Layer("air", 12), Layer("glass", 4)),
        ),
        rw_published=29.0,
        u_published=2.9,
        source="Pilkington U-value tables, 12 mm air",
    ),
]


def run_calibration() -> int:
    print("Calibration of acoustic + thermal model against published values\n")
    print(f"{'Reference':45s} {'Rw_pred':>8s} {'Rw_pub':>8s} {'dRw':>6s} "
          f"{'U_pred':>8s} {'U_pub':>8s} {'dU':>6s}")
    print("-" * 95)

    max_dRw = 0.0
    max_dU = 0.0

    for ref in REFERENCES:
        stl_bands = stl_curve(ref.config, ISO_BANDS_HZ)
        rw_pred, _, _ = rw_and_adaptation_terms(stl_bands)
        u_pred = u_value(ref.config).U

        dRw = rw_pred - ref.rw_published if ref.rw_published is not None else 0.0
        dU = u_pred - ref.u_published if ref.u_published is not None else 0.0
        max_dRw = max(max_dRw, abs(dRw))
        max_dU = max(max_dU, abs(dU))

        rw_pub_s = f"{ref.rw_published:.0f}" if ref.rw_published is not None else "--"
        u_pub_s = f"{ref.u_published:.2f}" if ref.u_published is not None else "--"
        print(
            f"{ref.label:45s} {rw_pred:8.1f} {rw_pub_s:>8s} {dRw:+6.1f} "
            f"{u_pred:8.2f} {u_pub_s:>8s} {dU:+6.2f}"
        )

    print()
    print(f"Worst |dRw| = {max_dRw:.1f} dB   (tolerance 2.0 dB)")
    print(f"Worst |dU|  = {max_dU:.2f} W/m^2K (tolerance 0.30 W/m^2K)")

    if max_dRw > 2.0 + 1e-9 or max_dU > 0.30 + 1e-9:
        print("\nCALIBRATION FAIL")
        return 1
    print("\nCALIBRATION PASS (acoustic tolerance 2 dB, thermal tolerance 0.3 W/m^2K)")
    return 0


if __name__ == "__main__":
    sys.exit(run_calibration())
