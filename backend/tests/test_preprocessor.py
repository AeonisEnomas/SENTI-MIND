from app.services.preprocessor import clean_text


def test_emoji_mapping():
    text, tokens = clean_text("I am so sad 😭")
    assert "heavy sobbing" in text
    assert "heavy sobbing" in tokens
    assert "😭" not in text


def test_url_stripping():
    text, _ = clean_text("Check this out https://example.com/help")
    assert "https://example.com/help" not in text
    assert "Check this out" in text


def test_whitespace_cleanup():
    text, _ = clean_text("Too    much   space\n\n\nlinebreaks")
    assert "Too much space linebreaks" == text


def test_combined_cleaning():
    raw = "HELP!!! 🆘 I'm drowning 🌊. Visit http://crisis.org"
    cleaned, tokens = clean_text(raw)
    assert "SOS emergency" in cleaned
    assert "wave overwhelming" in cleaned
    assert "http://crisis.org" not in cleaned
    assert "drowning" in cleaned
    assert len(tokens) == 2
