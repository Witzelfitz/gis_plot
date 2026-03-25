"""Export a matplotlib Figure to a PDF file or in-memory buffer."""

from __future__ import annotations

import io
from pathlib import Path

from matplotlib.figure import Figure


def export_pdf(figure: Figure, output_path: str | Path) -> None:
    """Save *figure* as a PDF at *output_path*."""
    figure.savefig(
        str(output_path),
        format="pdf",
        dpi=150,
        bbox_inches="tight",
        pad_inches=0,
    )


def export_pdf_bytes(figure: Figure) -> bytes:
    """Return the PDF as raw bytes (for streaming HTTP responses)."""
    buf = io.BytesIO()
    figure.savefig(
        buf,
        format="pdf",
        dpi=150,
        bbox_inches="tight",
        pad_inches=0,
    )
    buf.seek(0)
    return buf.read()
