// src/ 파티션을 조립해 정적 산출물을 생성한다:
//   site/index.html   — Cloudflare Pages 호스팅용 standalone (doctype/head/body + viewport)
// site/index.html은 손으로 고치지 않는다. 수정은 src/에서 하고 `node build.js`로 재생성.
const fs = require('fs'), path = require('path')
const root = __dirname
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\n$/, '')

const TITLE = '설비 정비주기 예측형 — 자동채점·리더보드 설계'

// CSS: tokens → base → (blank) → components  (원본 카스케이드 순서 보존)
const css = read('src/styles/tokens.css')
  + '\n' + read('src/styles/base.css')
  + '\n\n' + read('src/styles/components.css')

// 본문 섹션 (순서 = 파일명 접두 번호)
const sections = ['01-hero', '01b-summary', '02-data', '03-harness', '04-scoring', '05-console', '06-leaderboard', '06b-architecture', '06c-operations', '07-decisions', '08-footer']
  .map((n) => read('src/sections/' + n + '.html'))

const inner = '<div class="wrap">\n <div class="inner">\n\n'
  + sections.join('\n\n')
  + '\n\n </div>\n</div>'

// site/index.html (standalone: viewport meta + reset를 여기서 주입)
const site = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${TITLE}</title>
<meta name="color-scheme" content="light">
<style>
  /* minimal reset (Artifact 플랫폼이 주입하던 것과 동등) */
  *,*::before,*::after{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  html,body{margin:0;padding:0;background:#f2f4f6}
  img,svg,video{max-width:100%;height:auto}
</style>
<style>
${css}
</style>
</head>
<body>
${inner}
</body>
</html>
`
fs.mkdirSync(path.join(root, 'site'), { recursive: true })
fs.writeFileSync(path.join(root, 'site/index.html'), site)

// site/_headers — Cloudflare Pages: HTTP 레벨 검색 차단 (meta와 이중 방어)
fs.writeFileSync(path.join(root, 'site/_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n')

console.log('built site/index.html (' + site.length + 'B) + site/_headers')
