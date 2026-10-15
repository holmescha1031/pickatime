# 언제봄 — 카카오 SDK v2 친구 테스트

Vercel 화면·로그인 함수 + Firebase Spark DB. 기존 GitHub Pages 링크는 Vercel로 이동합니다.
Kakao JavaScript SDK 2.7.9: 공식 다운로드 페이지에서 확인한 최신 버전입니다.

## 1. GitHub에 파일 업로드
ZIP을 풀고 index.html, config.js, api 폴더(kakao.js 포함), package.json, vercel.json을 저장소 최상위에 올리세요.
README.md와 database.rules.json도 함께 올려도 됩니다. ZIP 자체를 올리지 마세요.
api/kakao.js가 루트 kakao.js로 올라가지 않도록 경로를 확인하세요.
서비스·공유 URL: https://pickatime-phi.vercel.app/
기존 GitHub Pages 링크는 같은 모임 ID를 유지하고 서비스 주소로 이동합니다.

## 2. Vercel Import
Add New → Project → GitHub pickatime 저장소 Import.
Framework Preset: Other, Root Directory: 기본값(저장소 최상위).
Build Command: 비워둠, Output Directory: 기본값, Install Command: 기본값.
Environment Variables에 다음을 추가:
- KAKAO_REST_API_KEY: 사용자가 받은 REST API 키
- KAKAO_CLIENT_SECRET: Kakao Developers의 REST API 키 설정에서 확인한 Client Secret
Client Secret은 채팅이나 GitHub에 올리지 말고 Vercel에 직접 입력하세요.
Production 환경에 적용하고 Deploy. 변경 시 Redeploy가 필요합니다.
Hobby는 개인·비상업용 한도 내 테스트에 사용하며 Firebase는 Spark로 유지합니다.

## 3. 배포 주소 연결
Vercel의 Production 주소(예: https://pickatime-실제주소.vercel.app)를 복사합니다.
GitHub의 config.js에서 authServer의 빈 문자열에 그 주소를 입력하고 Commit합니다.
Vercel 주소는 로그인 API 호출용이며 카카오 Redirect URI와 다릅니다.

## 4. 카카오 설정
JavaScript SDK 도메인: https://pickatime-phi.vercel.app (기존 GitHub 도메인 등록도 유지).
카카오 로그인 Redirect URI에 아래 값을 정확히 등록합니다:
https://pickatime-phi.vercel.app/
JavaScript 키와 REST API 키 각각에 새 Redirect URI를 추가하세요. 진행 중인 기존 로그인 요청을 위해 GitHub Redirect URI 등록도 유지하세요.
JS 키와 REST 키는 같은 언제봄 앱의 값이어야 합니다.
카카오 로그인 ON, 닉네임 선택 동의. Client Secret 활성화 상태를 확인합니다.

## 5. Firebase 규칙
Realtime Database → 규칙에 database.rules.json 전체를 붙여넣고 게시합니다.
업로드만으로 규칙이 적용되지 않습니다.
이 버전의 Firebase 접근은 인증 없는 링크 기반 친구 테스트용입니다.
서버는 카카오 로그인만 처리하고 Firebase 인증 토큰을 발급하지 않습니다.
카카오 ID는 참여자 구분에 사용되며 투표 변조를 DB 규칙으로 막지 못합니다.
민감한 내용을 넣지 마세요. 공개 서비스 전 Firebase 커스텀 인증을 연결해야 합니다.

## 6. 테스트
반드시 https://pickatime-phi.vercel.app/ 에서 테스트하세요.
모임 생성 → 카카오 로그인 → 닉네임 입력 → 투표 → 다른 기기에서 같은 링크 열기.
새로고침 시 재로그인하면 같은 계정의 기존 투표를 불러옵니다.
같은 닉네임의 다른 계정은 별도 참여자입니다. 이름 변경 버튼으로 닉네임을 수정합니다.
로그인 중 URL에서 인가 코드를 제거하고 state/10분 만료를 확인합니다.
토큰과 Client Secret은 브라우저/DB로 보내지 않습니다.
실제 카카오 로그인, Vercel API, Firebase 쓰기는 배포 후 확인해야 합니다.

## 남은 제한
- 연결 해제 웹훅은 미구현. 테스트 후 운영자가 sessions 데이터를 수동 삭제하세요.
- 테스트를 끝내면 DB 규칙을 {"rules":{".read":false,".write":false}}로 잠그세요.
- Google 캘린더 OAuth는 아직 미설정. 수동 투표와 ICS 업로드는 사용 가능합니다.
- Firebase Spark와 Vercel Hobby의 사용 한도가 적용됩니다.

공식 SDK: https://developers.kakao.com/docs/ko/javascript/download

## 참여 예정 인원
새 모임 생성 시 나를 포함한 예정 인원을 1~100명으로 입력합니다. 모임 화면의 참여 인원은 닉네임 등록을 완료한 계정 수이며, 투표한 인원은 별도로 표시합니다. 예정 인원이 없던 기존 모임에서는 ‘예정 인원 설정’을 한 번 사용할 수 있습니다. 인원 수집은 정원 제한이 아닙니다.

이 기능을 사용하기 전 Realtime Database의 규칙을 이 저장소의 최신 database.rules.json으로 갱신하고 게시해야 합니다. 새로 추가된 meta.expectedCount 필드가 기존 규칙에서는 차단됩니다. 다른 데이터에 대한 규칙이 있다면 전체를 덮어쓰지 말고 이 필드의 규칙만 추가하세요.

## 내 모임투표 · 계정 닉네임
우상단 목록 아이콘에서 참여한 모임의 이름, 현재 1위 일시(동률 안내 포함), 참여/예정 인원을 확인합니다. 미리보기는 목록을 열 때 최신 데이터를 읽으며 날짜 순위 화면과 같은 계산을 사용합니다. 목록 안에서 이동하면 현재 카카오 로그인 상태를 유지합니다. 닉네임을 처음 정하면 다른 모임에서도 자동으로 재사용하며, 이름 바꾸기는 등록된 참여 모임에도 반영됩니다.

최신 database.rules.json의 profiles 항목까지 Realtime Database 규칙에 추가하고 게시해야 계정별 저장과 기기 간 불러오기가 작동합니다. 규칙 적용 전에는 브라우저에 저장된 참여 이력을 사용하고 목록에 동기화 실패 안내를 표시합니다. 이전 버전의 모임은 해당 모임에 다시 들어갈 때 목록에 등록됩니다.

프로필 경로 키는 카카오 회원 조회에 성공한 서버가 기존 KAKAO_CLIENT_SECRET을 사용한 HMAC-SHA256으로 생성합니다. 공유 URL에는 포함하지 않습니다. 프로필 전체 목록은 읽을 수 없고 해당 비공개 경로 키를 아는 클라이언트만 개별 레코드에 접근합니다. Firebase 사용자 인증을 발급하는 구조는 아니므로 링크 기반 친구 테스트 범위를 유지합니다. Client Secret을 교체하면 프로필 키도 달라집니다.
