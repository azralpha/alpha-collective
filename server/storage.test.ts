import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { send, clientConstructor, putCommandConstructor, deleteCommandConstructor, headBucketCommandConstructor } = vi.hoisted(() => {
  const send = vi.fn();
  const clientConstructor = vi.fn(function (this: unknown) { return { send }; });
  const putCommandConstructor = vi.fn(function (this: unknown, input: unknown) { return { input }; });
  const deleteCommandConstructor = vi.fn(function (this: unknown, input: unknown) { return { input }; });
  const headBucketCommandConstructor = vi.fn(function (this: unknown, input: unknown) { return { input }; });
  return { send, clientConstructor, putCommandConstructor, deleteCommandConstructor, headBucketCommandConstructor };
});

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: clientConstructor,
  PutObjectCommand: putCommandConstructor,
  DeleteObjectCommand: deleteCommandConstructor,
  HeadBucketCommand: headBucketCommandConstructor,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

beforeEach(() => {
  send.mockResolvedValue({});
});

describe("product image storage", () => {
  it("checks R2 bucket connectivity without exposing credential values", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("R2_ACCOUNT_ID", "0123456789abcdef0123456789abcdef");
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-access-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret-key");
    vi.stubEnv("R2_BUCKET_NAME", "alpha-market-product-images");

    const { checkProductImageStorage } = await import("./storage");
    const result = await checkProductImageStorage();

    expect(result).toMatchObject({ ok: true, bucket: "alpha-market-product-images", endpointHost: "0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com", credentialsPresent: true });
    expect(result).not.toHaveProperty("accessKeyId");
    expect(result).not.toHaveProperty("secretAccessKey");
    expect(headBucketCommandConstructor).toHaveBeenCalledWith({ Bucket: "alpha-market-product-images" });
  });

  it("classifies R2 TLS failures without returning the raw error message", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("R2_ACCOUNT_ID", "0123456789abcdef0123456789abcdef");
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-access-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret-key");
    vi.stubEnv("R2_BUCKET_NAME", "alpha-market-product-images");
    send.mockRejectedValueOnce(Object.assign(new Error("TLS handshake failed"), { code: "EPROTO" }));

    const { checkProductImageStorage } = await import("./storage");
    const result = await checkProductImageStorage();

    expect(result).toMatchObject({ ok: false, errorClass: "tls-handshake", errorCode: "EPROTO", httpStatus: null });
    expect(result).not.toHaveProperty("message");
  });

  it("uploads processed product bytes to the configured R2 bucket with public immutable metadata", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("R2_ACCOUNT_ID", "0123456789abcdef0123456789abcdef");
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-access-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret-key");
    vi.stubEnv("R2_BUCKET_NAME", "alpha-market-product-images");
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://images.alphamarket.name.ng");

    const { storagePutProductImage } = await import("./storage");
    const result = await storagePutProductImage("vendor-products/41/photo.webp", Buffer.from("webp"), "image/webp");

    expect(clientConstructor).toHaveBeenCalledWith(expect.objectContaining({
      region: "auto",
      endpoint: "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
      forcePathStyle: true,
    }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({
      Bucket: "alpha-market-product-images",
      Key: expect.stringMatching(/^vendor-products\/41\/photo_[a-f0-9]{8}\.webp$/),
      Body: Buffer.from("webp"),
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }) }));
    expect(result.url).toMatch(/^https:\/\/images\.alphamarket\.name\.ng\/vendor-products\/41\/photo_[a-f0-9]{8}\.webp$/);
  });

  it("fails closed in production rather than returning an ephemeral local image URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { storagePutProductImage } = await import("./storage");
    await expect(storagePutProductImage("official-products/1/photo.webp", Buffer.from("image"), "image/webp"))
      .rejects.toThrow("Durable product image storage is not configured");
    expect(send).not.toHaveBeenCalled();
  });

  it("uses local storage only in development when no R2 credentials are present", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("UPLOADS_DIR", "/tmp/alpha-market-storage-test");
    const { storagePutProductImage } = await import("./storage");
    const result = await storagePutProductImage("vendor-products/41/photo.webp", Buffer.from("local"), "image/webp");
    expect(result.url).toMatch(/^http:\/\/localhost:3000\/uploads\/vendor-products\/41\/photo_[a-f0-9]{8}\.webp$/);
    expect(send).not.toHaveBeenCalled();
  });

  it("accepts only safe same-origin and R2 image URLs and enforces vendor ownership", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "0123456789abcdef0123456789abcdef");
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://images.alphamarket.name.ng");
    const { isProductImageUrl, isProductImageUrlUnderPrefix, isR2ProductImageUrl } = await import("./storage");

    expect(isProductImageUrl("https://images.alphamarket.name.ng/vendor-products/41/photo.webp")).toBe(true);
    expect(isR2ProductImageUrl("https://images.alphamarket.name.ng/vendor-products/41/photo.webp")).toBe(true);
    expect(isR2ProductImageUrl("/uploads/vendor-products/41/photo.webp")).toBe(false);
    expect(isR2ProductImageUrl("https://evil.example/vendor-products/41/photo.webp")).toBe(false);
    expect(isProductImageUrl("https://evil.example/vendor-products/41/photo.webp")).toBe(false);
    expect(isProductImageUrl("https://images.alphamarket.name.ng/%2e%2e/private.webp")).toBe(false);
    expect(isProductImageUrlUnderPrefix("https://images.alphamarket.name.ng/vendor-products/41/photo.webp", "vendor-products/41")).toBe(true);
    expect(isProductImageUrlUnderPrefix("https://images.alphamarket.name.ng/vendor-products/42/photo.webp", "vendor-products/41")).toBe(false);
    expect(isProductImageUrlUnderPrefix("/uploads/vendor-products/41/old.webp", "vendor-products/41")).toBe(true);
  });

  it("deletes a failed partial product-image upload from the configured R2 bucket", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("R2_ACCOUNT_ID", "0123456789abcdef0123456789abcdef");
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-access-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret-key");
    vi.stubEnv("R2_BUCKET_NAME", "alpha-market-product-images");
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://images.alphamarket.name.ng");
    const { storageDeleteProductImage } = await import("./storage");

    await storageDeleteProductImage("official-products/1/gallery-0.webp");

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ input: {
      Bucket: "alpha-market-product-images",
      Key: "official-products/1/gallery-0.webp",
    } }));
  });
});
