import type { NextApiRequest, NextApiResponse } from "next";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";

function isAuthorized(req: NextApiRequest): boolean {
  const expected = process.env.BASIC_AUTH;
  if (!expected) return true;
  return req.headers.authorization === `Basic ${expected}`;
}

const s3 = new S3Client({ region: process.env.AWS_S3_REGION });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!isAuthorized(req)) {
    res.setHeader("WWW-Authenticate", "Basic");
    res.status(401).end("Unauthorized");
    return;
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).end("Method Not Allowed");
    return;
  }

  const filename = req.query.filename as string;
  const contentType = (req.query.contentType as string) || "image/jpeg";
  const key = `articles/${nanoid()}-${filename}`;
  const command = new PutObjectCommand({
    Bucket: process.env.ARTICLE_IMAGE_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  res.status(200).json({ uploadUrl, key });
}
