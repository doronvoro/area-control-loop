
#!/usr/bin/env python3
"""Test script for Area Control Loop app - management page and admin monitoring form."""

from playwright.sync_api import sync_playwright
import time

def test_app():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        print("=== Testing Area Control Loop App ===\n")

        # 1. Go to login page
        print("1. Navigating to login page...")
        page.goto('http://localhost:3000/login')
        page.wait_for_load_state('networkidle')
        page.screenshot(path='/tmp/01_login_page.png')
        print("   Screenshot saved: /tmp/01_login_page.png")

        # 2. Login as admin
        print("2. Logging in as admin@example.com...")
        # Use placeholder text to find inputs
        page.fill('input[placeholder="your@email.com"]', 'admin@example.com')
        page.fill('input[type="password"]', 'admin123')
        page.click('button[type="submit"]')
        page.wait_for_load_state('networkidle')
        time.sleep(2)  # Wait for redirect
        page.screenshot(path='/tmp/02_after_login.png')
        print(f"   Current URL: {page.url}")
        print("   Screenshot saved: /tmp/02_after_login.png")

        # 3. Test Management page
        print("\n3. Testing Management page...")
        page.goto('http://localhost:3000/manage')
        page.wait_for_load_state('networkidle')
        time.sleep(1)
        page.screenshot(path='/tmp/03_manage_page.png')
        print(f"   Current URL: {page.url}")
        print("   Screenshot saved: /tmp/03_manage_page.png")

        # Get page content to check what's rendered
        content = page.content()
        if 'ניהול' in content or 'manage' in content.lower():
            print("   Management page loaded successfully")

        # 4. Test Admin Monitoring page
        print("\n4. Testing Admin Monitoring page...")
        page.goto('http://localhost:3000/admin/monitoring')
        page.wait_for_load_state('networkidle')
        time.sleep(1)
        page.screenshot(path='/tmp/04_admin_monitoring.png')
        print(f"   Current URL: {page.url}")
        print("   Screenshot saved: /tmp/04_admin_monitoring.png")

        # Check for form elements
        content = page.content()
        if 'לקוח' in content or 'customer' in content.lower():
            print("   Admin monitoring form loaded with customer selection")

        # 5. Test cascade API by selecting a customer
        print("\n5. Testing cascade selection...")

        # Try to find and click customer dropdown
        customer_selects = page.locator('select').all()
        print(f"   Found {len(customer_selects)} select elements")

        if len(customer_selects) > 0:
            # Take screenshot of current state
            page.screenshot(path='/tmp/05_form_state.png')
            print("   Screenshot saved: /tmp/05_form_state.png")

        # 6. Check navbar for new menu items
        print("\n6. Checking navbar...")
        nav_content = page.locator('nav').inner_html() if page.locator('nav').count() > 0 else ""
        if 'אזורים' in nav_content or 'ניהול' in nav_content:
            print("   Navbar contains expected Hebrew menu items")

        # Print console logs
        print("\n7. Console logs:")
        for log in console_logs[-20:]:  # Last 20 logs
            print(f"   {log}")

        browser.close()
        print("\n=== Tests completed ===")
        print("Screenshots saved in /tmp/")

if __name__ == '__main__':
    test_app()
