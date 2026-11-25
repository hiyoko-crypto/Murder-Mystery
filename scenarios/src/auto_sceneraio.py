"""Generate a complete detective-game scenario JSON with an LLM.

The module deliberately separates model invocation from scenario-generation logic.
You can use the default OpenAI-compatible client (Qwen API, vLLM, LM Studio, etc.)
or inject your own ``model_callable`` for another provider/local model.

Minimal example
---------------

    from auto_sceneraio import generate_scenario

    result = generate_scenario(
        prompt=GENERATOR_PROMPT,                 # your prompt string
        input_file="seed_scenario.json",         # input JSON to be filled/extended
        template="backend_template.json",       # required output JSON structure
        output_path="generated_scenario.json",
        model="qwen-plus",
        base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        api_key_env="DASHSCOPE_API_KEY",
    )

For local/custom models, pass ``model_callable``. Its signature is:

    model_callable(messages: list[dict], **kwargs) -> str | dict | provider_response

It should return either the generated text, a dict containing ``content`` or
``text``, or an OpenAI-style chat completion response.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any, Callable, Dict, List, Mapping, Optional, Union

JSONLike = Union[Dict[str, Any], List[Any], str, Path]
ModelCallable = Callable[..., Any]


class ScenarioGenerationError(RuntimeError):
    """Raised when the model cannot return a valid scenario JSON."""


def _load_json(value: JSONLike, *, name: str) -> Any:
    """Load JSON from a Python object or a JSON file path/string."""
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, Path):
        path = value
    elif isinstance(value, str):
        # Avoid treating a long JSON document as a filesystem path.
        stripped = value.lstrip()
        if stripped.startswith(("{", "[")):
            return json.loads(value)
        candidate = Path(value)
        try:
            is_file = candidate.exists() and candidate.is_file()
        except OSError:
            is_file = False
        if is_file:
            path = candidate
        else:
            # A string may itself be a JSON document.
            try:
                return json.loads(value)
            except json.JSONDecodeError as exc:
                raise FileNotFoundError(
                    f"{name} must be a JSON file path, dict/list, or JSON string; "
                    f"the path does not exist and the string is not valid JSON: {value!r}"
                ) from exc
    else:
        raise TypeError(f"Unsupported {name} type: {type(value).__name__}")

    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def _extract_response_text(response: Any) -> str:
    """Normalise common OpenAI-compatible and custom model response shapes."""
    if isinstance(response, str):
        return response

    if isinstance(response, Mapping):
        for key in ("content", "text", "output", "response"):
            value = response.get(key)
            if isinstance(value, str):
                return value
        # OpenAI-compatible response represented as a plain dict.
        choices = response.get("choices")
        if choices:
            message = choices[0].get("message", {})
            content = message.get("content")
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                return "\n".join(
                    part.get("text", "") for part in content if isinstance(part, Mapping)
                )
        # Also accept a custom adapter that directly returns the generated JSON dict.
        if not choices and not any(key in response for key in ("content", "text", "output", "response")):
            return json.dumps(response, ensure_ascii=False)

    # OpenAI Python SDK object response.
    try:
        content = response.choices[0].message.content
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "\n".join(
                getattr(part, "text", "") or "" for part in content
            )
    except (AttributeError, IndexError, TypeError):
        pass

    raise TypeError(
        "Could not extract text from model response. Return a string, a dict with "
        "'content'/'text', or an OpenAI-compatible chat completion response."
    )


def _parse_json_response(text: str) -> Any:
    """Parse a JSON response, tolerating Markdown fences and surrounding text."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Attempt to decode the first JSON object/array if the model added prose.
        decoder = json.JSONDecoder()
        for index, char in enumerate(cleaned):
            if char not in "[{":
                continue
            try:
                parsed, _end = decoder.raw_decode(cleaned[index:])
                return parsed
            except json.JSONDecodeError:
                continue
    raise json.JSONDecodeError("No valid JSON object/array found in model output", text, 0)


def _template_shape_errors(
    template: Any,
    generated: Any,
    *,
    path: str = "$",
    strict_keys: bool = False,
) -> List[str]:
    """Check that generated JSON preserves the key/type shape of a JSON template.

    Object keys in the template are required. Extra keys are allowed unless
    ``strict_keys=True``. For a non-empty template list, its first element acts
    as the item shape. Empty template lists do not constrain array contents.
    """
    errors: List[str] = []

    if isinstance(template, dict):
        if not isinstance(generated, dict):
            return [f"{path}: expected object, got {type(generated).__name__}"]
        missing = [key for key in template if key not in generated]
        if missing:
            errors.append(f"{path}: missing required key(s): {missing}")
        if strict_keys:
            extra = [key for key in generated if key not in template]
            if extra:
                errors.append(f"{path}: unexpected key(s): {extra}")
        for key, template_value in template.items():
            if key in generated:
                errors.extend(
                    _template_shape_errors(
                        template_value,
                        generated[key],
                        path=f"{path}.{key}",
                        strict_keys=strict_keys,
                    )
                )
        return errors

    if isinstance(template, list):
        if not isinstance(generated, list):
            return [f"{path}: expected array, got {type(generated).__name__}"]
        if template:
            for index, item in enumerate(generated):
                errors.extend(
                    _template_shape_errors(
                        template[0], item,
                        path=f"{path}[{index}]",
                        strict_keys=strict_keys,
                    )
                )
        return errors

    if template is None:
        return errors

    # Booleans must be checked before integers (bool is a subclass of int).
    expected_type = type(template)
    if expected_type is bool:
        if type(generated) is not bool:
            errors.append(f"{path}: expected boolean")
    elif expected_type is int:
        if type(generated) is not int:
            errors.append(f"{path}: expected integer")
    elif expected_type is float:
        if not isinstance(generated, (int, float)) or isinstance(generated, bool):
            errors.append(f"{path}: expected number")
    elif expected_type is str:
        if not isinstance(generated, str):
            errors.append(f"{path}: expected string")
    return errors


def openai_compatible_chat_completion(
    messages: List[Dict[str, str]],
    *,
    model: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 16000,
    timeout: float = 180.0,
    json_mode: bool = True,
    **extra_kwargs: Any,
) -> Any:
    """Default model adapter for OpenAI-compatible APIs, including Qwen/vLLM.

    Install the optional dependency with ``pip install openai``.
    ``base_url`` can point to DashScope's compatible endpoint or a local vLLM
    server, for example ``http://localhost:8000/v1``.
    """
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise ImportError(
            "The default model adapter requires the 'openai' package. "
            "Install it with `pip install openai`, or provide model_callable."
        ) from exc

    resolved_key = api_key or os.getenv("OPENAI_API_KEY") or os.getenv("DASHSCOPE_API_KEY")
    # Local OpenAI-compatible servers commonly accept any non-empty placeholder.
    if not resolved_key and base_url:
        resolved_key = "EMPTY"
    if not resolved_key:
        raise ValueError(
            "No API key found. Pass api_key or set OPENAI_API_KEY / DASHSCOPE_API_KEY."
        )

    client = OpenAI(
        api_key=resolved_key,
        base_url=base_url or os.getenv("OPENAI_BASE_URL"),
        timeout=timeout,
    )
    kwargs: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    kwargs.update(extra_kwargs)
    return client.chat.completions.create(**kwargs)


def generate_scenario(
    prompt: str,
    input_file: JSONLike,
    template_json: JSONLike,
    *,
    example_json: Optional[JSONLike] = None,
    output_path: Optional[Union[str, Path]] = None,
    model: str = "qwen-plus",
    model_callable: Optional[ModelCallable] = None,
    api_key: Optional[str] = None,
    api_key_env: Optional[str] = None,
    base_url: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 16000,
    timeout: float = 180.0,
    max_retries: int = 2,
    json_mode: bool = True,
    strict_template_keys: bool = False,
    model_kwargs: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Generate a complete scenario JSON.

    Parameters
    ----------
    prompt:
        Your already-defined system prompt as a string.
    input_file:
        Seed/input JSON, either a dict/list, JSON string, or file path.
        Its full content is sent to the model.
    template_json:
        Desired output JSON structure, either a dict/list or JSON file path.
        Every object key in this template is required in the model output.
    example_json:
        Optional valid example JSON. It is clearly labelled as a format example,
        not as facts that must be copied into the new scenario.
    output_path:
        Optional path to write the final JSON atomically.
    model_callable:
        Optional custom model adapter. It receives ``messages`` plus model
        settings as keyword arguments. This is the recommended integration point
        for non-OpenAI-compatible local models.
    max_retries:
        Number of repair attempts after invalid JSON/template output.

    Returns
    -------
    dict
        The generated complete scenario JSON.
    """
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("prompt must be a non-empty string")
    if max_retries < 0:
        raise ValueError("max_retries must be >= 0")

    source_data = _load_json(input_file, name="input_file")
    template_data = _load_json(template_json, name="template_json")
    example_data = (
        _load_json(example_json, name="example_json")
        if example_json is not None else None
    )

    system_prompt = (
        prompt.strip()
        + "\n\nOUTPUT CONTRACT:\n"
        "Return exactly one complete JSON object (or array if the template root is an array). "
        "Do not wrap it in Markdown fences. Preserve the template's required structure. "
        "Do not include explanations before or after the JSON."
    )

    payload: Dict[str, Any] = {
        "input_file_json": source_data,
        "required_output_template_json": template_data,
    }
    if example_data is not None:
        payload["valid_format_example_json"] = example_data
        payload["example_note"] = (
            "Use this only as a structural/backend-format example. Do not copy its scenario facts."
        )

    user_message = (
        "Generate the completed scenario using the system instructions.\n\n"
        "The following JSON contains the source file and output template.\n"
        "Treat the source file as the scenario data to work from, and the template as the required output shape.\n\n"
        + _json_text(payload)
    )

    caller = model_callable or openai_compatible_chat_completion
    call_kwargs: Dict[str, Any] = {
        "model": model,
        "api_key": api_key or (os.getenv(api_key_env) if api_key_env else None),
        "base_url": base_url,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "timeout": timeout,
        "json_mode": json_mode,
    }
    if model_kwargs:
        call_kwargs.update(model_kwargs)

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]
    errors: List[str] = []
    last_text = ""

    for attempt in range(max_retries + 1):
        try:
            response = caller(messages=messages, **call_kwargs)
            last_text = _extract_response_text(response)
            result = _parse_json_response(last_text)
            shape_errors = _template_shape_errors(
                template_data,
                result,
                strict_keys=strict_template_keys,
            )
            if shape_errors:
                raise ValueError("Template validation failed: " + "; ".join(shape_errors[:30]))
            if not isinstance(result, (dict, list)):
                raise ValueError("Model output root must be a JSON object or array")

            if output_path is not None:
                destination = Path(output_path)
                destination.parent.mkdir(parents=True, exist_ok=True)
                # Atomic write prevents a partially written scenario file.
                with tempfile.NamedTemporaryFile(
                    "w", encoding="utf-8", dir=str(destination.parent),
                    delete=False, suffix=".tmp"
                ) as tmp:
                    json.dump(result, tmp, ensure_ascii=False, indent=2)
                    tmp.write("\n")
                    temp_name = tmp.name
                os.replace(temp_name, destination)
            return result

        except Exception as exc:
            errors.append(f"Attempt {attempt + 1}: {type(exc).__name__}: {exc}")
            if attempt >= max_retries:
                break
            messages = messages + [
                {"role": "assistant", "content": last_text or "(No valid JSON was returned.)"},
                {
                    "role": "user",
                    "content": (
                        "Your previous response could not be accepted. Fix the following issue(s) "
                        "and return the entire corrected JSON, not a patch.\n"
                        + "\n".join(errors)
                    ),
                },
            ]

    raise ScenarioGenerationError(
        "Scenario generation failed after all attempts:\n- " + "\n- ".join(errors)
    )


# A descriptive alias for users who prefer a verb-first function name.
auto_generate_scenario = generate_scenario


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate a scenario JSON with an LLM.")
    parser.add_argument("--prompt-file", required=True, help="UTF-8 text file containing the prompt")
    parser.add_argument("--input", required=True, help="Input/seed scenario JSON")
    parser.add_argument("--template", required=True, help="Required output JSON template")
    parser.add_argument("--example", help="Optional valid example JSON")
    parser.add_argument("--output", required=True, help="Output scenario JSON path")
    parser.add_argument("--model", default="qwen-plus")
    parser.add_argument("--base-url", default=None)
    parser.add_argument("--api-key-env", default=None)
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--max-tokens", type=int, default=16000)
    parser.add_argument("--max-retries", type=int, default=2)
    args = parser.parse_args()

    prompt_text = Path(args.prompt_file).read_text(encoding="utf-8")
    generated = generate_scenario(
        prompt=prompt_text,
        input_file=args.input,
        template_json=args.template,
        example_json=args.example,
        output_path=args.output,
        model=args.model,
        base_url=args.base_url,
        api_key_env=args.api_key_env,
        temperature=args.temperature,
        max_tokens=args.max_tokens,
        max_retries=args.max_retries,
    )
    print(f"Generated scenario written to: {args.output}")
    print(f"Top-level keys: {list(generated) if isinstance(generated, dict) else 'array root'}")
