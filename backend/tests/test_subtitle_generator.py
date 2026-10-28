from app.schemas.caption import SubtitleSegment
from app.services.subtitle_generator import (
    seconds_to_srt_time,
    seconds_to_vtt_time,
    parse_offset_to_seconds,
    group_words_into_cues,
    build_cues_from_plain_text,
    generate_srt,
    generate_vtt,
    generate_txt,
    export_from_segments,
    process_transcription_results,
)


def test_time_conversions():
    # 0 seconds
    assert seconds_to_srt_time(0.0) == "00:00:00,000"
    assert seconds_to_vtt_time(0.0) == "00:00:00.000"

    # 1.25 seconds
    assert seconds_to_srt_time(1.25) == "00:00:01,250"
    assert seconds_to_vtt_time(1.25) == "00:00:01.250"

    # 65.5 seconds (1 min 5.5 sec)
    assert seconds_to_srt_time(65.5) == "00:01:05,500"
    assert seconds_to_vtt_time(65.5) == "00:01:05.500"

    # 3661.123 seconds (1 hour 1 min 1.123 sec)
    assert seconds_to_srt_time(3661.123) == "01:01:01,123"
    assert seconds_to_vtt_time(3661.123) == "01:01:01.123"


def test_parse_offset_to_seconds():
    assert parse_offset_to_seconds("1.5s") == 1.5
    assert parse_offset_to_seconds("2.25") == 2.25
    assert parse_offset_to_seconds(3) == 3.0
    assert parse_offset_to_seconds(4.75) == 4.75
    assert parse_offset_to_seconds(None) == 0.0
    assert parse_offset_to_seconds("invalid") == 0.0


def test_group_words_into_cues():
    mock_words = [
        {"word": "Welcome", "start_offset": "0.1s", "end_offset": "0.5s"},
        {"word": "to", "start_offset": "0.6s", "end_offset": "0.8s"},
        {"word": "the", "start_offset": "0.9s", "end_offset": "1.1s"},
        {"word": "class.", "start_offset": "1.2s", "end_offset": "1.7s"},
        {"word": "Today", "start_offset": "2.5s", "end_offset": "2.9s"},
        {"word": "we", "start_offset": "3.0s", "end_offset": "3.2s"},
        {"word": "learn", "start_offset": "3.3s", "end_offset": "3.7s"},
        {"word": "Gemini.", "start_offset": "3.8s", "end_offset": "4.4s"},
    ]

    cues = group_words_into_cues(mock_words)
    assert len(cues) >= 2
    assert cues[0].id == 1
    assert cues[0].text == "Welcome to the class."
    assert cues[0].start_seconds == 0.1
    assert cues[0].end_seconds == 1.7
    assert cues[0].start_time == "00:00:00,100"

    assert cues[1].id == 2
    assert cues[1].text == "Today we learn Gemini."


def test_build_cues_from_plain_text():
    text = "Hello everyone. Welcome to modern speech recognition. Let us begin."
    cues = build_cues_from_plain_text(text, total_duration_seconds=12.0)
    assert len(cues) == 3
    assert cues[0].id == 1
    assert cues[0].text == "Hello everyone."
    assert cues[1].id == 2
    assert cues[1].text == "Welcome to modern speech recognition."
    assert cues[2].id == 3
    assert cues[2].text == "Let us begin."


def test_generate_srt_and_vtt():
    segments = [
        SubtitleSegment(
            id=1,
            start_seconds=1.0,
            end_seconds=3.5,
            start_time="00:00:01,000",
            end_time="00:00:03,500",
            text="First sentence.",
        ),
        SubtitleSegment(
            id=2,
            start_seconds=4.0,
            end_seconds=7.0,
            start_time="00:00:04,000",
            end_time="00:00:07,000",
            text="Second sentence.",
        ),
    ]

    srt_out = generate_srt(segments)
    assert "1\n00:00:01,000 --> 00:00:03,500\nFirst sentence." in srt_out
    assert "2\n00:00:04,000 --> 00:00:07,000\nSecond sentence." in srt_out

    vtt_out = generate_vtt(segments)
    assert vtt_out.startswith("WEBVTT")
    assert "1\n00:00:01.000 --> 00:00:03.500\nFirst sentence." in vtt_out
    assert "2\n00:00:04.000 --> 00:00:07.000\nSecond sentence." in vtt_out


def test_export_from_segments_and_edits():
    original_segments = [
        SubtitleSegment(
            id=1,
            start_seconds=0.0,
            end_seconds=2.0,
            start_time="00:00:00,000",
            end_time="00:00:02,000",
            text="Original cue text.",
        )
    ]
    exports = export_from_segments(original_segments)
    assert "Original cue text." in exports.txt
    assert "Original cue text." in exports.srt
    assert "Original cue text." in exports.vtt

    # User edits cue text
    edited_segments = [
        SubtitleSegment(
            id=1,
            start_seconds=0.0,
            end_seconds=2.0,
            start_time="00:00:00,000",
            end_time="00:00:02,000",
            text="Edited cue text by user.",
        )
    ]
    updated_exports = export_from_segments(edited_segments)
    assert "Edited cue text by user." in updated_exports.txt
    assert "Edited cue text by user." in updated_exports.srt
    assert "Edited cue text by user." in updated_exports.vtt


def test_process_transcription_results():
    # With word timestamps
    words = [
        {"word": "Testing", "start_offset": "0.0s", "end_offset": "0.5s"},
        {"word": "transcription.", "start_offset": "0.6s", "end_offset": "1.2s"},
    ]
    segs, exps, estimated = process_transcription_results("Testing transcription.", words=words)
    assert estimated is False
    assert len(segs) == 1
    assert segs[0].text == "Testing transcription."

    # Without word timestamps (fallback)
    segs2, exps2, estimated2 = process_transcription_results("Fallback text here.", words=None)
    assert estimated2 is True
    assert len(segs2) >= 1
