#!/usr/bin/env python3
"""Generate the branded Kuapa Flow Feasibility & Data Strategy PDF.

This script converts docs/intent-and-initial-plans/Kuapa_Flow_Feasibility_and_Data_Strategy.md
into an executive-grade PDF using the Kuapa Dwaso brand design standards,
replacing all plain ASCII/text diagrams with custom SVG and CSS diagrams.

Usage:
    python docs/tools/generate_kuapa_flow_pdf.py
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
import pypdf

REPO_ROOT = Path(__file__).resolve().parents[2]
INPUT_MD = REPO_ROOT / "docs" / "intent-and-initial-plans" / "Kuapa_Flow_Feasibility_and_Data_Strategy.md"
OUTPUT_DIR = REPO_ROOT / "output" / "pdf"
OUTPUT_PDF = OUTPUT_DIR / "kuapa-flow-feasibility-and-data-strategy.pdf"
DOCS_PDF = REPO_ROOT / "docs" / "intent-and-initial-plans" / "Kuapa_Flow_Feasibility_and_Data_Strategy.pdf"
COVER_IMAGE = REPO_ROOT / "docs" / "blog-drafts" / "images" / "5.png"

# Temporary build paths
TMP_DIR = REPO_ROOT / "tmp" / "kuapa_flow_render"
TMP_DIR.mkdir(parents=True, exist_ok=True)
COVER_HTML_PATH = TMP_DIR / "cover.html"
CONTENT_HTML_PATH = TMP_DIR / "content.html"
COVER_PDF_PATH = TMP_DIR / "cover.pdf"
CONTENT_PDF_PATH = TMP_DIR / "content.pdf"

# ----------------- COVER PAGE HTML -----------------
COVER_HTML = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}
    body {{
      width: 8.5in;
      height: 11in;
      overflow: hidden;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      background: #0F1F14;
    }}
    .cover-container {{
      position: relative;
      width: 100%;
      height: 100%;
      background-image: url('{COVER_IMAGE.as_uri()}');
      background-size: cover;
      background-position: center;
    }}
    .overlay {{
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(15, 31, 20, 0.88) 0%, rgba(15, 31, 20, 0.94) 100%);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
      padding: 1.5in 0.85in 0.9in 0.85in;
    }}
    .logo-box {{
      width: 88px;
      height: 88px;
      margin-bottom: 24px;
    }}
    .main-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 38px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: 2px;
      margin-bottom: 12px;
      line-height: 1.1;
    }}
    .subtitle {{
      font-family: 'Outfit', sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: #D4A843;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      margin-bottom: 16px;
    }}
    .tagline {{
      font-size: 13px;
      line-height: 1.6;
      color: #DDE3D5;
      max-width: 5.2in;
      font-weight: 400;
      margin: 0 auto;
    }}
    .meta-box {{
      margin-top: 36px;
      font-size: 11px;
      color: #DDE3D5;
      line-height: 1.7;
    }}
    .meta-box strong {{
      color: #FFFFFF;
    }}
    .footer-divider {{
      width: 100%;
      height: 2.4px;
      background: #D4A843;
      margin-bottom: 20px;
    }}
    .footer-url {{
      font-size: 12px;
      font-weight: 700;
      color: #38A85C;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }}
  </style>
</head>
<body>
  <div class="cover-container">
    <div class="overlay">
      <div>
        <div class="logo-box">
          <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:100%;">
            <circle cx="22" cy="30" r="6" fill="#2d8a4e" opacity="0.5" />
            <circle cx="18" cy="60" r="6" fill="#2d8a4e" opacity="0.65" />
            <circle cx="22" cy="90" r="6" fill="#2d8a4e" opacity="0.8" />
            <circle cx="48" cy="45" r="8" fill="#2d8a4e" opacity="0.85" />
            <circle cx="48" cy="75" r="8" fill="#2d8a4e" opacity="0.9" />
            <circle cx="88" cy="60" r="22" fill="#2d8a4e" />
          </svg>
        </div>
        <h1 class="main-title">KUAPA DWASO</h1>
        <div class="subtitle">KUAPA FLOW — FEASIBILITY &amp; DATA STRATEGY</div>
        <p class="tagline">
          Adaptive Agricultural Fulfilment &amp; Coordination Intelligence: A mathematically defensible, multi-stage decision architecture for produce aggregation.
        </p>

        <div class="meta-box">
          <div><strong>Prepared:</strong> 29 August 2026 &nbsp;|&nbsp; <strong>Status:</strong> Feasibility &amp; Data Strategy</div>
          <div>Kuapa Dwaso • Western Region, Ghana</div>
        </div>
      </div>

      <div style="width:100%;">
        <div class="footer-divider"></div>
        <div class="footer-url">KUAPADWASO.COM</div>
      </div>
    </div>
  </div>
</body>
</html>
"""

def build_content_html():
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    @page {
      size: letter;
      margin: 64px 54px 64px 54px;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      color: #3A4048;
      background: #FFFFFF;
      font-size: 9.6pt;
      line-height: 1.5;
      margin: 0;
      padding: 0;
    }

    /* SVG Icon styles */
    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      margin-right: 5px;
      flex-shrink: 0;
    }

    /* Headings */
    h1.doc-title {
      font-family: 'Outfit', sans-serif;
      font-size: 22pt;
      font-weight: 800;
      color: #2D8A4E;
      margin: 0 0 6px 0;
      line-height: 1.15;
    }
    .doc-meta-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 8.6pt;
      color: #6B7280;
      padding-bottom: 10px;
      border-bottom: 2px solid #D4A843;
      margin-bottom: 16px;
    }
    .doc-meta-strip strong {
      color: #0F1F14;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 20px;
      margin-bottom: 10px;
      break-after: avoid;
    }
    .section-num {
      background: #0F1F14;
      color: #D4A843;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 9.5pt;
      padding: 3px 8px;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .section-title {
      font-family: 'Outfit', sans-serif;
      font-size: 13pt;
      font-weight: 700;
      color: #0F1F14;
      margin: 0;
      line-height: 1.2;
    }

    h3.sub-title {
      font-family: 'Outfit', sans-serif;
      font-size: 10.8pt;
      font-weight: 700;
      color: #2D8A4E;
      margin-top: 14px;
      margin-bottom: 6px;
      break-after: avoid;
    }
    h4.sub-sub-title {
      font-family: 'Outfit', sans-serif;
      font-size: 9.6pt;
      font-weight: 700;
      color: #0F1F14;
      margin-top: 10px;
      margin-bottom: 4px;
      break-after: avoid;
    }

    p {
      margin-top: 0;
      margin-bottom: 8px;
    }

    /* Clean modern cards without sidebars */
    .card {
      background: #F5F7F0;
      border: 1px solid #DDE3D5;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 10px;
      break-inside: avoid;
    }
    .card-gold { background: #FAF8F2; border-color: #EBDCB9; }
    .card-info { background: #EBF5F8; border-color: #C3E2ED; }
    .card-danger { background: #FDF4F4; border-color: #F8D0D0; }
    .card-success { background: #F2F9F4; border-color: #CDE8D5; }

    .quote-box {
      background: #F5F7F0;
      border: 1px solid #DDE3D5;
      padding: 10px 14px;
      margin: 8px 0 10px 0;
      border-radius: 6px;
      font-size: 9.6pt;
      color: #0F1F14;
      font-weight: 500;
      font-style: italic;
      break-inside: avoid;
    }

    /* Grid Layouts */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 10px;
      break-inside: avoid;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-bottom: 10px;
      break-inside: avoid;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 8px;
      margin-bottom: 10px;
      break-inside: avoid;
    }

    /* Tables */
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 12px 0;
      font-size: 8.6pt;
      break-inside: avoid;
    }
    table.data-table th {
      background: #0F1F14;
      color: #FFFFFF;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #0F1F14;
    }
    table.data-table td {
      padding: 5px 8px;
      border: 1px solid #DDE3D5;
      vertical-align: top;
    }
    table.data-table tr:nth-child(even) td {
      background: #F5F7F0;
    }

    /* Badges */
    .badge {
      display: inline-block;
      font-size: 7.5pt;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-green { background: #E7F4EC; color: #2D8A4E; border: 1px solid #C3E6D0; }
    .badge-gold { background: #FEF3D6; color: #B45309; border: 1px solid #FDE68A; }
    .badge-blue { background: #E0F2FE; color: #0369A1; border: 1px solid #BAE6FD; }
    .badge-red { background: #FEE2E2; color: #B91C1C; border: 1px solid #FECACA; }
    .badge-gray { background: #F3F4F6; color: #4B5563; border: 1px solid #E5E7EB; }

    /* Lists */
    ul.styled-list, ol.styled-list {
      margin: 0 0 8px 0;
      padding-left: 18px;
    }
    ul.styled-list li, ol.styled-list li {
      margin-bottom: 3px;
    }

    .avoid-break {
      break-inside: avoid;
    }

    /* Architecture Diagram */
    .arch-diagram {
      background: #F5F7F0;
      border: 1px solid #DDE3D5;
      border-radius: 8px;
      padding: 12px;
      margin: 10px 0 14px 0;
      break-inside: avoid;
    }
    .arch-grid {
      display: grid;
      grid-template-columns: 1.2fr auto 1.3fr auto 1.25fr;
      align-items: center;
      gap: 8px;
    }
    .arch-column {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .arch-node {
      background: #FFFFFF;
      border: 1px solid #DDE3D5;
      border-radius: 4px;
      padding: 5px 8px;
      font-size: 7.8pt;
      font-weight: 600;
      color: #0F1F14;
      display: flex;
      align-items: center;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .arch-core {
      background: #0F1F14;
      border: 1.5px solid #D4A843;
      border-radius: 6px;
      padding: 8px 8px;
      text-align: center;
      color: #FFFFFF;
    }
    .arch-arrow {
      color: #2D8A4E;
      font-size: 14pt;
      font-weight: bold;
      text-align: center;
    }

    .metric-card {
      background: #FFFFFF;
      border: 1px solid #DDE3D5;
      border-radius: 6px;
      padding: 8px 10px;
      break-inside: avoid;
    }

    .pipeline-stage {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 6px 9px;
      background: #FFFFFF;
      border: 1px solid #DDE3D5;
      border-radius: 6px;
      margin-bottom: 5px;
      break-inside: avoid;
    }
    .pipeline-num {
      background: #2D8A4E;
      color: #FFFFFF;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 8.2pt;
      padding: 2px 6px;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .pipeline-content {
      flex: 1;
    }
    .pipeline-title {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 9pt;
      color: #0F1F14;
      margin-bottom: 2px;
    }
    .pipeline-desc {
      font-size: 8.2pt;
      color: #4B5563;
      margin: 0;
    }

    /* Optimality Gap Chart */
    .bar-chart-card {
      background: #FFFFFF;
      border: 1px solid #DDE3D5;
      border-radius: 8px;
      padding: 12px 14px;
      margin: 10px 0 12px 0;
      break-inside: avoid;
    }
    .bar-row {
      display: grid;
      grid-template-columns: 140px 1fr 90px;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
      font-size: 8.5pt;
    }
    .bar-track {
      background: #F3F4F6;
      border-radius: 4px;
      height: 18px;
      overflow: hidden;
      display: flex;
    }
    .bar-fill-opt { background: #2D8A4E; height: 100%; }
    .bar-fill-kf { background: #38A85C; height: 100%; }
    .bar-fill-heur { background: #D4A843; height: 100%; }

    /* Code/Schema Container */
    .schema-box {
      background: #0F1F14;
      border: 1px solid #2D8A4E;
      border-radius: 6px;
      padding: 8px 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.8pt;
      color: #E7EFE4;
      line-height: 1.35;
      margin-bottom: 8px;
      break-inside: avoid;
    }
  </style>
</head>
<body>

  <!-- DOCUMENT HEADER -->
  <h1 class="doc-title">Kuapa Flow — Feasibility &amp; Data Strategy</h1>
  <div class="doc-meta-strip">
    <span><strong>Project:</strong> Kuapa Dwaso</span>
    <span><strong>Concept:</strong> Adaptive Agricultural Fulfilment &amp; Coordination Intelligence</span>
    <span><strong>Date:</strong> 29 August 2026</span>
    <span><strong>Status:</strong> <span class="badge badge-gold">Competition Feasibility Concept</span></span>
  </div>

  <!-- SECTION 1 -->
  <div class="section-header">
    <span class="section-num">01</span>
    <h2 class="section-title">Executive Summary</h2>
  </div>

  <p>Kuapa Flow is proposed as the operational intelligence layer beneath Kuapa Dwaso's agricultural aggregation model.</p>

  <p>Rather than adding a generic chatbot, an image classifier, or an ML feature that depends on operational transaction history Kuapa does not yet possess, Kuapa Flow focuses first on a problem that exists immediately when fragmented farmer supply must satisfy real buyer demand:</p>

  <div class="quote-box">
    &ldquo;Given available produce across multiple farmers and locations, buyer orders, prices, aggregation points, transport constraints, capacity limits, and deadlines, what fulfilment plan gives the best business outcome?&rdquo;
  </div>

  <p>The core system uses <strong>constraint optimisation, graph/network reasoning, scheduling, and later predictive machine learning where prediction is genuinely useful</strong>.</p>

  <div class="card">
    <div style="font-family:'Outfit',sans-serif; font-weight:700; font-size:9.8pt; color:#2D8A4E; margin-bottom:3px;">
      <span class="icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></span>
      Feasibility Advantage: Zero Historical Data Cold-Start
    </div>
    <p style="margin-bottom:0; font-size:8.8pt;">
      The initial Kuapa Flow engine does <strong>not require months of historical Kuapa data</strong>. It makes decisions from the <em>current state</em> of the network: what buyers require, what farmers have, actor locations, asking/offer prices, vehicle &amp; warehouse capacities, delivery deadlines, road travel times, and handling costs. Historical and public datasets are added incrementally for market price seasonality, cost estimation, supplier reliability, and demand forecasting.
    </p>
  </div>

  <h3 class="sub-title">Competition Strategy</h3>
  <div class="grid-2 avoid-break">
    <div class="card">
      <ol class="styled-list" style="margin-bottom:0; font-size:8.4pt;">
        <li><strong>Smallest Complete Engine:</strong> Build the smallest mathematically complete fulfilment engine.</li>
        <li><strong>Multi-Strategy Benchmarking:</strong> Benchmark against several realistic human/business strategies.</li>
        <li><strong>Mathematical Optimum Comparison:</strong> Compare with mathematical global optimum via MILP solvers.</li>
        <li><strong>Honest Objective Evidence:</strong> Prove where it saves money or improves fulfilment, and show where it does not.</li>
      </ol>
    </div>
    <div class="card">
      <ol class="styled-list" start="5" style="margin-bottom:0; font-size:8.4pt;">
        <li><strong>Gated Complexity:</strong> Add constraints one at a time only after the previous version proves useful.</li>
        <li><strong>Public Ghana Datasets:</strong> Use real public Ghana datasets where predictive ML is added.</li>
        <li><strong>Scientific Integrity:</strong> Avoid claiming field savings until Kuapa has actual warehouse/aggregation operations; report simulated benchmark savings.</li>
      </ol>
    </div>
  </div>

  <!-- SECTION 2 -->
  <div class="section-header">
    <span class="section-num">02</span>
    <h2 class="section-title">The Problem Kuapa Flow Solves</h2>
  </div>

  <p>Kuapa Dwaso aggregates fragmented agricultural supply. A buyer may request, for example: <em>&ldquo;5 tonnes of maize delivered to Tarkwa by Friday.&rdquo;</em> No individual farmer has 5 tonnes. Available supply is distributed as:</p>

  <table class="data-table">
    <thead>
      <tr>
        <th>Farmer</th>
        <th style="text-align:right;">Available Quantity</th>
        <th>Location</th>
        <th style="text-align:right;">Asking Price</th>
        <th>Earliest Availability</th>
      </tr>
    </thead>
    <tbody>
      <tr><td><strong>Farmer A</strong></td><td style="text-align:right;">800 kg</td><td>Community A</td><td style="text-align:right;">GHS / kg</td><td><span class="badge badge-green">Today</span></td></tr>
      <tr><td><strong>Farmer B</strong></td><td style="text-align:right;">1.4 t</td><td>Community B</td><td style="text-align:right;">GHS / kg</td><td><span class="badge badge-blue">Tomorrow</span></td></tr>
      <tr><td><strong>Farmer C</strong></td><td style="text-align:right;">600 kg</td><td>Community C</td><td style="text-align:right;">GHS / kg</td><td><span class="badge badge-green">Today</span></td></tr>
      <tr><td><strong>Farmer D</strong></td><td style="text-align:right;">2.1 t</td><td>Community D</td><td style="text-align:right;">GHS / kg</td><td><span class="badge badge-gold">Wednesday</span></td></tr>
      <tr><td><strong>Farmer E</strong></td><td style="text-align:right;">900 kg</td><td>Community E</td><td style="text-align:right;">GHS / kg</td><td><span class="badge badge-green">Today</span></td></tr>
    </tbody>
  </table>

  <h3 class="sub-title">13 Core Operational Decisions Resolved by Kuapa Flow</h3>
  <div class="grid-3 avoid-break">
    <div class="card">
      <div style="font-weight:700; color:#2D8A4E; font-size:8.6pt; margin-bottom:3px;">
        <span class="icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" stroke-width="2"><path d="M7 20h10"></path><path d="M10 20c0-4 1.5-6.5 4-8"></path><path d="M9.5 9.4c1.1.8 2.5 1.2 4.1 1.1 0-2.2-.9-4.2-2.5-5.5-1.1-.8-2.5-1.2-4.1-1.1 0 2.2.9 4.2 2.5 5.5z"></path></svg></span>
        Allocation &amp; Sourcing
      </div>
      <ul class="styled-list" style="font-size:8pt; padding-left:14px; margin-bottom:0;">
        <li>Which combination of farmers fulfils the order?</li>
        <li>Is the cheapest farmer still cheapest after transport?</li>
        <li>Will selecting one farmer starve another order?</li>
        <li>Which order is prioritised under tight supply?</li>
      </ul>
    </div>
    <div class="card">
      <div style="font-weight:700; color:#0E7490; font-size:8.6pt; margin-bottom:3px;">
        <span class="icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0E7490" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg></span>
        Logistics &amp; Capacity
      </div>
      <ul class="styled-list" style="font-size:8pt; padding-left:14px; margin-bottom:0;">
        <li>Should produce aggregate first at a warehouse?</li>
        <li>Which vehicle collects each farm batch?</li>
        <li>Can multiple collections/deliveries consolidate?</li>
        <li>Will vehicle or warehouse capacities breach?</li>
      </ul>
    </div>
    <div class="card">
      <div style="font-weight:700; color:#B45309; font-size:8.6pt; margin-bottom:3px;">
        <span class="icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path></svg></span>
        Commercial &amp; Contingency
      </div>
      <ul class="styled-list" style="font-size:8pt; padding-left:14px; margin-bottom:0;">
        <li>Is buyer's offered price commercially viable?</li>
        <li>What happens when a farmer under-supplies?</li>
        <li>What happens if a vehicle breaks down or delays?</li>
        <li>What is the expected landed profit margin?</li>
      </ul>
    </div>
  </div>

  <!-- SECTION 3 -->
  <div class="section-header">
    <span class="section-num">03</span>
    <h2 class="section-title">Core Architecture</h2>
  </div>

  <p>Kuapa Flow translates multidimensional operational inputs into an actionable, mathematically validated fulfilment plan:</p>

  <!-- ARCHITECTURE DIAGRAM -->
  <div class="arch-diagram">
    <div style="font-family:'Outfit',sans-serif; font-weight:700; font-size:9.5pt; color:#0F1F14; margin-bottom:8px; text-align:center;">
      Kuapa Flow Decision &amp; Coordination Intelligence Pipeline
    </div>
    <div class="arch-grid">
      <div class="arch-column">
        <div class="arch-node">
          <span class="icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg></span>
          Buyer Orders (Qty, Price, Due)
        </div>
        <div class="arch-node">
          <span class="icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" stroke-width="2"><path d="M7 20h10"></path><path d="M10 20c0-4 1.5-6.5 4-8"></path></svg></span>
          Farmer Supply (Vol, Loc, Ask)
        </div>
        <div class="arch-node">
          <span class="icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" stroke-width="2"><path d="M3 21V9l9-5 9 5v12H3z"></path></svg></span>
          Warehouse State &amp; Capacity
        </div>
        <div class="arch-node">
          <span class="icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg></span>
          Vehicle Fleet &amp; Limits
        </div>
        <div class="arch-node">
          <span class="icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon></svg></span>
          Road Graph &amp; Travel Time
        </div>
        <div class="arch-node">
          <span class="icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg></span>
          Public Prices (MoFA/WFP)
        </div>
      </div>
      <div class="arch-arrow">➔</div>
      <div class="arch-core">
        <div style="font-family:'Outfit',sans-serif; font-weight:800; font-size:10.5pt; color:#D4A843; letter-spacing:1px; margin-bottom:4px;">KUAPA FLOW ENGINE</div>
        <div style="font-size:7.5pt; line-height:1.35; color:#DDE3D5;">
          <div>• Constraint Optimisation</div>
          <div>• Network Flow Reasoning</div>
          <div>• Vehicle &amp; Trip Scheduling</div>
          <div>• Predictive Signals Hub</div>
        </div>
      </div>
      <div class="arch-arrow">➔</div>
      <div class="arch-column">
        <div class="arch-node">
          <span class="icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D4A843" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg></span>
          Farmer Selection &amp; Allocations
        </div>
        <div class="arch-node">
          <span class="icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D4A843" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path></svg></span>
          Aggregation Node Routing
        </div>
        <div class="arch-node">
          <span class="icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D4A843" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><circle cx="5.5" cy="18.5" r="2.5"></circle></svg></span>
          Vehicle Dispatch Schedules
        </div>
        <div class="arch-node">
          <span class="icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D4A843" stroke-width="2"><circle cx="8" cy="8" r="6"></circle><path d="M18.09 10.37A6 6 0 1 1 10.34 18"></path></svg></span>
          Total Fulfilment Cost (GHS)
        </div>
        <div class="arch-node">
          <span class="icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D4A843" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline></svg></span>
          Margin &amp; Commercial Viability
        </div>
        <div class="arch-node">
          <span class="icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D4A843" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></span>
          Risk-Weighted Fallback Plans
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 4 -->
  <div class="section-header">
    <span class="section-num">04</span>
    <h2 class="section-title">Why This Is More Viable Than a Data-Heavy ML Idea</h2>
  </div>

  <h3 class="sub-title">4.1 The Core Does Not Need a Training Dataset</h3>
  <p>The first Kuapa Flow engine primarily consumes <strong>current operational state</strong>, not historical examples:</p>

  <table class="data-table">
    <thead>
      <tr>
        <th>Operational Input</th>
        <th>Historical Training Data Required?</th>
        <th>Source / Derivation Method</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Buyer requested quantity &amp; price</td><td><span class="badge badge-green">No</span></td><td>Direct digital order submission</td></tr>
      <tr><td>Buyer destination &amp; delivery deadline</td><td><span class="badge badge-green">No</span></td><td>Direct order parameters</td></tr>
      <tr><td>Farmer available quantity, location &amp; ask price</td><td><span class="badge badge-green">No</span></td><td>Agent intake records &amp; app listings</td></tr>
      <tr><td>Commodity &amp; warehouse locations/capacities</td><td><span class="badge badge-green">No</span></td><td>Physical facility configuration</td></tr>
      <tr><td>Vehicle capacity &amp; current inventory</td><td><span class="badge badge-green">No</span></td><td>Fleet roster &amp; warehouse stock ledger</td></tr>
      <tr><td>Road distance / travel times</td><td><span class="badge badge-green">No</span></td><td>Derived from OpenStreetMap Ghana road network</td></tr>
      <tr><td>Historical market-price context</td><td><span class="badge badge-blue">Public Data</span></td><td>MoFA SRID &amp; WFP Ghana price databases</td></tr>
      <tr><td>Future demand forecast / Produce decay ML</td><td><span class="badge badge-gray">Deferred</span></td><td>Added later when operational data exists</td></tr>
    </tbody>
  </table>

  <h3 class="sub-title">4.2 Synthetic Scenarios Are Legitimate for Optimisation Testing</h3>
  <div class="grid-2 avoid-break">
    <div class="card card-danger">
      <div style="font-weight:700; color:#B91C1C; font-size:8.8pt; margin-bottom:2px;">
        <span class="icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></span>
        Not Acceptable (Speculative ML)
      </div>
      <p style="font-size:8.2pt; margin-bottom:0;">
        Generating synthetic images of tomatoes, training a freshness model on them, and claiming the model predicts real Ghanaian tomato deterioration.
      </p>
    </div>
    <div class="card card-success">
      <div style="font-weight:700; color:#2D8A4E; font-size:8.8pt; margin-bottom:2px;">
        <span class="icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
        Acceptable (Controlled Benchmarks)
      </div>
      <p style="font-size:8.2pt; margin-bottom:0;">
        Generating a defined scenario (100 farmers, 10 orders, 3 warehouses, 5 vehicles) and asking multiple algorithms to solve the <em>same defined optimisation problem</em>.
      </p>
    </div>
  </div>

  <!-- SECTION 5 -->
  <div class="section-header">
    <span class="section-num">05</span>
    <h2 class="section-title">Benchmark Philosophy &amp; Candidate Baseline Strategies</h2>
  </div>

  <div class="quote-box">
    &ldquo;The purpose of the benchmark should not be to make Kuapa Flow look good. The purpose should be to determine: Does Kuapa Flow actually make better operational decisions than reasonable human alternatives?&rdquo;
  </div>

  <div class="grid-4 avoid-break">
    <div class="metric-card">
      <div class="badge badge-gray" style="margin-bottom:3px;">Heuristic 01</div>
      <div style="font-weight:700; color:#0F1F14; font-size:8.2pt; margin-bottom:1px;">Nearest-Source</div>
      <p style="font-size:7.5pt; color:#6B7280; margin:0;">Fulfils from closest farmers regardless of purchase price.</p>
    </div>
    <div class="metric-card">
      <div class="badge badge-gray" style="margin-bottom:3px;">Heuristic 02</div>
      <div style="font-weight:700; color:#0F1F14; font-size:8.2pt; margin-bottom:1px;">Lowest-Price</div>
      <p style="font-size:7.5pt; color:#6B7280; margin:0;">Selects cheapest produce without optimising transport.</p>
    </div>
    <div class="metric-card">
      <div class="badge badge-gray" style="margin-bottom:3px;">Heuristic 03</div>
      <div style="font-weight:700; color:#0F1F14; font-size:8.2pt; margin-bottom:1px;">Greedy Landed</div>
      <p style="font-size:7.5pt; color:#6B7280; margin:0;">Selects lowest purchase + estimated direct transport.</p>
    </div>
    <div class="metric-card">
      <div class="badge badge-gray" style="margin-bottom:3px;">Heuristic 04</div>
      <div style="font-weight:700; color:#0F1F14; font-size:8.2pt; margin-bottom:1px;">Largest-Supplier</div>
      <p style="font-size:7.5pt; color:#6B7280; margin:0;">Prefers large suppliers, minimising collection stops.</p>
    </div>
  </div>
  <div class="grid-4 avoid-break">
    <div class="metric-card">
      <div class="badge badge-gray" style="margin-bottom:3px;">Heuristic 05</div>
      <div style="font-weight:700; color:#0F1F14; font-size:8.2pt; margin-bottom:1px;">Earliest-Available</div>
      <p style="font-size:7.5pt; color:#6B7280; margin:0;">Prioritises immediately accessible supply batches.</p>
    </div>
    <div class="metric-card">
      <div class="badge badge-gray" style="margin-bottom:3px;">Heuristic 06</div>
      <div style="font-weight:700; color:#0F1F14; font-size:8.2pt; margin-bottom:1px;">Deadline-Priority</div>
      <p style="font-size:7.5pt; color:#6B7280; margin:0;">Fulfils the most urgent buyer order first.</p>
    </div>
    <div class="metric-card">
      <div class="badge badge-gray" style="margin-bottom:3px;">Heuristic 07</div>
      <div style="font-weight:700; color:#0F1F14; font-size:8.2pt; margin-bottom:1px;">Warehouse-First</div>
      <p style="font-size:7.5pt; color:#6B7280; margin:0;">Depletes existing inventory before farm-gate sourcing.</p>
    </div>
    <div class="metric-card" style="border:1.5px solid #2D8A4E; background:#F5FBF7;">
      <div class="badge badge-green" style="margin-bottom:3px;">Heuristic 08 (Key)</div>
      <div style="font-weight:700; color:#2D8A4E; font-size:8.2pt; margin-bottom:1px;">Weighted Dispatcher</div>
      <p style="font-size:7.5pt; color:#0F1F14; margin:0;">Competent human rule combining price, distance &amp; due date.</p>
    </div>
  </div>

  <!-- SECTION 6 -->
  <div class="section-header">
    <span class="section-num">06</span>
    <h2 class="section-title">Exact Optimisation as a Stronger Benchmark</h2>
  </div>

  <p>For small and medium instances, formulating the problem as a Mixed-Integer Linear Program (MILP) provides the exact mathematical optimum, establishing a verifiable <strong>optimality gap</strong>:</p>

  <!-- OPTIMALITY GAP VISUALIZATION -->
  <div class="bar-chart-card">
    <div style="font-family:'Outfit',sans-serif; font-weight:700; font-size:9.5pt; color:#0F1F14; margin-bottom:10px;">
      Benchmark Fulfilment Cost &amp; Optimality Gap Comparison (GHS)
    </div>
    <div class="bar-row">
      <div><strong>Mathematical Optimum</strong><br><span style="font-size:7.2pt; color:#6B7280;">Exact MILP Lower Bound</span></div>
      <div class="bar-track"><div class="bar-fill-opt" style="width: 84.1%;"></div></div>
      <div style="font-weight:700; color:#2D8A4E; text-align:right; font-size:8.2pt;">GHS 8,410<br><span style="font-size:7.2pt; color:#2D8A4E;">(0.00% Gap)</span></div>
    </div>
    <div class="bar-row">
      <div><strong>Kuapa Flow Engine</strong><br><span style="font-size:7.2pt; color:#6B7280;">Heuristic / Solver</span></div>
      <div class="bar-track"><div class="bar-fill-kf" style="width: 84.7%;"></div></div>
      <div style="font-weight:700; color:#0F1F14; text-align:right; font-size:8.2pt;">GHS 8,470<br><span style="font-size:7.2pt; color:#2D8A4E;">(+0.71% Gap)</span></div>
    </div>
    <div class="bar-row">
      <div><strong>Weighted Human Dispatcher</strong><br><span style="font-size:7.2pt; color:#6B7280;">Competent Manager Rule</span></div>
      <div class="bar-track"><div class="bar-fill-heur" style="width: 92.7%;"></div></div>
      <div style="font-weight:700; color:#B45309; text-align:right; font-size:8.2pt;">GHS 9,270<br><span style="font-size:7.2pt; color:#B91C1C;">(+10.23% Gap)</span></div>
    </div>
    <div style="margin-top:8px; padding-top:6px; border-top:1px solid #DDE3D5; font-size:8.2pt;">
      <strong>Result:</strong> Kuapa Flow is only <code>(8,470 - 8,410) / 8,410 ≈ 0.71%</code> above the theoretical optimum, while saving <strong>GHS 800 (8.63%)</strong> over expert human heuristics.
    </div>
  </div>

  <!-- SECTION 7 -->
  <div class="section-header">
    <span class="section-num">07</span>
    <h2 class="section-title">Metrics That Matter to a Real Business</h2>
  </div>

  <div class="grid-2 avoid-break">
    <div class="card">
      <div style="font-family:'Outfit',sans-serif; font-weight:700; color:#2D8A4E; font-size:9pt; margin-bottom:3px;">
        <span class="icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v12M6 12h12"></path></svg></span>
        Economic Metrics
      </div>
      <ul class="styled-list" style="font-size:8pt; margin-bottom:0;">
        <li>Produce procurement cost &amp; transport cost</li>
        <li>Warehouse handling cost &amp; total landed cost</li>
        <li>Revenue fulfilled &amp; expected contribution margin</li>
        <li>Cost per kg delivered &amp; unfulfilled penalty cost</li>
      </ul>
    </div>
    <div class="card">
      <div style="font-family:'Outfit',sans-serif; font-weight:700; color:#0E7490; font-size:9pt; margin-bottom:3px;">
        <span class="icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0E7490" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
        Fulfilment Metrics
      </div>
      <ul class="styled-list" style="font-size:8pt; margin-bottom:0;">
        <li>Percentage of orders fully fulfilled &amp; on-time delivery rate</li>
        <li>Quantity fulfilled vs quantity left unmatched</li>
        <li>Number of order failures &amp; plan revisions</li>
      </ul>
    </div>
    <div class="card">
      <div style="font-family:'Outfit',sans-serif; font-weight:700; color:#B45309; font-size:9pt; margin-bottom:3px;">
        <span class="icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><circle cx="5.5" cy="18.5" r="2.5"></circle></svg></span>
        Logistics Metrics
      </div>
      <ul class="styled-list" style="font-size:8pt; margin-bottom:0;">
        <li>Total distance travelled &amp; empty vehicle kilometres</li>
        <li>Number of farm collections and delivery movements</li>
        <li>Vehicle capacity utilisation &amp; warehouse throughput</li>
      </ul>
    </div>
    <div class="card">
      <div style="font-family:'Outfit',sans-serif; font-weight:700; color:#0F1F14; font-size:9pt; margin-bottom:3px;">
        <span class="icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0F1F14" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg></span>
        Algorithm Metrics
      </div>
      <ul class="styled-list" style="font-size:8pt; margin-bottom:0;">
        <li>Solver runtime and memory consumption</li>
        <li>Optimality gap vs exact mathematical lower bound</li>
        <li>Scalability with network size (10 → 1,000 farmers)</li>
        <li>Robustness to inaccurate assumptions</li>
      </ul>
    </div>
  </div>

  <!-- SECTION 8 -->
  <div class="section-header">
    <span class="section-num">08</span>
    <h2 class="section-title">Economic Evidence Expressed in GHS</h2>
  </div>

  <p>Where possible, competition demonstrations translate improvements directly into Ghanaian Cedi:</p>

  <div class="grid-2 avoid-break">
    <div class="card card-danger">
      <div style="font-weight:700; color:#B91C1C; font-size:8.5pt; margin-bottom:2px;">
        <span class="icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></span>
        Vague Claim to Avoid
      </div>
      <p style="font-size:8pt; margin-bottom:0;">&ldquo;Kuapa improved efficiency by 12%.&rdquo;</p>
    </div>
    <div class="card card-success">
      <div style="font-weight:700; color:#2D8A4E; font-size:8.5pt; margin-bottom:2px;">
        <span class="icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
        Defensible Evidence
      </div>
      <p style="font-size:8pt; margin-bottom:0;">&ldquo;For this defined fulfilment cycle, the strongest dispatcher heuristic spent GHS 9,270 while Kuapa Flow produced a plan costing GHS 8,470 and fulfilled the same orders.&rdquo;</p>
    </div>
  </div>
  <p style="font-size:8.4pt; color:#4B5563;">
    Until Kuapa has real operations, the correct language is <strong>simulated benchmark savings</strong>, not <strong>real warehouse savings</strong>.
  </p>

  <!-- SECTION 9 -->
  <div class="section-header">
    <span class="section-num">09</span>
    <h2 class="section-title">Build the System Incrementally (Stage 0 to Stage 7)</h2>
  </div>

  <p>Each additional feature is required to justify its complexity through benchmark evidence:</p>

  <div class="pipeline-stage">
    <span class="pipeline-num">Stage 0</span>
    <div class="pipeline-content">
      <div class="pipeline-title">Supply Allocation Core <span class="badge badge-green">Day 1</span></div>
      <p class="pipeline-desc">Given farmers, available quantities, asking prices, and buyer demand, compute optimal allocations.</p>
    </div>
  </div>

  <div class="pipeline-stage">
    <span class="pipeline-num">Stage 1</span>
    <div class="pipeline-content">
      <div class="pipeline-title">Geography and Transport Cost</div>
      <p class="pipeline-desc">Add farmer/buyer locations, road distances, and transport cost. Cheapest farmer is now evaluated after transport.</p>
    </div>
  </div>

  <div class="pipeline-stage">
    <span class="pipeline-num">Stage 2</span>
    <div class="pipeline-content">
      <div class="pipeline-title">Vehicle Capacity &amp; Consolidation</div>
      <p class="pipeline-desc">Add vehicle capacities, load consolidation, and collection constraints to ensure allocations are physically practical.</p>
    </div>
  </div>

  <div class="pipeline-stage">
    <span class="pipeline-num">Stage 3</span>
    <div class="pipeline-content">
      <div class="pipeline-title">Aggregation / Warehouse Capacity</div>
      <p class="pipeline-desc">Add aggregation locations, storage limits, current stock, and handling costs, turning problem into a network flow.</p>
    </div>
  </div>

  <div class="pipeline-stage">
    <span class="pipeline-num">Stage 4</span>
    <div class="pipeline-content">
      <div class="pipeline-title">Scheduling and Deadlines</div>
      <p class="pipeline-desc">Add collection/delivery windows, competing order deadlines, vehicle schedules, and warehouse processing times.</p>
    </div>
  </div>

  <div class="pipeline-stage">
    <span class="pipeline-num">Stage 5</span>
    <div class="pipeline-content">
      <div class="pipeline-title">Economic Decision Support</div>
      <p class="pipeline-desc">Add market-price context, total cost modelling, minimum viable buyer prices, and commercial viability guidance.</p>
    </div>
  </div>

  <div class="pipeline-stage">
    <span class="pipeline-num">Stage 6</span>
    <div class="pipeline-content">
      <div class="pipeline-title">Predictive Intelligence From Operational History <span class="badge badge-blue">Post-Launch</span></div>
      <p class="pipeline-desc">Add models for supplier reliability, loading delay, travel time, and cancellation risk from real transaction logs.</p>
    </div>
  </div>

  <div class="pipeline-stage">
    <span class="pipeline-num" style="background:#6B7280;">Stage 7</span>
    <div class="pipeline-content">
      <div class="pipeline-title">Perishability Intelligence <span class="badge badge-gray">Deferred</span></div>
      <p class="pipeline-desc">Deferred until defensible local cold-chain, image, and storage sensor data is obtained.</p>
    </div>
  </div>

  <!-- SECTION 10 -->
  <div class="section-header">
    <span class="section-num">10</span>
    <h2 class="section-title">Public Data Kuapa Can Use Now</h2>
  </div>

  <div class="grid-3 avoid-break">
    <div class="card">
      <div class="badge badge-green" style="margin-bottom:3px;">MoFA SRID</div>
      <div style="font-weight:700; color:#0F1F14; font-size:8.5pt; margin-bottom:1px;">Commodity Prices</div>
      <p style="font-size:7.5pt; color:#4B5563; margin-bottom:3px;">Retail and wholesale commodity prices across Ghanaian regional markets.</p>
      <div style="font-size:7pt; color:#2D8A4E; font-weight:600;">Role: Historical Market Context</div>
    </div>
    <div class="card">
      <div class="badge badge-green" style="margin-bottom:3px;">MoFA SRID</div>
      <div style="font-weight:700; color:#0F1F14; font-size:8.5pt; margin-bottom:1px;">Production Estimates</div>
      <p style="font-size:7.5pt; color:#4B5563; margin-bottom:3px;">Average yield, area under cultivation, and district crop production statistics.</p>
      <div style="font-size:7pt; color:#2D8A4E; font-weight:600;">Role: Sourcing Cluster Realism</div>
    </div>
    <div class="card">
      <div class="badge badge-green" style="margin-bottom:3px;">Ghana Open Data</div>
      <div style="font-weight:700; color:#0F1F14; font-size:8.5pt; margin-bottom:1px;">District Crop Stats</div>
      <p style="font-size:7.5pt; color:#4B5563; margin-bottom:3px;">Historical district agricultural production from data.gov.gh.</p>
      <div style="font-size:7pt; color:#2D8A4E; font-weight:600;">Role: Placement Benchmarks</div>
    </div>
  </div>
  <div class="grid-3 avoid-break">
    <div class="card">
      <div class="badge badge-gold" style="margin-bottom:3px;">WFP / HDX Ghana</div>
      <div style="font-weight:700; color:#0F1F14; font-size:8.5pt; margin-bottom:1px;">Food Price Database</div>
      <p style="font-size:7.5pt; color:#4B5563; margin-bottom:3px;"><strong>27,348 rows</strong>, 41 markets, 26 crops (2006–2023) with coordinates.</p>
      <div style="font-size:7pt; color:#B45309; font-weight:600;">Role: Time-Series Seasonality ML</div>
    </div>
    <div class="card">
      <div class="badge badge-blue" style="margin-bottom:3px;">OpenStreetMap</div>
      <div style="font-weight:700; color:#0F1F14; font-size:8.5pt; margin-bottom:1px;">Ghana Road Network</div>
      <p style="font-size:7.5pt; color:#4B5563; margin-bottom:3px;">Geofabrik extract with navigable road topologies and distances.</p>
      <div style="font-size:7pt; color:#0369A1; font-weight:600;">Role: Routing &amp; Travel Matrices</div>
    </div>
    <div class="card">
      <div class="badge badge-gray" style="margin-bottom:3px;">WorldPop</div>
      <div style="font-weight:700; color:#0F1F14; font-size:8.5pt; margin-bottom:1px;">Gridded Population</div>
      <p style="font-size:7.5pt; color:#4B5563; margin-bottom:3px;">High-resolution 100m grid population density estimates.</p>
      <div style="font-size:7pt; color:#4B5563; font-weight:600;">Role: Catchment Sizing Proxy</div>
    </div>
  </div>

  <!-- SECTION 11 -->
  <div class="section-header">
    <span class="section-num">11</span>
    <h2 class="section-title">What Public Data Cannot Give Us</h2>
  </div>

  <p>Public datasets are useful, but they do <strong>not</strong> provide:</p>

  <div class="grid-2 avoid-break">
    <div class="card">
      <div style="font-weight:700; color:#0F1F14; font-size:8.5pt; margin-bottom:3px;">Real-Time Operational Inputs</div>
      <ul class="styled-list" style="font-size:8pt; margin-bottom:0;">
        <li>Kuapa buyer demand orders &amp; deadlines</li>
        <li>Exact farm-gate availability today &amp; asking prices</li>
        <li>Kuapa vehicle fleet costs &amp; capacities</li>
        <li>Current warehouse occupancy &amp; stock levels</li>
      </ul>
    </div>
    <div class="card">
      <div style="font-weight:700; color:#0F1F14; font-size:8.5pt; margin-bottom:3px;">Learned Operational Parameters</div>
      <ul class="styled-list" style="font-size:8pt; margin-bottom:0;">
        <li>Individual farmer reliability &amp; supply shortfall</li>
        <li>Real warehouse loading/unloading turnaround times</li>
        <li>Order cancellation rates &amp; trip delays</li>
        <li>Produce condition inside Kuapa warehouses</li>
      </ul>
    </div>
  </div>

  <!-- SECTION 12 -->
  <div class="section-header">
    <span class="section-num">12</span>
    <h2 class="section-title">Making Synthetic Benchmark Scenarios Realistic</h2>
  </div>

  <p>Synthetic does not mean arbitrary. Scenarios are generated using <strong>empirically informed distributions</strong>:</p>

  <div class="grid-3 avoid-break">
    <div class="card">
      <div style="font-weight:700; font-size:8.2pt; color:#0F1F14;">Farmer Geography</div>
      <p style="font-size:7.6pt; color:#4B5563; margin:0;">Anchored in MoFA district crop production clusters.</p>
    </div>
    <div class="card">
      <div style="font-weight:700; font-size:8.2pt; color:#0F1F14;">Supply Fragmentation</div>
      <p style="font-size:7.6pt; color:#4B5563; margin:0;">Tested across highly fragmented, moderate, and concentrated regimes.</p>
    </div>
    <div class="card">
      <div style="font-weight:700; font-size:8.2pt; color:#0F1F14;">Prices &amp; Roads</div>
      <p style="font-size:7.6pt; color:#4B5563; margin:0;">Sampled from observed WFP ranges; routed over actual Ghana OSM roads.</p>
    </div>
  </div>

  <!-- SECTION 13 & 14 -->
  <div class="section-header">
    <span class="section-num">13</span>
    <h2 class="section-title">Scenario Families &amp; Sensitivity Analysis</h2>
  </div>

  <div class="grid-4 avoid-break">
    <div class="metric-card">
      <div style="font-weight:700; font-size:8.2pt; color:#2D8A4E;">Normal Scenarios</div>
      <p style="font-size:7.4pt; color:#6B7280; margin:0;">Standard network size, adequate capacity, ordinary deadlines. Establishes baseline.</p>
    </div>
    <div class="metric-card">
      <div style="font-weight:700; font-size:8.2pt; color:#0E7490;">Stress Scenarios</div>
      <p style="font-size:7.4pt; color:#6B7280; margin:0;">High fragmentation, tight vehicle fleet, competing deadlines. Tests advantage growth.</p>
    </div>
    <div class="metric-card">
      <div style="font-weight:700; font-size:8.2pt; color:#B45309;">Shock Scenarios</div>
      <p style="font-size:7.4pt; color:#6B7280; margin:0;">Farmer under-supplies, vehicle breakdown, route spike. Tests replanning resilience.</p>
    </div>
    <div class="metric-card">
      <div style="font-weight:700; font-size:8.2pt; color:#B91C1C;">Adversarial Cases</div>
      <p style="font-size:7.4pt; color:#6B7280; margin:0;">Single supplier fulfills 100%, zero transport cost. Discovers where heuristics suffice.</p>
    </div>
  </div>

  <p style="font-size:8.4pt; margin-top:6px;">
    <strong>Sensitivity Variables:</strong> Fuel/transport cost, farmer price variance, number of farmers (10–500), order volume, fragmentation regimes, vehicle capacity, warehouse limits, deadline tightness, supplier reliability, and travel-time uncertainty.
  </p>

  <!-- SECTION 15 & 16 -->
  <div class="section-header">
    <span class="section-num">14</span>
    <h2 class="section-title">The Self-Correcting / Learning Loop</h2>
  </div>

  <p>Kuapa Flow becomes substantially more valuable once physical operations commence by recording prediction residuals:</p>

  <!-- LEARNING LOOP CARD -->
  <div class="card avoid-break">
    <div style="display:grid; grid-template-columns:1fr auto 1fr; gap:10px; align-items:center;">
      <div style="background:#FFFFFF; border:1px solid #DDE3D5; border-radius:6px; padding:7px 9px;">
        <div style="font-weight:700; font-size:8.2pt; color:#0F1F14; margin-bottom:3px; border-bottom:1px solid #DDE3D5; padding-bottom:2px;">
          Planned Assumptions
        </div>
        <div style="font-size:7.6pt; line-height:1.35;">
          <div>Farmer B Confirmed: <strong>700 kg</strong></div>
          <div>Expected Loading: <strong>35 min</strong></div>
          <div>Expected Transport: <strong>GHS 320</strong></div>
          <div>Expected Arrival: <strong>14:00</strong></div>
        </div>
      </div>

      <div style="text-align:center; font-weight:700; font-size:7.6pt; color:#B45309;">
        <span class="badge badge-gold">Residuals</span><br>
        <span style="color:#B91C1C;">-110 kg</span><br>
        <span style="color:#B91C1C;">+26 min</span><br>
        <span style="color:#B91C1C;">+GHS 48</span>
      </div>

      <div style="background:#FFFFFF; border:1px solid #DDE3D5; border-radius:6px; padding:7px 9px;">
        <div style="font-weight:700; font-size:8.2pt; color:#0F1F14; margin-bottom:3px; border-bottom:1px solid #DDE3D5; padding-bottom:2px;">
          Actual Execution Outcome
        </div>
        <div style="font-size:7.6pt; line-height:1.35;">
          <div>Farmer B Supplied: <strong>590 kg</strong></div>
          <div>Actual Loading: <strong>61 min</strong></div>
          <div>Actual Transport: <strong>GHS 368</strong></div>
          <div>Actual Arrival: <strong>14:43</strong></div>
        </div>
      </div>
    </div>
    <div style="margin-top:6px; padding-top:4px; border-top:1px dashed #DDE3D5; font-size:7.6pt; color:#2D8A4E; text-align:center; font-weight:600;">
      Feedback Calibration: Learns Farmer B reliability is 84.3%, Friday route delay is +43 min, and warehouse loading is slower.
    </div>
  </div>

  <h3 class="sub-title">Operational Learning Milestones</h3>
  <div class="grid-3 avoid-break">
    <div class="metric-card">
      <div style="font-weight:700; color:#6B7280; font-size:8.2pt;">Milestone T0</div>
      <div style="font-size:7.8pt; font-weight:600; color:#0F1F14;">No Operating History</div>
      <p style="font-size:7.4pt; color:#6B7280; margin:0;">Uses default geospatial speeds, nominal capacities, and listed prices.</p>
    </div>
    <div class="metric-card">
      <div style="font-weight:700; color:#2D8A4E; font-size:8.2pt;">Milestone T1</div>
      <div style="font-size:7.8pt; font-weight:600; color:#0F1F14;">100 Completed Trips</div>
      <p style="font-size:7.4pt; color:#6B7280; margin:0;">Calibrates regional delay distributions and average warehouse turnaround times.</p>
    </div>
    <div class="metric-card">
      <div style="font-weight:700; color:#D4A843; font-size:8.2pt;">Milestone T2</div>
      <div style="font-size:7.8pt; font-weight:600; color:#0F1F14;">500+ Completed Trips</div>
      <p style="font-size:7.4pt; color:#6B7280; margin:0;">High-precision supplier reliability scoring and route-specific friction multipliers.</p>
    </div>
  </div>

  <!-- SECTION 17 -->
  <div class="section-header">
    <span class="section-num">15</span>
    <h2 class="section-title">Market / Economic Intelligence</h2>
  </div>

  <p>Market intelligence serves as an evidence-based supporting signal using WFP and MoFA Ghana price histories:</p>

  <div class="grid-2 avoid-break">
    <div class="card">
      <div style="font-weight:700; font-size:8.5pt; color:#0F1F14;">Seasonal Context &amp; Spread Detection</div>
      <p style="font-size:7.8pt; color:#4B5563; margin:0;">Identifies whether buyer offers fall below historical seasonal ranges and flags inter-market price arbitrage opportunities.</p>
    </div>
    <div class="card">
      <div style="font-weight:700; font-size:8.5pt; color:#0F1F14;">Backtested Forecasting (No Leakage)</div>
      <p style="font-size:7.8pt; color:#4B5563; margin:0;">Trains exclusively on past years to predict unseen future periods, comparing predictions with actual observed prices.</p>
    </div>
  </div>

  <!-- SECTION 18 -->
  <div class="section-header">
    <span class="section-num">16</span>
    <h2 class="section-title">Commercial Decision Support</h2>
  </div>

  <p>Kuapa Flow evaluates whether a buyer's offer price covers total landed fulfilment costs plus risk buffers:</p>

  <!-- COMMERCIAL DECISION CARD -->
  <div class="card card-gold avoid-break">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <span style="font-family:'Outfit',sans-serif; font-weight:700; font-size:9.5pt; color:#0F1F14;">Order Commercial Viability Evaluation</span>
      <span class="badge badge-red">Rejected: Unviable Offer</span>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1.2fr; gap:12px; font-size:8.2pt;">
      <div>
        <div style="color:#6B7280;">Buyer Offered Price: <strong style="color:#0F1F14;">GHS 100,000</strong></div>
        <div style="margin-top:3px; line-height:1.35;">
          <div>• Produce Procurement: GHS 84,000</div>
          <div>• Transport &amp; Fuel: GHS 8,000</div>
          <div>• Handling &amp; Storage: GHS 4,000</div>
          <div>• Operational Risk Buffer: GHS 5,000</div>
        </div>
        <div style="border-top:1px solid #DDE3D5; margin-top:3px; padding-top:2px; font-weight:700;">
          Total Landed Cost: <span style="color:#B91C1C;">GHS 101,000</span>
        </div>
      </div>
      <div style="background:#FFFFFF; border:1px solid #DDE3D5; border-radius:6px; padding:7px 9px;">
        <div style="font-weight:700; color:#B91C1C; margin-bottom:2px;">Net Deficit: -GHS 1,000 (-1.0%)</div>
        <p style="font-size:7.5pt; color:#4B5563; margin-bottom:3px;">
          Fulfilling this order at the buyer's terms results in an immediate loss after mandatory logistics and risk allocations.
        </p>
        <div style="font-weight:700; color:#2D8A4E; font-size:7.8pt;">
          Suggested Minimum Viable Buyer Price: ≥ GHS 106,050 (5% target margin)
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 19 -->
  <div class="section-header">
    <span class="section-num">17</span>
    <h2 class="section-title">Multi-Objective Optimisation</h2>
  </div>

  <p>Kuapa Flow exposes 4 operating modes (Profit-Oriented, Reliability-Oriented, Logistics-Oriented, Balanced):</p>

  <div class="grid-2 avoid-break">
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
        <span style="font-weight:700; color:#0F1F14; font-size:8.8pt;">Plan A (Cost-Optimised)</span>
        <span class="badge badge-green">Min Cost</span>
      </div>
      <div style="font-size:8pt; line-height:1.35;">
        <div>• Expected Cost: <strong>GHS 8,500</strong></div>
        <div>• On-Time Robustness: <strong>Moderate (78%)</strong></div>
      </div>
    </div>
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
        <span style="font-weight:700; color:#0F1F14; font-size:8.8pt;">Plan B (Reliability-Optimised)</span>
        <span class="badge badge-gold">High Resilience</span>
      </div>
      <div style="font-size:8pt; line-height:1.35;">
        <div>• Expected Cost: <strong>GHS 8,850 (+GHS 350)</strong></div>
        <div>• On-Time Robustness: <strong>High (96%)</strong></div>
      </div>
    </div>
  </div>

  <!-- SECTION 20 & 21 -->
  <div class="section-header">
    <span class="section-num">18</span>
    <h2 class="section-title">Innovation &amp; Defensible Claims Guardrails</h2>
  </div>

  <table class="data-table">
    <thead>
      <tr>
        <th>Unsubstantiated Claims (Avoid)</th>
        <th>Demonstrated Today (Simulation Benchmarks)</th>
        <th>Validated Post-Launch (Operations)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>&ldquo;Reduces logistics cost by 30%&rdquo;</td>
        <td>Exact optimality gap &amp; MILP mathematical bounds</td>
        <td>Actual field fuel &amp; transport receipts saved</td>
      </tr>
      <tr>
        <td>&ldquo;Predicts exact farmer supply accurately&rdquo;</td>
        <td>Statistical distributions anchored in MoFA statistics</td>
        <td>Farmer-specific yield confirmation track records</td>
      </tr>
      <tr>
        <td>&ldquo;Knows the shelf life of produce&rdquo;</td>
        <td>Network flow reasoning with road distance graphs</td>
        <td>On-the-ground storage dwell and spoilage audits</td>
      </tr>
    </tbody>
  </table>

  <!-- SECTION 22 & 23 -->
  <div class="section-header">
    <span class="section-num">19</span>
    <h2 class="section-title">Live Competition Demonstration &amp; Benchmark Lab</h2>
  </div>

  <div class="grid-4 avoid-break">
    <div class="metric-card">
      <div class="badge badge-green" style="margin-bottom:3px;">Step 1</div>
      <div style="font-weight:700; font-size:8.2pt; color:#0F1F14;">Display Network</div>
      <p style="font-size:7.4pt; color:#6B7280; margin:0;">Visualise farmers, orders, warehouses, and vehicles.</p>
    </div>
    <div class="metric-card">
      <div class="badge badge-green" style="margin-bottom:3px;">Step 2</div>
      <div style="font-weight:700; font-size:8.2pt; color:#0F1F14;">Select Strategy</div>
      <p style="font-size:7.4pt; color:#6B7280; margin:0;">Choose human dispatcher vs Kuapa Flow solver.</p>
    </div>
    <div class="metric-card">
      <div class="badge badge-green" style="margin-bottom:3px;">Step 3</div>
      <div style="font-weight:700; font-size:8.2pt; color:#0F1F14;">Solve &amp; Compare</div>
      <p style="font-size:7.4pt; color:#6B7280; margin:0;">Display costs, routes, vehicle fills, and runtimes.</p>
    </div>
    <div class="metric-card">
      <div class="badge badge-gold" style="margin-bottom:3px;">Step 4 &amp; 5</div>
      <div style="font-weight:700; font-size:8.2pt; color:#0F1F14;">Live Shock Injection</div>
      <p style="font-size:7.4pt; color:#6B7280; margin:0;">Farmer under-supplies; watch Kuapa Flow re-route live.</p>
    </div>
  </div>

  <h3 class="sub-title">Benchmark Laboratory Parameter Sweep Matrix</h3>
  <div class="grid-3 avoid-break">
    <div class="card">
      <div style="font-weight:700; font-size:8pt; color:#0F1F14;">Network Scale</div>
      <div style="font-size:7.5pt; color:#4B5563;">Farmers: 10 → 50 → 100 → 500<br>Buyer Orders: 3 → 10 → 25 → 50</div>
    </div>
    <div class="card">
      <div style="font-weight:700; font-size:8pt; color:#0F1F14;">Fleet &amp; Storage Capacity</div>
      <div style="font-size:7.5pt; color:#4B5563;">Vehicles: 1 → 3 → 10 Trucks<br>Warehouse: Unlimited → Constrained</div>
    </div>
    <div class="card">
      <div style="font-weight:700; font-size:8pt; color:#0F1F14;">Market Friction</div>
      <div style="font-size:7.5pt; color:#4B5563;">Fragmentation: Low → High<br>Deadlines: Loose → Tight</div>
    </div>
  </div>

  <!-- SECTION 24 & 27 -->
  <div class="section-header">
    <span class="section-num">20</span>
    <h2 class="section-title">Modular Future Signals &amp; Experiment Schema</h2>
  </div>

  <div class="grid-2 avoid-break">
    <div class="schema-box">
      <div style="color:#D4A843; font-weight:700; margin-bottom:3px;">// Scenario Definition Schema</div>
      <div>scenario_id: <span style="color:#38A85C;">"KD-BENCH-004218"</span></div>
      <div>seed: <span style="color:#D4A843;">4218</span></div>
      <div>farmers: <span style="color:#D4A843;">100</span> | orders: <span style="color:#D4A843;">15</span> | vehicles: <span style="color:#D4A843;">4</span></div>
      <div>aggregation_nodes: <span style="color:#D4A843;">2</span></div>
      <div>fragmentation: <span style="color:#38A85C;">"high"</span></div>
      <div>deadline_pressure: <span style="color:#38A85C;">"medium"</span></div>
    </div>
    <div class="schema-box">
      <div style="color:#D4A843; font-weight:700; margin-bottom:3px;">// Experiment Output Schema</div>
      <div>strategy: <span style="color:#38A85C;">"kuapa_flow_v1"</span></div>
      <div>solution_cost_ghs: <span style="color:#D4A843;">8470.00</span></div>
      <div>optimality_gap: <span style="color:#38A85C;">"0.71%"</span></div>
      <div>runtime_ms: <span style="color:#D4A843;">42.8</span></div>
      <div>orders_fulfilled_pct: <span style="color:#D4A843;">100.0</span></div>
      <div>vehicle_utilisation: <span style="color:#D4A843;">0.89</span></div>
    </div>
  </div>

  <!-- SECTION 28 -->
  <div class="section-header">
    <span class="section-num">21</span>
    <h2 class="section-title">Major Feasibility Risks &amp; Concrete Mitigations</h2>
  </div>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width:28%;">Identified Risk</th>
        <th>Concrete Mitigation Strategy</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. Baselines Are Artificial Strawmen</strong></td>
        <td>Build serious multi-attribute human heuristics and benchmark against exact MILP mathematical bounds.</td>
      </tr>
      <tr>
        <td><strong>2. Synthetic Scenarios Lack Realism</strong></td>
        <td>Anchor spatial distributions in MoFA district yields, WFP price ranges, and actual OpenStreetMap road topologies.</td>
      </tr>
      <tr>
        <td><strong>3. High Computational Latency</strong></td>
        <td>Track runtime curves from Day 1; implement exact solvers for small batches and fast metaheuristics for scale.</td>
      </tr>
      <tr>
        <td><strong>4. Overpromising AI Without Data</strong></td>
        <td>Explicitly label the Day 1 engine as constraint optimisation and network reasoning, not opaque neural nets.</td>
      </tr>
      <tr>
        <td><strong>5. Wholesale vs Farm-Gate Spread</strong></td>
        <td>Do not conflate urban market prices with farm-gate purchase costs; maintain explicit price conversion margins.</td>
      </tr>
    </tbody>
  </table>

  <!-- SECTION 29, 30 & 31 -->
  <div class="section-header">
    <span class="section-num">22</span>
    <h2 class="section-title">Competition Evidence, Strategic Power &amp; Data Moat</h2>
  </div>

  <p><strong>Minimum Evidence Package:</strong> Formal problem definition, multi-baseline suite, MILP optimality bound, 10,000+ reproducible benchmark scenarios, sensitivity analysis, OpenStreetMap routing, capacity constraints, GHS economic translation, and honest limitations.</p>

  <div class="card">
    <div style="font-family:'Outfit',sans-serif; font-weight:700; font-size:9.5pt; color:#2D8A4E; margin-bottom:3px;">
      Why This Approach Is Strong in Competition
    </div>
    <p style="font-size:8.2pt; color:#0F1F14; margin-bottom:0;">
      Many AI competition projects depend on assumptions of perfect data, unlimited transport, and zero friction. Kuapa Flow deliberately takes the opposite approach: <em>&ldquo;We construct reproducible operational scenarios, compare against realistic alternatives, compute the true optimum where possible, stress the assumptions, and show exactly when and why the system creates value.&rdquo;</em>
    </p>
  </div>

  <p style="font-size:8.4pt; margin-top:6px;">
    <strong>17 Operational Data Moat Fields:</strong> Confirmed quantity, actual supplied quantity, promised availability, actual availability, farm purchase price, loading duration, transit route, travel time, transport cost, warehouse dwell time, buyer deadline, delivery time, acceptance status, cancellation reason, realized margin, plan revision count, and failure cause.
  </p>

  <!-- SECTION 32, 33 & 34 -->
  <div class="section-header">
    <span class="section-num">23</span>
    <h2 class="section-title">Final Feasibility Verdict &amp; Verified Data Sources</h2>
  </div>

  <table class="data-table">
    <thead>
      <tr>
        <th>Evaluation Dimension</th>
        <th style="width:16%;">Status</th>
        <th>Operational Impact</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Requires physical warehouse today?</strong></td>
        <td><span class="badge badge-green">No</span></td>
        <td>Immediate software and benchmark development without facility overhead.</td>
      </tr>
      <tr>
        <td><strong>Requires proprietary historical data today?</strong></td>
        <td><span class="badge badge-green">No</span></td>
        <td>Optimises directly from present-day operational state variables.</td>
      </tr>
      <tr>
        <td><strong>Anchored in real Ghanaian public data?</strong></td>
        <td><span class="badge badge-green">Yes</span></td>
        <td>Validated against MoFA SRID, WFP Ghana, and OpenStreetMap road graphs.</td>
      </tr>
      <tr>
        <td><strong>Reproducibly benchmarked?</strong></td>
        <td><span class="badge badge-green">Yes</span></td>
        <td>Thousands of controlled scenario experiments with seeded configurations.</td>
      </tr>
      <tr>
        <td><strong>Quantifiable optimality gap?</strong></td>
        <td><span class="badge badge-green">Yes (0.71%)</span></td>
        <td>Scientifically proven against exact MILP global optimum calculations.</td>
      </tr>
      <tr>
        <td><strong>Expressed in Ghanaian Cedi (GHS)?</strong></td>
        <td><span class="badge badge-green">Yes</span></td>
        <td>Real financial savings measured in landed transport and procurement costs.</td>
      </tr>
      <tr>
        <td><strong>Incorporates physical capacity constraints?</strong></td>
        <td><span class="badge badge-green">Yes</span></td>
        <td>Enforces vehicle payload, warehouse volume, and delivery time windows.</td>
      </tr>
      <tr>
        <td><strong>Self-correcting with operational growth?</strong></td>
        <td><span class="badge badge-green">Yes</span></td>
        <td>Residual logging automatically calibrates supplier and route delay priors.</td>
      </tr>
      <tr>
        <td><strong>Overall Competition Feasibility</strong></td>
        <td><span class="badge badge-green">High</span></td>
        <td>Technically rigorous, commercially relevant, and immediately executable.</td>
      </tr>
    </tbody>
  </table>

  <div class="card card-gold avoid-break" style="margin-top:10px;">
    <div style="font-family:'Outfit',sans-serif; font-weight:700; font-size:9.5pt; color:#0F1F14; margin-bottom:3px;">
      Verified Public Data Sources
    </div>
    <div style="font-size:8pt; line-height:1.4;">
      <div>1. <strong>Ghana MoFA SRID:</strong> Commodity Prices &amp; Production Statistics (<a href="https://srid.mofa.gov.gh/datasets" style="color:#2D8A4E; text-decoration:none;">srid.mofa.gov.gh/datasets</a>)</div>
      <div>2. <strong>Ghana Open Data Initiative:</strong> District Crop Production Datasets (<a href="https://data.gov.gh/" style="color:#2D8A4E; text-decoration:none;">data.gov.gh</a>)</div>
      <div>3. <strong>WFP / HDX Ghana Food Prices:</strong> ML-ready 27,348 observation dataset (<a href="https://huggingface.co/datasets/electricsheepafrica/africa-wfp-food-prices-for-ghana" style="color:#2D8A4E; text-decoration:none;">HuggingFace: africa-wfp-food-prices-for-ghana</a>)</div>
      <div>4. <strong>Geofabrik OpenStreetMap:</strong> Ghana road network extracts (<a href="https://download.geofabrik.de/africa/ghana.html" style="color:#2D8A4E; text-decoration:none;">download.geofabrik.de/africa/ghana.html</a>)</div>
      <div>5. <strong>WorldPop:</strong> 100m Gridded Population Estimates (<a href="https://hub.worldpop.org/" style="color:#2D8A4E; text-decoration:none;">hub.worldpop.org</a>)</div>
    </div>
  </div>

  <div class="quote-box" style="margin-top:10px; font-style:normal;">
    <strong>Closing Position:</strong> Kuapa Flow is viable precisely because it does not depend on pretending Kuapa already has data it has not yet generated. By solving the immediate coordination and allocation problem on day one, validating every decision against exact mathematical benchmarks, and capturing operational residuals to continuously calibrate future priors, Kuapa Flow establishes a defensible, highly competitive decision intelligence platform.
  </div>

</body>
</html>
"""

def generate_pdf():
    print("Preparing HTML files...")
    with open(COVER_HTML_PATH, "w", encoding="utf-8") as f:
        f.write(COVER_HTML)

    content_html = build_content_html()
    with open(CONTENT_HTML_PATH, "w", encoding="utf-8") as f:
        f.write(content_html)

    print("Launching Playwright Chromium...")
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # 1. Render Cover PDF
        print("Rendering Cover PDF...")
        cover_page = browser.new_page()
        cover_page.goto(COVER_HTML_PATH.as_uri())
        cover_page.evaluate("document.fonts.ready")
        cover_page.pdf(
            path=str(COVER_PDF_PATH),
            format="Letter",
            margin={"top": "0px", "bottom": "0px", "left": "0px", "right": "0px"},
            print_background=True
        )

        # 2. Render Content PDF
        print("Rendering Content PDF...")
        content_page = browser.new_page()
        content_page.goto(CONTENT_HTML_PATH.as_uri())
        content_page.evaluate("document.fonts.ready")

        header_template = """
        <div style="font-size: 8px; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #6b7280; width: 100%; display: flex; justify-content: space-between; border-bottom: 0.5px solid #dde3d5; padding-bottom: 5px; margin: 0 54px;">
            <span style="font-weight: 700; color: #0f1f14; letter-spacing: 0.5px;">KUAPA DWASO</span>
            <span style="font-weight: 600; color: #6b7280;">KUAPA FLOW — FEASIBILITY &amp; DATA STRATEGY</span>
        </div>
        """

        footer_template = """
        <div style="font-size: 8px; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #6b7280; width: 100%; display: flex; justify-content: space-between; border-top: 0.5px solid #dde3d5; padding-top: 5px; margin: 0 54px;">
            <span style="font-weight: 700; color: #2d8a4e;">KuapaDwaso</span>
            <span style="color: #6b7280;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
        """

        content_page.pdf(
            path=str(CONTENT_PDF_PATH),
            format="Letter",
            margin={"top": "70px", "bottom": "70px", "left": "54px", "right": "54px"},
            display_header_footer=True,
            header_template=header_template,
            footer_template=footer_template,
            print_background=True
        )

        browser.close()

    # 3. Merge Cover + Content
    print("Merging PDFs...")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_PDF.parent.mkdir(parents=True, exist_ok=True)

    merger = pypdf.PdfWriter()
    merger.append(str(COVER_PDF_PATH))
    merger.append(str(CONTENT_PDF_PATH))
    
    with open(OUTPUT_PDF, "wb") as f:
        merger.write(f)
    
    # Also write to docs directory as requested
    shutil.copyfile(OUTPUT_PDF, DOCS_PDF)
    print(f"Generated primary PDF at: {OUTPUT_PDF}")
    print(f"Copied to docs folder at: {DOCS_PDF}")

    # Clean up temporary files
    try:
        shutil.rmtree(TMP_DIR)
        print("Cleaned temporary build directory.")
    except Exception as e:
        print(f"Note: Could not clean temporary dir: {e}")

if __name__ == "__main__":
    generate_pdf()
