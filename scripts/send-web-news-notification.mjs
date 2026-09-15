import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import webpush from "web-push";

const NEWS_URL = "https://digital-card-binder.github.io/news.html";
const VAPID_SUBJECT = "mailto:pokemon.dogam.support@gmail.com";

function latestNewsItemFromData(news) {
  const items = Array.isArray(news?.items) ? news.items : [];
  if (!items.length) throw new Error("news.json has no items");
  return items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || a.index - b.index)[0];
}

function latestNewsItemFromText(text) {
  return latestNewsItemFromData(JSON.parse(text));
}

function newsIdentity(item) {
  const id = String(item?.id || "").trim();
  return id || `${String(item?.date || "").trim()}::${String(item?.title || "").trim()}`;
}

function previousLatestNewsItem() {
  if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch") return null;
  try {
    return latestNewsItemFromText(
      execFileSync("git", ["show", "HEAD^:news.json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return null;
  }
}

async function main() {
  const item = latestNewsItemFromText(fs.readFileSync("news.json", "utf8"));
  const previous = previousLatestNewsItem();
  if (previous && newsIdentity(previous) === newsIdentity(item)) {
    console.log(`Latest news item is unchanged (${newsIdentity(item)}); skipping Web Push.`);
    return;
  }

  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialPath) throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set");
  const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, "utf8"));
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });

  const db = getFirestore();
  const configSnap = await db.doc("systemConfig/webPush").get();
  if (!configSnap.exists) {
    throw new Error("Web Push VAPID configuration is missing. Run the setup workflow first.");
  }

  const vapid = configSnap.data() || {};
  const publicKey = String(vapid.publicKey || "");
  const privateKey = String(vapid.privateKey || "");
  if (!publicKey || !privateKey) throw new Error("Web Push VAPID keys are incomplete");
  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);

  const id = String(item.id || "").trim();
  const title = String(item.title || "새소식").trim();
  const summary = String(item.summary || title).trim();
  const url = id ? `${NEWS_URL}#${encodeURIComponent(id)}` : NEWS_URL;
  const payload = JSON.stringify({
    title: "디지털 카드 바인더 새소식",
    body: title,
    summary,
    url,
    tag: id ? `news-${id}` : "digital-card-binder-news",
  });

  const snapshot = await db.collectionGroup("webPushSubscriptions").get();
  if (snapshot.empty) {
    console.log("No iPhone/PWA Web Push subscriptions found.");
    return;
  }

  let sent = 0;
  let removed = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const subscription = {
      endpoint: String(data.endpoint || ""),
      keys: {
        p256dh: String(data.p256dh || ""),
        auth: String(data.auth || ""),
      },
    };

    if (!subscription.endpoint || !subscription.keys.p256dh || !subscription.keys.auth) {
      await doc.ref.delete();
      removed += 1;
      continue;
    }

    try {
      await webpush.sendNotification(subscription, payload, {
        TTL: 86400,
        urgency: "normal",
      });
      sent += 1;
    } catch (error) {
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        await doc.ref.delete();
        removed += 1;
      } else {
        failed += 1;
        console.error(`Web Push failed for ${doc.ref.path}:`, error?.message || error);
      }
    }
  }

  console.log(`Web Push result: sent=${sent}, removed=${removed}, failed=${failed}`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
