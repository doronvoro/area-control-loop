#!/usr/bin/env python3
"""Simple login test."""

from playwright.sync_api import sync_playwright
import time

def test_login():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        # Capture network responses
        responses = []
        def handle_response(response):
            if 'supabase' in response.url or 'auth' in response.url:
                responses.append({
                    'url': response.url,
                    'status': response.status,
                })
        page.on("response", handle_response)

        print("1. Going to login page...")
        page.goto('http://localhost:3000/login')
        page.wait_for_load_state('networkidle')
        time.sleep(2)
        print(f"   URL: {page.url}")

        print("2. Filling form...")
        email_input = page.locator('input[placeholder="your@email.com"]')
        password_input = page.locator('input[type="password"]')

        email_input.fill('admin@example.com')
        time.sleep(0.5)
        password_input.fill('admin123')
        time.sleep(0.5)

        print("3. Submitting...")
        page.click('button[type="submit"]')

        # Wait for response
        time.sleep(5)
        page.wait_for_load_state('networkidle')

        print(f"4. After login URL: {page.url}")
        page.screenshot(path='/tmp/login_result.png')

        print("\n5. Network responses (Supabase/auth):")
        for r in responses:
            print(f"   {r['status']} - {r['url'][:80]}")

        print("\n6. Console logs:")
        for log in console_logs:
            print(f"   {log}")

        # Check if there's an error message on the page
        error_text = page.locator('[class*="destructive"], [class*="error"], [class*="alert"]').all_text_contents()
        if error_text:
            print(f"\n7. Error message: {error_text}")

        browser.close()

if __name__ == '__main__':
    test_login()
