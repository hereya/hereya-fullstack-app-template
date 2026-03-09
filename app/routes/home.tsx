import { redirect } from "react-router";
import type { Route } from "./+types/home";
import { getUserId } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);
  if (userId) {
    return redirect("/dashboard");
  }
  return redirect("/auth/login");
}
