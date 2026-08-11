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
        self.drawRightString(558, 752, "VOICEOVER SCRIPT - ADMIN CONSOLE")
        
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
    pdf_path = r"c:\Users\Kevin\Projects\ML\agriculture\docs\Kuapa-Dwaso-Admin-Voiceover-Script.pdf"
    
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
    
    story.append(Paragraph("Kuapa Dwaso Admin Voiceover Script", title_style))
    story.append(Paragraph("Timed to sync with screen recordings of the Admin Control Center", subtitle_style))
    story.append(Spacer(1, 10))
    
    # Part 1 Header
    story.append(Paragraph("Part 1: Sign-In & MFA", heading_style))
    story.append(Paragraph("Video Source: <i>authentication flow</i> | Duration: 49s", subtitle_style))
    
    steps_p1 = [
        ("00:00 - 00:15", 
         "Visual: Desktop opens browser showing 'KuapaDweso Admin' sign-in page with slogan 'Control the market. Verify the harvest.' User clicks 'Continue with Google' and selects the account for Kevin Nchorbuno.",
         "\"Accessing the platform's control center begins at the Admin sign-in portal. Authentication is managed through Firebase, allowing administrators to sign in securely using Google Identity Services.\""),
        
        ("00:16 - 00:45",
         "Visual: Page requests MFA code. User types in code 051230 to verify identity.",
         "\"To protect critical agricultural data and operations, we enforce Multi-Factor Authentication. We input our secure one-time verification code to satisfy the two-factor authentication challenge.\""),
        
        ("00:46 - 00:49",
         "Visual: Access is granted to the Admin Control Center. Clicks green 'Enter Dashboard' button.",
         "\"With verification successful, the Firebase ID token is authenticated against the API service, resolving our active admin profile and loading the control center.\"")
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
    story.append(Paragraph("Part 2: Operations Dashboard & Inventory", heading_style))
    story.append(Paragraph("Video Source: <i>overview stats & lot Oversight</i> | Duration: 29s", subtitle_style))
    story.append(Spacer(1, 10))
    
    steps_p2 = [
        ("00:50 - 00:56",
         "Visual: Operations Overview dashboard loads. Displays total warehouses (7), active inventory (950 bags), disputes (0), and recent logs (59).",
         "\"The main operations overview dashboard aggregates live statistics from across our warehouses. In real-time, the system displays our active depots, current grain stock volumes, unresolved disputes, and system logs.\""),
        
        ("00:57 - 01:11",
         "Visual: Clicks 'Inventory' tab. Table 'Inventory Lot Oversight' loads. Clicks first item (Receipt WH-WHTKW001-002004 for Osei Andrews) to show right drawer and clicks its tabs (Lot Details, Fee Ledger, Change Audit).",
         "\"On the Inventory Oversight tab, we have full view of all stored lots. Selecting a batch code pulls up its side panel drawer. Here, admins can inspect the specific grade, track daily storage fee accumulations, and audit every historical status change logged in the Convex timeline.\""),
        
        ("01:12 - 01:19",
         "Visual: Clicks 'Orders' tab, loading the Orders Ledger. Clicks Kevin Amisom's Cassava order to review fulfillment.",
         "\"The Orders tab displays the contract ledger. Clicking an order reveals its live fulfillment status, verifying details like locked stock reservations, payments, and dispatch routing.\"")
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
    story.append(Paragraph("Part 3: Finance, Directories & Operations Management", heading_style))
    story.append(Paragraph("Video Source: <i>people oversight & warehouse config</i> | Duration: 50s", subtitle_style))
    story.append(Spacer(1, 10))
    
    steps_p3 = [
        ("01:20 - 01:23",
         "Visual: Clicks Sales, Finance, and Dispatch tabs, showing 'No records found'.",
         "\"For financial and logistics auditing, the Sales, Finance, and Dispatch tables act as the source of truth, tracking payment settlements and cargo movements.\""),
        
        ("01:24 - 01:42",
         "Visual: Directory navigation: Farmers (Osei Andrews profile), Buyers (Catherine Bruce and Kevin Amisom profiles), Agents (Kevin Amisom assigned to 7 warehouses).",
         "\"Our directory tabs allow us to oversee all actors. We can review farmer registrations, manage buyer profiles, and track our warehouse agents, verifying their assigned community warehouses and permissions.\""),
        
        ("01:43 - 01:52",
         "Visual: Under Configuration, opens 'Access', navigating inner tabs: Invites, Admin Users, Groups, Permission Preview.",
         "\"Under Access Configuration, the system manages role-based access controls and invite logs, letting us issue and audit platform tokens.\""),
        
        ("01:53 - 02:10",
         "Visual: Clicks 'Warehouses' and selects 'Tarkwa Community Warehouse'. Inner tabs: Profile, Capacity, Agents, Schedule. On schedule tab, clicks orange 'Maintenance' button, warning popup triggers, clicks 'Cancel'.",
         "\"In the Warehouses directory, we oversee all physical storage assets. If a depot requires repairs, the admin can trigger a maintenance state. The platform warns us that changing this status impacts active intakes and listings, prompting a confirmation before committing the update.\"")
    ]
    
    for time_cue, visual, speaker in steps_p3:
        block = []
        block.append(Paragraph(f"Time Cue: {time_cue}", time_style))
        block.append(Paragraph(visual, visual_style))
        block.append(Paragraph(f"<b>Voiceover:</b> {speaker}", speaker_style))
        story.append(KeepTogether(block))
        story.append(Spacer(1, 4))
        
    story.append(PageBreak())

    # Part 4 Header
    story.append(Paragraph("Part 4: Governance & Reports", heading_style))
    story.append(Paragraph("Video Source: <i>governance metrics & activity timelines</i> | Duration: 26s", subtitle_style))
    story.append(Spacer(1, 10))
    
    steps_p4 = [
        ("02:11 - 02:15",
         "Visual: Clicks 'Fee Rules' and 'Disputes' under Governance.",
         "\"Governance modules handle our operational fee rules and dispute resolutions, ensuring all parties adhere to verified terms.\""),
        
        ("02:16 - 02:20",
         "Visual: Clicks 'Notifications' (automated logs) and 'Audit Logs' (actor timeline).",
         "\"The platform registers all transaction logs and audit logs. This creates a tamper-proof record of every system event, trace, and status update for absolute accountability.\""),
        
        ("02:21 - 02:36",
         "Visual: Clicks 'Reports', showcasing high-level summaries and capacities, then returns to OBS to stop recording.",
         "\"Finally, the Reports portal generates executive breakdowns of storage utilization and financials. This comprehensive view ensures that Kuapa Dwaso remains structured, audited, and optimized from end to end.\"")
    ]
    
    for time_cue, visual, speaker in steps_p4:
        block = []
        block.append(Paragraph(f"Time Cue: {time_cue}", time_style))
        block.append(Paragraph(visual, visual_style))
        block.append(Paragraph(f"<b>Voiceover:</b> {speaker}", speaker_style))
        story.append(KeepTogether(block))
        story.append(Spacer(1, 4))
        
    doc.build(story, canvasmaker=NumberedCanvas)
    print("Admin Voiceover PDF generated successfully.")

if __name__ == '__main__':
    main()
