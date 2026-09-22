const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || "").trim();
const projectName = String(process.env.CLOUDFLARE_PAGES_PROJECT || "").trim();

if (!accountId || !apiToken || !projectName) {
  throw new Error(
    "CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_PAGES_PROJECT are required",
  );
}
if (!/^[a-z0-9][a-z0-9-]{0,57}[a-z0-9]$/.test(projectName)) {
  throw new Error(`Invalid Cloudflare Pages project name: ${projectName}`);
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`;
const headers = {
  Authorization: `Bearer ${apiToken}`,
  "Content-Type": "application/json",
};

async function responsePayload(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, errors: [{ message: text || response.statusText }] };
  }
}

const existingResponse = await fetch(`${endpoint}/${projectName}`, { headers });
if (existingResponse.ok) {
  const payload = await responsePayload(existingResponse);
  console.log(`Cloudflare Pages project already exists: ${payload.result?.name || projectName}`);
  process.exit(0);
}
if (existingResponse.status !== 404) {
  const payload = await responsePayload(existingResponse);
  throw new Error(
    `Unable to inspect Pages project (${existingResponse.status}): ${JSON.stringify(payload.errors || [])}`,
  );
}

const createResponse = await fetch(endpoint, {
  method: "POST",
  headers,
  body: JSON.stringify({ name: projectName, production_branch: "main" }),
});
const createPayload = await responsePayload(createResponse);
if (!createResponse.ok || !createPayload.success) {
  throw new Error(
    `Unable to create Pages project (${createResponse.status}): ${JSON.stringify(createPayload.errors || [])}`,
  );
}
console.log(`Created Cloudflare Pages project: ${createPayload.result?.name || projectName}`);
