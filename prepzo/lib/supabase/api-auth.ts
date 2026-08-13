// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export async function getRequestUser(request: Request, supabase: AnySupabase) {
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser();

  if (cookieUser) return cookieUser;

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!token) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  return user ?? null;
}
