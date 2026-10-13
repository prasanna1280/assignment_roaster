"""Tests for OpenAI roast generation (fake client; no network)."""

import json
from typing import Any

import httpx2
import openai
import pytest

from app.config import settings
from app.services import roast_service
from app.services.repo_filter_service import RepoFile, RepoSnapshot
from tests.roaster_helpers import FakeOpenAIClient, make_completion, valid_roast_dict


@pytest.fixture
def snapshot() -> RepoSnapshot:
    return RepoSnapshot(
        files=[RepoFile("main.py", "print('hi')\n")],
        tree="* main.py",
        files_analyzed=1,
        total_files=1,
        has_committed_secrets=False,
        primary_language="Python",
    )


async def test_valid_output(snapshot: RepoSnapshot) -> None:
    client = FakeOpenAIClient([make_completion(valid_roast_dict())])
    generation = await roast_service.generate_roast(snapshot, "Todo", "Build a todo", client)

    assert generation.result.overall_score == 6.5
    assert generation.model == "gpt-test-2026"
    assert (generation.input_tokens, generation.output_tokens) == (100, 50)

    call = client.completions.calls[0]
    assert call["model"] == settings.OPENAI_MODEL
    assert call["response_format"] is roast_service.LLMRoastResult
    assert "temperature" not in call
    assert call["messages"][0]["role"] == "system"
    assert "<untrusted_repo_content>" in call["messages"][1]["content"]


async def test_refusal_then_valid_retries_once(snapshot: RepoSnapshot) -> None:
    client = FakeOpenAIClient(
        [make_completion(refusal="I can't help with that"), make_completion(valid_roast_dict())]
    )
    generation = await roast_service.generate_roast(snapshot, None, None, client)

    assert generation.result.headline
    assert len(client.completions.calls) == 2
    assert (generation.input_tokens, generation.output_tokens) == (200, 100)
    retry_messages = client.completions.calls[1]["messages"]
    assert retry_messages[-1]["role"] == "user"
    assert "could not be used" in retry_messages[-1]["content"]


async def test_invalid_then_valid(snapshot: RepoSnapshot) -> None:
    bad = valid_roast_dict(overall_score=42, improvements=[])
    client = FakeOpenAIClient([make_completion(bad), make_completion(valid_roast_dict())])
    generation = await roast_service.generate_roast(snapshot, None, None, client)

    assert generation.result.overall_score == 6.5
    retry_messages = client.completions.calls[1]["messages"]
    # The bad answer is echoed back as assistant content, followed by the correction.
    assert retry_messages[-2]["role"] == "assistant"
    assert "overall_score" in retry_messages[-1]["content"]
    assert "improvements" in retry_messages[-1]["content"]


async def test_invalid_twice_raises(snapshot: RepoSnapshot) -> None:
    bad = valid_roast_dict(headline="x" * 301)
    client = FakeOpenAIClient([make_completion(bad), make_completion(bad)])
    with pytest.raises(roast_service.RoastGenerationError) as exc_info:
        await roast_service.generate_roast(snapshot, None, None, client)
    assert exc_info.value.code == "ai_invalid_output"
    assert len(client.completions.calls) == 2


async def test_partially_valid_category_score_rejected(snapshot: RepoSnapshot) -> None:
    bad = valid_roast_dict()
    bad["category_scores"]["testing"] = -1
    client = FakeOpenAIClient([make_completion(bad), make_completion(None)])
    with pytest.raises(roast_service.RoastGenerationError) as exc_info:
        await roast_service.generate_roast(snapshot, None, None, client)
    assert exc_info.value.code == "ai_invalid_output"


async def test_sdk_level_parse_errors_retry(snapshot: RepoSnapshot) -> None:
    length_error = openai.LengthFinishReasonError(completion=make_completion(None))  # type: ignore[arg-type]
    client = FakeOpenAIClient([length_error, json.JSONDecodeError("bad", "{", 0)])
    with pytest.raises(roast_service.RoastGenerationError) as exc_info:
        await roast_service.generate_roast(snapshot, None, None, client)
    assert exc_info.value.code == "ai_invalid_output"


async def test_no_choices_is_invalid(snapshot: RepoSnapshot) -> None:
    empty: Any = make_completion(None)
    empty.choices = []
    empty.usage = None
    client = FakeOpenAIClient([empty, make_completion(valid_roast_dict())])
    generation = await roast_service.generate_roast(snapshot, None, None, client)
    assert generation.input_tokens == 100


def _status_error(cls: type[openai.APIStatusError], status: int) -> openai.APIStatusError:
    request = httpx2.Request("POST", "https://api.openai.com/v1/chat/completions")
    response = httpx2.Response(status, request=request, json={"error": {"message": "x"}})
    return cls("x", response=response, body=None)


@pytest.mark.parametrize(
    "error",
    [
        lambda: _status_error(openai.AuthenticationError, 401),
        lambda: _status_error(openai.RateLimitError, 429),
        lambda: _status_error(openai.InternalServerError, 500),
        lambda: openai.APIConnectionError(
            request=httpx2.Request("POST", "https://api.openai.com/v1/chat/completions")
        ),
        lambda: openai.OpenAIError("client misconfigured"),
    ],
)
async def test_api_errors_become_ai_unavailable(snapshot: RepoSnapshot, error: Any) -> None:
    client = FakeOpenAIClient([error()])
    with pytest.raises(roast_service.RoastGenerationError) as exc_info:
        await roast_service.generate_roast(snapshot, None, None, client)
    assert exc_info.value.code == "ai_unavailable"
    assert len(client.completions.calls) == 1


def test_get_openai_client_requires_key(monkeypatch: pytest.MonkeyPatch) -> None:
    roast_service.get_openai_client.cache_clear()
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
    with pytest.raises(roast_service.RoastGenerationError) as exc_info:
        roast_service.get_openai_client()
    assert exc_info.value.code == "ai_unavailable"
    roast_service.get_openai_client.cache_clear()


def test_get_openai_client_builds_async_client() -> None:
    roast_service.get_openai_client.cache_clear()
    client = roast_service.get_openai_client()
    assert isinstance(client, openai.AsyncOpenAI)
    roast_service.get_openai_client.cache_clear()


async def test_real_sdk_parse_path_with_mock_transport(snapshot: RepoSnapshot) -> None:
    """Exercise the real SDK ``chat.completions.parse`` against a mocked HTTP transport."""
    captured: dict[str, Any] = {}

    def handler(request: httpx2.Request) -> httpx2.Response:
        captured["body"] = json.loads(request.content)
        return httpx2.Response(
            200,
            json={
                "id": "chatcmpl-1",
                "object": "chat.completion",
                "created": 1,
                "model": "gpt-test-2026",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {
                            "role": "assistant",
                            "content": json.dumps(valid_roast_dict()),
                            "refusal": None,
                        },
                    }
                ],
                "usage": {"prompt_tokens": 11, "completion_tokens": 22, "total_tokens": 33},
            },
        )

    client = openai.AsyncOpenAI(
        api_key="sk-test",
        http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(handler)),
    )
    generation = await roast_service.generate_roast(snapshot, None, None, client)

    assert generation.result.category_scores.readability == 7.5
    assert (generation.input_tokens, generation.output_tokens) == (11, 22)
    body = captured["body"]
    assert "temperature" not in body
    assert body["response_format"]["type"] == "json_schema"
    assert body["response_format"]["json_schema"]["strict"] is True
    schema_text = json.dumps(body["response_format"]["json_schema"]["schema"])
    for keyword in ("minimum", "maximum", "minItems", "maxItems", "maxLength"):
        assert keyword not in schema_text


@pytest.mark.parametrize("placeholder", ["(project)", "(repo-wide)", "N/A", "various", " Project "])
async def test_placeholder_file_reference_is_retried(
    snapshot: RepoSnapshot, placeholder: str
) -> None:
    bad = valid_roast_dict()
    bad["improvements"][0]["file"] = placeholder
    client = FakeOpenAIClient([make_completion(bad), make_completion(valid_roast_dict())])
    generation = await roast_service.generate_roast(snapshot, None, None, client)

    assert all(item.file != placeholder for item in generation.result.improvements)
    correction = client.completions.calls[1]["messages"][-1]["content"]
    assert "placeholder" in correction


def test_stored_roast_with_placeholder_still_serializes() -> None:
    from app.schemas.roast import RoastResponse

    data = valid_roast_dict()
    data["improvements"][0]["file"] = "(project)"
    response = RoastResponse.model_validate(
        {**data, "id": 1, "model_used": "gpt-test", "created_at": "2026-10-13T00:00:00Z"}
    )
    assert response.improvements[0].file == "(project)"


def test_new_file_paths_are_allowed() -> None:
    from app.schemas.roast import RoastResult, is_placeholder_file

    data = valid_roast_dict()
    data["improvements"][0]["file"] = "tests/test_app.py"
    data["improvements"][0]["line_hint"] = "new file"
    assert RoastResult.model_validate(data).improvements[0].file == "tests/test_app.py"
    assert not is_placeholder_file("src/(group)/page.tsx")
