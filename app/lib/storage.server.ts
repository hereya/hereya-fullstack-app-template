import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3: S3Client;

function getS3Client(): S3Client {
  if (!s3) {
    s3 = new S3Client({ region: process.env.awsRegion });
  }
  return s3;
}

function getBucket(): string {
  return process.env.bucketName!;
}

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string
) {
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getFile(
  key: string
): Promise<Buffer | null> {
  const client = getS3Client();
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
      })
    );
    const bytes = await response.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "NoSuchKey") {
      return null;
    }
    throw e;
  }
}

export async function deleteFile(key: string) {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );
}

export async function listFiles(
  prefix?: string
): Promise<string[]> {
  const client = getS3Client();
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: getBucket(),
      Prefix: prefix,
    })
  );
  return (response.Contents ?? []).map((obj) => obj.Key!).filter(Boolean);
}

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn }
  );
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
    { expiresIn }
  );
}
