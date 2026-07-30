import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type R2PublicMediaConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl: string;
};

let cachedClient: S3Client | null = null;
let cachedFingerprint = "";

function readR2Config(): R2PublicMediaConfig | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucketName = process.env.R2_BUCKET_NAME?.trim() ?? "";
  const publicBaseUrl = (
    process.env.R2_PUBLIC_URL ??
    process.env.R2_TEMP_PUBLIC ??
    ""
  )
    .trim()
    .replace(/\/$/, "");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicBaseUrl) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucketName, publicBaseUrl };
}

function clientFor(config: R2PublicMediaConfig) {
  const fingerprint = `${config.accountId}:${config.accessKeyId}`;
  if (!cachedClient || cachedFingerprint !== fingerprint) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    cachedFingerprint = fingerprint;
  }
  return cachedClient;
}

export function isR2PublicMediaConfigured() {
  return readR2Config() !== null;
}

export async function uploadPublicMediaObject(input: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  cacheControl?: string;
}): Promise<string> {
  const config = readR2Config();
  if (!config) throw new Error("Cloudflare R2 public media storage is not configured.");
  if (!input.key || input.key.includes("..") || input.key.startsWith("/")) {
    throw new Error("Invalid public media object key.");
  }

  await clientFor(config).send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: input.key,
      Body: new Uint8Array(input.body),
      ContentType: input.contentType,
      CacheControl: input.cacheControl ?? "public, max-age=31536000, immutable",
    }),
  );
  return `${config.publicBaseUrl}/${input.key}`;
}

export async function deletePublicMediaObject(key: string): Promise<void> {
  const config = readR2Config();
  if (!config || !key || key.includes("..") || key.startsWith("/")) return;
  await clientFor(config).send(
    new DeleteObjectCommand({ Bucket: config.bucketName, Key: key }),
  );
}

export function r2PublicMediaKeyFromUrl(url: string): string | null {
  const config = readR2Config();
  if (!config) return null;
  try {
    const base = new URL(`${config.publicBaseUrl}/`);
    const candidate = new URL(url);
    if (candidate.origin !== base.origin || !candidate.pathname.startsWith(base.pathname)) {
      return null;
    }
    const key = decodeURIComponent(candidate.pathname.slice(base.pathname.length));
    return key && !key.includes("..") && !key.startsWith("/") ? key : null;
  } catch {
    return null;
  }
}
