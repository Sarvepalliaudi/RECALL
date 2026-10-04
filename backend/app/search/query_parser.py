"""
Natural Language Query Parser for RECALL.
Extracts semantic topics, file types, relative time horizons, and target device mentions.
"""
import re
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from pydantic import BaseModel


class ParsedQuery(BaseModel):
    raw_query: str
    semantic_topic: str
    target_extensions: List[str] = []
    target_device: Optional[str] = None
    time_after: Optional[datetime] = None
    time_before: Optional[datetime] = None
    is_multi_result: bool = True


FILE_TYPE_PATTERNS = {
    r"\b(pdf|document|manual)\b": [".pdf"],
    r"\b(word|docx|doc)\b": [".docx"],
    r"\b(screenshot|image|photo|picture|diagram|png|jpg|jpeg)\b": [".png", ".jpg", ".jpeg", ".webp"],
    r"\b(code|script|program|python|javascript|typescript|java)\b": [".py", ".ts", ".js", ".java", ".tsx"],
    r"\b(sheet|excel|csv|spreadsheet|data)\b": [".csv"],
    r"\b(markdown|notes|readme)\b": [".md", ".txt"],
}

DEVICE_PATTERNS = {
    r"\b(windows(\s+pc)?|desktop)\b": "windows",
    r"\b(mac|macbook|apple|osx)\b": "macos",
    r"\b(iphone|ios|phone)\b": "ios",
    r"\b(android(\s+phone)?)\b": "android",
    r"\b(linux)\b": "linux",
}


def parse_query(query: str) -> ParsedQuery:
    """
    Parses natural language queries like:
    - 'Find the AWS architecture screenshot I saved last month'
    - 'Find the PDF containing the disaster recovery team diagram'
    - 'Show everything related to GATE preparation that I downloaded this week'
    """
    normalized = query.strip()
    now = datetime.now(timezone.utc)
    target_extensions: List[str] = []
    target_device: Optional[str] = None
    time_after: Optional[datetime] = None
    time_before: Optional[datetime] = None

    # 1. Match File Types
    for pattern, extensions in FILE_TYPE_PATTERNS.items():
        if re.search(pattern, normalized, re.IGNORECASE):
            target_extensions.extend(extensions)

    # 2. Match Devices
    for pattern, device_name in DEVICE_PATTERNS.items():
        if re.search(pattern, normalized, re.IGNORECASE):
            target_device = device_name
            break

    # 3. Match Relative Time
    if re.search(r"\b(today)\b", normalized, re.IGNORECASE):
        time_after = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif re.search(r"\b(yesterday)\b", normalized, re.IGNORECASE):
        yesterday = now - timedelta(days=1)
        time_after = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        time_before = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif re.search(r"\b(this\s+week)\b", normalized, re.IGNORECASE):
        time_after = now - timedelta(days=7)
    elif re.search(r"\b(last\s+week)\b", normalized, re.IGNORECASE):
        time_after = now - timedelta(days=14)
        time_before = now - timedelta(days=7)
    elif re.search(r"\b(this\s+month)\b", normalized, re.IGNORECASE):
        time_after = now - timedelta(days=30)
    elif re.search(r"\b(last\s+month)\b", normalized, re.IGNORECASE):
        time_after = now - timedelta(days=60)
        time_before = now - timedelta(days=30)
    elif re.search(r"\b(this\s+year)\b", normalized, re.IGNORECASE):
        time_after = now - timedelta(days=365)

    # 4. Clean semantic topic (strip conversational filler phrases)
    clean_topic = re.sub(
        r"^(find|show|search|get|look for|where is|bring up|give me|list)\s+",
        "",
        normalized,
        flags=re.IGNORECASE
    )
    clean_topic = re.sub(
        r"\b(i\s+saved|i\s+downloaded|that\s+i|from\s+last\s+\w+|from\s+this\s+\w+|last\s+\w+|this\s+\w+|today|yesterday)\b",
        "",
        clean_topic,
        flags=re.IGNORECASE
    )
    clean_topic = re.sub(r"\s+", " ", clean_topic).strip()

    return ParsedQuery(
        raw_query=normalized,
        semantic_topic=clean_topic if clean_topic else normalized,
        target_extensions=list(set(target_extensions)),
        target_device=target_device,
        time_after=time_after,
        time_before=time_before,
        is_multi_result=bool(re.search(r"\b(all|everything|files|list|show)\b", normalized, re.IGNORECASE))
    )
