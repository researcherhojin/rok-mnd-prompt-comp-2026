export function Footer() {
  return (
    <footer className="footer">
      <div className="foot-main">
        <div className="foot-brand">
          <div className="foot-title">국방AI 프롬프트 경진대회</div>
          <div className="foot-sub">설비·고장 정비주기 예측형</div>
        </div>
        <div className="foot-cols">
          <div className="foot-col">
            <span className="fc-h">주최 · 주관</span>
            <span>주최 국방부</span>
            <span>주관 IITP · KAIST · 데이원컴퍼니</span>
            <span>교육 skillflo.io</span>
          </div>
          <div className="foot-col">
            <span className="fc-h">문의 · 안내</span>
            <a href="#">대회 문의</a>
            <a href="#">이용약관</a>
            <a href="#">개인정보처리방침</a>
          </div>
        </div>
      </div>
      <div className="foot-bottom">
        © 2026 국방부 · 데이원컴퍼니. 본 사이트의 데이터는 합성 데이터이며 실제 군 보안자료가 아닙니다.
      </div>
    </footer>
  )
}
