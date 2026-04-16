import type { Route } from "./+types/api.checkout";
import { prisma } from "../db.server";
import DodoPayments from "dodopayments";

function getDodoClient(): DodoPayments {
  const apiKey = process.env["DODO_API_KEY"];
  if (!apiKey) throw new Error("DODO_API_KEY is not set");
  const isLive = apiKey.startsWith("sk_live_");
  return new DodoPayments({
    bearerToken: apiKey,
    environment: isLive ? "live_mode" : "test_mode",
  });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { email } = body as { email?: string };

  if (!email) {
    return Response.json({ error: "Email required" }, { status: 400 });
  }

  const builder = await prisma.builder.findUnique({ where: { email } });
  if (!builder) {
    return Response.json({ error: "Sign up first" }, { status: 404 });
  }

  if (builder.paid) {
    return Response.json({ error: "Already paid", alreadyPaid: true }, { status: 400 });
  }

  const productId = process.env["DODO_PRODUCT_ID"];
  if (!productId) throw new Error("DODO_PRODUCT_ID is not set");

  const baseUrl = process.env["RAILWAY_PUBLIC_DOMAIN"]
    ? `https://${process.env["RAILWAY_PUBLIC_DOMAIN"]}`
    : process.env["BASE_URL"] || "http://localhost:5173";

  const client = getDodoClient();
  const session = await client.checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: { email, name: builder.githubUsername || email.split("@")[0] },
    return_url: `${baseUrl}?paid=true&email=${encodeURIComponent(email)}`,
    metadata: { builderId: String(builder.id), email },
  });

  const url = session.checkout_url;
  if (!url) {
    return Response.json({ error: "Failed to create checkout" }, { status: 500 });
  }

  return Response.json({ checkoutUrl: url });
}
