import type { Route } from "./+types/api.projects";
import { prisma } from "../db.server";

// GET /api/projects?code=TM-xxx — fetch your projects
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return Response.json({ error: "Claim code required" }, { status: 400 });
  }

  const builder = await prisma.builder.findUnique({
    where: { claimCode: code },
    select: { projects: true, githubUsername: true },
  });

  if (!builder) {
    return Response.json({ error: "Invalid claim code" }, { status: 404 });
  }

  return Response.json({
    projects: builder.projects || [],
    username: builder.githubUsername,
  });
}

// POST /api/projects — update project visibility/urls
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { code, projects } = body as {
    code?: string;
    projects?: Array<{
      name: string;
      messages: number;
      visibility: "public" | "building" | "hidden";
      url: string;
    }>;
  };

  if (!code || !projects) {
    return Response.json({ error: "Code and projects required" }, { status: 400 });
  }

  const builder = await prisma.builder.findUnique({
    where: { claimCode: code },
  });

  if (!builder) {
    return Response.json({ error: "Invalid claim code" }, { status: 404 });
  }

  // Validate visibility values
  const validVisibilities = ["public", "building", "hidden"];
  for (const p of projects) {
    if (!validVisibilities.includes(p.visibility)) {
      return Response.json({ error: `Invalid visibility: ${p.visibility}` }, { status: 400 });
    }
  }

  await prisma.builder.update({
    where: { id: builder.id },
    data: { projects },
  });

  return Response.json({ success: true, projects });
}
