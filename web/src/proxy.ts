import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { redirectWithCookies, updateSession } from "@/lib/supabase/proxy";

function pickLocale(request: NextRequest): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;

  const accepted = request.headers.get("accept-language") ?? "";
  for (const part of accepted.split(",")) {
    const lang = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (lang === "iw") return "he"; // legacy code for Hebrew
    if (isLocale(lang)) return lang;
  }
  return defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const [, first, ...rest] = pathname.split("/");

  // 1. Every page lives under /he or /en.
  if (!isLocale(first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${pickLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // 2. Refresh the session and decide who may see what.
  const { response, userId } = await updateSession(request);
  const isLoginPage = rest.join("/") === "login";

  if (!userId && !isLoginPage) {
    const url = new URL(`/${first}/login`, request.url);
    if (rest.length > 0) url.searchParams.set("next", pathname + search);
    return redirectWithCookies(url, response);
  }

  if (userId && isLoginPage) {
    return redirectWithCookies(new URL(`/${first}/dashboard`, request.url), response);
  }

  // Remember the language for the next visit to "/".
  if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
    response.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }

  return response;
}

export const config = {
  // Everything except Next.js internals and files with an extension (images, fonts, favicon…).
  matcher: ["/((?!_next/|.*\\.[\\w]+$).*)"],
};
