.PHONY: dev test cli web web-build

dev:
	uv run uvicorn api.main:app --reload --port 8080

test:
	uv run pytest -q

cli:
	uv run grader run --prompt baselines/P1.txt --split public --runs 1

web:
	cd web && npm run dev

web-build:
	cd web && npm run build
