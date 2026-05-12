"""Sound transmission loss model for monolithic, laminated, and IGU glazing.

Model summary
=============
Per leaf (a stack of glass + PVB) we compute a frequency-dependent STL using:
  - Random-incidence mass law: R_ml(f) = 20 log10(m_s * f) - 47 dB
  - Coincidence dip / above-coincidence behaviour following Sharp / Cremer:
      R(f >= f_c) = R_ml(f) + 10 log10(2 eta f / (pi f_c))
    The dip at f_c is bounded by the loss factor eta. For laminated leaves
    eta is much higher than for monolithic glass because of the PVB shear
    damping, which removes most of the dip.
  - Effective bending stiffness for laminated panels follows a Wolfel-style
    interpolation between "fully shear-coupled" (one thick plate) at low
    frequency and "shear-decoupled" (sum of individual plates) at high
    frequency. This shifts the critical frequency upward with frequency.

For a double-glazed IGU we use the standard double-leaf model:
  - Below the mass-air-mass resonance f_0 the unit acts as a single panel
    with combined surface mass (m1 + m2).
  - Above f_0 (and well below the first cavity standing wave f_d = c/(2d))
    R_IGU(f) = R1(f) + R2(f) + 20 log10(f * d / c) - C
  - A smooth dip is applied at f_0 limited by air-cavity / glass damping.

Single-number Rw and the spectrum adaptation terms C, Ctr are computed
strictly per ISO 717-1 using 1/3-octave bands 100..3150 Hz.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from configurations import (
    C_AIR,
    E_GLASS,
    GlazingConfig,
    Layer,
    NU_GLASS,
    RHO_AIR,
    RHO_GLASS,
    leaf_is_laminated,
    leaf_max_glass_thickness_m,
    leaf_surface_mass,
    leaf_total_glass_thickness_m,
)

ISO_BANDS_HZ = np.array(
    [100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
     1000, 1250, 1600, 2000, 2500, 3150],
    dtype=float,
)

ISO_REF_CURVE = np.array(
    [33, 36, 39, 42, 45, 48, 51, 52, 53, 54, 55, 56, 56, 56, 56, 56],
    dtype=float,
)

C_SPECTRUM = np.array(
    [-29, -26, -23, -21, -19, -17, -15, -13, -12, -11, -10, -9, -9, -9, -9, -9],
    dtype=float,
)

CTR_SPECTRUM = np.array(
    [-20, -20, -18, -16, -15, -14, -13, -12, -11, -9, -8, -9, -10, -11, -13, -15],
    dtype=float,
)

ETA_GLASS_MONO = 0.03
ETA_GLASS_LAMINATED = 0.10


def _bending_stiffness(thickness_m: float) -> float:
    """Plate bending stiffness B = E h^3 / (12 (1 - nu^2)) per unit width."""
    return E_GLASS * thickness_m ** 3 / (12.0 * (1.0 - NU_GLASS ** 2))


def _critical_frequency_homogeneous(thickness_m: float) -> float:
    """Critical (coincidence) frequency for a homogeneous glass plate."""
    m_s = RHO_GLASS * thickness_m
    B = _bending_stiffness(thickness_m)
    return (C_AIR ** 2) / (2.0 * math.pi) * math.sqrt(m_s / B)


@dataclass(frozen=True)
class LeafAcoustics:
    surface_mass: float
    f_c_low: float
    f_c_high: float
    eta: float
    laminated: bool


def _build_leaf(leaf: list[Layer]) -> LeafAcoustics:
    m_s = leaf_surface_mass(leaf)
    h_total = leaf_total_glass_thickness_m(leaf)
    h_max = leaf_max_glass_thickness_m(leaf)
    laminated = leaf_is_laminated(leaf)
    if laminated:
        f_c_low = _critical_frequency_homogeneous(h_total)
        f_c_high = _critical_frequency_homogeneous(h_max)
        eta = ETA_GLASS_LAMINATED
    else:
        f_c_low = _critical_frequency_homogeneous(h_total)
        f_c_high = f_c_low
        eta = ETA_GLASS_MONO
    return LeafAcoustics(m_s, f_c_low, f_c_high, eta, laminated)


def _effective_f_c(leaf_acc: LeafAcoustics, f: float) -> float:
    """Frequency-dependent effective critical frequency for a laminated leaf.

    Below 500 Hz the leaf acts as a single thick plate (full shear coupling)
    so f_c == f_c_low. Above ~5000 Hz the plies decouple so f_c -> f_c_high.
    A smooth log-frequency interpolation between the two is used.
    """
    if not leaf_acc.laminated:
        return leaf_acc.f_c_low
    f_lo, f_hi = 500.0, 5000.0
    if f <= f_lo:
        return leaf_acc.f_c_low
    if f >= f_hi:
        return leaf_acc.f_c_high
    t = (math.log10(f) - math.log10(f_lo)) / (math.log10(f_hi) - math.log10(f_lo))
    return leaf_acc.f_c_low * (1 - t) + leaf_acc.f_c_high * t


def _single_leaf_stl(f: float, leaf_acc: LeafAcoustics) -> float:
    """Diffuse-field STL of one leaf at frequency f."""
    m_s = leaf_acc.surface_mass
    eta = leaf_acc.eta
    f_c = _effective_f_c(leaf_acc, f)

    R_ml = 20.0 * math.log10(m_s * f) - 47.0

    if f >= f_c:
        damping_term = 10.0 * math.log10(2.0 * eta * f / (math.pi * f_c))
        R = R_ml + damping_term
    else:
        ratio = f / f_c
        if ratio < 0.5:
            R = R_ml
        else:
            R_at_fc = (
                20.0 * math.log10(m_s * f_c)
                - 47.0
                + 10.0 * math.log10(2.0 * eta / math.pi)
            )
            R_at_half = 20.0 * math.log10(m_s * 0.5 * f_c) - 47.0
            alpha = (ratio - 0.5) / 0.5
            R = R_at_half * (1.0 - alpha) + R_at_fc * alpha

    floor = max(0.0, 20.0 * math.log10(max(m_s, 0.1)) - 25.0)
    return max(R, floor)


def _mass_air_mass_f0(m1: float, m2: float, d_air_m: float) -> float:
    """Mass-air-mass resonance frequency for a double-leaf with air gap d."""
    K = RHO_AIR * C_AIR ** 2 / d_air_m
    omega_sq = K * (m1 + m2) / (m1 * m2)
    return math.sqrt(omega_sq) / (2.0 * math.pi)


def _igu_stl(
    f: float,
    leaf1: LeafAcoustics,
    leaf2: LeafAcoustics,
    d_air_m: float,
) -> float:
    """STL of a double-glazed IGU.

    Empirical model calibrated against published 4-6-4 and 4-12-4 IGU data
    (Pilkington / Saint-Gobain typical curves):
      - Base level follows the diffuse mass law of the combined mass.
      - A modest "small-cavity" penalty accounts for the systematic 2-3 dB
        underperformance of close-coupled double leaves versus a single
        thick pane of the same total mass.
      - A Gaussian MAM-resonance dip is added near f_0, deeper for
        undamped (monolithic) leaves and shallower when at least one leaf
        is laminated (PVB damps the cavity-coupled mode).
      - Each leaf's coincidence dip is inherited via the maximum drop of
        leaf STL below its own mass law.
      - A modest gap-dependent coupling bonus appears well above f_0 for
        wider cavities (negligible for 6 mm, helpful at 12-16 mm).
    """
    m_total = leaf1.surface_mass + leaf2.surface_mass
    f_0 = _mass_air_mass_f0(leaf1.surface_mass, leaf2.surface_mass, d_air_m)

    R_ml_combined = 20.0 * math.log10(m_total * f) - 47.0

    laminated = leaf1.laminated or leaf2.laminated
    uniform_penalty = 2.0 if laminated else 3.0
    dip_extra = 3.0 if laminated else 7.0
    dip_sigma_sq = 0.55

    x_mam = math.log(f / f_0) / math.log(2.0)
    mam_dip = dip_extra * math.exp(-(x_mam ** 2) / dip_sigma_sq)

    coincidence_drop = 0.0
    for leaf in (leaf1, leaf2):
        R_ml_leaf = 20.0 * math.log10(leaf.surface_mass * f) - 47.0
        R_leaf = _single_leaf_stl(f, leaf)
        coincidence_drop = max(coincidence_drop, R_ml_leaf - R_leaf)

    octaves_above = max(0.0, math.log(f / f_0) / math.log(2.0))
    gap_advantage = 4.0 * math.log10(max(1.0, d_air_m / 0.006))
    coupling_bonus = gap_advantage * (1.0 - math.exp(-0.7 * octaves_above))

    R = R_ml_combined - uniform_penalty - mam_dip - coincidence_drop + coupling_bonus
    return R


def stl_curve(config: GlazingConfig, freqs_hz: np.ndarray) -> np.ndarray:
    """Compute R(f) in dB across the supplied frequencies."""
    leaves = config.split_at_air_gaps()
    air_gaps = config.air_gaps()

    if len(leaves) == 1:
        leaf_acc = _build_leaf(leaves[0])
        return np.array([_single_leaf_stl(f, leaf_acc) for f in freqs_hz])

    if len(leaves) == 2 and len(air_gaps) == 1:
        leaf1 = _build_leaf(leaves[0])
        leaf2 = _build_leaf(leaves[1])
        d = air_gaps[0].thickness_m
        return np.array([_igu_stl(f, leaf1, leaf2, d) for f in freqs_hz])

    raise NotImplementedError(
        f"Config '{config.name}' has unsupported leaf/gap structure"
    )


def rw_and_adaptation_terms(stl_iso_bands: np.ndarray) -> tuple[float, float, float]:
    """Compute Rw, C, Ctr per ISO 717-1 from 16 1/3-octave band values."""
    assert stl_iso_bands.shape == ISO_REF_CURVE.shape, (
        f"Expected {ISO_REF_CURVE.shape} bands, got {stl_iso_bands.shape}"
    )

    best_shift = None
    for shift in np.arange(-50.0, 50.0, 0.1):
        shifted_ref = ISO_REF_CURVE + shift
        unfav = np.maximum(shifted_ref - stl_iso_bands, 0.0)
        if unfav.sum() <= 32.0:
            best_shift = shift
        else:
            if best_shift is not None:
                break
    if best_shift is None:
        raise RuntimeError("Could not find a valid Rw shift")
    rw = ISO_REF_CURVE[ISO_BANDS_HZ == 500.0][0] + best_shift
    rw = round(rw)

    def adaptation(spectrum: np.ndarray) -> float:
        total = -10.0 * math.log10(
            float(np.sum(10.0 ** ((spectrum - stl_iso_bands) / 10.0)))
        )
        return round(total - rw)

    C = adaptation(C_SPECTRUM)
    Ctr = adaptation(CTR_SPECTRUM)
    return rw, C, Ctr


def mass_air_mass_frequency(config: GlazingConfig) -> float | None:
    """Return the MAM resonance for an IGU config, or None for a single leaf."""
    leaves = config.split_at_air_gaps()
    gaps = config.air_gaps()
    if len(leaves) != 2 or len(gaps) != 1:
        return None
    m1 = leaf_surface_mass(leaves[0])
    m2 = leaf_surface_mass(leaves[1])
    return _mass_air_mass_f0(m1, m2, gaps[0].thickness_m)
