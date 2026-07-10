import fitz
import os

pdf_path = r"c:\Users\Kevin\Projects\ML\agriculture\docs\product\kuapa-dwaso-product-description.pdf"
output_dir = r"C:\Users\Kevin\.gemini\antigravity\brain\9fc2987a-0cb8-4d0d-883e-87f47a885c21"

if not os.path.exists(pdf_path):
    print("PDF not found at:", pdf_path)
    exit(1)

doc = fitz.open(pdf_path)
for i in range(len(doc)):
    page = doc[i]
    pix = page.get_pixmap(dpi=150)
    output_path = os.path.join(output_dir, f"page_{i+1}.png")
    pix.save(output_path)
    print(f"Saved: {output_path}")
print("Finished converting pages.")
