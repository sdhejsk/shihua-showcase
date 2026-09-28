const fs = require("fs");
const { Client } = require("minio");

let client = null;

function getObjectStore() {
  if (!client) {
    client = new Client({
      endPoint: process.env.MINIO_ENDPOINT || "localhost",
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: String(process.env.MINIO_USE_SSL || "false").toLowerCase() === "true",
      accessKey: process.env.MINIO_ACCESS_KEY || "shihua",
      secretKey: process.env.MINIO_SECRET_KEY || "shihua_minio_password"
    });
  }
  return client;
}

function getBucketName() {
  return process.env.MINIO_BUCKET || "shihua-source-data";
}

async function ensureBucket() {
  const store = getObjectStore();
  const bucket = getBucketName();
  if (!(await store.bucketExists(bucket))) {
    await store.makeBucket(bucket, "us-east-1");
  }
  return bucket;
}

async function uploadFile(objectKey, filePath, sizeBytes, metadata = {}) {
  const bucket = await ensureBucket();
  await getObjectStore().putObject(bucket, objectKey, fs.createReadStream(filePath), sizeBytes, metadata);
  return { bucket, objectKey };
}

async function getObjectStream(objectKey) {
  return getObjectStore().getObject(getBucketName(), objectKey);
}

module.exports = {
  ensureBucket,
  getBucketName,
  getObjectStream,
  uploadFile
};
