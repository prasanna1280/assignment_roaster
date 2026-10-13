"""Shared test helpers for the submissions/roasts module (fixture tarballs, fake OpenAI)."""

import io
import json
import tarfile
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any

from app.schemas.roast import LLMRoastResult

TOP = "octo-hello-abc1234"


def make_tarball(
    files: dict[str, str | bytes],
    top: str = TOP,
    raw_members: list[tuple[tarfile.TarInfo, bytes | None]] | None = None,
) -> bytes:
    """Build a gzipped tarball in memory, GitHub style (all under ``{top}/``)."""
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        top_info = tarfile.TarInfo(top)
        top_info.type = tarfile.DIRTYPE
        archive.addfile(top_info)
        for path, content in files.items():
            data = content.encode("utf-8") if isinstance(content, str) else content
            info = tarfile.TarInfo(f"{top}/{path}")
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
        for info, data in raw_members or []:
            if data is not None:
                info.size = len(data)
                archive.addfile(info, io.BytesIO(data))
            else:
                archive.addfile(info)
    return buffer.getvalue()


def normal_repo_files() -> dict[str, str | bytes]:
    """A small, realistic Python project."""
    return {
        "README.md": "# Hello\nA tiny todo app.\n",
        "main.py": "from app.core import run\n\nif __name__ == '__main__':\n    run()\n",
        "app/core.py": "def run() -> None:\n    return None\n",
        "tests/test_core.py": "def test_run():\n    assert True\n",
        "pyproject.toml": "[project]\nname = 'hello'\n",
        "logo.png": b"\x89PNG\r\n\x1a\n\x00\x00binary",
    }


def valid_roast_dict(**overrides: Any) -> dict[str, Any]:
    """A valid RoastResult payload."""
    data: dict[str, Any] = {
        "overall_score": 6.5,
        "category_scores": {
            "code_quality": 6,
            "structure": 7,
            "readability": 7.5,
            "documentation": 4,
            "testing": 3,
            "best_practices": 6,
        },
        "headline": "Machaan, code semma, aana tests enga da?",
        "roast_text": "## Roast\nREADME la konjam detail podu machaan.",
        "strengths": ["Clean function names"],
        "improvements": [
            {
                "file": "main.py",
                "line_hint": None,
                "issue": "No error handling",
                "suggestion": "Wrap run() in try/except and log errors.",
                "severity": "medium",
            },
            {
                "file": "README.md",
                "line_hint": "line 1",
                "issue": "README too short",
                "suggestion": "Add setup and run instructions.",
                "severity": "low",
            },
            {
                "file": "tests/test_core.py",
                "line_hint": "test_run",
                "issue": "Test asserts True only",
                "suggestion": "Assert real behaviour of run().",
                "severity": "high",
            },
        ],
    }
    data.update(overrides)
    return data


def make_completion(
    parsed: dict[str, Any] | None = None,
    refusal: str | None = None,
    prompt_tokens: int = 100,
    completion_tokens: int = 50,
    model: str = "gpt-test-2026",
) -> SimpleNamespace:
    """Build an object shaped like ``ParsedChatCompletion``."""
    parsed_model = LLMRoastResult.model_validate(parsed) if parsed is not None else None
    message = SimpleNamespace(
        parsed=parsed_model,
        refusal=refusal,
        content=json.dumps(parsed) if parsed is not None else None,
    )
    return SimpleNamespace(
        choices=[SimpleNamespace(message=message)],
        usage=SimpleNamespace(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens),
        model=model,
    )


@dataclass
class FakeCompletions:
    """Returns (or raises) queued responses from ``parse``; records every call."""

    responses: list[Any]
    calls: list[dict[str, Any]] = field(default_factory=list)

    async def parse(self, **kwargs: Any) -> Any:
        self.calls.append({**kwargs, "messages": list(kwargs["messages"])})
        response = self.responses.pop(0)
        if isinstance(response, BaseException):
            raise response
        return response


class FakeOpenAIClient:
    """Mimics ``AsyncOpenAI`` enough for ``roast_service.generate_roast``."""

    def __init__(self, responses: list[Any]) -> None:
        self.completions = FakeCompletions(responses)
        self.chat = SimpleNamespace(completions=self.completions)
