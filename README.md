# 돼지런한 여름방학 Flask 웹사이트

## 실행 방법

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

브라우저에서 `http://127.0.0.1:5000` 접속.

## 포함 기능
- 회원가입 / 로그인 / 로그아웃
- 비밀번호 해시 저장
- SQLite 데이터베이스 자동 생성
- 공부 타이머
- 다른 탭, 다른 앱, 창 최소화 시 자동 일시정지
- 복귀 후 `공부 계속하기`를 눌러 재개
- 공부 기록 및 직접 기록 작성
- 일일 목표 설정 및 달성률
- 개인/반별 랭킹
- 모바일 반응형 화면

## 배포 전 필수
- `SECRET_KEY` 환경변수 변경
- 운영 서버에서는 `debug=False`
- 실제 행사용으로는 SQLite 대신 Supabase PostgreSQL 전환 권장
