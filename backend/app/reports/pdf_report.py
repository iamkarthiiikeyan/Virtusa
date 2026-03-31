"""PDF Report Generator — Full deployment planning report.

Generates a professional PDF with:
- Executive summary
- Area analysis and building count
- Fiber route details
- Full BOQ table
- Scenario comparison
- Risk assessment
- AI recommendation and reasoning

Install: pip install reportlab
"""
import io
import json
from datetime import datetime
from typing import Optional


def generate_report_pdf(result: dict, request_data: dict = None) -> bytes:
    """Generate a PDF report from planning results. Returns PDF bytes."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm, cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm,
                            leftMargin=2*cm, rightMargin=2*cm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=22, spaceAfter=6,
                                  textColor=colors.HexColor('#0e7490'))
    h1 = ParagraphStyle('H1', parent=styles['Heading1'], fontSize=16, spaceAfter=8,
                         textColor=colors.HexColor('#164e63'), spaceBefore=16)
    h2 = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=13, spaceAfter=6,
                         textColor=colors.HexColor('#155e75'), spaceBefore=12)
    body = styles['Normal']
    small = ParagraphStyle('Small', parent=body, fontSize=8, textColor=colors.grey)

    story = []

    # Title
    story.append(Paragraph("ATLAS — Fiber Deployment Planning Report", title_style))
    story.append(Paragraph("Autonomous Telecom Layout & Analytics System", body))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%d %B %Y, %H:%M')}", small))
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#0e7490')))
    story.append(Spacer(1, 12))

    route = result.get("route", {})
    cost = result.get("cost", {})
    risk = result.get("risk", {})
    decision = result.get("decision", {})
    explanation = result.get("explanation", {})
    scenarios = result.get("scenarios", {})
    area = route.get("area_analysis") or {}
    rec = decision.get("recommended_scenario", {})

    # Executive Summary
    story.append(Paragraph("Executive Summary", h1))
    story.append(Paragraph(f"<b>Recommended:</b> {rec.get('name', 'N/A')}", body))
    story.append(Paragraph(explanation.get("summary", ""), body))
    story.append(Spacer(1, 8))

    summary_data = [
        ["Metric", "Value"],
        ["Location", request_data.get("location", route.get("location", "N/A")) if request_data else "N/A"],
        ["Total CAPEX", f"₹{cost.get('total_cost', 0):,.0f}"],
        ["Cost per Premise", f"₹{cost.get('cost_per_premise', 0):,.0f}"],
        ["Fiber Route", f"{route.get('route_length_km', 0)} km"],
        ["Premises Connected", f"{route.get('premises_connected', 0):,}"],
        ["Buildings Detected", f"{area.get('detected_buildings', 'N/A')}"],
        ["Detection Source", area.get("building_source", "N/A")],
        ["Risk Score", f"{risk.get('overall_risk_score', 0) * 100:.0f}/100"],
        ["Terrain", cost.get("terrain_type", "N/A")],
        ["Deployment Method", cost.get("deployment_method", "N/A")],
    ]
    t = Table(summary_data, colWidths=[45*mm, 100*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0e7490')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ]))
    story.append(t)

    # Area Analysis
    if area:
        story.append(Paragraph("Area Analysis", h1))
        story.append(Paragraph(f"Area: {area.get('area_sq_km', 0):.4f} km²", body))
        story.append(Paragraph(f"Buildings detected: {area.get('detected_buildings', 0):,}", body))
        story.append(Paragraph(f"Source: {area.get('building_source', 'N/A')}", body))
        story.append(Paragraph(f"Polygon vertices: {area.get('polygon_vertices', 0)}", body))

    # Scenario Comparison
    story.append(Paragraph("Scenario Comparison", h1))
    rankings = decision.get("all_rankings", [])
    if rankings:
        scenario_data = [["Rank", "Scenario", "Cost (₹)", "Timeline", "Coverage", "Score"]]
        for s in rankings:
            scenario_data.append([
                str(s.get("rank", "")),
                s.get("name", ""),
                f"₹{s.get('estimated_cost', 0):,.0f}",
                f"{s.get('estimated_months', 0)} months",
                f"{s.get('coverage_percent', 0)}%",
                f"{(s.get('topsis_score', 0) * 100):.0f}",
            ])
        t2 = Table(scenario_data, colWidths=[12*mm, 45*mm, 35*mm, 25*mm, 22*mm, 18*mm])
        t2.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0e7490')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ]))
        story.append(t2)

    story.append(Paragraph(f"<b>AI Reasoning:</b> {decision.get('reasoning', '')}", body))

    # Bill of Quantities
    story.append(Paragraph("Bill of Quantities", h1))
    boq = cost.get("boq", [])
    if boq:
        # Group by category
        categories = {}
        for item in boq:
            cat = item.get("category", "Other")
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(item)

        for cat, items in categories.items():
            story.append(Paragraph(cat.replace("_", " ").title(), h2))
            boq_data = [["Item", "Qty", "Unit", "Unit Price", "Total"]]
            for item in items:
                boq_data.append([
                    item.get("item_name", ""),
                    f"{item.get('quantity', 0):,}",
                    item.get("unit", ""),
                    f"₹{item.get('unit_price_inr', item.get('unit_price', 0)):,.0f}",
                    f"₹{item.get('total_inr', item.get('total_price', 0)):,.0f}",
                ])
            # Category subtotal
            cat_total = sum(i.get("total_inr", i.get("total_price", 0)) for i in items)
            boq_data.append(["", "", "", "Subtotal:", f"₹{cat_total:,.0f}"])

            t3 = Table(boq_data, colWidths=[55*mm, 18*mm, 22*mm, 25*mm, 30*mm])
            t3.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#155e75')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTSIZE', (0, 0), (-1, -1), 7),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f8fafc')]),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTNAME', (-2, -1), (-1, -1), 'Helvetica-Bold'),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f0f9ff')),
                ('ALIGN', (-2, 0), (-1, -1), 'RIGHT'),
            ]))
            story.append(t3)
            story.append(Spacer(1, 6))

        # Grand total
        story.append(Spacer(1, 8))
        story.append(Paragraph(f"<b>CAPEX Subtotal:</b> ₹{cost.get('capex_subtotal', 0):,.0f}", body))
        story.append(Paragraph(f"<b>Contingency ({cost.get('contingency_percent', 12)}%):</b> ₹{cost.get('capex_subtotal', 0) * cost.get('contingency_percent', 12) / 100:,.0f}", body))
        story.append(Paragraph(f"<b>GST ({cost.get('gst_percent', 18)}%):</b> ₹{cost.get('capex_subtotal', 0) * cost.get('gst_percent', 18) / 100:,.0f}", body))
        story.append(Paragraph(f"<b>Total CAPEX: ₹{cost.get('total_cost', 0):,.0f}</b>", ParagraphStyle('GrandTotal', parent=body, fontSize=14, textColor=colors.HexColor('#0e7490'))))
        story.append(Paragraph(f"Annual OPEX: ₹{cost.get('annual_opex', 0):,.0f}", body))

    # Risk Assessment
    story.append(Paragraph("Risk Assessment", h1))
    story.append(Paragraph(f"Overall Score: {risk.get('overall_risk_score', 0) * 100:.0f}/100 ({risk.get('overall_severity', 'N/A')})", body))
    risks = risk.get("risks", [])
    if risks:
        risk_data = [["Risk Factor", "Score", "Severity", "Mitigation"]]
        for r in risks:
            risk_data.append([
                r.get("risk_type", "").replace("_", " ").title(),
                f"{r.get('score', 0) * 100:.0f}%",
                r.get("severity", ""),
                r.get("mitigation", "")[:60] + "..." if len(r.get("mitigation", "")) > 60 else r.get("mitigation", ""),
            ])
        t4 = Table(risk_data, colWidths=[35*mm, 18*mm, 22*mm, 75*mm])
        t4.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#9a3412')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ]))
        story.append(t4)

    # AI Explanation
    story.append(Paragraph("AI Decision Explanation", h1))
    for section in explanation.get("sections", []):
        story.append(Paragraph(f"<b>{section.get('title', '')}</b>", body))
        story.append(Paragraph(section.get("content", ""), ParagraphStyle('Content', parent=body, fontSize=9)))
        story.append(Spacer(1, 4))

    # Footer
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    story.append(Paragraph(f"ATLAS v2.0 — Pipeline duration: {result.get('pipeline_duration_seconds', 'N/A')}s — Confidence: {explanation.get('confidence', 'N/A')}", small))

    doc.build(story)
    return buffer.getvalue()
