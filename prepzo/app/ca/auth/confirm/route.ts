// CA-host counterpart to app/auth/confirm/route.ts, same one-line re-export
// shape as app/ca/auth/callback/route.ts. proxy.ts rewrites every CA-host
// path to /ca/<path>, so without this file a reset-password email link
// landing on ca.prepzo.study/auth/confirm rewrites to /ca/auth/confirm and
// 404s — the handler itself already branches on isCaHost, so it was always
// meant to be reachable here.
export { GET } from "@/app/auth/confirm/route";
