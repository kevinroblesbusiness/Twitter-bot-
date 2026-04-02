"""
prompt_generator.py
Generates fashion/seductive image prompts for each model using Claude API.
"""

import anthropic

# Character definitions – update descriptions as needed
MODELS = {
    "leah": {
        "name": "Leah",
        "description": "18-year-old Asian woman with long blonde hair, elegant features, bright eyes",
    },
    "catalina": {
        "name": "Catalina",
        "description": "18-year-old Latina woman with dark brown hair, warm tan skin, confident and fiery look",
    },
    "isabella": {
        "name": "Isabella",
        "description": "18-year-old Asian woman with straight black hair, mysterious and alluring gaze",
    },
}

SYSTEM_PROMPT = """You are a professional AI image prompt writer specializing in high-fashion and glamour photography.
Your prompts are used in AI image generators to create stunning, artistic visuals.
Write detailed, evocative prompts that describe lighting, clothing, setting, pose, and mood.
Keep each prompt under 120 words. Be creative and vary the style, location, and outfit each time.
Output ONLY the prompt text — no labels, no numbering, no extra commentary."""

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env
    return _client


def generate_prompt(model_key: str, count: int = 1) -> list[str]:
    """
    Generate `count` image prompts for the given model.

    Args:
        model_key: One of 'leah', 'catalina', 'isabella'
        count: Number of prompts to generate (default 1)

    Returns:
        List of prompt strings
    """
    if model_key not in MODELS:
        raise ValueError(f"Unknown model key '{model_key}'. Choose from: {list(MODELS)}")

    model_info = MODELS[model_key]
    client = _get_client()

    prompts = []
    for i in range(count):
        user_message = (
            f"Write {1} unique high-fashion, seductive image prompt for this character:\n"
            f"Character: {model_info['name']}\n"
            f"Appearance: {model_info['description']}\n\n"
            f"Requirements:\n"
            f"- Fashion-forward, glamorous, or editorial style\n"
            f"- Vary the setting (urban, beach, studio, rooftop, penthouse, etc.)\n"
            f"- Vary the outfit (lingerie, designer dress, bodysuit, athleisure, etc.)\n"
            f"- Include lighting details (golden hour, neon, soft studio light, etc.)\n"
            f"- Seductive but artistic — think Vogue or high-end fashion photography\n"
            f"- Make it distinct from common AI defaults\n"
            f"Prompt #{i + 1} of {count}:"
        )

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=200,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        prompt_text = response.content[0].text.strip()
        prompts.append(prompt_text)

    return prompts


def generate_all_prompts(count_per_model: int = 2) -> dict[str, list[str]]:
    """
    Generate prompts for all 3 models.

    Args:
        count_per_model: Number of prompts per model per run

    Returns:
        Dict mapping model_key -> list of prompt strings
    """
    result = {}
    for model_key in MODELS:
        print(f"  Generating {count_per_model} prompts for {MODELS[model_key]['name']}...")
        result[model_key] = generate_prompt(model_key, count=count_per_model)
    return result


if __name__ == "__main__":
    # Quick test
    import json
    prompts = generate_all_prompts(count_per_model=1)
    print(json.dumps(prompts, indent=2))
