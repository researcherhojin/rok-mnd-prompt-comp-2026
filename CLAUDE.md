# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Design-consultation deliverable for **「2026 국방AI 프롬프트 경진대회」 출제안 4 — 설비·고장 정비주기 예측형** (host 국방부; organizers IITP/KAIST·데이원컴퍼니). It contains **no application runtime** — the "harness", "scoring engine", "leaderboard" etc. are a *designed* system described in prose, not running code. (A React+FastAPI prototype was removed; it survives only in git history.)

Two artifact families:

- **`request/*.md`** — the design specification (Korean). The actual output handed to the 데이원컴퍼니 build team.
- **`site/`** — a self-contained one-page visual summary of that design, published to Cloudflare Pages (distribution is via the Pages URL only).

Plus **`data/`** — example CSVs generated deterministically from the §1.3 label rules (0 violations, includes boundary cases): `sample.csv` (15 rows, labeled), `private.csv` (30 rows, input only), `ground_truth.csv` (30 rows, labels + Public 12/Private 18 split). Dev/validation aids only — the real competition set must be redesigned (open decision ⑤ below).

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

## Diagrams & Playwright tooling

Two kinds of Mermaid, validated/rendered the same way (mermaid + a headless Chromium via Playwright):

- **`request/*.md` embed 10 Mermaid blocks** (brief 2 · spec 6 · arch 1 · workplan 1). A syntax error renders as a broken block on GitHub, so **validate every ` ```mermaid ` block with the real parser before committing.** ASCII box-diagrams were converted to Mermaid — keep it that way.
- **`src/sections/06b-architecture.html` embeds a pre-rendered inline `<svg id="archsvg">`** — the *only* diagram baked as SVG (so the static page needs no CDN mermaid.js). **Never hand-edit that SVG**: re-render from a `flowchart TB` source and splice the whole `<svg id="archsvg">…</svg>` block back (a longer node label changes the fixed box width, so hand-edits overflow).

Shared tooling for all three tasks below: `npm i mermaid` into the scratchpad, and drive the sandboxed Playwright already on this machine — `playwright-core` under `~/.npm/_npx/*/node_modules/`, chromium at `~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell`.

- **Validate:** `await mermaid.parse(block)` per block (throws on error).
- **Re-render 06b:** `mermaid.initialize({theme:'base', themeVariables:{primaryColor:'#eef2f8', primaryBorderColor:'#1c4270', primaryTextColor:'#191f28', lineColor:'#8195ad', fontFamily:'-apple-system,BlinkMacSystemFont,…'}})` → `mermaid.render('archsvg', src)` (keep the `archsvg` id so the wrapper CSS applies), then replace the SVG block in the html.
- **Overflow check (required before any `site/` deploy):** load `site/index.html` at 320/360/390/768/1180 and assert `documentElement.scrollWidth <= clientWidth`. Long unbreakable tokens (e.g. filenames in the footer) are the usual culprit → fix with `overflow-wrap:anywhere`, not by shortening claims.

## The designed system (what the docs describe)

A prompt-engineering competition, **not** a predict-file-upload competition:

- The participant submits **only a behavior instruction (행동 지침)** — a prompt. A **fixed harness** re-runs it on a **pinned lightweight model** (e.g. `gpt-4.1-nano`; `seed` + `temperature 0` — exact model TBD, confirmed after validation) against hidden data and scores the model output. (LLM output is not fully deterministic; raw output/parse/score are stored for reproducibility & audit.) Participants never train a model or upload predictions; the instruction itself does all preprocessing/analysis in-context.
- **Harness = 6 fixed stages, one participant-controlled:** `고정 시스템 지시 구성 → 참가자 행동 지침 삽입 → 비공개 데이터 입력 → LLM 실행 → 출력 파싱·검증 → 정답 대조·채점` (stage 2 is the participant's instruction; the host composes a fixed system instruction and merges the participant's behavior instruction + hidden data before running the LLM).
- Two labels: `risk_grade` (HIGH/MEDIUM/LOW) and `cycle_range` (0-30 / 31-90 / 91-180 / 181+).

Doc roles: `competition_design_brief` = *what* (data/labels/scoring); `system_functional_spec` = *how* (components/DB/pipeline); `dev_architecture_plan` = infra (front/back/DB); `dev_workplan_scoring_leaderboard` = implementation pseudocode.

> Open design question (flagged in the docs' "열린 항목"): the official `Data_Sample` reference shows a **multi-node agent chain + LLM-as-Judge**, whereas the current design is single-node. Do not silently resolve this.

## Naming conventions — keep consistent across every surface

- **Datasets:** `샘플 데이터` (`sample.csv`, public, labeled — for rule inference) and `비공개 데이터` (`private.csv`, hidden — scored). Do **not** revert to train/test; this is not ML training.
- **Leaderboard split:** `Public/Private` (English) is a subdivision of 비공개 데이터 (Public 12 / Private 18). Deliberately kept distinct from the Korean 비공개 데이터 label — don't conflate the two.

## Scoring — 재논의 중 (7/5 자문단 미팅). **배점 미확정 · 주최측 결정**

Scored on the harness's **re-executed model output** (paradigm A — re-execution harness kept; participants do **not** upload a predict file). 7/5 미팅에서 채점 구조가 **리더보드 점수 / 토탈 점수 분리 + 프롬프트 효율성 재도입**으로 재논의됐다. **정확 배점은 대회 의도·문제 수(1 vs 4) 확정 후**(주최측). 아래 IITP 5-dim은 **참고 기준**.

```
리더보드 점수 (실시간 경쟁, 최고점 자동 선택) = 결과값 유효성(예측 정확성·Macro F1) + 프롬프트 효율성(글자·토큰)
토탈 점수    (최종·수상)                    = 리더보드 점수 + 온라인 수강률 + 제출형식 준수 + 보안 적합성
```

- **동점:** ① 예측 성능 → ② Private Test → ③ **최초** 제출 시간.
- **점수 소스:** 대회 중 Public(12행), 마감 후 Private(18행) 재채점.
- **제출 제약:** 지침 3000자 하드캡 초과 → 반려(payload·비용).
- **참고 배점(확정 아님):** IITP 공식 = 예측 40 / 신뢰 25 / 데이터활용 20 / 문제해결(커버리지) 10 / 제출규격 5. DACON 롯데 = 최고값·단일 가중.
- **골드셋(brief §9)은 배점 확정 시 재계산.** 이전 IITP 가정 예시값 A=96.0 · B=70.0 · C=25.0은 **잠정**이며 배점 확정 전까지 회귀 앵커로 고정하지 말 것.

> 열린 결정(주최측 논의): ① 대회 의도(능력 vs 경험) ② 1 vs 4 문제 채점 ③ 리더보드/토탈 배점 ④ 제출 형태(Shape A 단일 vs B 가이드형 다단계) ⑤ 데이터 결함(§1.3 규칙이 LLM에 쉽게 추론 → 재설계). 각 문서 §7/§11에 반영(사이트 시각요약 `site/`에서는 열린 결정 섹션·상단 콜아웃을 제거 — 개발팀 전달용 문서에만 유지).

## Meeting constraints (7/5) — 반영됨
- **참가 환경:** 군장병 대상 → 사지방(PC) 대신 **핸드폰 위주**. UI **모바일 우선** + **세션 지속**(중단·재개, 콘솔 닫아도 서버 저장·백그라운드 진행).
- **제출 흐름:** 제출 즉시 접수 확인 → 백그라운드 채점 → **수 분 후** 리더보드 반영(순수 자정 배치 완화, 군 취침시간 고려).
- **부정 방지:** 문제만 붙여넣어 LLM 즉답 못 하게 하는 **함정 설계** + **비-DS 지인 pool** adversarial(off-topic/jailbreak) QA.
- **스택:** 개발팀 기존 스택 사용(우리는 아키텍처만). 서버보다 **API 세션 점유가 병목** → 배치·큐.
- **모델:** non-reasoning 소형(gpt-4o-mini/4.1-nano) + 정답-only 출력 강제(출력 토큰 캡 정합).

## Editing conventions

- The full CSS is `tokens.css + base.css + components.css` concatenated **in that order** by `build.js` — preserve cascade order when moving rules. Design tokens (navy `--blue:#1c4270`, Toss-style) live in `src/styles/tokens.css`.
- **Quantitative claims are exact.** No rounding, no `+`/`≈`/`≥` — verify against the spec/formula and write the precise number.
- **Load-bearing figures must match on every surface** (`site/` + `request/*.md` + `README.md`): dataset sizes (sample 15 / private 30, Public 12 / Private 18), submission caps (미리보기 50 / 제출 3, 3000자 hardcap), and the **tiebreak order** (예측 성능 → Private → 최초 제출; 프롬프트 효율성은 열린 결정이라 hedge). These have drifted before — after changing one surface, grep all of them.
- **정확도 ≠ Macro F1.** The sample-run feedback (`05-console.html`) shows two *distinct* metrics: 완전일치 행 수 (exact-match rows) and 평균 Macro F1. Never equate them or derive one from the other (`4/5 → F1 0.80` was a real bug; the correct macro-avg was 0.92).
- Before deploying a `site/` change, run the overflow check (see *Diagrams & Playwright tooling*) — **zero horizontal overflow** at 320/360/390/768/1180.
- Git: private repo `researcherhojin/rok-mnd-prompt-comp-2026`; commit author is anonymized (`researcherhojin@users.noreply.github.com`). `.env`, `docs/` (주최측 원본 문서·교육자료), and `.wrangler/` are gitignored — keep them out of commits.
