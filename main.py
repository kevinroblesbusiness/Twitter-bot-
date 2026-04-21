"""
main.py
Orchestrates the full pipeline:
  1. Generate prompts with Claude
  2. Automate Higgsfield AI to produce images
  3. Save images to a local folder (organized by model/date)
  4. Post each image to Twitter/X (when TWITTER_ENABLED=true)

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
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from prompt_generator import generate_all_prompts, MODELS
from higgsfield_bot import HiggsFieldBot
import twitter_poster

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

DOWNLOAD_DIR     = os.getenv("DOWNLOAD_DIR", "downloads")
HEADLESS         = os.getenv("HEADLESS", "true").lower() == "true"
SCHEDULE_TIMES   = os.getenv("SCHEDULE_TIMES", "08:00,14:00,20:00")
TWITTER_ENABLED  = os.getenv("TWITTER_ENABLED", "false").lower() == "true"

IMAGES_PER_RUN = 2   # images per model per run (3 runs × 2 = 6/model/day)


# ── Core pipeline ─────────────────────────────────────────────────────────

def run_pipeline():
    """Generate prompts → produce images → save to local folder."""
    log.info("=" * 60)
    log.info("Pipeline started")
    log.info("=" * 60)

    # 1. Generate prompts for all models
    log.info(f"Step 1/2 – Generating {IMAGES_PER_RUN} prompts per model via Claude...")
    try:
        all_prompts: dict[str, list[str]] = generate_all_prompts(count_per_model=IMAGES_PER_RUN)
    except Exception as exc:
        log.error(f"Prompt generation failed: {exc}")
        return

    # 2. For each model: run Higgsfield and save images locally
    today = date.today().isoformat()  # e.g. "2025-08-01"

    for model_key, prompts in all_prompts.items():
        model_display = MODELS[model_key]["name"]

        # Save to  downloads/<ModelName>/<YYYY-MM-DD>/
        save_dir = Path(DOWNLOAD_DIR) / model_display / today
        save_dir.mkdir(parents=True, exist_ok=True)

        log.info(f"Step 2/2 – Generating images for {model_display} → {save_dir}")

        try:
            with HiggsFieldBot(download_dir=str(save_dir), headless=HEADLESS) as bot:
                downloaded_files = bot.generate_batch(
                    model_name=model_display,
                    prompts=prompts,
                    email=HIGGSFIELD_EMAIL,
                    password=HIGGSFIELD_PASSWORD,
                )
        except Exception as exc:
            log.error(f"Higgsfield automation error for {model_display}: {exc}")
            downloaded_files = []

        if downloaded_files:
            log.info(f"  Saved {len(downloaded_files)} image(s) for {model_display} to {save_dir}")
        else:
            log.warning(f"  No images saved for {model_display}.")
            continue

        # 3. Post images to Twitter (optional)
        if TWITTER_ENABLED and downloaded_files:
            log.info(f"Step 3/3 – Posting {len(downloaded_files)} image(s) to Twitter for {model_display}...")
            posted = twitter_poster.post_batch(downloaded_files, model_name=model_display)
            log.info(f"  Posted {len(posted)}/{len(downloaded_files)} tweet(s) for {model_display}")

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
