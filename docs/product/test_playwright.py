import sys
try:
    from playwright.sync_api import sync_playwright
    print("Playwright is installed.")
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
            print("Chromium launched successfully.")
            browser.close()
        except Exception as e:
            print("Error launching Chromium:", e)
except ImportError:
    print("Playwright is not installed in the python environment.")
