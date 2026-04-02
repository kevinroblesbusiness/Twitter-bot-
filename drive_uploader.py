"""
drive_uploader.py
Uploads images to Google Drive using a Service Account.

Setup (one-time):
  1. Go to console.cloud.google.com → Create a project
  2. Enable the Google Drive API
  3. Create a Service Account → download the JSON key → save as service_account.json
  4. Share your target Drive folder with the service account's email (Editor role)
  5. Set GOOGLE_SERVICE_ACCOUNT_FILE and GOOGLE_DRIVE_FOLDER_ID in .env
"""

import os
from datetime import date
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/drive"]


class DriveUploader:
    def __init__(self, service_account_file: str, root_folder_id: str):
        self.root_folder_id = root_folder_id
        credentials = service_account.Credentials.from_service_account_file(
            service_account_file, scopes=SCOPES
        )
        self._service = build("drive", "v3", credentials=credentials)
        self._folder_cache: dict[str, str] = {}

    # ── Folder helpers ────────────────────────────────────────────────────

    def _get_or_create_folder(self, name: str, parent_id: str) -> str:
        """Return the ID of a subfolder, creating it if it doesn't exist."""
        cache_key = f"{parent_id}/{name}"
        if cache_key in self._folder_cache:
            return self._folder_cache[cache_key]

        # Search for existing folder
        query = (
            f"name='{name}' and mimeType='application/vnd.google-apps.folder' "
            f"and '{parent_id}' in parents and trashed=false"
        )
        results = (
            self._service.files()
            .list(q=query, spaces="drive", fields="files(id, name)")
            .execute()
        )
        files = results.get("files", [])
        if files:
            folder_id = files[0]["id"]
        else:
            metadata = {
                "name": name,
                "mimeType": "application/vnd.google-apps.folder",
                "parents": [parent_id],
            }
            folder = self._service.files().create(body=metadata, fields="id").execute()
            folder_id = folder["id"]

        self._folder_cache[cache_key] = folder_id
        return folder_id

    def _model_date_folder(self, model_name: str) -> str:
        """
        Ensure the path  <root>/<ModelName>/<YYYY-MM-DD>/  exists and return its ID.
        """
        model_folder_id = self._get_or_create_folder(model_name.capitalize(), self.root_folder_id)
        date_str = date.today().isoformat()   # e.g. "2025-08-01"
        date_folder_id = self._get_or_create_folder(date_str, model_folder_id)
        return date_folder_id

    # ── Upload ────────────────────────────────────────────────────────────

    def upload(self, file_path: str, model_name: str) -> str:
        """
        Upload a file to  <root>/<model_name>/<today>/

        Returns the Google Drive file ID.
        """
        dest_folder_id = self._model_date_folder(model_name)
        file_name = Path(file_path).name

        file_metadata = {
            "name": file_name,
            "parents": [dest_folder_id],
        }
        media = MediaFileUpload(file_path, mimetype="image/png", resumable=True)
        uploaded = (
            self._service.files()
            .create(body=file_metadata, media_body=media, fields="id, webViewLink")
            .execute()
        )
        file_id = uploaded.get("id")
        link = uploaded.get("webViewLink", "")
        print(f"  [Drive] Uploaded '{file_name}' → {link or file_id}")
        return file_id

    def upload_batch(self, file_paths: list[str], model_name: str) -> list[str]:
        """Upload multiple files for a given model. Returns list of Drive file IDs."""
        ids = []
        for path in file_paths:
            try:
                fid = self.upload(path, model_name)
                ids.append(fid)
            except Exception as exc:
                print(f"  [Drive] Failed to upload '{path}': {exc}")
        return ids
