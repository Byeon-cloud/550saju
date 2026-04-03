---
url: 'https://developers-apps-in-toss.toss.im/game-center/develop.md'
description: '게임 센터 개발 가이드입니다. SDK 연동, API 사용법, 구현 예제를 확인하세요.'
---

# 개발하기

![](/assets/leaderboard_flow.89s_SZOn.png)

## 1. 게임 리더보드에 점수 제출하기

**SDK를 통해 연동해 주세요.**

게임 종료 시 사용자의 점수를 리더보드에 제출합니다.\
사용자 식별은 앱인토스 SDK에서 자동으로 처리돼요.\
점수 제출이 완료되면 해당 사용자는 리더보드에서 자신의 점수를 확인할 수 있어요.\
[게임 리더보드 개발 문서의 submitGameCenterLeaderBoardScore](../bedrock/reference/framework/게임/submitGameCenterLeaderBoardScore.md) 페이지를 확인해주세요.

::: tip 주의하세요

게임 프로필이 생성되기 전에 점수를 제출하면 오류가 발생할 수 있어요.\
게임에 진입하자마자 바로 점수를 제출하는 것은 피해 주세요.\
보안상의 이유로, 사용자 식별자는 응답에 포함되지 않아요.

:::

## 2. 게임 리더보드 열기

**SDK를 통해 연동해 주세요.**

사용자가 리더보드에서 자신의 순위를 확인할 수 있어요.\
친구 관계를 맺고 친구에게 점수를 공유하거나 자랑할 수도 있어요.\
[게임 리더보드 개발 문서의 openGameCenterLeaderboard](../bedrock/reference/framework/게임/submitGameCenterLeaderBoardScore.md) 페이지를 확인해주세요.

::: tip 주의하세요

게임 프로필 WebView와 화면이 겹칠 수 있어요.\
게임 진입 직후 바로 리더보드를 호출하는 것은 피해 주세요.\
보안상의 이유로, 사용자 식별자는 응답에 포함되지 않아요.\
**리더보드를 열면 미니앱은 백그라운드 상태로 전환돼요.**\
리더보드에서 다시 돌아오면 포그라운드로 복귀하니, 게임 상태 관리에 유의하세요.

:::

![](/assets/leaderboard_1.ClRou2kf.png)

![](/assets/leaderboard_2.aVgnyiEG.png)

## 샌드박스 테스트

샌드박스 환경에서도 리더보드 기능을 테스트할 수 있어요.\
샌드박스에서 기록한 점수는 실제 서비스 리더보드에는 반영되지 않아요.

샌드박스 앱 최소 지원 버전을 확인하세요.

* android: 2025-12-16
* ios: 2025-12-07

## 자주 묻는 질문

\<FaqAccordion :items='\[
{
q: "리더보드 함수 실행 시 LeaderBoard not found 에러가 발생해요.",
a: \`미니앱 정보 승인이 되지 않았는데 호출하면 발생하는 오류에요.
