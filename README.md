# The Third World 🎲

TV(호스트 화면)에 띄우고 **휴대폰을 컨트롤러로** 사용하는 Jackbox 스타일 D&D 파티 게임.
구글 로그인으로 호스트가 게임을 열고, 플레이어는 4자리 방 코드로 참여합니다.

## 구조

```
The Third World/
├─ server.js              # Express + Socket.IO + Google OAuth
├─ src/
│  ├─ rooms.js            # 방(룸코드) 저장소 (메모리)
│  └─ socketHandlers.js   # 실시간 이벤트 (호스트 ↔ 플레이어)
├─ public/
│  ├─ index.html          # 시작 / 구글 로그인
│  ├─ home.html           # 로그인 후 홈 (호스트/참여 선택)
│  ├─ host.html           # 📺 TV 호스트 화면
│  ├─ controller.html     # 📱 휴대폰 컨트롤러
│  └─ styles.css
├─ .env.example
└─ package.json
```

## 1. 설치

```powershell
npm install
```

## 2. 구글 로그인(OAuth) 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속 → 새 프로젝트 생성
2. **API 및 서비스 → OAuth 동의 화면** 설정 (외부, 앱 이름 등 입력)
3. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 애플리케이션 유형: **웹 애플리케이션**
   - **승인된 리디렉션 URI**에 다음 추가:
     - 로컬: `http://localhost:3000/auth/google/callback`
     - 배포 후(도메인 구매 시): `https://내도메인.com/auth/google/callback`
4. 발급된 **클라이언트 ID / 클라이언트 보안 비밀**을 복사

`.env.example`을 복사해 `.env`를 만들고 값을 채웁니다:

```powershell
Copy-Item .env.example .env
```

```env
SESSION_SECRET=아무_긴_랜덤_문자열
GOOGLE_CLIENT_ID=발급받은-클라이언트-ID
GOOGLE_CLIENT_SECRET=발급받은-시크릿
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

> `.env`는 비밀 정보라 `.gitignore`에 의해 git에 올라가지 않습니다.

## 3. 실행

```powershell
npm run dev
```

브라우저에서 http://localhost:3000 접속.

## 4. 플레이 방법

1. **TV/노트북**에서 로그인 → "TV로 새 게임 시작" → 방 코드가 크게 표시됨
2. **휴대폰**에서 같은 사이트 접속 → "방 코드로 참여하기" → 코드 + 닉네임 입력
3. 호스트가 **게임 시작** → 폰에서 선택지 투표 → 모두 선택하면 TV에 결과 표시

> 같은 와이파이라면 휴대폰에서 `http://<PC의_로컬_IP>:3000` 으로 접속하면 됩니다.
> (PowerShell에서 `ipconfig` 로 IPv4 주소 확인)

## 다음 단계 (TODO)

- [ ] 실제 D&D 분기 스토리 데이터 추가 (현재는 왼쪽/오른쪽 데모)
- [ ] 캐릭터 시트 · 주사위 굴리기 · HP/스탯
- [ ] QR 코드로 폰 입장 간소화
- [ ] 방 상태를 Redis 등으로 옮겨 다중 서버 지원
- [ ] 도메인 구매 후 HTTPS 배포 (Render/Railway/Fly.io 등)

## 배포 (Render 기준) — 구글 설정보다 먼저 하면 재작업이 줄어요

> WebSocket(Socket.IO) 상시 연결이 필요해 **상시 실행 서버**형 플랫폼을 씁니다.
> (Vercel/Netlify 같은 서버리스는 비추천.) 무료로 시작하려면 **Render**가 가장 간단합니다.

순서: **① 배포 → ② 공개 URL 확보 → ③ 그 URL로 구글 OAuth 설정**

### 1) 코드를 GitHub에 올리기
```powershell
git init
git add .
git commit -m "init: The Third World"
# GitHub에 새 repo 만든 뒤
git remote add origin https://github.com/<계정>/<repo>.git
git push -u origin main
```

### 2) Render에 배포
1. https://render.com 가입 → **New → Blueprint** 선택 → 위 GitHub repo 연결
   (repo 안의 [render.yaml](render.yaml)을 자동 인식합니다.)
2. 첫 배포가 끝나면 공개 URL이 생깁니다. 예: `https://the-third-world.onrender.com`
3. Render 대시보드 **Environment**에서 다음 값을 채웁니다:
   - `PUBLIC_URL` = 방금 받은 공개 URL (끝에 `/` 없이)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (아래 3단계에서 발급)
   - `SESSION_SECRET`은 Render가 자동 생성, `NODE_ENV=production`도 자동 설정됨
4. 값 저장 후 **Manual Deploy → Deploy latest commit** 으로 재배포

> 다른 플랫폼: **Railway**는 repo 연결 시 `npm start` 자동 실행,
> **Fly.io**는 동봉된 [Dockerfile](Dockerfile)로 `fly launch` 하면 됩니다.
> 어느 쪽이든 위 환경변수만 동일하게 넣으면 동작합니다.

### 3) 구글 OAuth — 로컬 + 운영 URI를 한 번에 등록
[Google Cloud Console](https://console.cloud.google.com/) → OAuth 클라이언트 ID의
**승인된 리디렉션 URI**에 둘 다 추가하면 재작업이 없습니다:
- `http://localhost:3000/auth/google/callback` (로컬 개발용)
- `https://the-third-world.onrender.com/auth/google/callback` (운영용)

> 콜백 URL은 코드가 `PUBLIC_URL`로 자동 생성하므로, 운영에선 `GOOGLE_CALLBACK_URL`을
> 따로 설정할 필요가 없습니다. HTTPS 보안 쿠키와 프록시 신뢰는 `NODE_ENV=production`일 때
> 자동 적용됩니다.

### 4) 커스텀 도메인 (선택)
무료 서브도메인으로 충분하지만, `.com/.kr`을 붙이고 싶다면:
1. 도메인 구매 (Cloudflare/Namecheap/가비아 등)
2. 플랫폼의 **Custom Domain**에 추가 후 DNS(CNAME) 연결
3. `PUBLIC_URL`을 새 도메인으로 바꾸고, 구글 콘솔 리디렉션 URI에도
   `https://내도메인.com/auth/google/callback` 추가 → 재배포

