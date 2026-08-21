-- 날씨 주제(상설 싱글턴) 시드 — 부팅 경로에 있던 ensureWeatherTopic()을 여기로 옮긴다
--
-- 왜: 기존에는 server.ts가 부팅할 때마다 await ensureWeatherTopic(db)를 돌렸다.
--     onConflictDoNothing이라 다중 인스턴스에서도 안전하긴 했지만, 스케일투제로 환경에서는
--     콜드스타트마다 DB 왕복 1회가 사용자 대기 시간에 그대로 얹힌다.
--     시드는 배포 시 1회면 충분하므로 마이그레이션이 맞는 자리다.
--
-- 근거: entity-topic — 날씨는 kind=weather, 지역 파티션(regional), 마감 없음, 크레딧 0.
--       options는 비워 둔다 — 선택지는 코드의 월 매핑 규칙에서 파생된다 (term-weather-option).
--       id 'weather'는 src/domain/weather-options.ts의 WEATHER_TOPIC_ID와 일치해야 한다.

INSERT INTO "topics" ("id", "title", "kind", "status", "options", "regional", "credit_cost") VALUES
  ('weather', '지금 날씨 어때?', 'weather', 'active', '[]'::jsonb, true, 0)
ON CONFLICT ("id") DO NOTHING;
