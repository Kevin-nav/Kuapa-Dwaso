const accountId = "a9471a52861e2054b510f4a7b0e069b5";
const bucketName = "kuapa-dwaso";
const token = "cfat_y8i2XAv1O1qV3xz2vuZ23CEcpuYbsGZWWoST7OOU5ec9cc46";

const corsRules = {
  rules: [
    {
      id: "allow-ops-uploads",
      allowed: {
        origins: [
          "https://ops.kuapadwaso.com",
          "https://app.kuapadwaso.com",
          "https://admin.kuapadwaso.com",
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
          "http://localhost:3003"
        ],
        methods: ["GET", "PUT", "POST", "HEAD"],
        headers: ["*"]
      },
      maxAgeSeconds: 3000
    }
  ]
};

try {
  console.log("Configuring R2 CORS using Cloudflare API...");
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/cors`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(corsRules)
  });

  const result = await response.json();
  if (response.ok && result.success) {
    console.log("R2 CORS configuration successfully updated using Cloudflare API!");
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.error("Cloudflare API returned error:", JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error("Request failed:", error);
}
