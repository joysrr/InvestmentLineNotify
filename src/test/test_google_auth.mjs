import "dotenv/config";
import { JWT } from "google-auth-library";

let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";
privateKey = privateKey.replace(/^["']|["']$/g, "");
if (privateKey && !privateKey.includes("\n")) {
  privateKey = privateKey.replace(/\\n/g, "\n");
}

console.log("Private Key starts with:", privateKey.substring(0, 30));

try {
  const jwtClient = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  await jwtClient.authorize();
  console.log("Auth success!");
} catch (e) {
  console.error("Auth error:", e.message);
}
