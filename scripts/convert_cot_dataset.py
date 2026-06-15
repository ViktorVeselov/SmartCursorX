#!/usr/bin/env python3
"""
Fable 5 Chain-of-Thought → Instruction-Tuning Dataset Converter.

Converts the fable5_cot_merged.json (CoT conversation JSONL) into
instruction-tuning JSONL format compatible with finetune_qlora.py.

Output modes:
  --mode think         (default)  Full context → chain-of-thought + action
  --mode instruction   USER query → ASSISTANT response
  --mode cot           Chain-of-thought included as part of response
  --mode tool          Tool-call patterns preserved (teaches tool use)
  --mode code_only     Only entries containing code/file writes

Usage:
    python convert_cot_dataset.py \
        --input data-set/fable5_cot_merged.json \
        --output data-set/fable5_ft_instruction.jsonl \
        --mode instruction \
        --max-samples 2000

Pipeline (full automated):
    python convert_cot_dataset.py --input data-set/fable5_cot_merged.json \
        --output data-set/fable5_ft.jsonl \
        --mode instruction --max-samples 2000
    python finetune_qlora.py \
        --hf-model Qwen/Qwen2.5-Coder-7B-Instruct \
        --dataset data-set/fable5_ft.jsonl \
        --output-dir ./finetuned/fable5-qwen \
        --quantization 4bit --num-epochs 3 --use-unsloth
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from typing import Optional


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert Fable 5 CoT dataset to instruction-tuning format")
    parser.add_argument("--input", type=str, default="data-set/fable5_cot_merged.json",
                        help="Input CoT JSONL path")
    parser.add_argument("--output", type=str, default="data-set/fable5_ft_instruction.jsonl",
                        help="Output instruction JSONL path")
    parser.add_argument("--mode", type=str, default="think",
                        choices=["session", "instruction", "cot", "tool", "think", "code_only"],
                        help="Conversion mode (see docstring)")
    parser.add_argument("--max-samples", type=int, default=0,
                        help="Max samples (0 = all)")
    parser.add_argument("--session", type=str, default="",
                        help="Process only a specific session UUID")
    parser.add_argument("--dedup", action="store_true", default=True,
                        help="Deduplicate by instruction hash (default: on)")
    parser.add_argument("--min-response-len", type=int, default=100,
                        help="Minimum response/output length to include")
    parser.add_argument("--filter-truncated", action="store_true", default=False,
                        help="Skip entries with [truncated] markers in output")
    parser.add_argument("--max-output-len", type=int, default=0,
                        help="Truncate outputs longer than N chars (0 = no limit)")
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Cleaning utilities
# ---------------------------------------------------------------------------

ANSI_ESCAPE = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]')
CONTROL_CHARS = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]')
TRUNCATED_MARKERS = re.compile(
    r'(?:'
    r'…\[(earlier )?truncated\]…'
    r'|\.{2,}\[((earlier )?)truncated\]\.{2,}'
    r'|\s*\[(earlier )?truncated\]\s*'
    r')'
)
CAVEAT_BLOCK = re.compile(
    r'<local-command-caveat>.*?</local-command-caveat>\s*', re.DOTALL
)
COMMAND_STDOUT = re.compile(
    r'<local-command-stdout>.*?</local-command-stdout>\s*', re.DOTALL
)
COMMAND_STUB = re.compile(
    r'<command-name>.*?</command-name>\s*<command-message>.*?</command-message>\s*<command-args>.*?</command-args>\s*', re.DOTALL
)
TOOL_RESULT_PREFIX = re.compile(r'^(TOOL RESULT:?|TOOL RESULT:)\s*', re.MULTILINE)
TERMINAL_LINE = re.compile(
    r'^(?:[.\-–—\s]*)(?:-x---|drwx|total\s+\d+|bin\s+|etc\s+|usr\s+|home\s+|root\s+|node\s|'
    r'rw-r|rwx|d\s{3}|app|server|archives|public)', re.MULTILINE
)


def clean_context(text: str) -> str:
    """Remove system boilerplate from context strings."""
    text = ANSI_ESCAPE.sub('', text)
    text = CONTROL_CHARS.sub('', text)
    text = TRUNCATED_MARKERS.sub('', text)
    text = CAVEAT_BLOCK.sub('', text)
    text = COMMAND_STDOUT.sub('', text)
    text = COMMAND_STUB.sub('', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def extract_last_user_message(context: str) -> str:
    """Extract the last clean USER instruction, skipping terminal-output noise."""
    parts = re.split(r'^USER:\s*', context, flags=re.MULTILINE)
    if len(parts) <= 1:
        return clean_context(context)

    SHORT_NOISE = re.compile(r'^[.\-–—\s]{0,5}$')

    for i in range(len(parts) - 1, 0, -1):
        msg = parts[i].strip()
        msg = clean_context(msg)
        if not msg or SHORT_NOISE.match(msg):
            continue
        # Skip messages that are purely terminal/file output
        lines = msg.split('\n')
        terminal_lines = sum(1 for l in lines if TERMINAL_LINE.match(l))
        if len(lines) > 3 and terminal_lines > len(lines) * 0.6:
            continue
        if len(msg) < 10:
            continue
        return msg

    return clean_context(parts[-1])


def extract_context_before_last_user(context: str) -> str:
    """Extract conversation context leading up to the last USER message."""
    parts = re.split(r'^USER:\s*', context, flags=re.MULTILINE)
    if len(parts) <= 2:
        # Only one USER message, or we have the preamble + first message
        return clean_context(parts[0]) if parts else ""
    # Everything before the last USER message
    before = "".join(parts[:-1])
    return clean_context(before)


def clean_completion(completion: str, mode: str) -> str:
    """Clean and format the assistant completion based on mode."""
    # Remove the <think> tag content if not in cot mode
    if mode != "cot" and mode != "tool":
        completion = re.sub(r'<think>.*?</think>\s*', '', completion, flags=re.DOTALL)

    # Strip tool result boilerplate
    completion = completion.strip()
    return completion


def extract_output_for_text(completion: str) -> str:
    """For text entries, extract the assistant message."""
    # Remove think block
    text = re.sub(r'<think>.*?</think>\s*', '', completion, flags=re.DOTALL).strip()
    # Extract message after ASSISTANT (message):
    msg_match = re.search(r'ASSISTANT\s*\(message\):\s*(.*)', text, re.DOTALL)
    if msg_match:
        return clean_output(msg_match.group(1).strip())
    return clean_output(text)


def extract_output_for_tool(completion: str) -> str:
    """For tool_use entries, extract the thinking + tool call pattern."""
    # Keep the think block + tool call
    # Remove the TOOL RESULT parts (those are the system's response)
    text = re.sub(r'\nTOOL RESULT:.*?(\nASSISTANT|\Z)', r'\1', completion, flags=re.DOTALL)
    text = re.sub(r'TOOL RESULT:.*', '', text, flags=re.DOTALL)
    # Extract just the thinking + tool call
    think_match = re.search(r'<think>.*?</think>', text, re.DOTALL)
    tool_match = re.search(r'ASSISTANT\s*\(tool call\).*', text, re.DOTALL)
    result = ""
    if think_match:
        result += think_match.group(0) + "\n"
    if tool_match:
        result += tool_match.group(0)
    return clean_output(result.strip() or text.strip())


# ---------------------------------------------------------------------------
# Entry parsing
# ---------------------------------------------------------------------------

def parse_entries(input_path: str) -> list[dict]:
    """Load all entries from CoT JSONL."""
    entries = []
    with open(input_path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                entries.append(entry)
            except json.JSONDecodeError as e:
                print(f"  WARN: Skipping bad JSON line: {e}", file=sys.stderr)
    return entries


def group_by_session(entries: list[dict]) -> dict[str, list[dict]]:
    """Group entries by session UUID, maintaining order."""
    sessions = defaultdict(list)
    for entry in entries:
        session_id = entry.get("session", "unknown")
        # Extract turn number from uid (e.g., "...#5" -> 5)
        uid = entry.get("uid", "")
        turn = 0
        if "#" in uid:
            try:
                turn = int(uid.split("#")[-1])
            except ValueError:
                turn = 0
        entry["_turn"] = turn
        sessions[session_id].append(entry)

    # Sort entries within each session by turn number
    for sid in sessions:
        sessions[sid].sort(key=lambda e: e.get("_turn", 0))

    return dict(sessions)


# ---------------------------------------------------------------------------
# Conversion modes
# ---------------------------------------------------------------------------

def get_session_prompt(sessions: dict[str, list[dict]], session_id: str) -> str:
    """Extract the initial user instruction from a session's first entry."""
    turns = sessions.get(session_id, [])
    if not turns:
        return ""
    # The first turn's context usually contains the original user request
    ctx = turns[0].get("context", "")
    # Try to get the first non-noise USER message
    parts = re.split(r'^USER:\s*', ctx, flags=re.MULTILINE)
    for p in parts[1:3]:  # First couple USER messages
        cleaned = clean_context(p.strip())
        if len(cleaned) > 20 and not TERMINAL_LINE.match(cleaned):
            return cleaned
    # Fallback: just the last user message from the first entry
    return extract_last_user_message(ctx)


def get_session_code_output(sessions: dict[str, list[dict]], session_id: str) -> str:
    """Extract all code-writing actions across a session."""
    turns = sessions.get(session_id, [])
    outputs = []
    for turn in turns:
        completion = turn.get("completion", "")
        # Extract Write tool calls (these are file writes)
        writes = re.findall(
            r'ASSISTANT\s*\(tool call\)\s*Write\s*input=\{"[^}]*"file_path":\s*"([^"]+)"[^}]*"content":\s*"([^"]+)"\}',
            completion
        )
        for file_path, content in writes:
            short_path = file_path.split('/')[-1]
            outputs.append(f"// File: {short_path}\n{content[:2000]}")

        # Extract Bash commands that are build/verify
        bash_commands = re.findall(
            r'ASSISTANT\s*\(tool call\)\s*Bash\s*input=\{.*?"command":\s*"([^"]+)"',
            completion
        )
        for cmd in bash_commands:
            if any(x in cmd for x in ['npm', 'node', 'python', 'ls', 'cat', 'mkdir', 'cp']):
                outputs.append(f"$ {cmd}")

    return "\n\n".join(outputs[:20])  # Limit to 20 actions


def convert_session(sessions: dict[str, list[dict]], session_id: str) -> Optional[dict]:
    """Mode: session — reconstruct full conversation as a single sample."""
    turns = sessions.get(session_id, [])
    if not turns:
        return None

    instruction = get_session_prompt(sessions, session_id)
    if not instruction or len(instruction) < 20:
        return None

    # Build full assistant trajectory: combine all completions
    all_parts = []
    code_actions = []

    for turn in turns:
        completion = turn.get("completion", "")
        output_type = turn.get("output_type", "")

        # Extract thinking blocks
        thinks = re.findall(r'<think>(.*?)</think>', completion, re.DOTALL)
        for t in thinks:
            cleaned = clean_context(t.strip())
            if len(cleaned) > 50:
                all_parts.append(f"<think>\n{cleaned}\n</think>")

        # Extract messages
        msgs = re.findall(r'ASSISTANT\s*\(message\):\s*(.*?)(?=\nASSISTANT|\nTOOL|\Z)', completion, re.DOTALL)
        for m in msgs:
            cleaned = clean_context(m.strip())
            if len(cleaned) > 20:
                all_parts.append(cleaned)

        # Extract tool calls (compact form)
        tool_calls = re.findall(
            r'ASSISTANT\s*\(tool call\)\s*(\w+)\s*input=\{.*?"description":\s*"([^"]+)"',
            completion
        )
        for tool_name, desc in tool_calls:
            all_parts.append(f"[{tool_name}: {desc}]")

        # Track actual file writes for code output
        writes = re.findall(
            r'ASSISTANT\s*\(tool call\)\s*Write\s*input=\{.*?"file_path":\s*"([^"]+)"[^}]*"content":\s*"([^"]+)"\}',
            completion
        )
        for file_path, content in writes:
            short_path = '/'.join(file_path.split('/')[-2:])
            content_clean = content.replace('\\n', '\n')[:1500]
            code_actions.append(f"// {short_path}\n{content_clean}")

    if not all_parts and not code_actions:
        return None

    # Assemble output with code actions as the main body
    trajectory = "\n\n".join(all_parts)
    code_block = "\n\n".join(code_actions[:10])

    output_parts = []
    if trajectory:
        output_parts.append(trajectory)
    if code_block:
        output_parts.append(f"```\n{code_block}\n```")

    output = "\n\n".join(output_parts)
    if len(output) < 100:
        return None

    return {
        "instruction": instruction,
        "input": f"Session: {session_id}\nModel: {turns[0].get('model', 'unknown')}",
        "output": output,
        "source": f"session:{session_id}",
    }


def convert_instruction(entry: dict) -> Optional[dict]:
    """Mode: instruction — individual turn as instruction-response pair."""
    context = entry.get("context", "")
    completion = entry.get("completion", "")
    output_type = entry.get("output_type", "")

    if not context or not completion:
        return None

    last_user = extract_last_user_message(context)
    if not last_user or len(last_user) < 20:
        return None

    # Check if this is a real instruction (not terminal output)
    lines = last_user.split('\n')
    terminal_lines = sum(1 for l in lines if TERMINAL_LINE.match(l.strip()))
    if len(lines) > 3 and terminal_lines > len(lines) * 0.6:
        return None

    if output_type == "text":
        response = extract_output_for_text(completion)
    else:
        response = extract_output_for_tool(completion)

    if not response or len(response) < 50:
        return None

    return {
        "instruction": last_user,
        "input": "",
        "output": response,
        "source": entry.get("uid", ""),
    }


def convert_cot(entry: dict) -> Optional[dict]:
    """Mode: cot — include chain-of-thought in response."""
    result = convert_instruction(entry)
    if result is None:
        return None

    cot = entry.get("cot", "")
    if cot:
        cleaned_cot = clean_context(cot.strip())
        if len(cleaned_cot) > 50:
            result["output"] = f"<think>\n{cleaned_cot}\n</think>\n{result['output']}"
    return result


def convert_tool(entry: dict) -> Optional[dict]:
    """Mode: tool — keep tool call patterns, useful for teaching tool use."""
    context = entry.get("context", "")
    completion = entry.get("completion", "")
    output_type = entry.get("output_type", "")

    if output_type != "tool_use":
        return convert_instruction(entry)

    if not context or not completion:
        return None

    last_user = extract_last_user_message(context)
    if not last_user or len(last_user) < 20:
        return None

    response = clean_completion(completion, "tool")
    if not response or len(response) < 50:
        return None

    return {
        "instruction": last_user,
        "input": "",
        "output": response,
        "source": entry.get("uid", ""),
    }


def clean_output(text: str) -> str:
    """Light cleaning for completion output — strips encoding garbage but preserves content structure."""
    text = ANSI_ESCAPE.sub('', text)
    text = CONTROL_CHARS.sub('', text)
    text = TRUNCATED_MARKERS.sub('', text)
    text = COMMAND_STDOUT.sub('', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def convert_think(entry: dict) -> Optional[dict]:
    """Mode: think (default) — full context as input, completion as output.
    Preserves chain-of-thought reasoning + tool call formatting verbatim.
    """
    context = entry.get("context", "")
    completion = entry.get("completion", "")
    if not context or not completion or len(completion) < 50:
        return None
    return {
        "instruction": "Continue the conversation, reasoning step by step.",
        "input": clean_context(context),
        "output": clean_output(completion),
        "source": entry.get("uid", ""),
    }


def convert_code_only(entry: dict) -> Optional[dict]:
    """Mode: code_only — only keep entries that wrote/modified files."""
    completion = entry.get("completion", "")
    has_write = bool(re.search(r'\(tool call\)\s*Write\s*input=', completion))
    has_bash_code = bool(re.search(r'\(tool call\)\s*Bash\s*input=.*?"(?:npm|node |npx|python|mkdir)', completion))

    if not has_write and not has_bash_code:
        return None

    return convert_instruction(entry)


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def deduplicate(samples: list[dict]) -> list[dict]:
    """Remove duplicates by source (UID) hash."""
    seen = set()
    result = []
    for s in samples:
        source = s.get("source", "")
        h = hash(source[:300] if source else s.get("instruction", "")[:200])
        if h not in seen:
            seen.add(h)
            result.append(s)
    return result


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

def print_stats(samples: list[dict], title: str = "Dataset Stats"):
    """Print summary statistics."""
    if not samples:
        print(f"\n  {title}: 0 samples")
        return

    total_input_tokens = sum(len(s.get("instruction", "")) + len(s.get("input", "")) for s in samples)
    total_output_tokens = sum(len(s.get("output", "")) for s in samples)
    avg_input = total_input_tokens / len(samples)
    avg_output = total_output_tokens / len(samples)

    print(f"\n  {title}:")
    print(f"    Samples:    {len(samples)}")
    print(f"    Avg input:  {avg_input:.0f} chars")
    print(f"    Avg output: {avg_output:.0f} chars")
    print(f"    Total:      ~{(total_input_tokens + total_output_tokens) / 1000:.0f}K tokens")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

CONVERTERS = {
    "session": convert_session,
    "instruction": convert_instruction,
    "cot": convert_cot,
    "tool": convert_tool,
    "think": convert_think,
    "code_only": convert_code_only,
}


def main():
    args = parse_args()

    if not os.path.exists(args.input):
        print(f"Input not found: {args.input}")
        sys.exit(1)

    print(f"Loading entries from {args.input}...")
    entries = parse_entries(args.input)
    print(f"  Loaded {len(entries)} entries")

    sessions = group_by_session(entries)
    print(f"  Sessions: {len(sessions)}")

    if args.session:
        if args.session not in sessions:
            print(f"  Session {args.session} not found. Available sessions:")
            for sid in sorted(sessions.keys())[:10]:
                print(f"    {sid} ({len(sessions[sid])} turns)")
            sys.exit(1)
        entries = sessions[args.session]
        print(f"  Filtered to session {args.session} ({len(entries)} turns)")

    converter = CONVERTERS[args.mode]
    print(f"\nConverting (mode={args.mode})...")

    samples = []
    skipped = 0

    if args.mode == "session":
        # Session mode uses entire sessions, not individual entries
        session_ids = list(sessions.keys())
        if args.session:
            session_ids = [args.session] if args.session in sessions else []
        for sid in session_ids:
            sample = convert_session(sessions, sid)
            if sample is not None:
                samples.append(sample)
            else:
                skipped += 1
    else:
        for entry in entries:
            sample = converter(entry)
            if sample is not None:
                samples.append(sample)
            else:
                skipped += 1

    if args.dedup:
        before = len(samples)
        samples = deduplicate(samples)
        print(f"  Dedup removed {before - len(samples)} duplicates")

    # Apply quality filters
    before = len(samples)

    # Filter truncated (check both instruction and output)
    if args.filter_truncated:
        has_trunc = []
        for s in samples:
            out = s.get("output", "")
            instr = s.get("instruction", "")
            if re.search(r'\[truncated\]', out) or re.search(r'\[truncated\]', instr):
                has_trunc.append(s)
        samples = [s for s in samples if s not in has_trunc]
        print(f"  Filter-truncated removed {len(has_trunc)} entries")

    # Filter short responses
    before2 = len(samples)
    samples = [s for s in samples if len(s.get("output", "")) >= args.min_response_len]
    if before2 - len(samples) > 0:
        print(f"  Short-output filter removed {before2 - len(samples)} entries (min {args.min_response_len} chars)")

    if args.max_output_len > 0:
        for s in samples:
            out = s.get("output", "")
            if len(out) > args.max_output_len:
                s["output"] = out[:args.max_output_len]

    if args.max_samples > 0 and len(samples) > args.max_samples:
        samples = samples[:args.max_samples]

    print_stats(samples)

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, 'w', encoding='utf-8') as f:
        for sample in samples:
            f.write(json.dumps(sample, ensure_ascii=False) + '\n')

    print(f"\n  Output: {args.output}")
    print(f"  Skipped: {skipped} entries")
    print(f"  Written: {len(samples)} samples")


if __name__ == "__main__":
    main()
