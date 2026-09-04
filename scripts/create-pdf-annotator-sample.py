from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


OUTPUT = Path(__file__).parents[1] / "apps" / "demo" / "public" / "foldworks-sample.pdf"


def label(pdf: canvas.Canvas, text: str, x: float, y: float) -> None:
    pdf.setFillColor(HexColor("#71717A"))
    pdf.setFont("Helvetica", 8)
    pdf.drawString(x, y, text.upper())


def rule(pdf: canvas.Canvas, x: float, y: float, width: float) -> None:
    pdf.setStrokeColor(HexColor("#E4E4E7"))
    pdf.setLineWidth(0.8)
    pdf.line(x, y, x + width, y)


def build() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(OUTPUT), pagesize=letter, pageCompression=1)
    width, height = letter

    pdf.setTitle("Foldworks sample agreement")
    pdf.setAuthor("Foldworks")
    pdf.setFillColor(HexColor("#18181B"))
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(54, height - 68, "Independent contractor agreement")
    pdf.setFillColor(HexColor("#71717A"))
    pdf.setFont("Helvetica", 10)
    pdf.drawString(54, height - 88, "Prepared for Northstar Studio and Alex Morgan")
    rule(pdf, 54, height - 108, width - 108)

    paragraphs = [
        ("1. Scope", "The contractor will provide product design and engineering services described in mutually approved statements of work."),
        ("2. Term", "This agreement begins on September 15, 2026 and continues until the services are completed or either party provides written notice."),
        ("3. Fees", "Northstar Studio will pay approved invoices within thirty days. Expenses require written approval before they are incurred."),
        ("4. Ownership", "Work product created and paid for under this agreement transfers to Northstar Studio, excluding the contractor's existing tools and materials."),
    ]
    y = height - 146
    for heading, body in paragraphs:
        pdf.setFillColor(HexColor("#18181B"))
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(54, y, heading)
        y -= 19
        pdf.setFont("Helvetica", 10)
        pdf.setFillColor(HexColor("#3F3F46"))
        text = pdf.beginText(54, y)
        text.setLeading(15)
        words = body.split()
        line = ""
        for word in words:
            candidate = f"{line} {word}".strip()
            if pdf.stringWidth(candidate, "Helvetica", 10) > width - 108:
                text.textLine(line)
                line = word
            else:
                line = candidate
        text.textLine(line)
        pdf.drawText(text)
        y -= 55

    label(pdf, "Contractor signature", 54, 166)
    rule(pdf, 54, 130, 210)
    label(pdf, "Date", 302, 166)
    rule(pdf, 302, 130, 120)
    label(pdf, "Company signature", 54, 92)
    rule(pdf, 54, 56, 210)
    label(pdf, "Date", 302, 92)
    rule(pdf, 302, 56, 120)
    pdf.showPage()

    pdf.setFillColor(HexColor("#18181B"))
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(54, height - 68, "Exhibit A - Scope of work")
    pdf.setFillColor(HexColor("#71717A"))
    pdf.setFont("Helvetica", 10)
    pdf.drawString(54, height - 88, "Initial product delivery milestones")
    rule(pdf, 54, height - 108, width - 108)

    rows = [
        ("Discovery", "Research, workflows, and technical approach", "$4,500"),
        ("Design", "Interface system and prototype", "$7,500"),
        ("Build", "Production implementation and handoff", "$12,000"),
    ]
    y = height - 154
    for title, description, amount in rows:
        pdf.setFillColor(HexColor("#18181B"))
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(54, y, title)
        pdf.setFont("Helvetica", 10)
        pdf.drawRightString(width - 54, y, amount)
        pdf.setFillColor(HexColor("#52525B"))
        pdf.drawString(54, y - 18, description)
        rule(pdf, 54, y - 34, width - 108)
        y -= 64

    pdf.setFillColor(HexColor("#18181B"))
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(54, 290, "Acceptance criteria")
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(HexColor("#3F3F46"))
    criteria = [
        "Milestone deliverables match the approved statement of work.",
        "Source files and implementation notes are included.",
        "Northstar Studio confirms acceptance in writing.",
    ]
    for index, item in enumerate(criteria):
        line_y = 262 - index * 32
        pdf.rect(54, line_y - 2, 12, 12, stroke=1, fill=0)
        pdf.drawString(78, line_y, item)

    label(pdf, "Approval", 54, 128)
    rule(pdf, 54, 92, 210)
    label(pdf, "Date", 302, 128)
    rule(pdf, 302, 92, 120)
    pdf.save()


if __name__ == "__main__":
    build()
