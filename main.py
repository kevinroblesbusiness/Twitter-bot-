"""
main.py
Orchestrates the full pipeline:
  1. Generate prompts with Claude
  2. Automate Higgsfield AI to produce images
  3. Upload images to Google Drive

Schedule (default): runs 3× per day at 08:00, 14:00, 20:00
Each run generates 2 images per model → 6 images/model/day × 3 models = 18 total/day

Usage:
    python main.py            # start the scheduler (runs forever)
    python main.py --now      # run one batch immediately and exit
"""

import argparse
import os
import sys
import logging
from pathlib import Path

from dotenv import load_dotenv
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from prompt_generator import generate_all_prompts, MODELS
from higgsfield_bot import HiggsFieldBot
from drive_uploader import DriveUploader

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

# ── Config from environment ───────────────────────────────────────────────

HIGGSFIELD_EMAIL    = os.environ["HIGGSFIELD_EMAIL"]
HIGGSFIELD_PASSWORD = os.environ["HIGGSFIELD_PASSWORD"]

SA_FILE        = os.environ["GOOGLE_SERVICE_ACCOUNT_FILE"]
DRIVE_FOLDER   = os.environ["GOOGLE_DRIVE_FOLDER_ID"]

DOWNLOAD_DIR   = os.getenv("DOWNLOAD_DIR", "downloads")
HEADLESS       = os.getenv("HEADLESS", "true").lower() == "true"
SCHEDULE_TIMES = os.getenv("SCHEDULE_TIMES", "08:00,14:00,20:00")

IMAGES_PER_RUN = 2   # images per model per run  (2 runs × 3 models = 6/model/day)


# ── Core pipeline ─────────────────────────────────────────────────────────

def run_pipeline():
    """Generate prompts → produce images → upload to Drive."""
    log.info("=" * 60)
    log.info("Pipeline started")
    log.info("=" * 60)

    # 1. Generate prompts for all models
    log.info(f"Step 1/3 – Generating {IMAGES_PER_RUN} prompts per model via Claude...")
    try:
        all_prompts: dict[str, list[str]] = generate_all_prompts(count_per_model=IMAGES_PER_RUN)
    except Exception as exc:
        log.error(f"Prompt generation failed: {exc}")
        return

    # 2. For each model: run Higgsfield, download images
    drive = DriveUploader(SA_FILE, DRIVE_FOLDER)

    for model_key, prompts in all_prompts.items():
        model_display = MODELS[model_key]["name"]
        log.info(f"Step 2/3 – Generating images for {model_display} on Higgsfield AI...")

        try:
            with HiggsFieldBot(download_dir=DOWNLOAD_DIR, headless=HEADLESS) as bot:
                downloaded_files = bot.generate_batch(
                    model_name=model_display,
                    prompts=prompts,
                    email=HIGGSFIELD_EMAIL,
                    password=HIGGSFIELD_PASSWORD,
                )
        except Exception as exc:
            log.error(f"Higgsfield automation error for {model_display}: {exc}")
            downloaded_files = []

        if not downloaded_files:
            log.warning(f"No images downloaded for {model_display}. Skipping upload.")
            continue

        # 3. Upload to Google Drive
        log.info(f"Step 3/3 – Uploading {len(downloaded_files)} image(s) for {model_display} to Drive...")
        try:
            drive.upload_batch(downloaded_files, model_name=model_display)
        except Exception as exc:
            log.error(f"Drive upload error for {model_display}: {exc}")
            continue

        # Clean up local files after upload
        for f in downloaded_files:
            try:
                Path(f).unlink()
            except OSError:
                pass

    log.info("Pipeline complete.\n")


# ── Scheduler ─────────────────────────────────────────────────────────────

def _parse_schedule(times_str: str) -> list[tuple[int, int]]:
    """Parse 'HH:MM,HH:MM,...' into list of (hour, minute) tuples."""
    result = []
    for t in times_str.split(","):
        t = t.strip()
        h, m = map(int, t.split(":"))
        result.append((h, m))
    return result


def start_scheduler():
    schedule = _parse_schedule(SCHEDULE_TIMES)
    scheduler = BlockingScheduler(timezone="UTC")

    for hour, minute in schedule:
        scheduler.add_job(
            run_pipeline,
            CronTrigger(hour=hour, minute=minute),
            id=f"pipeline_{hour:02d}{minute:02d}",
            max_instances=1,
            coalesce=True,
        )
        log.info(f"Scheduled pipeline at {hour:02d}:{minute:02d} UTC")

    log.info("Scheduler running. Press Ctrl+C to stop.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("Scheduler stopped.")


# ── Entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Higgsfield AI automation bot")
    parser.add_argument(
        "--now",
        action="store_true",
        help="Run one pipeline batch immediately and exit (no scheduler)",
    )
    args = parser.parse_args()

    if args.now:
        run_pipeline()
    else:
        start_scheduler()
