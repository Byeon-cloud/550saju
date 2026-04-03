---
url: 'https://developers-apps-in-toss.toss.im/smart-message/develop.md'
description: '푸시 알림 개발 가이드입니다. SDK 연동, API 사용법, 구현 예제를 확인하세요.'
---

# 개발하기

![](/assets/push_3.C3w3QjH_.png)

## 테스트 메시지 발송 API

개발 과정에서 실제 사용자에게 메시지를 전송해 동작을 검증하고 싶다면,\
테스트용 메시지 발송 API를 사용할 수 있어요.

::: tip 테스트 메시지 API\
이 API는 파트너 앱이 토스 사용자에게 알림 또는 메시지를 **테스트 발송**할 수 있도록 제공돼요.\
사용자 인증 토큰이 필요하며, 메시지 전송 scope 권한이 포함돼야 해요.

[테스트 메시지 발송 API 보러가기](/api/sendTestMessage.html)
:::

## 메시지 발송 API

::: tip BaseURL
`https://apps-in-toss-api.toss.im`
:::

파트너 앱이 토스 사용자에게 메시지를 발송할 때 사용하는 기본 API예요.

* Content-type : application/json
* Method : `POST`
* Endpoint : `/api-partner/v1/apps-in-toss/messenger/send-message`

**요청 헤더**\
| 이름 | 타입 | 필수값 여부 | 설명 |
|---------------|---------|--------------|----------------------------------------------------------------------|
| x-toss-user-key | string | Y | 토스 로그인을 통해 획득한 userKey 값 |

**요청 파라미터**
| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| templateSetCode | String | Y | 발송할 메시지 템플릿 코드값|
| context | object|Y|등록된 템플릿의 내용 중 변수 전달|

```json
{
	"templateSetCode":"test_01", //발송할 메시지 템플릿 코드값
	"context": { // 등록된 템플릿의 내용 중 변수 전달
		"storeName": "토스증권",
		"date": "2025-01-20 15:30"
		// userName 은 발송 시 유저의 이름으로 적용되는 기본 변수이기 때문에 전달할 필요 없음
	}
}
```

**응답**

```json
{
	"resultType": "SUCCESS" // HTTP_TIMEOUT, NETWORK_ERROR, EXECUTION_FAIL, INTERRUPTED, INTERNAL_ERROR, FAIL
	"result":{
		"msgCount": 1, // 발송 성공 카운트
		"sentPushCount": 1, // 발송 성공 푸시 카운트
		"sentInboxCount: 0, // 발송 성공 Inbox(알림) 카운트
		"sentSmsCount": 0, // 발송 성공 문자 카운트
		"sentAlimtalkCount": 0, // 발송 성공 알림톡 카운트
		"sentFriendtalkCount": 0, // 발송 성공 친구톡 카운트
		"detail": {
			"sentPush":[
				{
					"contentId":"toss:PUSH~~~~", // 발송 성공한 푸시의 메시지 키
				}
			],
			"sentInbox":[], // sentPush 와 동일 포맷
			"sentInbox":[], // sentPush 와 동일 포맷
			"sentSms":[], // sentPush 와 동일 포맷
			"sentAlimtalk":[], // sentPush 와 동일 포맷
			"sentFriendtalk":[], // sentPush 와 동일 포맷
		}
		"fail": {
				"sentPush":[
					{
						"contentId":"toss:PUSH~~~~", // 발송 성공한 푸시의 메시지 키
						"reachFailReason: "실패사유", // 실패 사유
					}
				],
				"sentInbox":[], // sentPush 와 동일 포맷
				"sentInbox":[], // sentPush 와 동일 포맷
				"sentSms":[], // sentPush 와 동일 포맷
				"sentAlimtalk":[], // sentPush 와 동일 포맷
				"sentFriendtalk":[], // sentPush 와 동일 포맷
		}
	},
	"error": {
    "errorType": 0,
    "errorCode": "string",
    "reason": "string",
    "data": {
      "additionalProp1": {},
      "additionalProp2": {},
      "additionalProp3": {}
    },
    "title": "string"
  }
}
```

```json
curl --location 'https://{{domain}}/api-partner/v1/apps-in-toss/messenger/send-message' \
--header 'Content-Type: application/json' \
--header 'X-Toss-User-Key: {{유저 정보 조회에서 나온 userKey}}'
--data '{
	"templateSetCode":"vivarepublica_hello_world", //발송할 메시지 템플릿 코드값
	"context": { // 등록된 템플릿의 내용 중 변수 전달
		"storeName": "비바리퍼블리카",
		"greetDate": "2025년 01월 20일 15시 30분"
		// userName 은 발송 시 유저의 이름으로 적용되는 기본 변수이기 때문에 전달할 필요 없음
	}
}'
```
