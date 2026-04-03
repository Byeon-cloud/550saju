---
url: 'https://developers-apps-in-toss.toss.im/reward/develop.md'
description: '공유 리워드 개발 가이드입니다. SDK 연동, API 사용법, 구현 예제를 확인하세요.'
---

# 개발하기

**SDK를 통해 연동해 주세요.**

사용자가 친구 초대를 통해 리워드를 획득할 수 있어요.\
콘솔에서 입력한 공유 리워드 화면을 노출하고, 사용자가 친구에게 공유하기를 완료하면 event를 전달드려요.\
[contactsViral](../bedrock/reference/framework/친구초대/contactsViral.md) 페이지를 확인해주세요.

### 게임

![](/assets/reward_flow.DoOU8nLb.png)

### 비게임

![](/assets/reward_flow_nongame.64rEEzg-.png)

## 자주 묻는 질문

\<FaqAccordion :items='\[
{
q: "샌드박스에서 공유 리워드 기능이 되지 않아요",
a: \`샌드박스에서는 공유 리워드 기능을 지원하지 않아요.
