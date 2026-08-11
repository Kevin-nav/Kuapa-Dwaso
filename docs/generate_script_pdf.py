import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing, Circle

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_decorations(self, num_pages):
        page_num = self._pageNumber
        self.saveState()
        
        # Header
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#0f1f14")) # deep green-black ink
        self.drawString(54, 752, "KUAPA DWASO")
        
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#6b7280")) # gray 500
        self.drawRightString(558, 752, "PRESENTATION SCRIPT - LANDING PAGE")
        
        self.setStrokeColor(colors.HexColor("#dde3d5")) # hairline divider line
        self.setLineWidth(0.5)
        self.line(54, 744, 558, 744)
        
        # Footer
        self.line(54, 52, 558, 52)
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#2d8a4e")) # field green
        self.drawString(54, 38, "Kuapa Dwaso")
        
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#6b7280"))
        footer_text = f"Page {page_num} of {num_pages}"
        self.drawRightString(558, 38, footer_text)
        
        self.restoreState()

def draw_logo(width=80, height=80):
    d = Drawing(width, height)
    scale = width / 120.0
    
    def get_color(opacity):
        return colors.Color(45/255.0, 138/255.0, 78/255.0, opacity)

    circles_data = [
        (22, 120 - 30, 6, 0.5),
        (18, 120 - 60, 6, 0.65),
        (22, 120 - 90, 6, 0.8),
        (48, 120 - 45, 8, 0.85),
        (48, 120 - 75, 8, 0.9),
        (88, 120 - 60, 22, 1.0)
    ]

    for cx, cy, r, opacity in circles_data:
        d.add(Circle(cx * scale, cy * scale, r * scale, 
                     fillColor=get_color(opacity), 
                     strokeColor=None))
    return d

def main():
    pdf_path = r"c:\Users\Kevin\Projects\ML\agriculture\docs\Kuapa-Dwaso-Presentation-Script.pdf"
    
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=64,
        bottomMargin=64
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles - Font is a little bigger (fontSize=12, leading=18 for speaker text)
    speaker_style = ParagraphStyle(
        'SpeakerText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=18,
        textColor=colors.HexColor("#0f1f14"), # deep green-black ink
        spaceAfter=14
    )
    
    visual_style = ParagraphStyle(
        'VisualDirections',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=10.5,
        leading=15,
        textColor=colors.HexColor("#c2410c"), # brand clay color to make visual cues stand out
        spaceAfter=10,
        leftIndent=15
    )
    
    heading_style = ParagraphStyle(
        'SlideHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=20,
        textColor=colors.HexColor("#2d8a4e"), # field green
        spaceBefore=14,
        spaceAfter=12,
        keepWithNext=True
    )
    
    title_style = ParagraphStyle(
        'ScriptTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=30,
        textColor=colors.HexColor("#0f1f14"),
        spaceAfter=6,
        alignment=1 # Center
    )
    
    subtitle_style = ParagraphStyle(
        'ScriptSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=16,
        textColor=colors.HexColor("#6b7280"),
        spaceAfter=20,
        alignment=1 # Center
    )
    
    story = []
    
    # Title Section
    logo = draw_logo(60, 60)
    logo_table = Table([[logo]], colWidths=[504])
    logo_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(logo_table)
    
    story.append(Paragraph("Kuapa Dwaso Presentation Script", title_style))
    story.append(Paragraph("Landing Page & Product Overview Presentation (2-Minute Cut)", subtitle_style))
    story.append(Spacer(1, 15))
    
    # Slide 1
    story.append(Paragraph("Slide 1: Brand & Logo Concept", heading_style))
    story.append(Paragraph(
        "<b>[Visual: Display the Title Slide (logo-presentation.html) showing the centered green logo with 'Kuapa Dwaso' below it]</b>", 
        visual_style
    ))
    story.append(Paragraph(
        "<b>Speaker:</b><br/>"
        "\"Hello everyone. Kuapa Dwaso—which translates to <b>'Farmer’s Market'</b> in Akan—is a warehouse-based platform for produce aggregation, inventory, sales, and dispatch.<br/><br/>"
        "This logo represents a concept we call <b>'Geometric Aggregation.'</b> On the far left, you see small, individual producer nodes—our smallholder farmers. They converge into intermediate community warehouses in the middle, which ultimately consolidate into a large, aggregated bulk supply on the right.<br/><br/>"
        "This design directly reflects the field insights that shaped our entire product direction. During our visits with farmers and traders in Tarkwa, we learned that farmers were carrying all the risk. They were transporting perishable crops to the city on speculation, with no confirmed buyers, leaving them with zero bargaining power and exposing them to heavy spoilage.\"",
        speaker_style
    ))
    
    story.append(Spacer(1, 20))
    story.append(PageBreak()) # Clean break to the next page / slide
    
    # Slide 2
    story.append(Paragraph("Slide 2: The Landing Page & Warehouse Model", heading_style))
    story.append(Paragraph(
        "<b>[Visual: Actively scroll and show the Kuapa Dwaso Landing Page]</b>", 
        visual_style
    ))
    story.append(Paragraph(
        "<b>Speaker:</b><br/>"
        "\"We designed our landing page with a product philosophy of <b>radical restraint and high-trust documentation</b>.<br/><br/>"
        "Instead of a simple digital matching app, our landing page shows how we establish physical warehouses as trust points. Farmers store produce locally, and we only dispatch bulk transport once orders are confirmed by buyers.<br/><br/>"
        "The landing page clearly outlines this flow for three key roles:<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;1. The <b>Farmer Portal</b>, where farmers track their storage fees and payouts.<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;2. The <b>Warehouse Agent Dashboard</b>, where agents grade and record produce intake.<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;3. The <b>Buyer Console</b>, where traders purchase verified, physical inventory.<br/><br/>"
        "Let's now log into the platform and see this flow in action.\"",
        speaker_style
    ))
    
    doc.build(story, canvasmaker=NumberedCanvas)
    print("PDF generated successfully.")

if __name__ == '__main__':
    main()
