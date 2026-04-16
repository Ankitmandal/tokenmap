import type { Route } from "./+types/api.webhook";
import { prisma } from "../db.server";
import { createHmac } from "node:crypto";

function verifyWebhookSignature(
  body: string,
  webhookId: string,
  webhookTimestamp: string,
  webhookSignature: string,
): boolean {
  const secret = process.env["DODO_WEBHOOK_SECRET"];
  if (!secret) return false;

  const secretBytes = Buffer.from(
    secret.startsWith("whsec_") ? secret.slice(6) : secret,
    "base64",
  );

  const signedContent = `${webhookId}.${webhookTimestamp}.${body}`;
  const expected = createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  const signatures = webhookSignature.split(" ");
  for (const sig of signatures) {
    const sigValue = sig.split(",").pop() ?? "";
    if (sigValue === expected) return true;
  }
  return false;
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.text();
  const webhookId = request.headers.get("webhook-id") || "";
  const webhookTimestamp = request.headers.get("webhook-timestamp") || "";
  const webhookSignature = request.headers.get("webhook-signature") || "";

  if (!verifyWebhookSignature(body, webhookId, webhookTimestamp, webhookSignature)) {
    console.error("Webhook signature verification failed");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body);
  console.log("Webhook event:", event.type);

  if (event.type === "payment.succeeded") {
    const metadata = event.data?.metadata;
    const email = metadata?.email;
    const paymentId = event.data?.payment_id;

    if (!email) {
      console.error("No email in webhook metadata");
      return Response.json({ error: "No email in metadata" }, { status: 400 });
    }

    await prisma.builder.update({
      where: { email },
      data: {
        paid: true,
        paidAt: new Date(),
        paymentId: paymentId || null,
      },
    });

    console.log(`Payment succeeded for ${email}`);
  }

  return Response.json({ received: true });
}
