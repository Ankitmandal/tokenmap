import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("variants", "routes/variants.tsx"),
  route("api/signup", "routes/api.signup.tsx"),
  route("api/leaderboard", "routes/api.leaderboard.tsx"),
  route("api/verify-usage", "routes/api.verify-usage.tsx"),
  route("api/tiles", "routes/api.tiles.tsx"),
  route("api/scan-local", "routes/api.scan-local.tsx"),
  route("api/lookup", "routes/api.lookup.tsx"),
  route("api/claim", "routes/api.claim.tsx"),
  route("api/claim-status", "routes/api.claim-status.tsx"),
  route("api/checkout", "routes/api.checkout.tsx"),
  route("api/webhook", "routes/api.webhook.tsx"),
] satisfies RouteConfig;
