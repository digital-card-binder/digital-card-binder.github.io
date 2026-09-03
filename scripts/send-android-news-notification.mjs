import fs from "node:fs";
import crypto from "node:crypto";

const PROJECT_ID = "pokemon-dex-40e92";
const TOPIC = "updates";
const NEWS_URL = "https://digital-card-binder.github.io/news.html";

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer
    .sign(serviceAccount.private_key, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!response.ok) {
    throw new Error(`OAuth token request failed: ${response.status} ${await response.text()}`);
  }
  const payloadJson = await response.json();
  if (!payloadJson.access_token) throw new Error("OAuth access token missing");
  return payloadJson.access_token;
}

function latestNewsItem() {
  const news = JSON.parse(fs.readFileSync("news.json", "utf8"));
  const items = Array.isArray(news.items) ? news.items : [];
  if (!items.length) throw new Error("news.json has no items");
  return items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || a.index - b.index)[0];
}

async function main() {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialPath) throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set");
  const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, "utf8"));
  const item = latestNewsItem();
  const accessToken = await getAccessToken(serviceAccount);

  const id = String(item.id || "").trim();
  const title = String(item.title || "새소식").trim();
  const summary = String(item.summary || title).trim();
  const url = id ? `${NEWS_URL}#${encodeURIComponent(id)}` : NEWS_URL;

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        message: {
          topic: TOPIC,
          notification: {
            title: "디지털 카드 바인더 새소식",
            body: title,
          },
          data: {
            type: "news",
            newsId: id,
            title: "디지털 카드 바인더 새소식",
            body: summary,
            url,
          },
          android: {
            priority: "high",
            notification: {
              channel_id: "updates",
            },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`FCM send failed: ${response.status} ${await response.text()}`);
  }
  const result = await response.json();
  console.log(`Sent Android news push for ${id || title}: ${result.name || "ok"}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
