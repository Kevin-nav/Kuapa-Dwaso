import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing, Circle

# Define the custom canvas for two-pass page numbering and background decorations
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
        if page_num == 1:
            # First page - Cover
            bg_path = r"c:\Users\Kevin\Projects\ML\agriculture\apps\admin\public\auth-bg.png"
            if os.path.exists(bg_path):
                self.drawImage(bg_path, 0, 0, width=612, height=792, preserveAspectRatio=False)
            
            # Draw semi-transparent dark green-black overlay (#0f1f14 with opacity 0.82)
            self.saveState()
            self.setFillAlpha(0.82)
            self.setFillColor(colors.HexColor("#0f1f14"))
            self.rect(0, 0, 612, 792, stroke=0, fill=1)
            
            # Gold bottom divider line (#d4a843)
            self.setStrokeColor(colors.HexColor("#d4a843"))
            self.setLineWidth(3)
            self.line(54, 80, 558, 80)
            self.restoreState()
        else:
            # Subsequent pages header and footer
            self.saveState()
            
            # Header
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#0f1f14")) # deep green-black ink
            self.drawString(54, 752, "KUAPA DWASO")
            
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#6b7280")) # gray 500
            self.drawRightString(558, 752, "PRODUCT VISION & SOLUTION CONCEPT")
            
            self.setStrokeColor(colors.HexColor("#dde3d5")) # hairline divider line
            self.setLineWidth(0.5)
            self.line(54, 744, 558, 744)
            
            # Footer
            self.line(54, 52, 558, 52)
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#2d8a4e")) # field green
            self.drawString(54, 38, "KuapaDwaso")
            
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#6b7280"))
            footer_text = f"Page {page_num} of {num_pages}"
            self.drawRightString(558, 38, footer_text)
            
            self.restoreState()

# Helper function to draw the SVG-like logo using vector drawing shapes
def draw_logo(width=100, height=100):
    d = Drawing(width, height)
    scale = width / 120.0
    
    # RGB coordinates from SVG: cx, cy, r
    # Color #2d8a4e: RGB (45, 138, 78)
    def get_color(opacity):
        return colors.Color(45/255.0, 138/255.0, 78/255.0, opacity)

    # Note: SVG y is top-down; ReportLab y is bottom-up. Flip y coordinates (120 - y_svg)
    circles_data = [
        (22, 120 - 30, 6, 0.5),   # circle cx="22" cy="30" r="6" opacity="0.5"
        (18, 120 - 60, 6, 0.65),  # circle cx="18" cy="60" r="6" opacity="0.65"
        (22, 120 - 90, 6, 0.8),   # circle cx="22" cy="90" r="6" opacity="0.8"
        (48, 120 - 45, 8, 0.85),  # circle cx="48" cy="45" r="8" opacity="0.85"
        (48, 120 - 75, 8, 0.9),   # circle cx="48" cy="75" r="8" opacity="0.9"
        (88, 120 - 60, 22, 1.0)   # circle cx="88" cy="60" r="22" opacity="1.0"
    ]

    for cx, cy, r, opacity in circles_data:
        d.add(Circle(cx * scale, cy * scale, r * scale, 
                     fillColor=get_color(opacity), 
                     strokeColor=None))
    return d

def generate_pdf():
    pdf_path = r"c:\Users\Kevin\Projects\ML\agriculture\docs\product\kuapa-dwaso-product-vision.pdf"
    
    # Page Setup
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54, # 0.75 in
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    # Styles
    styles = getSampleStyleSheet()
    
    # Text styles
    body_style = ParagraphStyle(
        'KuapaBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14.5,
        textColor=colors.HexColor("#3a4048"), # gray 700
        spaceAfter=10
    )
    
    body_bold_style = ParagraphStyle(
        'KuapaBodyBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )
    
    title_style = ParagraphStyle(
        'KuapaH1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#2d8a4e"), # field green
        spaceAfter=12,
        keepWithNext=True
    )
    
    h2_style = ParagraphStyle(
        'KuapaH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#0f1f14"), # ink
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )
    
    h3_style = ParagraphStyle(
        'KuapaH3',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14.5,
        textColor=colors.HexColor("#2d8a4e"), # field green
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )
    
    # Cover text styles
    cover_title_style = ParagraphStyle(
        'CoverTitle',
        fontName='Helvetica-Bold',
        fontSize=36,
        leading=42,
        textColor=colors.white,
        alignment=1 # Center
    )
    
    cover_sub_style = ParagraphStyle(
        'CoverSub',
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=20,
        textColor=colors.HexColor("#d4a843"), # Gold accent
        alignment=1,
        spaceBefore=8
    )
    
    cover_tag_style = ParagraphStyle(
        'CoverTag',
        fontName='Helvetica-Oblique',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#dde3d5"), # light green-gray
        alignment=1,
        spaceBefore=12
    )
    
    cover_url_style = ParagraphStyle(
        'CoverURL',
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#38a85c"), # fieldLight
        alignment=1
    )

    story = []

    # ================= COVER PAGE =================
    story.append(Spacer(1, 130))
    
    # Centered Logo
    logo = draw_logo(110, 110)
    logo_table = Table([[logo]], colWidths=[504])
    logo_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(logo_table)
    story.append(Spacer(1, 25))
    
    story.append(Paragraph("KUAPA DWASO", cover_title_style))
    story.append(Paragraph("PRODUCT VISION & SOLUTION CONCEPT", cover_sub_style))
    story.append(Paragraph("A warehouse-based produce aggregation, inventory, sales, and dispatch platform.", cover_tag_style))
    story.append(Spacer(1, 160))
    story.append(Paragraph("kuapadwaso.com", cover_url_style))
    
    story.append(PageBreak())

    # ================= DOCUMENT CONTENT =================
    story.append(Paragraph("Kuapa Dwaso: Product Vision", title_style))
    
    intro_p = ("Kuapa Dwaso (&ldquo;Farmer's Market&rdquo; in Akan) is a warehouse-based platform "
               "for produce aggregation, inventory, sales, and dispatch. Built around the realities of "
               "agricultural trade in regions like Tarkwa, it replaces risky, speculative farm-to-city "
               "transport with a secure, demand-driven local warehouse model.")
    story.append(Paragraph(intro_p, body_style))
    story.append(Spacer(1, 5))

    # --- Problem & Solution Side-by-Side Card Tables ---
    # The Problem Card
    prob_p = Paragraph(
        "<b>The Problem:</b> Consultations with smallholder farmers and market traders around Tarkwa "
        "revealed that the biggest bottleneck in agricultural trade is a fragmented and risky produce movement system. "
        "Farmers face high transport costs, poor roads, multiple layers of intermediaries, pressure to sell on credit, "
        "and heavy spoilage losses.<br/><br/>"
        "Because farming land around Tarkwa is damaged by illegal mining, produce comes from outlying communities "
        "and passes through second-chain buyers, loading boys, tricycles, and trucks. Every transfer adds cost and spoilage risk. "
        "Worse, a farmer who arrives in the city with perishable goods and no buyer has no bargaining power and "
        "often sells on forced credit.",
        body_style
    )
    
    prob_table = Table([[prob_p]], colWidths=[504])
    prob_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#fbeaea")), # dangerBg
        ('LINELEFT', (0,0), (0,-1), 4, colors.HexColor("#b91c1c")), # danger red line
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
        ('RIGHTPADDING', (0,0), (-1,-1), 14),
    ]))
    
    # The Solution Card
    sol_p = Paragraph(
        "<b>The Solution:</b> Kuapa Dwaso establishes local community warehouses as physical trust points. "
        "Farmers deposit produce nearby instead of transporting it to the city on speculation. The platform "
        "matches warehouse stock to confirmed city demand and coordinates bulk transport only when orders exist.",
        body_style
    )
    
    sol_table = Table([[sol_p]], colWidths=[504])
    sol_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#e7f4ec")), # successBg
        ('LINELEFT', (0,0), (0,-1), 4, colors.HexColor("#2d8a4e")), # success green line
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
        ('RIGHTPADDING', (0,0), (-1,-1), 14),
    ]))
    
    story.append(Paragraph("Context and System Design", h2_style))
    story.append(prob_table)
    story.append(Spacer(1, 10))
    story.append(sol_table)
    story.append(Spacer(1, 15))

    # --- Key Design Decisions List Table ---
    story.append(Paragraph("Key Design Decisions from Field Insights", h3_style))
    
    decisions = [
        ("Consignment Model", "Farmers retain ownership of stored produce and pay a transparent daily storage fee deducted from sale proceeds, with digital tracking of expected payouts. This avoids the capital burden of the platform buying stock upfront."),
        ("Demand-Driven Dispatch", "Traders submit requirements ahead of market windows (especially Friday mornings), so produce leaves the warehouse only against confirmed orders."),
        ("Landed-Cost Transparency", "The platform tracks every cost component (produce, loading, tricycle, truck, handling, spoilage buffers) so users understand real margins."),
        ("Custody Tracking", "The system maps the actual supply chain, including second-chain buyers, aggregators, and local transporters."),
        ("Realistic Accessibility", "Most farmers have household access to a smartphone, so we built a lightweight web app with agent-assisted registration instead of fragile two-way SMS workflows. One-way SMS handles transactional updates (Produce Received, Produce Sold, Payment Recorded).")
    ]
    
    dec_cells = []
    for title, desc in decisions:
        t_cell = Paragraph(f"<b>{title}</b>", body_bold_style)
        d_cell = Paragraph(desc, body_style)
        dec_cells.append([t_cell, d_cell])
        
    dec_table = Table(dec_cells, colWidths=[140, 364])
    dec_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#dde3d5")),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    
    story.append(dec_table)
    story.append(PageBreak())

    # ================= PAGE 3 =================
    story.append(Paragraph("Core Product Capabilities", h2_style))
    
    capabilities = [
        ("1", "Warehouse Intake & Agent Dashboard", 
         "Agents register farmers, record intake details (crop, variety, quantity, grade, storage rate, shelf life), attach photo evidence, and generate Storage Receipts and Inventory Batches."),
        ("2", "Mobile-First Farmer Portal", 
         "Farmers see their produce and receipts by warehouse, a transparent storage fee ledger, and clear sale and payout tracking (gross sales, deducted fees, net amount due)."),
        ("3", "Aggregate Buyer Console", 
         "Buyers browse combined warehouse stock by crop, grade, location, and dispatch date, place and pay for orders digitally, schedule dispatch around market days, and track order status end to end."),
        ("4", "Logistics & Dispatch Manager", 
         "Consolidates multiple orders into single truck dispatches, tracking vehicles, transit costs, payers, and delivery confirmations."),
        ("5", "Administration Control Center", 
         "Admins manage accounts and warehouses, configure fee rules, review audit logs for sensitive actions, and resolve disputes.")
    ]
    
    cap_cells = []
    for num, title, desc in capabilities:
        badge_html = f"<font color='white'><b>{num}</b></font>"
        # Draw a small badge cell
        num_cell = Table([[Paragraph(badge_html, ParagraphStyle('badge', fontName='Helvetica-Bold', fontSize=11, alignment=1, textColor=colors.white))]], colWidths=[24])
        num_cell.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#2d8a4e")),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        
        content = Paragraph(f"<b>{title}</b><br/>{desc}", body_style)
        cap_cells.append([num_cell, content])
        
    cap_table = Table(cap_cells, colWidths=[36, 468])
    cap_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(cap_table)
    story.append(Spacer(1, 10))

    # --- System Workflow Table ---
    story.append(Paragraph("System Workflow & Produce Lifecycle", h2_style))
    
    workflow_steps = [
        ("Step 1", "Intake & Deposit", "Farmer delivers produce to Warehouse Agent."),
        ("Step 2", "Registration", "Agent records weight, grade, photo, and storage rate in system."),
        ("Step 3", "Confirmation", "System sends SMS confirmation & Storage Receipt to Farmer."),
        ("Step 4", "Ordering", "Buyer browses available warehouse stock and places Order."),
        ("Step 5", "Reservation", "System reserves inventory for the Order."),
        ("Step 6", "Payment", "Buyer pays digitally via Paystack."),
        ("Step 7", "Preparation", "Agent prepares inventory and links it to a Dispatch."),
        ("Step 8", "Logistics", "System assigns Dispatch task to Transporter."),
        ("Step 9", "Delivery", "Transporter updates transit status (Departed -> Delivered)."),
        ("Step 10", "Deductions", "System deducts storage fees & calculates Net Payout for Farmer."),
        ("Step 11", "Payout", "System sends SMS (Payment Ready) to Farmer.")
    ]
    
    wf_cells = []
    # Table headers
    wf_cells.append([
        Paragraph("<b>Stage</b>", ParagraphStyle('HCol1', fontName='Helvetica-Bold', fontSize=9.5, textColor=colors.HexColor("#0f1f14"))),
        Paragraph("<b>Action</b>", ParagraphStyle('HCol2', fontName='Helvetica-Bold', fontSize=9.5, textColor=colors.HexColor("#0f1f14"))),
        Paragraph("<b>Fulfillment Context</b>", ParagraphStyle('HCol3', fontName='Helvetica-Bold', fontSize=9.5, textColor=colors.HexColor("#0f1f14")))
    ])
    
    for step, name, desc in workflow_steps:
        wf_cells.append([
            Paragraph(f"<font color='#d4a843'><b>{step}</b></font>", body_bold_style),
            Paragraph(f"<b>{name}</b>", body_style),
            Paragraph(desc, body_style)
        ])
        
    wf_table = Table(wf_cells, colWidths=[55, 115, 334])
    wf_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f5f7f0")), # surface
        ('LINEBELOW', (0,0), (-1,0), 1, colors.HexColor("#2d8a4e")), # green divider
        ('LINEBELOW', (0,1), (-1,-1), 0.5, colors.HexColor("#dde3d5")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    
    story.append(wf_table)
    story.append(PageBreak())

    # ================= PAGE 4 =================
    story.append(Paragraph("Technical Architecture & Core Stack", h2_style))
    story.append(Paragraph(
        "To achieve a lightweight experience for farmers, real-time inventory management for agents, "
        "and enterprise stability for administrators, Kuapa Dwaso is built with a decoupled monorepo architecture:",
        body_style
    ))
    
    tech_stack = [
        ("Turborepo + pnpm", "Keeps multiple client applications and shared packages (types, permissions, configs) in a single, strictly typed codebase for safe, unified updates."),
        ("Convex Database", "Serves as the system of record. Automatic real-time queries and mutations prevent double-selling of stock across agent and buyer interfaces."),
        ("NestJS + Fastify", "Powers backend services, processing file uploads, security validation, and managing third-party system webhooks."),
        ("Firebase Auth", "Secures identity validation and tokens, enforcing role-based permissions."),
        ("Paystack Integration", "Automates verification of digital payments from buyers."),
        ("Arkesel Gateway", "Powers transactional, one-way SMS alerts for network-independent updates."),
        ("Cloudflare R2", "Stores private produce photos and receipts, accessed securely via short-lived signed URLs.")
    ]
    
    tech_cells = []
    for tech, desc in tech_stack:
        tech_cells.append([
            Paragraph(f"<b>{tech}</b>", body_bold_style),
            Paragraph(desc, body_style)
        ])
        
    tech_table = Table(tech_cells, colWidths=[140, 364])
    tech_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.white, colors.HexColor("#f5f7f0")]),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#dde3d5")),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(tech_table)
    story.append(Spacer(1, 15))

    # --- Engineering Callout Table ---
    eng_title = Paragraph("<b>Engineering for Real-World Conditions</b>", ParagraphStyle('EngTitle', fontName='Helvetica-Bold', fontSize=11, textColor=colors.HexColor("#0e7490")))
    eng_p = Paragraph(
        "&bull; <b>Low bandwidth:</b> The public site and farmer portal use server-side rendering and minimal dependencies to load fast on poor connections.<br/>"
        "&bull; <b>Privacy boundaries:</b> Buyers browse aggregated inventory without access to farmer identities, enforced in <code>packages/permissions</code>.<br/>"
        "&bull; <b>Immutable audit logs:</b> All changes to quantities, grades, or pricing (spoilage, shrinkage, disputes) are logged for accountability.<br/>"
        "&bull; <b>Financial separation:</b> Order payments, storage fees, and farmer payouts run in separate state machines, letting admins audit and authorize payouts independently of payment gateways.",
        body_style
    )
    
    eng_content = Table([[eng_title], [eng_p]], colWidths=[504])
    eng_content.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#e3f2f4")), # infoBg
        ('LINELEFT', (0,0), (0,-1), 4, colors.HexColor("#0e7490")), # sky/info blue line
        ('TOPPADDING', (0,0), (-1,0), 10),
        ('BOTTOMPADDING', (0,0), (-1,0), 2),
        ('TOPPADDING', (0,1), (-1,1), 2),
        ('BOTTOMPADDING', (0,1), (-1,1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
        ('RIGHTPADDING', (0,0), (-1,-1), 14),
    ]))
    
    story.append(eng_content)

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
    print("PDF generation complete.")

if __name__ == "__main__":
    generate_pdf()
