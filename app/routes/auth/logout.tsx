import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { destroyUserSession } from "~/lib/auth.server";

export async function loader() {
  return redirect("/auth/login");
}

export async function action({ request }: Route.ActionArgs) {
  return destroyUserSession(request);
}
