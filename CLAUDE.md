# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Design-consultation deliverable for **「2026 국방AI 프롬프트 경진대회」 출제안 4 — K-511 계통별 정비주기 예측형** (host 국방부; organizers IITP/KAIST·데이원컴퍼니). The `request/*.md` + `site/` deliverable itself has **no application runtime** — the "harness", "scoring engine", "leaderboard" etc. are a *designed* system described in prose, not running code. (A React+FastAPI prototype was removed; it survives only in git history.)

**Exception — `defense-prompt-grader/`** is a real, working runtime: a local auto-grading simulator for **문제 B** (the K-511 truck **dual-label** variant — `risk_grade` HIGH/MEDIUM/LOW + `cycle_range` 0-30/31-90/91-180/181+, 8 part_systems, 23 input columns; data in `data/`, the Codex V2 set: sample 10 / public 300 / private 700, labels inline). It's a self-contained uv project (Python 3.12) with its own README + `data/README.md` — `grader/` scoring core (two Macro F1 averaged) + CLI + a FastAPI API + a mobile-first web console (DACON-style: top nav 대회 안내[문제·데이터·평가·규칙 sub-nav]/제출/리더보드, plus internal 운영·개발 `/ops`). Leaderboard aggregates best-per-participant with 소속/누적/마스킹/내 위치 histogram. 게시판(board) is **not** in the console — it's the build team's platform feature; only its spec lives in `request/harness_config_options.md` §6.2. Used by the 출제위원 to measure baseline prompts (P0–P2, CLI-only) and validate the parse/scoring pipeline against real data. It does **not** supersede the `request/*.md` design; it's the executable counterpart of 문제 B. **Label redundancy (실측 1000/1000):** `cycle_range` determines `risk_grade` (0-30→HIGH, 31-90·91-180→MEDIUM, 181+→LOW) — the grader still scores both axes independently from the model's literal output; never infer one label from the other.

Two artifact families:

- **`request/*.md`** — the design specification (Korean). The actual output handed to the 데이원컴퍼니 build team.
- **`site/`** — a self-contained one-page visual summary of that design, published to Cloudflare Pages (distribution is via the Pages URL only).

Plus **`data/`** — the K-511 competition set: `sample.csv` (10 rows, labeled, public) + `public.csv` (300) · `private.csv` (700) · `all.csv` (1,000-row reference), labels inline. **Only `sample.csv` is git-tracked**; the hidden answer keys (`public.csv`·`private.csv`·`all.csv`) are `.gitignore`d (local-only) so answers never enter git. The grader reads this dir by default (`_default_data_dir() → REPO_ROOT/data`; override with `GRADER_DATA_DIR`).

## Build & deploy

**`site/index.html` is generated — never hand-edit it.** Edit the partitions under `src/` and rebuild:

```bash
node build.js     # src/styles/*.css + src/sections/*.html → site/index.html + site/_headers
```

- `site/index.html` = full standalone (adds `<meta viewport>`, `noindex`, a CSS reset) for static hosting.
- (A content-only `flow.html` for claude.ai Artifact upload was removed — distribution is Cloudflare Pages only. To restore it, re-add the `flow` write block to `build.js`.)

Deploy the static site (Cloudflare Pages, private project, noindex):

```bash
npx wrangler pages deploy site --project-name=rmpc-2026-23aded --branch main --commit-dirty=true
```

Production URL `https://rmpc-2026-23aded.pages.dev`. Cloudflare Access (email-gated) is the intended lock; until it's set the page is public but noindex.

## defense-prompt-grader — commands & layout

Self-contained uv project (Python 3.12); all commands run from `defense-prompt-grader/`. Its `Makefile` is the entry point:

```bash
make dev        # uv run uvicorn api.main:app --reload --port 8080   (API + 웹 콘솔 백엔드)
make test       # uv run pytest -q
make cli        # uv run grader run --prompt baselines/P1.txt --split public --runs 1
make web        # cd web && npm run dev      (Vite dev server)
make web-build  # cd web && npm run build    (tsc && vite build → web/dist)

uv run pytest tests/test_score.py::test_name -q   # 단일 테스트
uv run ruff check . && uv run ruff format .       # lint/format (config: repo root ruff.toml)
```

CLI flags (`grader run`): `--prompt` (필수, 텍스트 파일) · `--split sample|public|private` · `--runs 1|2|3` · `--model` (`.env`의 `LLM_MODEL` override) · `--force` (캐시 무시).

Pipeline module map — `grader/`: `config.py` (`.env` 로드, 라벨 순서·`CHAR_HARDCAP=3000`·`SPLIT_FILES`·`LLMConfig` seed 42/temp 0/`max_tokens=50`) → `data.py` (CSV 로드) → `template.py` (프롬프트 합성) → `llm.py` (OpenAI-호환 호출, `max_completion_tokens`↔`max_tokens` 폴백) → `parse.py` → `score.py` (두 Macro F1 평균) — `runner.py`가 오케스트레이션(행별 async, 실패율 5% 초과 시 `RunAborted`, `cache.py` SQLite 캐시). `api/main.py`는 제출/실행/취소/진행률/리더보드 REST, `api/store.py`가 `submissions.db`. `web/`은 React 19 + Vite + Tailwind 4 + react-router 콘솔.

**`.env`가 필요**(`LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`/`MAX_CONCURRENCY`) — gitignored. `cache.db`·`submissions.db`는 로컬 산출물.

## Diagrams & Playwright tooling

Two kinds of Mermaid, validated/rendered the same way (mermaid + a headless Chromium via Playwright):

- **`request/*.md` embed 10 Mermaid blocks** (brief 2 · spec 6 · arch 1 · workplan 1). A syntax error renders as a broken block on GitHub, so **validate every ` ```mermaid ` block with the real parser before committing.** ASCII box-diagrams were converted to Mermaid — keep it that way.
- **`src/sections/06b-architecture.html` embeds a pre-rendered inline `<svg id="archsvg">`** — the *only* diagram baked as SVG (so the static page needs no CDN mermaid.js). **Never hand-edit that SVG**: re-render from a `flowchart TB` source and splice the whole `<svg id="archsvg">…</svg>` block back (a longer node label changes the fixed box width, so hand-edits overflow).

Shared tooling for all the tasks below: `npm i mermaid` into the scratchpad, and drive the sandboxed Playwright already on this machine — `playwright-core` under `~/.npm/_npx/*/node_modules/`, chromium at `~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell`.

- **Validate:** `await mermaid.parse(block)` per block (throws on error).
- **Re-render 06b:** `mermaid.initialize({theme:'base', themeVariables:{primaryColor:'#eef2f8', primaryBorderColor:'#1c4270', primaryTextColor:'#191f28', lineColor:'#8195ad', fontFamily:'-apple-system,BlinkMacSystemFont,…'}})` → `mermaid.render('archsvg', src)` (keep the `archsvg` id so the wrapper CSS applies), then replace the SVG block in the html.
- **Overflow check (required before any `site/` deploy):** load `site/index.html` at 320/360/390/768/1180 and assert `documentElement.scrollWidth <= clientWidth`. Long unbreakable tokens (e.g. filenames in the footer) are the usual culprit → fix with `overflow-wrap:anywhere`, not by shortening claims.
- **Console screen capture → `snap/`:** the grader console's 9 screens (`/` · `/data` · `/evaluation` · `/rules` · `/submit` ×2 · `/leaderboard` · `/detail/:id` · `/ops`) captured at 1440×900, `deviceScaleFactor 2`, `fullPage`, asserting the same `scrollWidth <= clientWidth` per screen. Boot both servers first (`make dev` + `make web`). **Fill the 제출 form but never click 제출하고 채점 시작** — submitting spends real LLM calls; the 리더보드·상세 screens already render from the existing rows in `submissions.db`, so a full capture pass costs zero API calls. `snap/` is gitignored (regenerable, ~4MB of PNG).

## The designed system (what the docs describe)

A prompt-engineering competition, **not** a predict-file-upload competition:

- The participant submits **only a behavior instruction (행동 지침)** — a prompt. A **fixed harness** re-runs it on a **pinned lightweight model** (e.g. `gpt-4o-mini`; `seed` 42 + `temperature 0` — exact model TBD, confirmed after validation) against hidden data and scores the model output. (LLM output is not fully deterministic; raw output/parse/score are stored for reproducibility & audit.) Participants never train a model or upload predictions; the instruction itself does all preprocessing/analysis in-context.
- **Harness = 6 fixed stages, one participant-controlled:** `고정 시스템 지시 구성 → 참가자 행동 지침 삽입 → 비공개 데이터 입력 → LLM 실행 → 출력 파싱·검증 → 정답 대조·채점` (stage 2 is the participant's instruction; the host composes a fixed system instruction and merges the participant's behavior instruction + hidden data before running the LLM).
- Two labels: `risk_grade` (HIGH/MEDIUM/LOW) and `cycle_range` (0-30 / 31-90 / 91-180 / 181+).

Doc roles: `competition_design_brief` = *what* (data/labels/scoring); `system_functional_spec` = *how* (components/DB/pipeline); `dev_architecture_plan` = infra (front/back/DB); `dev_workplan_scoring_leaderboard` = implementation pseudocode.

> Open design question (flagged in the docs' "열린 항목"): the official `Data_Sample` reference shows a **multi-node agent chain + LLM-as-Judge**, whereas the current design is single-node. Do not silently resolve this.

## Naming conventions — keep consistent across every surface

- **Datasets:** `샘플 데이터` (`data/sample.csv`, 10 rows, public, labeled — for rule inference) and `비공개 데이터` (`data/public.csv`·`private.csv`, scored; `data/all.csv` = 1,000-row reference). Do **not** revert to train/test; this is not ML training.
- **Leaderboard split:** `Public/Private` (English) — Public 300 (leaderboard) / Private 700 (final). Deliberately kept distinct from the Korean 비공개 데이터 label — don't conflate the two.

## Scoring — 재논의 중 (7/5 자문단 미팅). **배점 미확정 · 주최측 결정**

Scored on the harness's **re-executed model output** (paradigm A — re-execution harness kept; participants do **not** upload a predict file). 7/5 미팅에서 채점 구조가 **리더보드 점수 / 토탈 점수 분리 + 프롬프트 효율성 재도입**으로 재논의됐다. **정확 배점은 대회 의도·문제 수(1 vs 4) 확정 후**(주최측). 아래 IITP 5-dim은 **참고 기준**.

```
리더보드 점수 (실시간 경쟁, 최고점 자동 선택) = 결과값 유효성(예측 정확성·Macro F1) + 프롬프트 효율성(글자·토큰)
토탈 점수    (최종·수상)                    = 리더보드 점수 + 온라인 수강률 + 제출형식 준수 + 보안 적합성
```

- **동점:** ① 예측 성능 → ② Private Test → ③ **최초** 제출 시간.
- **점수 소스:** 대회 중 Public(300행), 마감 후 Private(700행) 재채점.
- **제출 제약:** 지침 3000자 하드캡 초과 → 반려(payload·비용).
- **참고 배점(확정 아님):** IITP 공식 = 예측 40 / 신뢰 25 / 데이터활용 20 / 문제해결(커버리지) 10 / 제출규격 5. DACON 롯데 = 최고값·단일 가중.
- **골드셋(brief §9)은 배점 확정 시 재계산.** 이전 IITP 가정 예시값 A=96.0 · B=70.0 · C=25.0은 **잠정**이며 배점 확정 전까지 회귀 앵커로 고정하지 말 것.

> 열린 결정(주최측 논의): ① 대회 의도(능력 vs 경험) ② 1 vs 4 문제 채점 ③ 리더보드/토탈 배점 ④ 제출 형태(Shape A 단일 vs B 가이드형 다단계) ⑤ 라벨 중복(`cycle_range`가 `risk_grade`를 결정 → 두 F1 평균이 HIGH/LOW 이중 계산 → 배점 재논의). 각 문서 §7/§11에 반영(사이트 시각요약 `site/`에서는 열린 결정 섹션·상단 콜아웃을 제거 — 개발팀 전달용 문서에만 유지).

## Meeting constraints (7/5) — 반영됨
- **참가 환경:** 군장병 대상 → 사지방(PC) 대신 **핸드폰 위주**. UI **모바일 우선** + **세션 지속**(중단·재개, 콘솔 닫아도 서버 저장·백그라운드 진행).
- **제출 흐름:** 제출 즉시 접수 확인 → 백그라운드 채점 → **수 분 후** 리더보드 반영(순수 자정 배치 완화, 군 취침시간 고려).
- **부정 방지:** 문제만 붙여넣어 LLM 즉답 못 하게 하는 **함정 설계** + **비-DS 지인 pool** adversarial(off-topic/jailbreak) QA.
- **스택:** 개발팀 기존 스택 사용(우리는 아키텍처만). 서버보다 **API 세션 점유가 병목** → 배치·큐.
- **모델:** non-reasoning 소형(gpt-4o-mini/4.1-nano) + 정답-only 출력 강제(출력 토큰 캡 정합). ⚠️ **모델이 점수 천장을 결정(실측):** 규칙을 다 담은 동일 프롬프트가 nano ≈35 / mini ≈54 / gpt-5.4급 ≈80 — 소형·`max_tokens=50`·정답-only에선 완벽한 규칙도 실행이 안 돼 상한이 낮다(글자수 무관). 참고 프롬프트(≈50·≈80)·실측 → `request/reference_prompts.md`. `llm.py`는 최신 모델용 `max_completion_tokens`↔`max_tokens` 자동 폴백 + 4xx 본문 로깅.

## Editing conventions

- The full CSS is `tokens.css + base.css + components.css` concatenated **in that order** by `build.js` — preserve cascade order when moving rules. Design tokens (navy `--blue:#1c4270`, Toss-style) live in `src/styles/tokens.css`.
- **Quantitative claims are exact.** No rounding, no `+`/`≈`/`≥` — verify against the spec/formula and write the precise number.
- **Load-bearing figures must match on every surface** (`site/` + `request/*.md` + `README.md` + `defense-prompt-grader/`): dataset sizes (sample 10 / Public 300 / Private 700), 23 input columns / 8 part_systems, submission caps (미리보기 50 / 제출 3, 3000자 hardcap), and the **tiebreak order** (예측 성능 → Private → 최초 제출; 프롬프트 효율성은 열린 결정이라 hedge). These have drifted before — after changing one surface, grep all of them.
- **정확도 ≠ Macro F1.** The sample-run feedback (`05-console.html`) shows two *distinct* metrics: 완전일치 행 수 (exact-match rows) and 평균 Macro F1. Never equate them or derive one from the other (`4/5 → F1 0.80` was a real bug; the correct macro-avg was 0.92).
- Before deploying a `site/` change, run the overflow check (see *Diagrams & Playwright tooling*) — **zero horizontal overflow** at 320/360/390/768/1180.
- Git: private repo `researcherhojin/rok-mnd-prompt-comp-2026`; commit author is anonymized (`researcherhojin@users.noreply.github.com`). `.env`, `docs/` (주최측 원본 문서·교육자료), and `.wrangler/` are gitignored — keep them out of commits.
