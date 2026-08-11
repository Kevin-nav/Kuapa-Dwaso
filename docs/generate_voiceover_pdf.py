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
        self.drawRightString(558, 752, "VOICEOVER SCRIPT - OPERATIONS & INTAKE")
        
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
    pdf_path = r"c:\Users\Kevin\Projects\ML\agriculture\docs\Kuapa-Dwaso-Operations-Voiceover-Script.pdf"
    
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
    
    story.append(Paragraph("Kuapa Dwaso Operations Voiceover Script", title_style))
    story.append(Paragraph("Timed to sync with screen recordings of the Operations Console", subtitle_style))
    story.append(Spacer(1, 10))
    
    # Part 1 Header
    story.append(Paragraph("Part 1: Produce Intake Walkthrough", heading_style))
    story.append(Paragraph("Video Source: <i>produce intake.mp4</i> | Duration: 1m 35s", subtitle_style))
    
    # Part 1 steps
    steps_p1 = [
        ("00:00 - 00:12", 
         "Visual: Operations Console dashboard shows today's intakes, expiring batches, and active counts. The agent clicks '+ New Produce Intake'.",
         "\"Welcome to the Kuapa Dwaso Operations Console. This is the dashboard where warehouse agents run daily intake and manage stored produce. =\""),
        
        ("00:12 - 00:26",
         "Visual: Step 1: 'IDENTIFY PRODUCER'. Agent searches and selects farmer Osei Andrews, confirming Tarkwa warehouse. Clicks continue.",
         "\"First, we identify the producer(which is our farmer) in this case, Osei Andrews—and select the receiving community warehouse. This links the deposit directly to the farmer's account.\""),
        
        ("00:26 - 00:35",
         "Visual: Step 2: 'SELECT CROP TYPE'. Agent selects Cassava, sets Grade A, and checks condition tags: mixed sizes, well dried, insect free.",
         "\"Next, we enter the crop details. The agent here selects Cassava, grades it and checks off quality tags like 'well dried' and 'insect-free' to establish a clear quality baseline.\""),
        
        ("00:35 - 00:56",
         "Visual: Step 3: Intake quantity (500 tubers), shelf life (30 days), daily storage fee (GHS 0.20), and asking/minimum pricing terms are input.",
         "\"We then enter the quantity—500 tubers—and specify the storage terms. The system calculates the sell-by date based on a 30-day shelf life. We set a transparent storage fee of 20 pesewas per day and record the farmer's asking price terms.\""),
        
        ("00:56 - 01:07",
         "Visual: Step 4: 'PRODUCE PHOTO'. Agent uploads a file. A preview of fresh cassava tubers appears.",
         "\"To prevent quality disputes, the agent uploads a photo of the produce as physical evidence. This photo is linked permanently to this specific batch.\""),
        
        ("01:07 - 01:15",
         "Visual: Agent reviews 'INTAKE VERIFICATION' screen with all terms summarized, then clicks 'Confirm & Create Receipt'.",
         "\"We do a final review of the intake terms with the farmer, confirming the storage rates and asking prices, and click 'Confirm & Create Receipt' to write the transaction to our ledger.\""),
        
        ("01:15 - 01:23",
         "Visual: 'Receipt Created Successfully' screen appears showing receipt code WH-WHTKW001-779443.",
         "\"The platform generates a unique, tamper-proof Receipt Code. Simultaneously, an SMS notification containing the receipt details is sent to the farmer's phone.\""),
        
        ("01:23 - 01:35",
         "Visual: Agent navigates to 'Inventory' tab, expands the new Cassava batch, and clicks 'List for Sale'. The status changes to 'AVAILABLE'.",
         "\"Finally, we navigate to our active inventory. Here is our Cassava batch. The agent clicks 'List for Sale' to instantly publish this verified warehouse stock to our buyer marketplace, ready for orders.\"")
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
    story.append(Paragraph("Part 2: Change Status of Inventory", heading_style))
    story.append(Paragraph("Video Source: <i>chnage status of inventory.mp4</i> | Duration: 33s", subtitle_style))
    story.append(Spacer(1, 10))
    
    steps_p2 = [
        ("00:00 - 00:05",
         "Visual: Inventory list view. Agent selects the Maize batch for Osei Andrews (150 bags, status AVAILABLE).",
         "\"In this clip, we'll look at how we manage inventory status. The agent goes to the inventory list and opens the active Maize batch for Osei Andrews.\""),
        
        ("00:05 - 00:18",
         "Visual: Agent clicks 'Change Status', selects 'withdrawn' from dropdown, and types reason: 'Farmer decided to withdraw'.",
         "\"If a farmer decides to take back unsold crop, the agent clicks 'Change Status,' changes the status to 'withdrawn,' and types in the reason for the audit trail.\""),
        
        ("00:18 - 00:33",
         "Visual: Agent clicks 'Commit Status'. Timeline updates with 'Status changed to withdrawn: Farmer decided to withdraw'.",
         "\"Once committed, the system calculates any outstanding storage fees, updates the status, and logs a permanent entry in the batch history timeline. This ensures total audit accountability at every step.\"")
    ]
    
    for time_cue, visual, speaker in steps_p2:
        block = []
        block.append(Paragraph(f"Time Cue: {time_cue}", time_style))
        block.append(Paragraph(visual, visual_style))
        block.append(Paragraph(f"<b>Voiceover:</b> {speaker}", speaker_style))
        story.append(KeepTogether(block))
        story.append(Spacer(1, 4))
        
    doc.build(story, canvasmaker=NumberedCanvas)
    print("Voiceover PDF generated successfully.")

if __name__ == '__main__':
    main()
