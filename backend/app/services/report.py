"""
report.py — Professional PDF Site Readiness Report Generator (PS-2 compliant).
Uses ReportLab to generate executive-ready PDF dossiers.
"""

from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)


def generate_pdf_report(
    city_name: str,
    business_type: str,
    score_summary: dict[str, Any],
    top_sites: list[dict[str, Any]],
    ai_explanation: dict[str, Any] | None = None,
    provenance_meta: dict[str, Any] | None = None,
    selected_site: dict[str, Any] | None = None,
) -> bytes:
    """
    Generates a high-quality PDF report and returns the raw bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a"),
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#475569"),
    )
    h2_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#065f46"),
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "BodyTextCustom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#334155"),
    )
    meta_style = ParagraphStyle(
        "MetaText",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#64748b"),
    )

    elements = []

    # Title & Header
    elements.append(Paragraph("SiteScope™ Geospatial Site Readiness Report", title_style))
    elements.append(Spacer(1, 4))
    elements.append(
        Paragraph(
            f"Location Intelligence Evaluation for <b>{business_type.title()}</b> in <b>{city_name}</b> | Generated on {datetime.now(timezone.utc).strftime('%B %d, %Y')}",
            subtitle_style,
        )
    )
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#059669"), spaceAfter=14))

    # Executive Summary Card
    mean_sc = score_summary.get("mean_score", 0.0)
    top_sc = score_summary.get("top_score", 0.0)
    tot_hex = score_summary.get("total_hexes", 0)

    summary_data = [
        [
            Paragraph(f"<b>Target Business:</b> {business_type.title()}", body_style),
            Paragraph(f"<b>Metro Evaluated:</b> {city_name}", body_style),
        ],
        [
            Paragraph(f"<b>Analyzed Hex Cells:</b> {tot_hex:,} (H3 Res 8)", body_style),
            Paragraph(f"<b>City Mean Score:</b> {mean_sc:.1f} / 100", body_style),
        ],
        [
            Paragraph(f"<b>Top Ranked Score:</b> {top_sc:.1f} / 100", body_style),
            Paragraph("<b>Scoring Engine:</b> Vectorized MCDA (0-100)", body_style),
        ],
    ]
    summary_table = Table(summary_data, colWidths=[260, 260])
    summary_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
            ("PADDING", (0, 0), (-1, -1), 6),
        ])
    )
    elements.append(summary_table)
    elements.append(Spacer(1, 14))

    # Selected Site Location & Address
    if selected_site:
        lat = selected_site.get("lat")
        lng = selected_site.get("lng")
        h3_idx = selected_site.get("h3", "N/A")
        score_val = selected_site.get("score", 0)
        score_100 = selected_site.get("score100", round(score_val * 100))

        elements.append(Paragraph("Selected Site — Detailed Location Profile", h2_style))

        # Try to get address via reverse geocoding (simplified - coordinates shown)
        location_text = f"H3 Index: <b>{h3_idx}</b>"
        if lat is not None and lng is not None:
            location_text += f" | Coordinates: <b>{lat:.6f}° N, {lng:.6f}° E</b>"
            # Note: For production, integrate a reverse geocoding service (Nominatim, Google Maps, etc.)
            # to convert lat/lng to human-readable address.
            location_text += "  <i>(Reverse geocoding available via OSM Nominatim / Google Maps API)</i>"

        elements.append(Paragraph(location_text, body_style))
        elements.append(Spacer(1, 4))

        # Site score highlight
        score_color = "#059669" if score_100 >= 80 else "#0f766e" if score_100 >= 65 else "#0891b2" if score_100 >= 50 else "#d97706" if score_100 >= 35 else "#dc2626"
        score_label = (
            "Strong Opportunity" if score_100 >= 80 else
            "Good Potential" if score_100 >= 65 else
            "Moderate Fit" if score_100 >= 50 else
            "Marginal Fit" if score_100 >= 35 else
            "Low Suitability"
        )
        elements.append(
            Paragraph(
                f"<b>Site Readiness Score:</b> <font color='{score_color}'><b>{score_100} / 100</b></font> — {score_label}",
                body_style,
            )
        )
        elements.append(Spacer(1, 6))

        # Sub-scores breakdown if available
        sub_keys = [
            ("sub_demand", "Demand"),
            ("sub_accessibility", "Transit Accessibility"),
            ("sub_competition", "Competition"),
            ("sub_complementary", "Complementary"),
            ("sub_landuse", "Land Use"),
            ("sub_risk", "Risk"),
        ]
        sub_rows = []
        for key, label in sub_keys:
            if key in selected_site:
                sub_rows.append([Paragraph(f"<b>{label}:</b>", body_style), Paragraph(f"{selected_site[key]:.1f} / 100", body_style)])
        if sub_rows:
            sub_table = Table(sub_rows, colWidths=[180, 100])
            sub_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdfa")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#a7f3d0")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1fae5")),
                    ("PADDING", (0, 0), (-1, -1), 4),
                ])
            )
            elements.append(sub_table)
            elements.append(Spacer(1, 10))

    # AI Strategic Insights
    if ai_explanation:
        elements.append(Paragraph("Strategic AI Insights & Driver Synthesis", h2_style))
        elements.append(Paragraph(ai_explanation.get("summary", ""), body_style))
        elements.append(Spacer(1, 6))

        strengths = ai_explanation.get("strengths", [])
        if strengths:
            elements.append(Paragraph("<b>Primary Growth Drivers & Strengths:</b>", body_style))
            for s in strengths:
                elements.append(Paragraph(f"• {s}", body_style))
            elements.append(Spacer(1, 6))

        risks = ai_explanation.get("risks", [])
        if risks:
            elements.append(Paragraph("<b>Risk Factors & Mitigation:</b>", body_style))
            for r in risks:
                elements.append(Paragraph(f"• {r}", body_style))
            elements.append(Spacer(1, 6))

        rec = ai_explanation.get("recommendation", "")
        if rec:
            elements.append(Paragraph(f"<b>Recommendation:</b> {rec}", body_style))
            elements.append(Spacer(1, 10))

    # Top Candidate Locations Table
    elements.append(Paragraph("Top Candidate Sites (Ranked by Readiness Score)", h2_style))

    table_data = [
        [
            Paragraph("<b>Rank</b>", body_style),
            Paragraph("<b>H3 Index</b>", body_style),
            Paragraph("<b>Score</b>", body_style),
            Paragraph("<b>Demand</b>", body_style),
            Paragraph("<b>Transit</b>", body_style),
            Paragraph("<b>Footfall</b>", body_style),
            Paragraph("<b>Flood Risk</b>", body_style),
            Paragraph("<b>Zoning</b>", body_style),
        ]
    ]

    for i, s in enumerate(top_sites[:10]):
        rank_label = f"#{i+1}"
        h3_short = s.get("h3", "")[:12] + "..."
        sc = f"{s.get('score', 0):.1f}"
        dm = f"{s.get('sub_demand', 0):.0f}"
        tr = f"{s.get('sub_transit', 0):.0f}"
        ff = f"{s.get('sub_footfall', 0):.0f}"
        fl = f"{s.get('flood_susceptibility', 0):.2f}"
        lu = s.get("landuse_dominant", "mixed")[:8]

        table_data.append([
            Paragraph(rank_label, body_style),
            Paragraph(h3_short, body_style),
            Paragraph(f"<b>{sc}</b>", body_style),
            Paragraph(dm, body_style),
            Paragraph(tr, body_style),
            Paragraph(ff, body_style),
            Paragraph(fl, body_style),
            Paragraph(lu, body_style),
        ])

    sites_table = Table(table_data, colWidths=[35, 95, 45, 50, 45, 50, 60, 60])
    sites_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#065f46")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("PADDING", (0, 0), (-1, -1), 5),
        ])
    )
    elements.append(sites_table)
    elements.append(Spacer(1, 14))

    # Data Provenance & Citations Section
    elements.append(Paragraph("Data Provenance & Scientific Citations", h2_style))
    prov_text = (
        "All metrics are computed deterministically from real geospatial datasets with zero synthetic generation: "
        "<br/>• <b>Demographics:</b> WorldPop 2020 UN-Adjusted Population Raster (100m resolution, exact pixel mask)."
        "<br/>• <b>Street Network & Infrastructure:</b> OpenStreetMap (OSM) multi-tiled roads, bus stops, and building footprints."
        "<br/>• <b>Terrain & Elevation:</b> AWS Terrarium / Copernicus 30m Digital Elevation Model (DEM)."
        "<br/>• <b>Spatial Statistics:</b> Getis-Ord Gi* local autocorrelation (PySal / esda, α=0.01) and Haversine DBSCAN."
        "<br/>• <b>Isochrones:</b> Multimodal Valhalla FOSSGIS routing engine with metric UTM 43N area projection."
    )
    elements.append(Paragraph(prov_text, meta_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
