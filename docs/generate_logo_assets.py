import os
from playwright.sync_api import sync_playwright

output_dir = r"c:\Users\Kevin\Projects\ML\agriculture\docs"

svg_content = '''<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="22" cy="30" r="6" fill="#2d8a4e" opacity="0.5" />
  <circle cx="18" cy="60" r="6" fill="#2d8a4e" opacity="0.65" />
  <circle cx="22" cy="90" r="6" fill="#2d8a4e" opacity="0.8" />
  <circle cx="48" cy="45" r="8" fill="#2d8a4e" opacity="0.85" />
  <circle cx="48" cy="75" r="8" fill="#2d8a4e" opacity="0.9" />
  <circle cx="88" cy="60" r="22" fill="#2d8a4e" />
</svg>'''

svg_path = os.path.join(output_dir, "kuapa_dwaso_logo.svg")
with open(svg_path, "w", encoding="utf-8") as f:
    f.write(svg_content)
print(f"Saved SVG to {svg_path}")

html_content = f'''<!DOCTYPE html>
<html>
<head>
<style>
  body {{
    margin: 0;
    padding: 0;
    background: transparent;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 600px;
    height: 600px;
  }}
  svg {{
    width: 500px;
    height: 500px;
  }}
</style>
</head>
<body>
{svg_content}
</body>
</html>'''

temp_html = os.path.join(output_dir, "temp_logo.html")
png_path = os.path.join(output_dir, "kuapa_dwaso_logo.png")

with open(temp_html, "w", encoding="utf-8") as f:
    f.write(html_content)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 600, "height": 600})
    page.goto("file://" + temp_html)
    page.screenshot(path=png_path, omit_background=True)
    browser.close()

if os.path.exists(temp_html):
    os.remove(temp_html)

print(f"Saved PNG to {png_path}")
