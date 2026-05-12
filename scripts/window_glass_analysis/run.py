"""Run acoustic + thermal analysis for the five candidate window configs.

Generates:
  out/stl_curves.png      - 1/3-octave STL curves for all configs
  out/summary_bars.png    - Rw, Rw+Ctr, U_g bar charts
  out/results.md          - Numeric summary, ranking, trade-off discussion
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from configurations import CONFIGS
from window_acoustics import (
    ISO_BANDS_HZ,
    mass_air_mass_frequency,
    rw_and_adaptation_terms,
    stl_curve,
)
from window_thermal import u_value

OUT = Path(__file__).parent / "out"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    rows: list[dict] = []
    stl_per_config: dict[str, np.ndarray] = {}

    for cfg in CONFIGS:
        stl = stl_curve(cfg, ISO_BANDS_HZ)
        stl_per_config[cfg.name] = stl
        rw, C, Ctr = rw_and_adaptation_terms(stl)
        therm = u_value(cfg)
        f0 = mass_air_mass_frequency(cfg)
        rows.append(
            {
                "config": cfg.name,
                "description": cfg.description,
                "Rw": rw,
                "C": C,
                "Ctr": Ctr,
                "Rw_plus_Ctr": rw + Ctr,
                "U_g": therm.U,
                "f0_MAM": f0,
                "thermal_breakdown": therm.contributions,
            }
        )

    rw_plus_ctr = np.array([r["Rw_plus_Ctr"] for r in rows], dtype=float)
    u_vals = np.array([r["U_g"] for r in rows], dtype=float)

    def z(arr: np.ndarray, higher_is_better: bool) -> np.ndarray:
        mu, sigma = arr.mean(), arr.std() or 1.0
        z = (arr - mu) / sigma
        return z if higher_is_better else -z

    composite = 0.5 * z(rw_plus_ctr, True) + 0.5 * z(u_vals, False)
    for r, score in zip(rows, composite):
        r["balanced_score"] = float(score)

    _plot_stl(stl_per_config)
    _plot_summary(rows)
    _write_results(rows)
    _print_console(rows)


def _plot_stl(stl_per_config: dict[str, np.ndarray]) -> None:
    fig, ax = plt.subplots(figsize=(9, 5.5))
    for name, stl in stl_per_config.items():
        ax.semilogx(ISO_BANDS_HZ, stl, marker="o", label=name)
    ax.set_xlabel("Frequency (Hz, 1/3-octave bands)")
    ax.set_ylabel("Sound Reduction R (dB)")
    ax.set_title("Sound transmission loss vs. frequency")
    ax.grid(True, which="both", alpha=0.3)
    ax.legend(loc="lower right")
    ax.set_xticks(ISO_BANDS_HZ)
    ax.set_xticklabels(
        [f"{int(f)}" if f in (100, 250, 500, 1000, 2000) else "" for f in ISO_BANDS_HZ]
    )
    fig.tight_layout()
    fig.savefig(OUT / "stl_curves.png", dpi=130)
    plt.close(fig)


def _plot_summary(rows: list[dict]) -> None:
    names = [r["config"] for r in rows]
    rw = [r["Rw"] for r in rows]
    rw_ctr = [r["Rw_plus_Ctr"] for r in rows]
    u = [r["U_g"] for r in rows]

    fig, axes = plt.subplots(1, 3, figsize=(13, 4.5))
    x = np.arange(len(names))

    axes[0].bar(x, rw, color="#4c72b0")
    axes[0].set_xticks(x)
    axes[0].set_xticklabels(names, rotation=30, ha="right")
    axes[0].set_title("Rw  (weighted sound reduction)\nhigher = quieter")
    axes[0].set_ylabel("dB")
    for i, v in enumerate(rw):
        axes[0].text(i, v + 0.3, f"{v:.0f}", ha="center")

    axes[1].bar(x, rw_ctr, color="#dd8452")
    axes[1].set_xticks(x)
    axes[1].set_xticklabels(names, rotation=30, ha="right")
    axes[1].set_title("Rw + Ctr  (traffic-weighted)\nhigher = quieter")
    axes[1].set_ylabel("dB")
    for i, v in enumerate(rw_ctr):
        axes[1].text(i, v + 0.3, f"{v:.0f}", ha="center")

    axes[2].bar(x, u, color="#55a868")
    axes[2].set_xticks(x)
    axes[2].set_xticklabels(names, rotation=30, ha="right")
    axes[2].set_title("U_g  (centre-of-glazing)\nlower = warmer")
    axes[2].set_ylabel("W/m^2 K")
    for i, v in enumerate(u):
        axes[2].text(i, v + 0.05, f"{v:.2f}", ha="center")

    fig.tight_layout()
    fig.savefig(OUT / "summary_bars.png", dpi=130)
    plt.close(fig)


def _write_results(rows: list[dict]) -> None:
    by_rw = sorted(rows, key=lambda r: -r["Rw"])
    by_ctr = sorted(rows, key=lambda r: -r["Rw_plus_Ctr"])
    by_u = sorted(rows, key=lambda r: r["U_g"])
    by_balanced = sorted(rows, key=lambda r: -r["balanced_score"])

    lines: list[str] = []
    lines.append("# Window Glass Analysis: results\n")
    lines.append(
        "Centre-of-glazing thermal transmittance (EN 673) and sound "
        "reduction (ISO 717-1) for the five candidate configurations.\n"
    )
    lines.append("## Configurations\n")
    lines.append("| # | Config | Description |")
    lines.append("|---|--------|-------------|")
    for i, r in enumerate(rows, 1):
        lines.append(f"| {i} | `{r['config']}` | {r['description']} |")
    lines.append("")

    lines.append("## Headline numbers\n")
    lines.append(
        "| Config | Rw (dB) | C | Ctr | Rw+Ctr (dB) | U_g (W/m²K) | "
        "MAM resonance |"
    )
    lines.append("|--------|--------:|---:|----:|------------:|------------:|--------------:|")
    for r in rows:
        f0 = f"{r['f0_MAM']:.0f} Hz" if r["f0_MAM"] is not None else "—"
        lines.append(
            f"| `{r['config']}` | {r['Rw']:.0f} | {r['C']:+.0f} | {r['Ctr']:+.0f} | "
            f"{r['Rw_plus_Ctr']:.0f} | {r['U_g']:.2f} | {f0} |"
        )
    lines.append("")

    lines.append("## Rankings\n")
    lines.append("### Best for general noise (Rw)\n")
    for i, r in enumerate(by_rw, 1):
        lines.append(f"{i}. `{r['config']}` — Rw = {r['Rw']:.0f} dB")
    lines.append("")
    lines.append("### Best for traffic / low-frequency noise (Rw + Ctr)\n")
    for i, r in enumerate(by_ctr, 1):
        lines.append(
            f"{i}. `{r['config']}` — Rw+Ctr = {r['Rw_plus_Ctr']:.0f} dB "
            f"(Rw {r['Rw']:.0f}, Ctr {r['Ctr']:+.0f})"
        )
    lines.append("")
    lines.append("### Best for heat retention (lowest U_g)\n")
    for i, r in enumerate(by_u, 1):
        lines.append(f"{i}. `{r['config']}` — U_g = {r['U_g']:.2f} W/m²K")
    lines.append("")
    lines.append("### Balanced ranking (50% acoustic Rw+Ctr, 50% thermal U)\n")
    for i, r in enumerate(by_balanced, 1):
        lines.append(
            f"{i}. `{r['config']}` — score {r['balanced_score']:+.2f} "
            f"(Rw+Ctr {r['Rw_plus_Ctr']:.0f} dB, U {r['U_g']:.2f} W/m²K)"
        )
    lines.append("")

    winner = by_balanced[0]
    lines.append("## Recommendation\n")
    lines.append(
        f"Balanced winner: **`{winner['config']}`**. It scores the best "
        "composite of traffic-weighted acoustic performance and thermal "
        "insulation among the options offered. The IGUs (configs 4 and 5) "
        "win almost any heat-vs-noise trade-off versus the triplexes because "
        "the air cavity halves U_g; among the IGUs, the laminated inner leaf "
        "in config 5 fills in the mass-air-mass dip with PVB damping, which "
        "shows up directly in a much better Ctr.\n"
    )

    lines.append("## Thermal breakdown\n")
    for r in rows:
        lines.append(f"### `{r['config']}` — U_g = {r['U_g']:.2f} W/m²K")
        lines.append("| Layer | R (m²K/W) |")
        lines.append("|-------|----------:|")
        for label, R in r["thermal_breakdown"]:
            lines.append(f"| {label} | {R:.4f} |")
        lines.append("")

    lines.append("## Caveats\n")
    lines.append(
        "- **Centre-of-glazing only.** The window frame and edge-of-glass "
        "spacer typically add 0.3–0.7 W/m²K to the whole-window U-value. "
        "A poor frame can erase the thermal advantage of the IGU.\n"
        "- **Lab-rated Rw.** Field STL is typically 3–8 dB worse due to "
        "frame leakage, seal quality and flanking. Buy the best window/frame "
        "you can afford if noise is critical.\n"
        "- **Standard PVB assumed.** Acoustic-PVB interlayers (Saflex Q, "
        "Trosifol SC) add another 3–10 dB in the 1–4 kHz band but are a "
        "separate product line — ask the glazier whether it is available.\n"
        "- **No low-e / argon.** Either upgrade reduces U_g substantially; "
        "the analysis assumes uncoated glass and dry air per your spec.\n"
        "- **Temperature.** PVB damping drops in cold weather, so the "
        "acoustic edge of laminated options narrows by ~2 dB at 0 °C.\n"
    )

    (OUT / "results.md").write_text("\n".join(lines))


def _print_console(rows: list[dict]) -> None:
    print("\nResults\n=======")
    print(f"{'Config':16s} {'Rw':>4s} {'C':>4s} {'Ctr':>4s} "
          f"{'Rw+Ctr':>7s} {'U_g':>7s} {'f0':>8s} {'balanced':>9s}")
    for r in rows:
        f0 = f"{r['f0_MAM']:.0f}" if r["f0_MAM"] is not None else "--"
        print(
            f"{r['config']:16s} {r['Rw']:4.0f} {r['C']:+4.0f} {r['Ctr']:+4.0f} "
            f"{r['Rw_plus_Ctr']:7.0f} {r['U_g']:7.2f} {f0:>8s} "
            f"{r['balanced_score']:+9.2f}"
        )
    winner = max(rows, key=lambda r: r["balanced_score"])
    print(f"\nBalanced winner: {winner['config']}")


if __name__ == "__main__":
    main()
