"""
Semantic Text Chunking Engine for RECALL.
Splits extracted document text into overlapping semantic passages.
"""
from typing import List, Dict, Any


def chunk_text(
    text: str,
    max_chunk_chars: int = 1500,
    overlap_chars: int = 200,
    min_chunk_chars: int = 80
) -> List[Dict[str, Any]]:
    """
    Split long document content into overlapping chunks respecting line & paragraph breaks.
    """
    cleaned_text = text.strip()
    if not cleaned_text:
        return []

    if len(cleaned_text) <= max_chunk_chars:
        return [{
            "chunk_index": 0,
            "content": cleaned_text,
            "char_count": len(cleaned_text),
            "token_count": len(cleaned_text.split()),
        }]

    paragraphs = cleaned_text.split("\n\n")
    chunks: List[str] = []
    current_chunk = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(current_chunk) + len(para) + 2 <= max_chunk_chars:
            current_chunk = f"{current_chunk}\n\n{para}".strip() if current_chunk else para
        else:
            if current_chunk:
                chunks.append(current_chunk)
            
            # If the single paragraph is itself longer than max_chunk_chars, split by sentences/lines
            if len(para) > max_chunk_chars:
                lines = para.split("\n")
                sub_chunk = ""
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    if len(sub_chunk) + len(line) + 1 <= max_chunk_chars:
                        sub_chunk = f"{sub_chunk}\n{line}".strip() if sub_chunk else line
                    else:
                        if sub_chunk:
                            chunks.append(sub_chunk)
                        sub_chunk = line
                if sub_chunk:
                    current_chunk = sub_chunk
                else:
                    current_chunk = ""
            else:
                current_chunk = para

    if current_chunk and len(current_chunk) >= min_chunk_chars:
        chunks.append(current_chunk)
    elif current_chunk and chunks:
        # Append short trailing piece to previous chunk
        chunks[-1] = f"{chunks[-1]}\n\n{current_chunk}"
    elif current_chunk:
        chunks.append(current_chunk)

    formatted_chunks: List[Dict[str, Any]] = []
    for idx, content in enumerate(chunks):
        formatted_chunks.append({
            "chunk_index": idx,
            "content": content,
            "char_count": len(content),
            "token_count": len(content.split()),
        })

    return formatted_chunks
