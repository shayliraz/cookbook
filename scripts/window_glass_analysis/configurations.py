"""Glazing configurations and material constants."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

RHO_GLASS = 2500.0
RHO_PVB = 1070.0
RHO_AIR = 1.20
K_GLASS = 1.0
K_PVB = 0.22
E_GLASS = 70.0e9
NU_GLASS = 0.22
EPS_GLASS = 0.837
C_AIR = 343.0
SIGMA = 5.670374419e-8

R_SI = 0.13
R_SE = 0.04

LayerKind = Literal["glass", "pvb", "air"]


@dataclass(frozen=True)
class Layer:
    kind: LayerKind
    thickness_mm: float

    @property
    def thickness_m(self) -> float:
        return self.thickness_mm / 1000.0


@dataclass(frozen=True)
class GlazingConfig:
    name: str
    layers: tuple[Layer, ...]
    description: str = ""

    def split_at_air_gaps(self) -> list[list[Layer]]:
        """Return the leaf groups separated by air cavities."""
        leaves: list[list[Layer]] = [[]]
        for layer in self.layers:
            if layer.kind == "air":
                leaves.append([])
            else:
                leaves[-1].append(layer)
        return leaves

    def air_gaps(self) -> list[Layer]:
        return [l for l in self.layers if l.kind == "air"]


def leaf_surface_mass(leaf: list[Layer]) -> float:
    """Surface mass (kg/m²) of one leaf (a stack of glass + PVB layers)."""
    m = 0.0
    for layer in leaf:
        if layer.kind == "glass":
            m += RHO_GLASS * layer.thickness_m
        elif layer.kind == "pvb":
            m += RHO_PVB * layer.thickness_m
        else:
            raise ValueError(f"Unexpected layer in leaf: {layer.kind}")
    return m


def leaf_total_glass_thickness_m(leaf: list[Layer]) -> float:
    return sum(l.thickness_m for l in leaf if l.kind == "glass")


def leaf_max_glass_thickness_m(leaf: list[Layer]) -> float:
    glass = [l.thickness_m for l in leaf if l.kind == "glass"]
    return max(glass) if glass else 0.0


def leaf_is_laminated(leaf: list[Layer]) -> bool:
    return any(l.kind == "pvb" for l in leaf)


CONFIGS: list[GlazingConfig] = [
    GlazingConfig(
        name="3-0.36-3",
        layers=(Layer("glass", 3.0), Layer("pvb", 0.36), Layer("glass", 3.0)),
        description="Triplex laminated, symmetric, thin",
    ),
    GlazingConfig(
        name="3-0.72-4",
        layers=(Layer("glass", 3.0), Layer("pvb", 0.72), Layer("glass", 4.0)),
        description="Triplex laminated, asymmetric, thick PVB",
    ),
    GlazingConfig(
        name="4-0.72-4",
        layers=(Layer("glass", 4.0), Layer("pvb", 0.72), Layer("glass", 4.0)),
        description="Triplex laminated, symmetric, heavy",
    ),
    GlazingConfig(
        name="4-6-4",
        layers=(Layer("glass", 4.0), Layer("air", 6.0), Layer("glass", 4.0)),
        description="Double-glazed IGU, 6 mm air cavity",
    ),
    GlazingConfig(
        name="4-6-3-0.36-3",
        layers=(
            Layer("glass", 4.0),
            Layer("air", 6.0),
            Layer("glass", 3.0),
            Layer("pvb", 0.36),
            Layer("glass", 3.0),
        ),
        description="IGU with laminated inner leaf, 6 mm air cavity",
    ),
]
