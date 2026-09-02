const CATALOG = Object.freeze([
  Object.freeze({
    id: "05ce00ff-544c-5fc1-81ca-387b109116d4",
    version: "0.2.7",
    title: "Ranma Card Game",
    authors: "Strichnine",
    description:
      "Ranma 1/2 created by Rumiko Takahashi. Based on Epic Battles by Score. Fan set by Strichnine.",
    projectUrl: "https://sites.google.com/site/epicbattlestcg/epic-battles-workshop/ranma-12?authuser=0",
    iconUrl:
      "https://octgn-multi-game-feed.awesome-mole.workers.dev/assets/ranma/resources/cardback.jpg",
    tags: "SCORE 1v1 Epic Battles Ranma Fan Made",
    r2Key:
      "packages/ranma/05ce00ff-544c-5fc1-81ca-387b109116d4.0.2.7.nupkg",
    size: 813166,
    updated: "2026-09-02T07:48:00Z",
  }),
  Object.freeze({
    id: "336cc7ef-c808-5f75-a22e-0171564da1e3",
    version: "0.9.0.3",
    title: "Epic Battles Online",
    authors: "Strichnine and Lifeless; contributors Ehrmac and Honeybee",
    description:
      "Unofficial OCTGN implementation of Epic Battles TCG. Plugin and fan sets by Strichnine and Lifeless. Contributors: Ehrmac and Honeybee.",
    projectUrl: "https://github.com/JoePerry/Epic-Battles-Online",
    iconUrl:
      "https://octgn-multi-game-feed.awesome-mole.workers.dev/assets/epic-battles-online/resources/cardback.jpg",
    tags:
      "Street Fighter Mortal Kombat Tekken Marvel Vs Capcom TCG CCG Fan Set",
    r2Key:
      "packages/epic-battles-online/336cc7ef-c808-5f75-a22e-0171564da1e3.0.9.0.3.nupkg",
    size: 2137434,
    updated: "2026-09-01T12:36:00Z",
  }),
]);

const XML_HEADERS = Object.freeze({
  "content-type": "application/xml; charset=utf-8",
  "cache-control": "public, max-age=300",
  "access-control-allow-origin": "*",
});

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};

export async function handleRequest(request, env = {}) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, HEAD, OPTIONS",
        "access-control-allow-headers": "Range, If-None-Match",
      },
    });
  }

  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "GET, HEAD, OPTIONS" },
    });
  }

  const path = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, "");
  const base = `${url.origin}/`;
  let response;

  if (!path) {
    response = xml(serviceDocument(base));
  } else if (path === "$metadata") {
    response = xml(metadataDocument());
  } else if (isPackageCollectionPath(path)) {
    response = xml(packagesDocument(base, selectPackages(path, url.searchParams)));
  } else if (path.startsWith("assets/")) {
    response = await serveObject(
      request,
      env,
      `games/${path.slice("assets/".length)}`,
    );
  } else {
    const packageMatch = matchPackagePath(path);
    if (!packageMatch) return new Response("Not Found", { status: 404 });

    const pkg = packages().find(
      (item) =>
        item.id.toLowerCase() === packageMatch.id.toLowerCase() &&
        item.version.toLowerCase() === packageMatch.version.toLowerCase(),
    );
    if (!pkg) return new Response("Package Not Found", { status: 404 });

    response = packageMatch.value
      ? await serveObject(request, env, pkg.r2Key, {
          contentType: "application/zip",
          downloadName: `${pkg.id}.${pkg.version}.nupkg`,
        })
      : xml(entryDocument(base, pkg));
  }

  if (method === "HEAD" && response.body) {
    return new Response(null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
  return response;
}

async function serveObject(request, env, key, options = {}) {
  if (!env.OCTGN_DATA) {
    return new Response("R2 binding is not configured", { status: 503 });
  }

  const isHead = request.method.toUpperCase() === "HEAD";
  const rangeHeader = request.headers.get("range");
  const object = isHead
    ? await env.OCTGN_DATA.head(key)
    : rangeHeader
      ? await env.OCTGN_DATA.get(key, { range: request.headers })
      : await env.OCTGN_DATA.get(key);
  if (!object) return new Response("Object Not Found", { status: 404 });

  const headers = new Headers();
  if (typeof object.writeHttpMetadata === "function") {
    object.writeHttpMetadata(headers);
  }
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  if (object.size !== undefined) headers.set("content-length", String(object.size));
  headers.set("accept-ranges", "bytes");
  headers.set("access-control-allow-origin", "*");
  headers.set(
    "cache-control",
    key.endsWith(".json")
      ? "public, max-age=300"
      : "public, max-age=86400, immutable",
  );
  if (options.contentType) headers.set("content-type", options.contentType);
  if (!headers.has("content-type")) headers.set("content-type", contentTypeFor(key));
  if (options.downloadName) {
    headers.set(
      "content-disposition",
      `attachment; filename="${options.downloadName.replace(/\"/g, "")}"`,
    );
  }

  const status = rangeHeader && object.range ? 206 : 200;
  return new Response(isHead ? null : object.body, { status, headers });
}

function contentTypeFor(key) {
  const extension = key.split(".").pop().toLowerCase();
  return (
    {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      json: "application/json; charset=utf-8",
      nupkg: "application/zip",
      o8g: "application/zip",
      o8c: "application/zip",
      zip: "application/zip",
      pdf: "application/pdf",
    }[extension] || "application/octet-stream"
  );
}

function isPackageCollectionPath(path) {
  return /^(Packages|Packages\(\)|Search\(\)|FindPackagesById\(\))$/i.test(path);
}

function matchPackagePath(path) {
  const match = path.match(
    /^Packages\(Id='([^']+)',Version='([^']+)'\)(\/\$value)?$/i,
  );
  if (!match) return null;
  return {
    id: decodeODataString(match[1]),
    version: decodeODataString(match[2]),
    value: Boolean(match[3]),
  };
}

function decodeODataString(value) {
  return value.replace(/''/g, "'");
}

function selectPackages(path, searchParams) {
  let result = packages();
  const id =
    extractFunctionArgument(path, "id") ||
    decodeODataParameter(searchParams.get("id"));
  const search =
    extractFunctionArgument(path, "searchTerm") ||
    decodeODataParameter(searchParams.get("searchTerm"));

  if (id) result = result.filter((pkg) => pkg.id.toLowerCase() === id.toLowerCase());
  if (search) {
    const needle = search.toLowerCase();
    result = result.filter((pkg) =>
      [pkg.id, pkg.title, pkg.tags, pkg.description].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }

  const filter = searchParams.get("$filter") || "";
  const idFilter = filter.match(/Id\s+eq\s+'([^']+)'/i);
  const versionFilter = filter.match(/Version\s+eq\s+'([^']+)'/i);
  if (idFilter) {
    result = result.filter(
      (pkg) => pkg.id.toLowerCase() === decodeODataString(idFilter[1]).toLowerCase(),
    );
  }
  if (versionFilter) {
    result = result.filter(
      (pkg) =>
        pkg.version.toLowerCase() ===
        decodeODataString(versionFilter[1]).toLowerCase(),
    );
  }

  const skip = Math.max(0, Number.parseInt(searchParams.get("$skip") || "0", 10) || 0);
  const topValue = Number.parseInt(searchParams.get("$top") || "", 10);
  const top = Number.isFinite(topValue) && topValue >= 0 ? topValue : result.length;
  return result.slice(skip, skip + top);
}

function decodeODataParameter(value) {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return decodeODataString(trimmed.slice(1, -1));
  }
  return trimmed;
}

function extractFunctionArgument(path, name) {
  const expression = new RegExp(`${name}='((?:''|[^'])*)'`, "i");
  const match = path.match(expression);
  return match ? decodeODataString(match[1]) : "";
}

function packages() {
  const list = CATALOG.map((pkg) => ({
    ...pkg,
    created: new Date(pkg.updated),
    updated: new Date(pkg.updated),
    latest: false,
  })).sort((a, b) => {
    const idOrder = a.id.localeCompare(b.id);
    return idOrder || compareVersions(a.version, b.version);
  });

  for (const pkg of list) {
    const newer = list.some(
      (candidate) =>
        candidate.id === pkg.id && compareVersions(candidate.version, pkg.version) > 0,
    );
    pkg.latest = !newer;
  }
  return list;
}

function serviceDocument(base) {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    `<service xml:base="${escapeXml(base)}" ` +
    'xmlns="http://www.w3.org/2007/app" xmlns:atom="http://www.w3.org/2005/Atom">' +
    '<workspace><atom:title>OCTGN Multi-Game Feed</atom:title><collection href="Packages">' +
    '<atom:title>Packages</atom:title></collection></workspace></service>'
  );
}

function metadataDocument() {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">' +
    '<edmx:DataServices m:DataServiceVersion="2.0" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">' +
    '<Schema Namespace="NuGetGallery" xmlns="http://schemas.microsoft.com/ado/2008/09/edm">' +
    '<EntityType Name="V2FeedPackage"><Key><PropertyRef Name="Id"/><PropertyRef Name="Version"/></Key>' +
    '<Property Name="Id" Type="Edm.String" Nullable="false"/><Property Name="Version" Type="Edm.String" Nullable="false"/>' +
    '<Property Name="Title" Type="Edm.String"/><Property Name="Authors" Type="Edm.String"/>' +
    '<Property Name="Description" Type="Edm.String"/><Property Name="Summary" Type="Edm.String"/>' +
    '<Property Name="Tags" Type="Edm.String"/><Property Name="ProjectUrl" Type="Edm.String"/>' +
    '<Property Name="IconUrl" Type="Edm.String"/><Property Name="PackageSize" Type="Edm.Int64"/>' +
    '<Property Name="Created" Type="Edm.DateTime"/><Property Name="LastUpdated" Type="Edm.DateTime"/>' +
    '<Property Name="Published" Type="Edm.DateTime"/><Property Name="IsLatestVersion" Type="Edm.Boolean"/>' +
    '<Property Name="IsAbsoluteLatestVersion" Type="Edm.Boolean"/><Property Name="IsPrerelease" Type="Edm.Boolean"/>' +
    '<Property Name="RequireLicenseAcceptance" Type="Edm.Boolean"/><Property Name="DownloadCount" Type="Edm.Int32"/>' +
    '<Property Name="VersionDownloadCount" Type="Edm.Int32"/><Property Name="Dependencies" Type="Edm.String"/>' +
    '<Property Name="PackageHash" Type="Edm.String"/><Property Name="PackageHashAlgorithm" Type="Edm.String"/>' +
    '</EntityType><EntityContainer Name="FeedContext" m:IsDefaultEntityContainer="true">' +
    '<EntitySet Name="Packages" EntityType="NuGetGallery.V2FeedPackage"/></EntityContainer>' +
    '</Schema></edmx:DataServices></edmx:Edmx>'
  );
}

function packagesDocument(base, list) {
  const updated = list.length
    ? new Date(Math.max(...list.map((item) => item.updated.getTime())))
    : new Date(0);
  let body =
    '<?xml version="1.0" encoding="utf-8"?>' +
    `<feed xml:base="${escapeXml(base)}" xmlns="http://www.w3.org/2005/Atom" ` +
    'xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" ' +
    'xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">' +
    `<id>${escapeXml(`${base}Packages`)}</id><title type="text">Packages</title>` +
    `<updated>${iso(updated)}</updated><link rel="self" title="Packages" href="Packages"/>`;
  for (const pkg of list) body += entry(base, pkg);
  return `${body}</feed>`;
}

function entryDocument(base, pkg) {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    `<entry xml:base="${escapeXml(base)}" xmlns="http://www.w3.org/2005/Atom" ` +
    'xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" ' +
    'xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">' +
    entryBody(base, pkg) +
    '</entry>'
  );
}

function entry(base, pkg) {
  return `<entry>${entryBody(base, pkg)}</entry>`;
}

function entryBody(base, pkg) {
  const key = `Packages(Id='${odataEscape(pkg.id)}',Version='${odataEscape(pkg.version)}')`;
  const valueUrl = `${base}${key}/$value`;
  return (
    `<id>${escapeXml(base + key)}</id><title type="text">${escapeXml(pkg.title)}</title>` +
    `<summary type="text">${escapeXml(pkg.description)}</summary><updated>${iso(pkg.updated)}</updated>` +
    `<author><name>${escapeXml(pkg.authors)}</name></author>` +
    `<link rel="edit-media" title="V2FeedPackage" href="${escapeXml(`${key}/$value`)}"/>` +
    `<link rel="edit" title="V2FeedPackage" href="${escapeXml(key)}"/>` +
    '<category term="NuGetGallery.V2FeedPackage" scheme="http://schemas.microsoft.com/ado/2007/08/dataservices/scheme"/>' +
    `<content type="application/zip" src="${escapeXml(valueUrl)}"/>` +
    '<m:properties>' +
    data("Id", pkg.id) +
    data("Version", pkg.version) +
    data("NormalizedVersion", pkg.version) +
    data("Authors", pkg.authors) +
    data("Copyright", "") +
    date("Created", pkg.created) +
    data("Dependencies", "") +
    data("Description", pkg.description) +
    int("DownloadCount", 0) +
    data("GalleryDetailsUrl", base + key) +
    data("IconUrl", pkg.iconUrl) +
    bool("IsLatestVersion", pkg.latest) +
    bool("IsAbsoluteLatestVersion", pkg.latest) +
    bool("IsPrerelease", false) +
    nil("Language", "Edm.String") +
    date("LastUpdated", pkg.updated) +
    date("Published", pkg.created) +
    data("PackageHash", "") +
    data("PackageHashAlgorithm", "") +
    int64("PackageSize", pkg.size) +
    data("ProjectUrl", pkg.projectUrl) +
    data("ReportAbuseUrl", "") +
    data("ReleaseNotes", "Migrated to the unified Cloudflare-hosted OCTGN feed.") +
    bool("RequireLicenseAcceptance", false) +
    data("Summary", pkg.description) +
    data("Tags", pkg.tags) +
    data("Title", pkg.title) +
    int("VersionDownloadCount", 0) +
    nil("MinClientVersion", "Edm.String") +
    nil("LastEdited", "Edm.DateTime") +
    nil("LicenseUrl", "Edm.String") +
    nil("LicenseNames", "Edm.String") +
    nil("LicenseReportUrl", "Edm.String") +
    '</m:properties>'
  );
}

function xml(value) {
  return new Response(value, { status: 200, headers: XML_HEADERS });
}

function compareVersions(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0);
    if (delta) return delta;
  }
  return 0;
}

function iso(value) {
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function odataEscape(value) {
  return String(value).replace(/'/g, "''");
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function data(name, value) {
  return `<d:${name}>${escapeXml(value)}</d:${name}>`;
}

function bool(name, value) {
  return `<d:${name} m:type="Edm.Boolean">${value ? "true" : "false"}</d:${name}>`;
}

function int(name, value) {
  return `<d:${name} m:type="Edm.Int32">${Number(value || 0)}</d:${name}>`;
}

function int64(name, value) {
  return `<d:${name} m:type="Edm.Int64">${Number(value || 0)}</d:${name}>`;
}

function date(name, value) {
  return `<d:${name} m:type="Edm.DateTime">${iso(value)}</d:${name}>`;
}

function nil(name, type) {
  return `<d:${name} m:type="${type}" m:null="true" />`;
}
