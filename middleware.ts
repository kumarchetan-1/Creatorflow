import { type NextRequest } from "next/server";
import { createClient } from "./utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request);

  const pathname = request.nextUrl.pathname;
  const publicRoutes = ["/signin", "/signup", "/auth/callback"];
  const isPublic = publicRoutes.includes(pathname);
  const isApiRoute = pathname.startsWith("/api/");

  // Protect all app pages by default; keep auth pages and API routes accessible.
  if (isPublic || isApiRoute) return response;

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    return Response.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
