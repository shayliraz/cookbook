"""Centre-of-glazing thermal transmittance per EN 673.

For each air cavity we compute the cavity conductance h_s = h_g + h_r:
  - h_r (radiative) between two grey glass surfaces with emissivity eps:
        h_r = sigma * (T_m^3 * 4) / (1/eps_1 + 1/eps_2 - 1)
  - h_g (gas conduction + convection) via the Nusselt-number correlation for
    a vertical air layer (Hollands et al.):
        Nu = max(1, 0.0673 * Ra^(1/3)) for Ra > ~1e4, otherwise Nu = 1.
        h_g = Nu * k_gas / d
For 6 mm air gaps Ra is well below the convection threshold, so Nu = 1 and
the gas term is pure conduction.

Surface resistances follow ISO 10077-1: R_si = 0.13 (horizontal heat flow,
internal), R_se = 0.04 (external, exposed to wind).
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from configurations import (
    EPS_GLASS,
    GlazingConfig,
    K_GLASS,
    K_PVB,
    Layer,
    R_SE,
    R_SI,
    SIGMA,
)

K_AIR = 0.0254
NU_AIR = 1.47e-5
ALPHA_AIR = 2.07e-5
G = 9.81
T_MEAN = 283.0
DT = 15.0


@dataclass(frozen=True)
class ThermalBreakdown:
    R_total: float
    U: float
    contributions: list[tuple[str, float]]


def _air_cavity_resistance(d_m: float, eps_1: float, eps_2: float) -> float:
    h_r = SIGMA * 4.0 * T_MEAN ** 3 / (1.0 / eps_1 + 1.0 / eps_2 - 1.0)

    beta = 1.0 / T_MEAN
    Ra = G * beta * DT * d_m ** 3 / (NU_AIR * ALPHA_AIR)
    Nu = max(1.0, 0.0673 * Ra ** (1.0 / 3.0)) if Ra > 1.0e4 else 1.0
    h_g = Nu * K_AIR / d_m

    h_s = h_g + h_r
    return 1.0 / h_s


def _layer_resistance(layer: Layer) -> float:
    if layer.kind == "glass":
        return layer.thickness_m / K_GLASS
    if layer.kind == "pvb":
        return layer.thickness_m / K_PVB
    raise ValueError(f"_layer_resistance called on {layer.kind}")


def u_value(config: GlazingConfig) -> ThermalBreakdown:
    contributions: list[tuple[str, float]] = [("R_si (internal surface)", R_SI)]
    R_total = R_SI
    for layer in config.layers:
        if layer.kind == "air":
            r = _air_cavity_resistance(layer.thickness_m, EPS_GLASS, EPS_GLASS)
            label = f"air gap {layer.thickness_mm:g} mm (uncoated)"
        else:
            r = _layer_resistance(layer)
            label = f"{layer.kind} {layer.thickness_mm:g} mm"
        contributions.append((label, r))
        R_total += r
    contributions.append(("R_se (external surface)", R_SE))
    R_total += R_SE
    return ThermalBreakdown(R_total=R_total, U=1.0 / R_total, contributions=contributions)
