from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Login
    page.goto('http://localhost:3000/login')
    page.wait_for_load_state('networkidle')
    page.locator('input[placeholder="your@email.com"]').fill('admin@example.com')
    page.locator('input[type="password"]').fill('admin123')
    page.click('button:has-text("התחבר")')
    page.wait_for_load_state('networkidle')
    time.sleep(2)
    print("✓ Logged in")

    # Go to monitoring form
    page.goto('http://localhost:3000/monitoring')
    page.wait_for_load_state('networkidle')
    time.sleep(1)
    print("✓ At monitoring form")

    # Select customer
    page.locator('button:has-text("בחר לקוח")').first.click()
    page.wait_for_timeout(500)
    page.locator('[role="option"]').first.click()
    page.wait_for_timeout(1000)
    print("✓ Customer selected")

    # Select inspector
    page.locator('button:has-text("בחר פקח")').first.click()
    page.wait_for_timeout(500)
    page.locator('[role="option"]').first.click()
    page.wait_for_timeout(500)
    print("✓ Inspector selected")

    # Select area
    page.locator('button:has-text("בחר אזור")').first.click()
    page.wait_for_timeout(500)
    page.locator('[role="option"]').first.click()
    page.wait_for_timeout(1000)
    print("✓ Area selected")

    # --- Entry 1 ---
    print("\n--- Filling Entry 1 ---")

    # Select sub-area for entry 1
    page.locator('button[role="combobox"] >> text="בחר תת-שטח"').first.click()
    page.wait_for_timeout(500)
    page.locator('[role="option"]').first.click()
    page.wait_for_timeout(500)
    print("  ✓ Sub-area 1 selected")

    # Select finding for entry 1
    page.locator('button[role="combobox"] >> text="בחר ממצא"').first.click()
    page.wait_for_timeout(500)
    page.locator('[role="option"]').first.click()
    page.wait_for_timeout(500)
    print("  ✓ Finding 1 selected")

    # --- Add Entry 2 ---
    print("\n--- Adding Entry 2 ---")
    page.locator('button:has-text("הוסף רשומה")').click()
    page.wait_for_timeout(1000)
    print("  ✓ Entry 2 added")

    # List all comboboxes to see what's available
    all_cb = page.locator('button[role="combobox"]').all()
    print(f"  All comboboxes ({len(all_cb)}):")
    for i, cb in enumerate(all_cb):
        text = cb.text_content().strip()
        is_disabled = cb.is_disabled()
        # Only show if it's not already selected (contains placeholder text)
        if 'בחר' in text or 'תחילה' in text:
            print(f"    {i}: '{text}' disabled={is_disabled}")

    # Entry 2's sub-area should be the combobox with exactly "בחר תת-שטח" that is NOT disabled
    # Find it by looking for non-disabled comboboxes with "בחר תת-שטח" text (exact)
    for cb in all_cb:
        text = cb.text_content().strip()
        if text == "בחר תת-שטח" and not cb.is_disabled():
            print(f"  Clicking Entry 2 sub-area: '{text}'")
            cb.click()
            page.wait_for_timeout(500)
            page.locator('[role="option"]').first.click()  # Same sub-area
            page.wait_for_timeout(500)
            print("  ✓ Sub-area 2 selected")
            break

    # Entry 2's finding - find "בחר ממצא" that is NOT disabled
    all_cb = page.locator('button[role="combobox"]').all()
    for cb in all_cb:
        text = cb.text_content().strip()
        if text == "בחר ממצא" and not cb.is_disabled():
            print(f"  Clicking Entry 2 finding: '{text}'")
            cb.click()
            page.wait_for_timeout(500)
            options = page.locator('[role="option"]').all()
            if len(options) > 1:
                options[1].click()  # Different finding
            else:
                options[0].click()
            page.wait_for_timeout(500)
            print("  ✓ Finding 2 selected")
            break

    page.screenshot(path='/tmp/before_submit.png', full_page=True)
    print("\n✓ Screenshot: /tmp/before_submit.png")

    # Submit the form
    print("\n--- Submitting Form ---")
    page.locator('button:has-text("שמור דוח ניטור")').click()
    page.wait_for_timeout(3000)

    page.screenshot(path='/tmp/after_submit.png', full_page=True)

    # Check result
    content = page.content()
    if 'הדוח נשמר בהצלחה' in content:
        print("\n✅ SUCCESS: Form submitted with 2 entries!")
    elif 'duplicate key' in content.lower():
        print("\n❌ FAILED: Duplicate key constraint error")
    elif 'שגיאה' in content:
        alert = page.locator('[role="alert"]').first
        if alert.is_visible():
            print(f"\n❌ ERROR: {alert.text_content()}")
    else:
        print("\n⚠️  Check /tmp/after_submit.png")

    browser.close()
