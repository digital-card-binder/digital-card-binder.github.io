"use strict";

// 이 사이트에서 window.fetch를 감싸는 유일한 곳이다.
// 각 모듈은 window.fetch를 직접 덮어쓰지 않고 use()로 응답 가공 핸들러만 등록한다.
// 핸들러는 등록 순서대로 실행되며, 앞 핸들러가 돌려준 응답이 다음 핸들러로 전달된다.
(function () {
  const root = (window.DigitalCardBinder = window.DigitalCardBinder || {});
  if (root.fetchPipeline) return;

  const nativeFetch = window.fetch.bind(window);
  const handlers = [];

  function urlOf(input) {
    return typeof input === "string" ? input : input?.url || "";
  }

  async function pipelineFetch(input, init) {
    let response = await nativeFetch(input, init);
    if (!response.ok || !handlers.length) return response;

    const url = urlOf(input);
    for (const handler of handlers) {
      if (!handler.pattern.test(url)) continue;
      try {
        response = await handler.handle(response, { url, input, init });
      } catch (error) {
        console.warn("응답 가공 핸들러를 적용하지 못했습니다.", error);
      }
    }
    return response;
  }

  window.fetch = pipelineFetch;

  root.fetchPipeline = Object.freeze({
    // 가공이 적용되지 않은 원래 fetch
    native: nativeFetch,
    use(pattern, handle) {
      if (Object.prototype.toString.call(pattern) !== "[object RegExp]" || typeof handle !== "function") {
        throw new TypeError("fetchPipeline.use(RegExp, function) 형식이어야 합니다.");
      }
      handlers.push({ pattern, handle });
    },
  });
})();
