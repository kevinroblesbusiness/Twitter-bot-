"""
higgsfield_bot.py
Automates Higgsfield AI (higgsfield.ai) using Playwright to:
  1. Log in
  2. Select a character model
  3. Submit a prompt
  4. Wait for generation to finish
  5. Download the resulting image

NOTE: If Higgsfield updates its UI, update the selectors in the constants below.
"""

import os
import time
import uuid
from pathlib import Path
from playwright.sync_api import sync_playwright, Page, Browser, TimeoutError as PWTimeout

# ── Selectors – update these if the Higgsfield UI changes ──────────────────
LOGIN_URL = "https://app.higgsfield.ai/login"
HOME_URL  = "https://app.higgsfield.ai"

SEL_EMAIL_INPUT    = 'input[type="email"]'
SEL_PASSWORD_INPUT = 'input[type="password"]'
SEL_LOGIN_BUTTON   = 'button[type="submit"]'

# On the creation page: the model selector dropdown / tab
SEL_MODEL_PICKER   = '[data-testid="model-selector"], .model-selector, [aria-label="Select model"]'
# Prompt textarea
SEL_PROMPT_INPUT   = 'textarea[placeholder*="prompt" i], textarea[placeholder*="describe" i], [data-testid="prompt-input"]'
# Generate button
SEL_GENERATE_BTN   = 'button:has-text("Generate"), button:has-text("Create"), [data-testid="generate-button"]'
# Generated image result (adjust if Higgsfield uses a different structure)
SEL_RESULT_IMAGE   = '.result-image img, [data-testid="result-image"] img, .generated-image img'
# Download button that may appear on hover / result card
SEL_DOWNLOAD_BTN   = 'button:has-text("Download"), a[download], [data-testid="download-button"]'

WAIT_TIMEOUT   = 120_000   # 2 min max wait for generation
NAV_TIMEOUT    = 30_000    # 30 s for page navigation


class HiggsFieldBot:
    def __init__(self, download_dir: str, headless: bool = True):
        self.download_dir = Path(download_dir)
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.headless = headless
        self._pw = None
        self._browser: Browser | None = None
        self._page: Page | None = None

    # ── Lifecycle ─────────────────────────────────────────────────────────

    def start(self):
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(
            headless=self.headless,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = self._browser.new_context(
            accept_downloads=True,
            viewport={"width": 1280, "height": 900},
        )
        self._page = context.new_page()

    def stop(self):
        if self._browser:
            self._browser.close()
        if self._pw:
            self._pw.stop()

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, *_):
        self.stop()

    # ── Authentication ─────────────────────────────────────────────────────

    def login(self, email: str, password: str) -> bool:
        page = self._page
        print(f"  [HiggsField] Navigating to login page...")
        page.goto(LOGIN_URL, timeout=NAV_TIMEOUT)
        page.wait_for_load_state("networkidle", timeout=NAV_TIMEOUT)

        try:
            page.fill(SEL_EMAIL_INPUT, email)
            page.fill(SEL_PASSWORD_INPUT, password)
            page.click(SEL_LOGIN_BUTTON)
            # Wait until we land somewhere other than the login page
            page.wait_for_url(lambda url: "login" not in url, timeout=NAV_TIMEOUT)
            print("  [HiggsField] Logged in successfully.")
            return True
        except PWTimeout:
            print("  [HiggsField] Login timed out. Check credentials or selectors.")
            return False

    # ── Image generation ──────────────────────────────────────────────────

    def generate_image(self, model_name: str, prompt: str) -> str | None:
        """
        Navigate to the creation page, pick the model, enter the prompt,
        trigger generation, wait, then download the image.

        Returns:
            Local file path of the downloaded image, or None on failure.
        """
        page = self._page
        print(f"  [HiggsField] Generating image for model='{model_name}'...")

        # Go to the main creation page
        page.goto(HOME_URL, timeout=NAV_TIMEOUT)
        page.wait_for_load_state("networkidle", timeout=NAV_TIMEOUT)

        # -- Select model --
        try:
            self._select_model(model_name)
        except Exception as exc:
            print(f"  [HiggsField] Could not select model '{model_name}': {exc}")
            print("  [HiggsField] Proceeding with currently active model.")

        # -- Enter prompt --
        try:
            page.wait_for_selector(SEL_PROMPT_INPUT, timeout=10_000)
            page.fill(SEL_PROMPT_INPUT, "")
            page.type(SEL_PROMPT_INPUT, prompt, delay=30)
        except PWTimeout:
            print("  [HiggsField] Prompt input not found. Check SEL_PROMPT_INPUT selector.")
            return None

        # -- Click generate --
        try:
            page.wait_for_selector(SEL_GENERATE_BTN, timeout=10_000)
            page.click(SEL_GENERATE_BTN)
            print("  [HiggsField] Generation started, waiting for result...")
        except PWTimeout:
            print("  [HiggsField] Generate button not found. Check SEL_GENERATE_BTN selector.")
            return None

        # -- Wait for result image --
        try:
            page.wait_for_selector(SEL_RESULT_IMAGE, timeout=WAIT_TIMEOUT)
        except PWTimeout:
            print("  [HiggsField] Timed out waiting for generated image.")
            return None

        # -- Download image --
        return self._download_result(model_name)

    def _select_model(self, model_name: str):
        """
        Opens the model picker and clicks the option matching model_name.
        Higgsfield may list your trained models by name.
        """
        page = self._page
        page.wait_for_selector(SEL_MODEL_PICKER, timeout=10_000)
        page.click(SEL_MODEL_PICKER)
        # Look for a list item / option containing the model name
        model_option_sel = f'[role="option"]:has-text("{model_name}"), li:has-text("{model_name}"), button:has-text("{model_name}")'
        page.wait_for_selector(model_option_sel, timeout=8_000)
        page.click(model_option_sel)
        time.sleep(0.5)  # small settle delay after selection

    def _download_result(self, model_name: str) -> str | None:
        """
        Downloads the generated image. Tries the Download button first,
        then falls back to grabbing the <img> src and fetching it.
        """
        page = self._page
        filename = f"{model_name}_{uuid.uuid4().hex[:8]}.png"
        dest = self.download_dir / filename

        # Strategy 1: click a Download button if present
        try:
            dl_btn = page.query_selector(SEL_DOWNLOAD_BTN)
            if dl_btn:
                with page.expect_download(timeout=30_000) as dl_info:
                    dl_btn.click()
                download = dl_info.value
                download.save_as(str(dest))
                print(f"  [HiggsField] Downloaded via button -> {dest}")
                return str(dest)
        except Exception:
            pass

        # Strategy 2: grab <img> src and fetch it
        try:
            img_el = page.query_selector(SEL_RESULT_IMAGE)
            if img_el:
                src = img_el.get_attribute("src")
                if src:
                    import requests
                    resp = requests.get(src, timeout=30)
                    resp.raise_for_status()
                    dest.write_bytes(resp.content)
                    print(f"  [HiggsField] Downloaded via img src -> {dest}")
                    return str(dest)
        except Exception as exc:
            print(f"  [HiggsField] Image download failed: {exc}")

        return None

    # ── Batch helper ──────────────────────────────────────────────────────

    def generate_batch(
        self,
        model_name: str,
        prompts: list[str],
        email: str,
        password: str,
    ) -> list[str]:
        """
        Log in once, then generate one image per prompt.

        Returns list of downloaded file paths (skips failures).
        """
        results = []
        if not self.login(email, password):
            return results
        for prompt in prompts:
            path = self.generate_image(model_name, prompt)
            if path:
                results.append(path)
            time.sleep(3)  # brief pause between generations
        return results
