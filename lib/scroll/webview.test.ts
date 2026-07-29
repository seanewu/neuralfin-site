import assert from "node:assert/strict";
import test from "node:test";
import { detectWebviewEnv } from "./webview";

test("webview detection identifies the major in-app browsers", () => {
  assert.equal(
    detectWebviewEnv(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003129) NetType/WIFI Language/zh_CN",
    ),
    "wechat",
  );
  assert.equal(
    detectWebviewEnv("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari Line/14.0.1/IAB"),
    "line",
  );
  assert.equal(
    detectWebviewEnv("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.34.90"),
    "instagram",
  );
  assert.equal(
    detectWebviewEnv("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.38.108;]"),
    "facebook",
  );
});

test("regular browsers are not webviews", () => {
  assert.equal(
    detectWebviewEnv("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"),
    "none",
  );
  assert.equal(
    detectWebviewEnv("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"),
    "none",
  );
  // "line" must not false-positive on words containing it
  assert.equal(detectWebviewEnv("Mozilla/5.0 OutlineReader/2.0 Chrome/126.0"), "none");
});
