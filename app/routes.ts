import { type RouteConfig, index, route, prefix } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  ...prefix("auth", [
    route("login", "routes/auth/login.tsx"),
    route("code", "routes/auth/code.tsx"),
    route("logout", "routes/auth/logout.tsx"),
    route("passkey/register", "routes/auth/passkey.register.ts"),
    route("passkey/authenticate", "routes/auth/passkey.authenticate.ts"),
  ]),
  route("dashboard", "routes/dashboard.tsx"),
  route("admin/users", "routes/admin/users.tsx"),
] satisfies RouteConfig;
