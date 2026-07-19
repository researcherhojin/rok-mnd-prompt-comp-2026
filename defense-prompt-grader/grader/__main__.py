"""CLI: UI 없이 전 기능 실행. 예) python -m grader run --prompt baselines/P1.txt --split public --runs 2"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from . import runner
from .config import load_llm_config


def _run(args: argparse.Namespace) -> int:
    prompt = Path(args.prompt).read_text(encoding="utf-8")
    cfg = load_llm_config()
    if args.model:
        cfg = cfg.__class__(**{**cfg.__dict__, "model": args.model})

    last = {"line": ""}

    def on_progress(p: runner.Progress) -> None:
        line = f"\r진행 {p.done}/{p.total} · 유효 {p.valid} · INVALID {p.invalid} · ERROR {p.error}"
        last["line"] = line
        print(line, end="", flush=True)

    result = asyncio.run(
        runner.run(
            prompt,
            split=args.split,
            runs=args.runs,
            cfg=cfg,
            progress_cb=on_progress,
            force=args.force,
        )
    )
    print()  # progress 줄 종료
    pc = result.primary
    print(f"\n[{result.split}] model={result.model} runs={result.runs} 글자수={result.prompt_len}")
    print(f"  Macro F1 (결합 평균): {result.macro_f1_mean:.4f}")
    print(f"    risk_grade  F1   : {pc['risk']['macro_f1']:.4f}")
    print(f"    cycle_range F1   : {pc['cycle']['macro_f1']:.4f}")
    print(f"  리더보드 점수      : {result.leaderboard_score:.4f}")
    print(f"  완전일치 행수      : {pc['exact_match_count']}/{pc['n']}")
    print(f"  INVALID율          : {pc['invalid_rate']:.4f} ({pc['invalid_count']}행)")
    for axis in ("risk", "cycle"):
        print(f"    [{axis}]")
        for lbl, m in pc[axis]["per_class"].items():
            print(f"      {lbl:<7} P={m['precision']:.3f} R={m['recall']:.3f} F1={m['f1']:.3f}")
    if result.runs_agg:
        a = result.runs_agg
        print(f"  실행간 std={a['macro_f1_std']:.4f} · 판정불일치율={a['disagreement_rate']:.4f}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="grader", description="문제 B 로컬 자동채점")
    sub = parser.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="프롬프트 채점 실행")
    r.add_argument("--prompt", required=True, help="시스템 프롬프트 텍스트 파일")
    r.add_argument("--split", default="public", choices=["sample", "public", "private"])
    r.add_argument("--runs", type=int, default=1, choices=[1, 2, 3])
    r.add_argument("--model", default=None, help=".env의 LLM_MODEL override")
    r.add_argument("--force", action="store_true", help="캐시 무시하고 재실행")
    r.set_defaults(func=_run)
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
