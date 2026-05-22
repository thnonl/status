import { getVapidPublicKey } from "@/lib/push";

export async function GET() {
  const publicKey = getVapidPublicKey();
  return Response.json({ publicKey, configured: Boolean(publicKey) });
}
