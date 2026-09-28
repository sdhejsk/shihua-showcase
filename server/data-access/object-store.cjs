const fs = require("fs");
const { Client } = require("minio");
const config = require("../config.cjs");

let client = null;

function getObjectStore() {
  if (!client) {
    client = new Client({
      endPoint: config.objectStore.endpoint,
      port: config.objectStore.port,
      useSSL: config.objectStore.useSSL,
      accessKey: config.objectStore.accessKey,
      secretKey: config.objectStore.secretKey
    });
  }
  return client;
}

function getBucketName() {
  return config.objectStore.bucket;
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
