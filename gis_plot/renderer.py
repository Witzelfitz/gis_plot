"""Compose a map image into a print-ready A0 matplotlib Figure."""

from __future__ import annotations

import math

import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.figure import Figure
from PIL.Image import Image as PILImage

# A0 dimensions in millimetres
A0_WIDTH_MM = 841
A0_HEIGHT_MM = 1189

# Margins in millimetres
MARGIN_MM = 20

# DPI for rasterised export (PDF itself is vector, map image is raster)
DPI = 150


def _mm_to_in(mm: float) -> float:
    return mm / 25.4


def render_a0(
    map_image: PILImage,
    title: str,
    bbox: tuple[float, float, float, float],
    crs: str = "EPSG:2056",
) -> Figure:
    """Compose *map_image* onto an A0 figure with decorations.

    Parameters
    ----------
    map_image:
        The map raster returned by :func:`gis_plot.wms_client.WMSClient.get_map_image`.
    title:
        Title text printed at the top of the sheet.
    bbox:
        Geographic bounding box ``(xmin, ymin, xmax, ymax)`` in *crs* units.
    crs:
        Coordinate reference system string (informational, used for scale bar).
    """
    fig_w = _mm_to_in(A0_WIDTH_MM)
    fig_h = _mm_to_in(A0_HEIGHT_MM)

    fig = Figure(figsize=(fig_w, fig_h), dpi=DPI)

    margin_frac_x = MARGIN_MM / A0_WIDTH_MM
    margin_frac_y = MARGIN_MM / A0_HEIGHT_MM

    # Title band height (normalised figure coords)
    title_h = 0.04

    # Map axes occupies most of the figure
    ax_left = margin_frac_x
    ax_bottom = margin_frac_y
    ax_width = 1 - 2 * margin_frac_x
    ax_height = 1 - 2 * margin_frac_y - title_h - 0.01

    ax = fig.add_axes([ax_left, ax_bottom, ax_width, ax_height])
    ax.imshow(np.asarray(map_image), aspect="auto", interpolation="lanczos")
    ax.set_axis_off()

    # Border around map
    for spine in ax.spines.values():
        spine.set_visible(True)
        spine.set_linewidth(1.0)
        spine.set_edgecolor("black")

    # ------------------------------------------------------------------
    # Title
    # ------------------------------------------------------------------
    title_y = ax_bottom + ax_height + margin_frac_y * 0.5
    fig.text(
        0.5,
        title_y + title_h / 2,
        title,
        ha="center",
        va="center",
        fontsize=28,
        fontweight="bold",
    )

    # ------------------------------------------------------------------
    # North arrow  (top-right corner of map axes, in axes coords)
    # ------------------------------------------------------------------
    _draw_north_arrow(fig, ax)

    # ------------------------------------------------------------------
    # Scale bar (bottom-left of map axes)
    # ------------------------------------------------------------------
    _draw_scale_bar(fig, ax, bbox, crs)

    # ------------------------------------------------------------------
    # CRS / data source note
    # ------------------------------------------------------------------
    fig.text(
        ax_left + ax_width,
        ax_bottom - margin_frac_y * 0.5,
        f"Quelle: swisstopo – map.geo.admin.ch  |  {crs}",
        ha="right",
        va="top",
        fontsize=7,
        color="#555555",
    )

    return fig


# ---------------------------------------------------------------------------
# Decoration helpers
# ---------------------------------------------------------------------------

def _draw_north_arrow(fig: Figure, ax) -> None:
    """Draw a simple north arrow in the top-right corner of *ax*."""
    # Position in axes fraction
    x, y = 0.97, 0.97
    dx, dy = 0.0, -0.06

    ax.annotate(
        "",
        xy=(x, y),
        xytext=(x + dx, y + dy),
        xycoords="axes fraction",
        textcoords="axes fraction",
        arrowprops=dict(
            arrowstyle="-|>",
            color="black",
            lw=1.5,
            mutation_scale=14,
        ),
    )
    ax.text(
        x + dx,
        y + dy - 0.03,
        "N",
        transform=ax.transAxes,
        ha="center",
        va="top",
        fontsize=10,
        fontweight="bold",
    )


def _draw_scale_bar(
    fig: Figure,
    ax,
    bbox: tuple[float, float, float, float],
    crs: str,
) -> None:
    """Draw a scale bar at the bottom-left of *ax*.

    Works correctly when *crs* is a metric projection (e.g. EPSG:2056).
    Falls back gracefully for geographic CRS.
    """
    xmin, ymin, xmax, ymax = bbox
    x_span_m = xmax - xmin  # metres for Swiss LV95

    # Choose a round bar length (~20 % of map width)
    target_fraction = 0.20
    target_m = x_span_m * target_fraction
    magnitude = 10 ** math.floor(math.log10(target_m))
    bar_m = round(target_m / magnitude) * magnitude
    bar_fraction = bar_m / x_span_m

    # Position: bottom-left, inset a little
    bar_x0 = 0.03
    bar_y = 0.035
    bar_height = 0.008

    # Alternating black/white segments
    n_segments = 4
    seg_frac = bar_fraction / n_segments
    for i in range(n_segments):
        color = "black" if i % 2 == 0 else "white"
        rect = mpatches.FancyBboxPatch(
            (bar_x0 + i * seg_frac, bar_y - bar_height / 2),
            seg_frac,
            bar_height,
            boxstyle="square,pad=0",
            facecolor=color,
            edgecolor="black",
            linewidth=0.5,
            transform=ax.transAxes,
            clip_on=False,
        )
        ax.add_patch(rect)

    # Labels
    label_m = bar_m
    unit = "m"
    if label_m >= 1000:
        label_m /= 1000
        unit = "km"

    ax.text(
        bar_x0,
        bar_y - bar_height / 2 - 0.015,
        "0",
        transform=ax.transAxes,
        ha="center",
        va="top",
        fontsize=7,
    )
    ax.text(
        bar_x0 + bar_fraction / 2,
        bar_y - bar_height / 2 - 0.015,
        f"{label_m / 2:g} {unit}",
        transform=ax.transAxes,
        ha="center",
        va="top",
        fontsize=7,
    )
    ax.text(
        bar_x0 + bar_fraction,
        bar_y - bar_height / 2 - 0.015,
        f"{label_m:g} {unit}",
        transform=ax.transAxes,
        ha="center",
        va="top",
        fontsize=7,
    )
