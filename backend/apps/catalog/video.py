
from django.conf import settings


def bunny_playback_url(video_id: str) -> str:
    library_id = settings.BUNNY_LIBRARY_ID.strip()
    video_id = video_id.strip("/")
    if not library_id or not video_id:
        raise ValueError("Bunny library ID or video ID is missing")
    return (
        f"https://player.mediadelivery.net/play/"
        f"{library_id}/{video_id}"
    )
