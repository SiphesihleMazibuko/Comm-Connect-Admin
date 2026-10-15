import { createClient } from "@supabase/supabase-js";

const unauthorized = (message = "You must sign in as an approved admin.") =>
  Response.json({ error: message }, { status: 401 });

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return unauthorized();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return Response.json(
      {
        error:
          "Set SUPABASE_SERVICE_ROLE_KEY in the server environment to enable user blocking.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const targetUserId =
    body && typeof body === "object" && "userId" in body
      ? (body as { userId?: unknown }).userId
      : null;
  if (
    typeof targetUserId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      targetUserId,
    )
  ) {
    return Response.json({ error: "A valid user ID is required." }, { status: 400 });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } =
    await userClient.auth.getUser(accessToken);
  if (authError || !authData.user) return unauthorized("Your session is invalid or expired.");
  if (authData.user.id === targetUserId) {
    return Response.json(
      { error: "You cannot block your own admin account." },
      { status: 403 },
    );
  }

  const { data: actorProfile, error: actorError } = await userClient
    .from("users")
    .select("role, approvalStatus")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (actorError) {
    console.error("[AdminBlockUser] Could not verify admin profile", actorError);
    return Response.json({ error: "Could not verify admin access." }, { status: 500 });
  }
  if (!actorProfile || actorProfile.role !== "admin") {
    return Response.json(
      { error: "Your user profile does not have the admin role." },
      { status: 403 },
    );
  }
  if (actorProfile.approvalStatus !== "approved") {
    return Response.json(
      { error: "Your admin account has not been approved." },
      { status: 403 },
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: targetProfile, error: targetError } = await adminClient
    .from("users")
    .select("role, approvalStatus")
    .eq("id", targetUserId)
    .maybeSingle();
  if (targetError) {
    console.error("[AdminBlockUser] Could not load target profile", targetError);
    return Response.json({ error: "Could not load the selected user." }, { status: 500 });
  }
  if (!targetProfile) {
    return Response.json({ error: "The selected user was not found." }, { status: 404 });
  }
  if (targetProfile.role === "admin") {
    return Response.json(
      { error: "Admin accounts cannot be blocked from User Management." },
      { status: 403 },
    );
  }
  if (targetProfile.approvalStatus === "blocked") {
    return Response.json({ blocked: true, alreadyBlocked: true });
  }

  const { data: updatedProfile, error: profileUpdateError } = await adminClient
    .from("users")
    .update({ approvalStatus: "blocked" })
    .eq("id", targetUserId)
    .select("id")
    .maybeSingle();
  if (profileUpdateError || !updatedProfile) {
    console.error(
      "[AdminBlockUser] Could not mark the profile as blocked",
      profileUpdateError,
    );
    return Response.json({ error: "Could not update the user status." }, { status: 500 });
  }

  const { error: banError } = await adminClient.auth.admin.updateUserById(
    targetUserId,
    { ban_duration: "876000h" },
  );
  if (banError) {
    const { error: rollbackError } = await adminClient
      .from("users")
      .update({ approvalStatus: targetProfile.approvalStatus })
      .eq("id", targetUserId);
    console.error("[AdminBlockUser] Supabase Auth ban failed", banError);
    if (rollbackError) {
      console.error("[AdminBlockUser] Profile status rollback failed", rollbackError);
    }
    return Response.json({ error: "Supabase Auth could not block this account." }, { status: 502 });
  }

  return Response.json({ blocked: true });
}
