// src/acc.js
// REV162: Autodesk Construction Cloud acquisition layer for the one way FOK sync.
// Mirrors the contract of sharepoint.js downloadSharePointFile: given an authenticated
// token it returns { fileName, version, buffer } so the existing FOK parser and invite
// pipeline are reused unchanged. NOTHING here mints a token or is called live in REV162;
// the token model is proven in REV163. Every function takes the token and region as inputs
// and an optional fetcher, so the Node harness can drive the exact call sequence with a
// stub and assert the EMEA region header without touching Autodesk.

const APS = "https://developer.api.autodesk.com";

// Autodesk stores non US accounts in EMEA. FIN04 (Koski) is EMEA, so the region header must
// ride on every Data Management and OSS call, or they silently resolve to the wrong region.
export function regionHeaders(region) {
  const r = (region || "US").toUpperCase();
  return r === "US" ? {} : { "x-ads-region": r };
}

// Low level GET against APS. Separated so the harness can stub `fetcher` and inspect calls.
async function apsGet(path, { token, region, fetcher }) {
  const f = fetcher || fetch;
  const res = await f(APS + path, {
    method: "GET",
    headers: { Authorization: "Bearer " + token, ...regionHeaders(region) },
  });
  if (!res.ok) {
    const status = res.status;
    if (status === 401 || status === 403) throw new Error("ACC refused the request (" + status + "). Check the service identity is authorised on the hub and the token is current.");
    if (status === 404) throw new Error("ACC returned 404. Check the project, item and region are correct.");
    throw new Error("ACC request failed (" + status + ") for " + path);
  }
  return res.json();
}

// A version's storage id looks like:
//   urn:adsk.objects:os.object:wip.dm.prod.emea/<guid>.xlsx
// The OSS signed download endpoint needs the bucketKey and the (url encoded) objectKey.
export function parseStorageId(storageId) {
  const marker = "os.object:";
  const i = String(storageId || "").indexOf(marker);
  if (i === -1) throw new Error("Unrecognised ACC storage id: " + storageId);
  const rest = storageId.slice(i + marker.length); // bucketKey/objectKey
  const slash = rest.indexOf("/");
  if (slash === -1) throw new Error("Storage id has no object key: " + storageId);
  return { bucketKey: rest.slice(0, slash), objectKey: rest.slice(slash + 1) };
}

// Resolve the tip (latest) version of an item and pull the file bytes.
// accProjectId is the Data Management project id (the "b." prefixed form).
export async function downloadAccFile({ token, region, accProjectId, itemUrn, fetcher }) {
  if (!token) throw new Error("downloadAccFile needs a token");
  if (!accProjectId || !itemUrn) throw new Error("downloadAccFile needs accProjectId and itemUrn");

  // 1. Tip version of the item. The version carries the storage relationship and a version tag.
  const tip = await apsGet(
    "/data/v1/projects/" + encodeURIComponent(accProjectId) + "/items/" + encodeURIComponent(itemUrn) + "/tip",
    { token, region, fetcher }
  );
  const version = tip && tip.data;
  const storageId = version && version.relationships && version.relationships.storage
    && version.relationships.storage.data && version.relationships.storage.data.id;
  if (!storageId) throw new Error("The tip version returned no storage. The item may not be a downloadable file.");
  const fileName = (version.attributes && (version.attributes.displayName || version.attributes.name)) || "";
  const versionTag = (version.attributes && version.attributes.versionNumber != null)
    ? ("v" + version.attributes.versionNumber) : (version.id || "");

  // 2. Signed S3 download URL from OSS.
  const { bucketKey, objectKey } = parseStorageId(storageId);
  const signed = await apsGet(
    "/oss/v2/buckets/" + encodeURIComponent(bucketKey) + "/objects/" + encodeURIComponent(objectKey) + "/signeds3download",
    { token, region, fetcher }
  );
  const url = signed && signed.url;
  if (!url) throw new Error("OSS returned no signed download URL.");

  // 3. Download the bytes from the signed URL (plain S3 GET, no Autodesk auth header).
  const f = fetcher || fetch;
  const dl = await f(url, { method: "GET" });
  if (!dl.ok) throw new Error("Signed S3 download failed (" + dl.status + ").");
  const buffer = await dl.arrayBuffer();

  // Same shape downloadSharePointFile returns, so the FOK parser path never forks.
  return { fileName, version: versionTag, buffer };
}

// Canonical, key sorted signature of the watch config, so change detection compares like for
// like against Postgres jsonb output (the SharePoint sync learned this the hard way).
export function configSignature(cfg) {
  const c = cfg || {};
  const keys = ["hub_id", "acc_project_id", "folder_urn", "item_urn", "file_name", "sheet_name", "region", "enabled"];
  return JSON.stringify(keys.reduce((o, k) => { o[k] = c[k] === undefined ? null : c[k]; return o; }, {}));
}
