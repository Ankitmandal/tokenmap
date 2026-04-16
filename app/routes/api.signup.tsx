import type { Route } from "./+types/api.signup";
import { prisma } from "../db.server";
import { randomBytes } from "node:crypto";

function generateClaimCode(): string {
  // 6 alphanumeric chars, e.g. "TM-a8f3b2"
  const chars = randomBytes(3).toString("hex"); // 6 hex chars
  return `TM-${chars}`;
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { email, city, githubUsername, lat, lng } = body as {
    email?: string;
    city?: string;
    githubUsername?: string;
    lat?: number;
    lng?: number;
  };

  if (!email || !city) {
    return Response.json(
      { error: "Email and city are required" },
      { status: 400 }
    );
  }

  const trimmedCity = city.trim();

  // Check if already exists
  const existing = await prisma.builder.findUnique({ where: { email } });
  if (existing) {
    // Update lat/lng if provided and missing
    if (lat && lng && !existing.lat) {
      await prisma.builder.update({
        where: { email },
        data: { lat, lng },
      });
    }

    const cityCount = await prisma.builder.count({
      where: { city: existing.city },
    });
    const cityPosition = await prisma.builder.count({
      where: { city: existing.city, id: { lte: existing.id } },
    });
    return Response.json({
      success: true,
      alreadyExists: true,
      position: existing.id,
      email: existing.email,
      githubUsername: existing.githubUsername || "",
      city: existing.city,
      cityPosition,
      cityCount,
      claimCode: existing.claimCode,
      referralCode: existing.referralCode,
      verified: existing.verified,
      paid: existing.paid,
      totalTokens: existing.totalTokens.toString(),
    });
  }

  // Generate unique claim code (retry on collision)
  let claimCode = generateClaimCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.builder.findUnique({ where: { claimCode } });
    if (!exists) break;
    claimCode = generateClaimCode();
  }

  const entry = await prisma.builder.create({
    data: {
      email,
      city: trimmedCity,
      githubUsername: githubUsername?.trim() || null,
      claimCode,
      lat: lat || null,
      lng: lng || null,
    },
  });

  const totalCount = await prisma.builder.count();
  const cityCount = await prisma.builder.count({
    where: { city: entry.city },
  });

  return Response.json({
    success: true,
    alreadyExists: false,
    position: entry.id,
    email: entry.email,
    githubUsername: entry.githubUsername || "",
    city: entry.city,
    cityPosition: cityCount,
    cityCount,
    totalCount,
    claimCode: entry.claimCode,
    referralCode: entry.referralCode,
    verified: false,
    paid: false,
    totalTokens: "0",
  });
}
