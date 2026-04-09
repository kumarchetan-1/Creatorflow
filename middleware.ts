import { type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request);

  const pathname = request.nextUrl.pathname;
  const protectedRoutes = ["/chat", "/dashboard", "/inbox", "/connections"];
  const isProtected =
    protectedRoutes.includes(pathname) ||
    protectedRoutes.some((p) => p !== "/" && pathname.startsWith(`${p}/`));

  if (!isProtected) return response;

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
