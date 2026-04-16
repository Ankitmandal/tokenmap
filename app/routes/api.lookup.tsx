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
      email: true,
      githubUsername: true,
      city: true,
      totalTokens: true,
      verified: true,
    },
  });

  if (!builder) {
    return Response.json({ found: false }, { status: 404 });
  }

  return Response.json({
    found: true,
    email: builder.email,
    githubUsername: builder.githubUsername || "",
    city: builder.city,
    totalTokens: builder.totalTokens.toString(),
    verified: builder.verified,
  });
}
