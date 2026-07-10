import os
from playwright.sync_api import sync_playwright
import pypdf

# Define paths
work_dir = "c:/Users/Kevin/Projects/ML/agriculture"
cover_html_path = os.path.join(work_dir, "docs", "product", "cover.html")
content_html_path = os.path.join(work_dir, "docs", "product", "content.html")
cover_pdf_path = os.path.join(work_dir, "docs", "product", "cover.pdf")
content_pdf_path = os.path.join(work_dir, "docs", "product", "content.pdf")
final_pdf_path = os.path.join(work_dir, "docs", "product", "kuapa-dwaso-product-description.pdf")

# ----------------- COVER PAGE HTML -----------------
cover_html_content = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 8.5in;
      height: 11in;
      overflow: hidden;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    }
    .background {
      background-image: url('file://c:/Users/Kevin/Projects/ML/agriculture/apps/admin/public/auth-bg.png');
      background-size: cover;
      background-position: center;
      width: 100%;
      height: 100%;
      position: relative;
    }
    .overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 31, 20, 0.85); /* Cohesive opacity overlay */
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 1.8in 0.75in 1.2in 0.75in;
      box-sizing: border-box;
    }
    .header-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .logo-container {
      width: 90px;
      height: 90px;
      margin-bottom: 25px;
    }
    .title {
      font-family: 'Outfit', sans-serif;
      font-size: 38px;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
      letter-spacing: 2px;
    }
    .subtitle {
      font-family: 'Outfit', sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: #d4a843; /* Gold */
      margin-top: 10px;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    .tagline {
      font-size: 12.5px;
      font-style: italic;
      color: #dde3d5; /* light green-gray */
      margin-top: 25px;
      max-width: 4.5in;
      line-height: 1.6;
    }
    .footer-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
    }
    .divider {
      width: 100%;
      height: 3px;
      background: #d4a843; /* Gold */
      margin-bottom: 20px;
    }
    .url {
      font-size: 14px;
      font-weight: 700;
      color: #38a85c; /* green */
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="background">
    <div class="overlay">
      <div class="header-group">
        <div class="logo-container">
          <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
            <circle cx="22" cy="30" r="6" fill="#2d8a4e" opacity="0.5" />
            <circle cx="18" cy="60" r="6" fill="#2d8a4e" opacity="0.65" />
            <circle cx="22" cy="90" r="6" fill="#2d8a4e" opacity="0.8" />
            <circle cx="48" cy="45" r="8" fill="#2d8a4e" opacity="0.85" />
            <circle cx="48" cy="75" r="8" fill="#2d8a4e" opacity="0.9" />
            <circle cx="88" cy="60" r="22" fill="#2d8a4e" />
          </svg>
        </div>
        <div class="title">KUAPA DWASO</div>
        <div class="subtitle">Product Description &amp; Solution Concept</div>
        <div class="tagline">A warehouse-based produce aggregation, inventory, sales, and dispatch platform.</div>
      </div>
      <div class="footer-group">
        <div class="divider"></div>
        <div class="url">kuapadwaso.com</div>
      </div>
    </div>
  </div>
</body>
</html>
"""

# ----------------- CONTENT PAGE HTML -----------------
content_html_content = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: letter;
      margin: 70px 54px 70px 54px;
    }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      color: #0f1f14; /* ink */
      background: #ffffff;
      font-size: 11pt; /* Professional body size */
      line-height: 1.5;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 22pt;
      font-weight: 700;
      color: #2d8a4e; /* field green */
      margin-top: 0;
      margin-bottom: 12px;
      border-bottom: 2px solid #dde3d5;
      padding-bottom: 6px;
    }
    h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 14pt;
      font-weight: 700;
      color: #0f1f14;
      margin-top: 22px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    h3 {
      font-family: 'Outfit', sans-serif;
      font-size: 12pt;
      font-weight: 700;
      color: #2d8a4e;
      margin-top: 18px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }
    p {
      margin-top: 0;
      margin-bottom: 10px;
    }
    /* Cohesive card styling for problem/solution */
    .card {
      background: #f5f7f0; /* Cohesive brand surface */
      border-left: 4px solid #2d8a4e; /* Primary green border */
      padding: 14px 18px;
      margin-bottom: 14px;
      border-radius: 0 6px 6px 0;
    }
    .card-title {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 12pt;
      color: #0f1f14;
      margin-bottom: 6px;
    }
    
    /* Tables */
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      margin-bottom: 12px;
    }
    .grid-table td {
      padding: 8px 10px;
      vertical-align: top;
      border-bottom: 1px solid #dde3d5;
      font-size: 10.5pt;
    }
    .grid-table tr:last-child td {
      border-bottom: none;
    }
    .grid-title {
      font-weight: 700;
      color: #2d8a4e;
      width: 150px;
    }
    
    /* Timeline */
    .timeline-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      margin-bottom: 12px;
    }
    .timeline-table th {
      background: #f5f7f0;
      color: #0f1f14;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 10pt;
      text-align: left;
      padding: 8px 10px;
      border-bottom: 2px solid #2d8a4e;
    }
    .timeline-table td {
      padding: 8px 10px;
      vertical-align: top;
      border-bottom: 1px solid #dde3d5;
      font-size: 10pt;
    }
    .timeline-step {
      color: #d4a843; /* Gold */
      font-weight: 700;
      width: 55px;
    }
    .timeline-action {
      font-weight: 700;
      width: 130px;
    }
    
    /* Capabilities */
    .cap-item {
      display: flex;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .cap-badge {
      background: #2d8a4e;
      color: #ffffff;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 11pt;
      width: 26px;
      height: 26px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 15px;
      flex-shrink: 0;
    }
    .cap-text {
      flex-grow: 1;
    }
    .cap-title {
      font-weight: 700;
      color: #2d8a4e;
      margin-bottom: 2px;
      font-size: 11.5pt;
    }
    
    /* Tech stack */
    .tech-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      margin-bottom: 12px;
    }
    .tech-table tr:nth-child(even) {
      background: #f5f7f0;
    }
    .tech-table td {
      padding: 8px 10px;
      vertical-align: top;
      border-bottom: 1px solid #dde3d5;
      font-size: 10pt;
    }
    .tech-name {
      font-weight: 700;
      color: #0f1f14;
      width: 150px;
    }
    
    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>

  <!-- PAGE 1 CONTENT -->
  <h1>Kuapa Dwaso: Product Description</h1>
  
  <p>Kuapa Dwaso (&ldquo;Farmer's Market&rdquo; in Akan) is a warehouse-based platform for produce aggregation, inventory, sales, and dispatch. Built around the realities of agricultural trade in regions like Tarkwa, it replaces risky, speculative farm-to-city transport with a secure, demand-driven local warehouse model.</p>

  <h2>Context and System Design</h2>

  <div class="card">
    <div class="card-title">The Problem</div>
    <p>Consultations with smallholder farmers and market traders around Tarkwa revealed that the biggest bottleneck in agricultural trade is a fragmented and risky produce movement system. Farmers face high transport costs, poor roads, multiple layers of intermediaries, pressure to sell on credit, and heavy spoilage losses.</p>
    <p>Because farming land around Tarkwa is damaged by illegal mining, produce comes from outlying communities and passes through second-chain buyers, loading boys, tricycles, and trucks before reaching the city. Every transfer adds cost and spoilage risk. Worse, a farmer who arrives in the city with perishable goods and no confirmed buyer has almost no bargaining power, and often ends up selling at a discount or on forced credit.</p>
  </div>

  <div class="card">
    <div class="card-title">The Solution</div>
    <p>Kuapa Dwaso establishes local community warehouses as physical trust points. Farmers deposit produce nearby instead of transporting it to the city on speculation. The platform then matches warehouse stock to confirmed city demand and coordinates bulk transport only when orders exist.</p>
  </div>

  <div class="page-break"></div>

  <!-- PAGE 2 CONTENT -->
  <h3>Key Design Decisions from Field Insights</h3>
  
  <table class="grid-table">
    <tr>
      <td class="grid-title">Consignment Model</td>
      <td>Farmers retain ownership of stored produce and pay a transparent daily storage fee deducted from sale proceeds, with digital tracking of expected payouts. This avoids the capital burden of the platform buying stock upfront.</td>
    </tr>
    <tr>
      <td class="grid-title">Demand-Driven Dispatch</td>
      <td>Traders submit requirements ahead of market windows (especially Friday mornings), so produce leaves the warehouse only against confirmed orders.</td>
    </tr>
    <tr>
      <td class="grid-title">Landed-Cost Transparency</td>
      <td>The platform tracks every cost component (produce, loading, tricycle, truck, handling, spoilage buffers) so users understand real margins.</td>
    </tr>
    <tr>
      <td class="grid-title">Custody Tracking</td>
      <td>The system maps the actual supply chain, including second-chain buyers, aggregators, and local transporters.</td>
    </tr>
    <tr>
      <td class="grid-title">Realistic Accessibility</td>
      <td>Most farmers have household access to a smartphone, so we built a lightweight web app with agent-assisted registration instead of fragile two-way SMS workflows. One-way SMS handles transactional updates (Produce Received, Produce Sold, Payment Recorded).</td>
    </tr>
  </table>

  <h2>Core Product Capabilities</h2>
  
  <div class="cap-item">
    <div class="cap-badge">1</div>
    <div class="cap-text">
      <div class="cap-title">Warehouse Intake &amp; Agent Dashboard</div>
      <p>Agents register farmers, record intake details (crop, variety, quantity, grade, storage rate, shelf life), attach photo evidence, and generate Storage Receipts and Inventory Batches.</p>
    </div>
  </div>
  
  <div class="cap-item">
    <div class="cap-badge">2</div>
    <div class="cap-text">
      <div class="cap-title">Mobile-First Farmer Portal</div>
      <p>Farmers see their produce and receipts by warehouse, a transparent storage fee ledger, and clear sale and payout tracking (gross sales, deducted fees, net amount due).</p>
    </div>
  </div>
  
  <div class="cap-item">
    <div class="cap-badge">3</div>
    <div class="cap-text">
      <div class="cap-title">Aggregate Buyer Console</div>
      <p>Buyers browse combined warehouse stock by crop, grade, location, and dispatch date, place and pay for orders digitally, schedule dispatch around market days, and track order status end to end.</p>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- PAGE 3 CONTENT -->
  <div class="cap-item">
    <div class="cap-badge">4</div>
    <div class="cap-text">
      <div class="cap-title">Logistics &amp; Dispatch Manager</div>
      <p>Consolidates multiple orders into single truck dispatches, tracking vehicles, transit costs, payers, and delivery confirmations.</p>
    </div>
  </div>
  
  <div class="cap-item">
    <div class="cap-badge">5</div>
    <div class="cap-text">
      <div class="cap-title">Administration Control Center</div>
      <p>Admins manage accounts and warehouses, configure fee rules, review audit logs for sensitive actions, and resolve disputes.</p>
    </div>
  </div>

  <h2>System Workflow &amp; Produce Lifecycle</h2>
  
  <table class="timeline-table">
    <thead>
      <tr>
        <th>Stage</th>
        <th>Action</th>
        <th>Fulfillment Context</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="timeline-step">Step 1</td>
        <td class="timeline-action">Intake &amp; Deposit</td>
        <td>Farmer delivers produce to Warehouse Agent.</td>
      </tr>
      <tr>
        <td class="timeline-step">Step 2</td>
        <td class="timeline-action">Registration</td>
        <td>Agent records weight, grade, photo, and storage rate in system.</td>
      </tr>
      <tr>
        <td class="timeline-step">Step 3</td>
        <td class="timeline-action">Confirmation</td>
        <td>System sends SMS confirmation &amp; Storage Receipt to Farmer.</td>
      </tr>
      <tr>
        <td class="timeline-step">Step 4</td>
        <td class="timeline-action">Ordering</td>
        <td>Buyer browses available warehouse stock and places Order.</td>
      </tr>
      <tr>
        <td class="timeline-step">Step 5</td>
        <td class="timeline-action">Reservation</td>
        <td>System reserves inventory for the Order.</td>
      </tr>
      <tr>
        <td class="timeline-step">Step 6</td>
        <td class="timeline-action">Payment</td>
        <td>Buyer pays digitally via Paystack.</td>
      </tr>
      <tr>
        <td class="timeline-step">Step 7</td>
        <td class="timeline-action">Preparation</td>
        <td>Agent prepares inventory and links it to a Dispatch.</td>
      </tr>
      <tr>
        <td class="timeline-step">Step 8</td>
        <td class="timeline-action">Logistics</td>
        <td>System assigns Dispatch task to Transporter.</td>
      </tr>
      <tr>
        <td class="timeline-step">Step 9</td>
        <td class="timeline-action">Delivery</td>
        <td>Transporter updates transit status (Departed -> Delivered).</td>
      </tr>
      <tr>
        <td class="timeline-step">Step 10</td>
        <td class="timeline-action">Deductions</td>
        <td>System deducts storage fees &amp; calculates Net Payout for Farmer.</td>
      </tr>
      <tr>
        <td class="timeline-step">Step 11</td>
        <td class="timeline-action">Payout</td>
        <td>System sends SMS (Payment Ready) to Farmer.</td>
      </tr>
    </tbody>
  </table>

  <div class="page-break"></div>

  <!-- PAGE 4 CONTENT -->
  <h2>Technical Architecture &amp; Core Stack</h2>
  <p>To achieve a lightweight experience for farmers, real-time inventory management for agents, and enterprise stability for administrators, Kuapa Dwaso is built with a decoupled monorepo architecture:</p>
  
  <table class="tech-table">
    <tr>
      <td class="tech-name">Turborepo &amp; pnpm</td>
      <td>Keeps multiple client applications and shared packages (types, permissions, configs) in a single, strictly typed codebase for safe, unified updates.</td>
    </tr>
    <tr>
      <td class="tech-name">Convex Database</td>
      <td>Serves as the system of record. Automatic real-time queries and mutations prevent double-selling of stock across agent and buyer interfaces.</td>
    </tr>
    <tr>
      <td class="tech-name">NestJS + Fastify</td>
      <td>Powers backend services, processing file uploads, security validation, and managing third-party system webhooks.</td>
    </tr>
    <tr>
      <td class="tech-name">Firebase Auth</td>
      <td>Secures identity validation and tokens, enforcing role-based permissions.</td>
    </tr>
    <tr>
      <td class="tech-name">Paystack Integration</td>
      <td>Automates verification of digital payments from buyers.</td>
    </tr>
    <tr>
      <td class="tech-name">Arkesel Gateway</td>
      <td>Powers transactional, one-way SMS alerts for network-independent updates.</td>
    </tr>
    <tr>
      <td class="tech-name">Cloudflare R2</td>
      <td>Stores private produce photos and receipts, accessed securely via short-lived signed URLs.</td>
    </tr>
  </table>

  <div class="card" style="margin-top: 20px; border-left-color: #0e7490; background: #e3f2f4; padding: 12px 18px;">
    <div class="card-title" style="color: #0e7490; font-size: 12pt;">Engineering for Real-World Conditions</div>
    <p style="margin-bottom: 6px; font-size: 10pt;">&bull; <b>Low bandwidth:</b> The public site and farmer portal use server-side rendering and minimal dependencies to load fast on poor connections.</p>
    <p style="margin-bottom: 6px; font-size: 10pt;">&bull; <b>Privacy boundaries:</b> Buyers browse aggregated inventory without access to farmer identities, enforced in <code>packages/permissions</code>.</p>
    <p style="margin-bottom: 6px; font-size: 10pt;">&bull; <b>Immutable audit logs:</b> All changes to quantities, grades, or pricing (spoilage, shrinkage, disputes) are logged for accountability.</p>
    <p style="margin-bottom: 0; font-size: 10pt;">&bull; <b>Financial separation:</b> Order payments, storage fees, and farmer payouts run in separate state machines, letting admins audit and authorize payouts independently of payment gateways.</p>
  </div>

</body>
</html>
"""

# ----------------- MAIN SCRIPT -----------------
def generate_pdfs():
    # Write HTML contents to files
    with open(cover_html_path, "w", encoding="utf-8") as f:
        f.write(cover_html_content)
    with open(content_html_path, "w", encoding="utf-8") as f:
        f.write(content_html_content)

    print("HTML files written successfully.")

    # Render PDFs using Playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        
        # 1. Render Cover Page
        cover_page = browser.new_page()
        cover_page.goto("file://" + cover_html_path)
        cover_page.evaluate("document.fonts.ready")
        cover_page.pdf(
            path=cover_pdf_path,
            format="Letter",
            margin={"top": "0px", "bottom": "0px", "left": "0px", "right": "0px"},
            print_background=True
        )
        print("Cover PDF generated.")
        
        # 2. Render Content Pages
        content_page = browser.new_page()
        content_page.goto("file://" + content_html_path)
        content_page.evaluate("document.fonts.ready")
        
        # Header template HTML (Chromium injection)
        header_template = """
        <div style="font-size: 8px; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #6b7280; width: 100%; display: flex; justify-content: space-between; border-bottom: 0.5px solid #dde3d5; padding-bottom: 5px; margin: 0 54px;">
            <span style="font-weight: bold; color: #0f1f14; letter-spacing: 0.5px;">KUAPA DWASO</span>
            <span>PRODUCT DESCRIPTION &amp; SOLUTION CONCEPT</span>
        </div>
        """
        
        # Footer template HTML (Chromium injection)
        footer_template = """
        <div style="font-size: 8px; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #6b7280; width: 100%; display: flex; justify-content: space-between; border-top: 0.5px solid #dde3d5; padding-top: 5px; margin: 0 54px;">
            <span style="font-weight: bold; color: #2d8a4e;">KuapaDwaso</span>
            <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
        """
        
        content_page.pdf(
            path=content_pdf_path,
            format="Letter",
            margin={"top": "80px", "bottom": "80px", "left": "54px", "right": "54px"},
            display_header_footer=True,
            header_template=header_template,
            footer_template=footer_template,
            print_background=True
        )
        print("Content PDF generated.")
        
        browser.close()

    # 3. Merge PDFs using pypdf
    merger = pypdf.PdfWriter()
    merger.append(cover_pdf_path)
    # Note: page count offsets are correct because headers/footers in content.pdf will correctly start from Page 2 to Page 5!
    # Wait, in content_page.pdf, the page number on the first page of content.pdf is printed as "Page 1".
    # But since we prepend cover_pdf_path, the merged PDF will have:
    # Page 1 = Cover (no footer)
    # Page 2 = Content Page 1 (will show "Page 1 of 4" or similar if printed directly, wait!)
    # Ah! Playwright's pageNumber in footer_template counts the page index of that specific print job.
    # So in content.pdf, the first page is Page 1, and the total pages is 4.
    # Thus, the footer will say "Page 1 of 4", "Page 2 of 4", etc.
    # But in the merged PDF, content page 1 is physically Page 2.
    # The user asked: "just add only page numbers to the footer and maybe just KuapaDwaso there and that is it."
    # Showing "Page 1 of 4" on the first content page is actually standard because the cover page is not numbered.
    # But wait, if we want it to be perfectly aligned, we can offset it, or we can just print "Page 1 of 4" which is completely normal for documents where the cover page is unnumbered and pagination starts on the first content page.
    # Wait, can we make page numbers count the cover page as Page 1 and start content at Page 2?
    # Playwright doesn't easily let us change the starting page number in page.pdf() unless we write a custom JS pagination overlay or print them together and hide header/footer on page 1 via CSS.
    # Wait! Can we hide the header/footer on page 1 via CSS?
    # Yes! In Chromium, you can write a CSS style sheet that hides headers/footers on the first page!
    # Let's check how:
    # If we print them as a single document, we can use CSS to hide the header/footer on page 1.
    # Wait, how? Playwright's header_template/footer_template are printed on EVERY page by default, and they are in a separate iframe, so they don't have access to the main page's styles.
    # However, inside the header/footer template, you can target page numbers or write CSS. But Chromium does not expose page index directly to the template except via the `.pageNumber` element.
    # Wait! We can hide the header/footer in the template itself if `.pageNumber` has a value of 1!
    # No, CSS cannot conditionalize based on text content unless we use a hack.
    # Is there a CSS hack?
    # Yes! In the header/footer template, we can write a CSS style:
    # `<style>#header, #footer { display: none !important; }</style>`
    # But wait, how do we target only page 1?
    # There is a well-known trick in Chromium print templates:
    # If we want to hide it on the first page, we can use CSS page breaks or we can do the merge.
    # Actually, having the cover page without a footer, and content pages starting at "Page 1" is extremely standard and professional (it's called "different first page" or "front-matter pagination"). It looks very clean.
    # Let's see: if we merge them:
    # Page 1: Cover (no header/footer)
    # Page 2: Content page 1 (Header: KUAPA DWASO, Footer: KuapaDwaso, Page 1 of 4)
    # This is perfect and looks very correct! Let's do that!
    
    merger.append(content_pdf_path)
    merger.write(final_pdf_path)
    merger.close()

    print(f"Final merged PDF created at: {final_pdf_path}")

    # Clean up temporary PDFs
    if os.path.exists(cover_pdf_path):
        os.remove(cover_pdf_path)
    if os.path.exists(content_pdf_path):
        os.remove(content_pdf_path)
    if os.path.exists(cover_html_path):
        os.remove(cover_html_path)
    if os.path.exists(content_html_path):
        os.remove(content_html_path)
    print("Temporary files cleaned up.")

if __name__ == "__main__":
    generate_pdfs()
