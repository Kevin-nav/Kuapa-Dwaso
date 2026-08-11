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
        self.drawRightString(558, 752, "VOICEOVER SCRIPT - TRANSPORTER PORTAL")
        
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
    pdf_path = r"c:\Users\Kevin\Projects\ML\agriculture\docs\Kuapa-Dwaso-Transporter-Voiceover-Script.pdf"
    
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
    
    story.append(Paragraph("Kuapa Dwaso Transporter Voiceover Script", title_style))
    story.append(Paragraph("Timed to sync with screen recordings of the Transporter Onboarding", subtitle_style))
    story.append(Spacer(1, 10))
    
    # Part 1 Header
    story.append(Paragraph("Part 1: Registration & Onboarding", heading_style))
    story.append(Paragraph("Video Source: <i>registration & route setup</i> | Duration: 1m 20s", subtitle_style))
    
    steps_p1 = [
        ("00:00 - 00:15", 
         "Visual: Clicks 'Join the Pilot' on the landing page, and selects 'Transport produce' as role on the signup screen.",
         "\"To sign up as a transporter on Kuapa Dwaso, we select the 'Transport produce' option under role selection. This links the user profile to our logistics network.\""),
        
        ("00:15 - 00:30",
         "Visual: Inputs phone number and verifies it with OTP '744951'.",
         "\"Just like buyers and farmers, we authenticate securely using a one-way SMS verification code. This ties the transporter's mobile number directly to their account.\""),
        
        ("00:30 - 01:20",
         "Visual: Completes profile details (Johnson Mesah, 20 ton Truck, Tarkwa) and inputs serviced routes and destinations.",
         "\"We enter our profile details—Johnson Mesah, driving a 20-ton truck out of Tarkwa. Specifying our vehicle capacity and exact service routes like Sefwi Wiawso or Bibiani is critical; this data is used by the platform to automatically match us with bulk shipments that fit our truck size and route locations.\"")
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
    story.append(Paragraph("Part 2: Login & Verification Pending State", heading_style))
    story.append(Paragraph("Video Source: <i>dashboard access & verification warnings</i> | Duration: 51s", subtitle_style))
    story.append(Spacer(1, 10))
    
    steps_p2 = [
        ("01:20 - 02:00",
         "Visual: Encounters profile warning, signs out, and logs back in via the Transporter Login portal with code '713436'.",
         "\"After onboarding, we log in specifically through the Transporter Login portal. Re-authenticating with a secure code loads the dashboard for our assigned vehicle profile.\""),
        
        ("02:00 - 02:11",
         "Visual: Accesses dashboard. Dashboard shows Johnson Mesah's truck details with a 'Pending' status and an admin approval banner.",
         "\"Our dashboard is active, but our status is marked as 'Pending.' In Kuapa Dwaso, transporters carry high-value produce batches, so accounts must be verified by an admin before they can see or accept dispatch jobs. This protects the security of the harvest.\"")
    ]
    
    for time_cue, visual, speaker in steps_p2:
        block = []
        block.append(Paragraph(f"Time Cue: {time_cue}", time_style))
        block.append(Paragraph(visual, visual_style))
        block.append(Paragraph(f"<b>Voiceover:</b> {speaker}", speaker_style))
        story.append(KeepTogether(block))
        story.append(Spacer(1, 4))
        
    story.append(PageBreak())
    
    # Part 3 Header
    story.append(Paragraph("Part 3: Uploading Truck Evidence & Navigation", heading_style))
    story.append(Paragraph("Video Source: <i>truck evidence upload & menu navigation</i> | Duration: 32s", subtitle_style))
    story.append(Spacer(1, 10))
    
    steps_p3 = [
        ("02:11 - 02:20",
         "Visual: Clicks 'Manage profile and truck evidence' and uploads 'produce truck.jpg'.",
         "\"To get verified, we click 'Manage profile and truck evidence' and upload a photo of our vehicle. This truck photo serves as visual proof of capacity and identity for our warehouse agents.\""),
        
        ("00:11 - 00:20",
         "Visual: Status shows 'Pending upload' and briefly flashes a network error.",
         "\"The system handles the upload state securely, tracking it as a pending asset in our database. Even if a brief network hiccup occurs on poor connections, the metadata is saved.\""),
        
        ("00:20 - end",
         "Visual: Photos counter updates to 1. Navigates the navigation bar tabs (Dispatches, Profile, Home).",
         "\"Our upload is recorded, and the truck photos counter updates to one. Browsing the 'Dispatches' tab shows it is currently empty. Once the admin reviews our truck evidence and verifies our account, matching dispatch requests will appear here, ready for transport.\"")
    ]
    
    for time_cue, visual, speaker in steps_p3:
        block = []
        block.append(Paragraph(f"Time Cue: {time_cue}", time_style))
        block.append(Paragraph(visual, visual_style))
        block.append(Paragraph(f"<b>Voiceover:</b> {speaker}", speaker_style))
        story.append(KeepTogether(block))
        story.append(Spacer(1, 4))
        
    doc.build(story, canvasmaker=NumberedCanvas)
    print("Transporter Voiceover PDF generated successfully.")

if __name__ == '__main__':
    main()
