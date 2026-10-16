# ROUTINE FIT

질문과 오늘의 컨디션을 바탕으로 실행 가능한 건강 루틴을 제안하는 React 웹서비스입니다.
기존 화면·추천 엔진·주간/하루 계획 기능을 Next.js로 이전하고, Clerk 인증과 Neon Postgres 계정별 저장을 연결했습니다.

서비스: [routine-fit-seven.vercel.app](https://routine-fit-seven.vercel.app/)

GitHub `main` 브랜치는 Vercel 프로젝트에 연결되어 변경 시 자동 배포됩니다.

## 핵심 기능

- 생활패턴 질문, 근거 자료 안내, 오늘의 컨디션에 따른 핵심 루틴 조정
- 직접 만드는 루틴, 추천 루틴 선택, 완료 체크와 주간 리포트
- 핵심 루틴 / 하루 전체 계획 모드, 주간 고정 일정과 날짜별 일정, 다른 날짜 루틴 미리보기
- 카테고리별 블록 라이브러리, 드래그 배치, 연결된 일정 일괄 수정·삭제, 전체/정리 시간표
- 식품·독서·음악 안내와 영양제 참고 정보, iHerb 외부 구매 링크
- InBody 수치 수동 등록, 선택적 이미지 OCR
- Clerk 로그인·로그아웃, Neon 저장·복원, JSON 내보내기·이전 파일 가져오기

## 기술 구조

React 19 + TypeScript → Next.js 16 App Router → Clerk 세션 검증 → Drizzle ORM / pg → Neon Postgres

Vercel Functions와 DB는 Singapore 리전을 사용합니다. 운영 DB와 개발/미리보기 DB는 분리되어 있습니다.
추천은 기존 규칙 기반 엔진이며, LLM 호출이나 영양 결핍 진단을 구현한 것은 아닙니다.

## 로컬 실행

Node.js 24.x와 npm이 필요합니다.

```sh
npm ci
vercel link
vercel env pull .env.local --environment=development
npm run db:migrate
npm run dev
```

`vercel link`에서는 본인이 소유한 올바른 팀·프로젝트를 선택하세요. 개발 서버 주소는 `http://localhost:3000`입니다.
인증키 및 DB 연결은 Vercel Marketplace에서 연결한 Clerk / Neon의 환경변수를 사용합니다.
별도 설정 시 `.env.example`의 변수명만 참고하고, 실제 값은 로컬 또는 플랫폼의 비밀 환경변수에 입력하세요.

| 변수 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk 공개 인증 설정 |
| `CLERK_SECRET_KEY` | 서버 전용 Clerk 인증키 |
| `DATABASE_URL` | 서버 실행용 pooled 연결 |
| `DATABASE_URL_UNPOOLED` | 스키마 마이그레이션용 direct 연결 |
| `GOOGLE_VISION_API_KEY` | 선택적 OCR 키. 없으면 수동 입력 사용 |

`db:migrate`는 `.env.local`의 대상 DB에 적용합니다. 운영 적용은 대상·마이그레이션을 먼저 검토하고 별도로 실행하세요.
앱 빌드가 운영 DB 마이그레이션을 자동 실행하지 않도록 분리했습니다.

## 검증

```sh
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

69개 테스트는 추천·계획 엔진과 인증 거절, 계정별 접근, 동시 저장 충돌, 이전 데이터 덮어쓰기 방지를 검사합니다.
실제 Clerk 개발 세션으로 API → Neon 저장/복원·계정 격리·CAS·같은 출처 검증·루틴 생성을 확인했습니다.
배포 환경에서도 Clerk 세션 → Vercel API → 운영용 Neon DB 저장·복원을 합성 계정으로 확인했습니다.
검증용 합성 계정과 기록은 검증 후 삭제했습니다. 사용자의 실제 Gmail 로그인/가입 완료는 별도 확인이 필요합니다.

개발 통합 검증은 로컬 서버와 별도 개발 DB, `.env.production.local`이 준비된 경우에만 명시적으로 실행합니다:

```sh
node --env-file=.env.local scripts/verify-integration.mjs
```

이 스크립트는 Clerk 개발 인스턴스에서만 합성 계정을 만들고 자신이 만든 계정/기록만 정리합니다.
운영 의존성 감사는 취약점 0개입니다. 개발 전용 Drizzle Kit의 하위 esbuild 관련 moderate 경고는 남아 있으며,
해당 도구의 외부 공개 개발 서버는 실행하지 않습니다. 강제 다운그레이드는 적용하지 않았습니다.

## 기존 데이터 이전

기존 Sites 서비스는 수정하거나 중단하지 않았습니다. 새 인증 계정은 기존 ChatGPT 계정과 자동으로 연결하지 않습니다.

1. 기존 서비스에 본인 계정으로 로그인해 설정에서 JSON을 내보냅니다.
2. 새 서비스에 로그인하고 `/import`를 엽니다.
3. 대상 계정과 파일 요약을 확인하고 건강정보 이전에 동의한 뒤 가져옵니다.
4. 새 서비스에서 루틴·계획·기록이 복원됐는지 확인합니다.

새 계정에 이미 저장된 데이터가 있으면 가져오기를 차단합니다. 이메일 일치만으로 데이터 소유권을 추정하지 않습니다.
내보낸 파일에는 건강정보가 포함될 수 있으므로 GitHub에 커밋하거나 공유하지 마세요.

## 배포와 운영 주의

- Vercel 팀 `k53952684-7853`, 프로젝트 `routine-fit`을 사용합니다. 배포 전 `vercel project inspect --non-interactive`로 확인하세요.
- `vercel.json`은 Next.js 프레임워크와 Singapore Functions 리전을 지정합니다.
- 현재 Clerk 키는 **개발 인스턴스**입니다. 테스트/MVP용이며 실제 운영은 도메인과 Clerk production 인스턴스 설정 후 전환해야 합니다.
- Clerk 운영 인스턴스 전환 시 개발 사용자 ID와 달라질 수 있으므로 계정별 데이터 이전 계획도 필요합니다.
- OCR API 키는 아직 별도로 구성해야 합니다. InBody 수동 입력은 키 없이 사용 가능합니다.
- iHerb 연동은 외부 구매 링크이며 결제 API나 공식 제휴가 구현됐다는 의미가 아닙니다.
- 공개 Git에는 소스·스키마·합성 테스트만 포함합니다. 환경변수, 인증 토큰, 사용자 건강정보와 원본 이미지는 제외합니다.

서비스는 생활습관 관리를 위한 참고 정보를 제공합니다. 질병 진단·영양 결핍 확정·처방을 제공하지 않으며,
복용 약·질환·임신 등 안전 확인이 필요한 경우 전문가 상담이 우선입니다.
