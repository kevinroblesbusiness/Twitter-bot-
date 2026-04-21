"""
twitter_poster.py
Posts generated images to Twitter/X using the Twitter API v2.

Requires env vars:
    TWITTER_API_KEY
    TWITTER_API_SECRET
    TWITTER_ACCESS_TOKEN
    TWITTER_ACCESS_TOKEN_SECRET
    TWITTER_USERNAME          (optional – used to build tweet URLs in logs)
    TWITTER_CAPTION_TEMPLATE  (optional – e.g. "New look for {model} ✨ #AI #Fashion")
"""

import logging
import os

import tweepy

log = logging.getLogger(__name__)


def _api_v1() -> tweepy.API:
    """OAuth 1.0a client (needed for media upload, which v2 doesn't support directly)."""
    auth = tweepy.OAuth1UserHandler(
        os.environ["TWITTER_API_KEY"],
        os.environ["TWITTER_API_SECRET"],
        os.environ["TWITTER_ACCESS_TOKEN"],
        os.environ["TWITTER_ACCESS_TOKEN_SECRET"],
    )
    return tweepy.API(auth)


def _client_v2() -> tweepy.Client:
    """Twitter API v2 client for creating tweets."""
    return tweepy.Client(
        consumer_key=os.environ["TWITTER_API_KEY"],
        consumer_secret=os.environ["TWITTER_API_SECRET"],
        access_token=os.environ["TWITTER_ACCESS_TOKEN"],
        access_token_secret=os.environ["TWITTER_ACCESS_TOKEN_SECRET"],
    )


def post_image(image_path: str, caption: str = "") -> str | None:
    """
    Upload an image to Twitter and post a tweet with an optional caption.

    Returns:
        Tweet URL string on success, None on failure.
    """
    try:
        media = _api_v1().media_upload(filename=image_path)
        response = _client_v2().create_tweet(
            text=caption,
            media_ids=[media.media_id],
        )
        tweet_id = response.data["id"]
        username = os.environ.get("TWITTER_USERNAME", "")
        url = (
            f"https://twitter.com/{username}/status/{tweet_id}"
            if username
            else f"tweet_id={tweet_id}"
        )
        log.info(f"  [Twitter] Posted: {url}")
        return url
    except Exception as exc:
        log.error(f"  [Twitter] Post failed for {image_path}: {exc}")
        return None


def post_batch(image_paths: list[str], model_name: str) -> list[str]:
    """
    Post each image in image_paths as a separate tweet.

    The caption is read from TWITTER_CAPTION_TEMPLATE env var, with
    {model} replaced by model_name.  Defaults to an empty string.

    Returns:
        List of tweet URLs for successfully posted images.
    """
    template = os.environ.get("TWITTER_CAPTION_TEMPLATE", "")
    posted_urls: list[str] = []
    for path in image_paths:
        caption = template.format(model=model_name)
        url = post_image(path, caption=caption)
        if url:
            posted_urls.append(url)
    return posted_urls
