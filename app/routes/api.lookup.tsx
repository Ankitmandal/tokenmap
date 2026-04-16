import type { Route } from "./+types/api.lookup";
import { prisma } from "../db.server";

// Read-only lookup — never creates accounts
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");

  if (!email) {
    return Response.json({ error: "Email required" }, { status: 400 });
  }

  const builder = await prisma.builder.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      githubUsername: true,
      city: true,
      totalTokens: true,
      verified: true,
      paid: true,
      claimCode: true,
      referralCode: true,
    },
  });

  if (!builder) {
    return Response.json({ found: false }, { status: 404 });
  }

  // Calculate position and city stats
  const [position, cityCount, cityPosition] = await Promise.all([
    prisma.builder.count({ where: { id: { lte: builder.id } } }),
    prisma.builder.count({ where: { city: builder.city } }),
    prisma.builder.count({ where: { city: builder.city, id: { lte: builder.id } } }),
  ]);

  return Response.json({
    found: true,
    success: true,
    email: builder.email,
    githubUsername: builder.githubUsername || "",
    city: builder.city,
    totalTokens: builder.totalTokens.toString(),
    verified: builder.verified,
    paid: builder.paid,
    claimCode: builder.claimCode,
    referralCode: builder.referralCode,
    position,
    cityPosition,
    cityCount,
  });
}
