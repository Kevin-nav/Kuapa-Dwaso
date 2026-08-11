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
        self.drawRightString(558, 752, "VOICEOVER SCRIPT - BUYER PORTAL")
        
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
    pdf_path = r"c:\Users\Kevin\Projects\ML\agriculture\docs\Kuapa-Dwaso-Buyer-Voiceover-Script.pdf"
    
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=64,
        bottomMargin=64
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles - Larger fonts as requested
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
        textColor=colors.HexColor("#c2410c"), # brand clay color
        spaceAfter=8,
        leftIndent=15
    )
    
    time_style = ParagraphStyle(
        'TimeCue',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#2d8a4e"), # field green
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )
    
    heading_style = ParagraphStyle(
        'PartHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=22,
        textColor=colors.HexColor("#0f1f14"),
        spaceBefore=18,
        spaceAfter=10,
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
    
    story.append(Paragraph("Kuapa Dwaso Buyer Voiceover Script", title_style))
    story.append(Paragraph("Timed to sync with screen recordings of the Buyer Portal", subtitle_style))
    story.append(Spacer(1, 10))
    
    # Part 1 Header
    story.append(Paragraph("Part 1: Registration & Onboarding", heading_style))
    story.append(Paragraph("Video Source: <i>registration walkthrough</i> | Duration: 1m 5s", subtitle_style))
    
    steps_p1 = [
        ("00:00 - 00:15", 
         "Visual: Clicks 'Join the Pilot' on the landing page, and selects 'Buy Produce' on the role selection screen.",
         "\"To join Kuapa Dwaso as a buyer, we click 'Join the pilot' and select our role. In this walk-through, we'll choose 'Buy produce' to set up our trader profile.\""),
        
        ("00:15 - 00:30",
         "Visual: Inputs phone number, receives the transactional SMS verification code, and verifies the account.",
         "\"Account security starts with phone verification. We input our phone number and verify it instantly with a one-time code. This ensures all buyer communications are securely tied to a real device.\""),
        
        ("00:30 - 00:50",
         "Visual: Fills profile details (Kevin Amisom, market trader, Tarkwa Market Circle destination market) and clicks 'Save profile'.",
         "\"We complete our profile by adding our name, business type, and target destination market—in this case, Tarkwa Market Circle. This destination helps the platform group bulk logistics and coordinate shipping later. With a click, the account is created and ready for verification.\""),
        
        ("00:50 - 01:05",
         "Visual: Navigates the buyer dashboard tabs (Marketplace, Orders, Profile).",
         "\"Once logged in, we land on our marketplace dashboard. Buyers have immediate access to real-time available stock, their purchase history, and profile controls directly from the bottom navigation bar.\"")
    ]
    
    for time_cue, visual, speaker in steps_p1:
        block = []
        block.append(Paragraph(f"Time Cue: {time_cue}", time_style))
        block.append(Paragraph(visual, visual_style))
        block.append(Paragraph(f"<b>Voiceover:</b> {speaker}", speaker_style))
        story.append(KeepTogether(block))
        story.append(Spacer(1, 4))
        
    story.append(PageBreak())
    
    # Part 2 Header
    story.append(Paragraph("Part 2: Marketplace Purchase & Real-Time Reservation", heading_style))
    story.append(Paragraph("Video Source: <i>checkout flow & confirmation</i> | Duration: 1m 8s", subtitle_style))
    story.append(Spacer(1, 10))
    
    steps_p2 = [
        ("00:00 - 00:10",
         "Visual: Marketplace dashboard scrolling and clicking 'Order Details' on the Cassava listing.",
         "\"On the marketplace dashboard, we see verified, available warehouse stock. Buyers can scroll through listings, filter by crop or grade, and click 'Order Details' to inspect any batch.\""),
        
        ("00:10 - 00:17",
         "Visual: Reviewing Stock Detail Summary and expanding 'How Fees & Transportation Work' panel.",
         "\"Here, we see the Stock Detail Summary. It shows total available tubers, pricing, freshness, and the dispatch schedule. Expanding the fee dropdown reveals a transparent breakdown of the purchase price, service fees, and transport costs.\""),
        
        ("00:17 - 00:35",
         "Visual: Checkout form. Inputs 100 tubers, changes price from 30 to 25, triggering the validation error.",
         "\"Next, we click 'Continue to Place Order' and set our quantity to 100 tubers. When we try to bid below the minimum price of 30, the system triggers a validation error. This protects the contract terms set during produce intake.\""),
        
        ("00:35 - 00:55",
         "Visual: Corrects price to 30, selects warehouse dispatch date dropdown, and clicks green 'Request Produce'.",
         "\"Reverting the price to 30 instantly clears the error. We select our warehouse dispatch date from the dropdown and click 'Request Produce' to submit our purchase request.\""),
        
        ("00:55 - 01:08",
         "Visual: Order tracking screen opens showing Order ID #M174MCR4, fulfillment journey timeline, invoice, and locked reservation status.",
         "\"Our order is submitted successfully. The platform assigns a unique Order ID and updates the fulfillment timeline in real-time. The system has automatically locked our 100 Cassava tubers in the warehouse, preventing double-selling. The invoice is generated, and we are ready to complete the payment.\"")
    ]
    
    for time_cue, visual, speaker in steps_p2:
        block = []
        block.append(Paragraph(f"Time Cue: {time_cue}", time_style))
        block.append(Paragraph(visual, visual_style))
        block.append(Paragraph(f"<b>Voiceover:</b> {speaker}", speaker_style))
        story.append(KeepTogether(block))
        story.append(Spacer(1, 4))
        
    doc.build(story, canvasmaker=NumberedCanvas)
    print("Buyer Voiceover PDF generated successfully.")

if __name__ == '__main__':
    main()
