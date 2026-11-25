import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { businesses } from "@/db/schema";
import { createUserAccountSchema } from "@/lib/validators";
import { canManageUsers, isPrimaryAdmin } from "@/lib/auth/admin";
import { getLicenseEntitlements } from "@/lib/licenses/service";
import { countUsedAccountSeats } from "@/lib/licenses/seats";
import { deleteAccounts } from "@/lib/accounts/deletion";
import { createAccountResponse } from "./create";
import { accountListItemFromUser, listAccountsForAdmin, requireTeamAdmin, withoutAccountContacts } from "./utils";
import { hasValidSessionMutationOrigin } from "@/lib/auth/origin";

export async function GET(request: Request) {
	const access = await requireTeamAdmin(request);
	if (access.error) return access.error;
	const actor = access.user!;
	const includeContacts = canManageUsers(actor);
	const db = getDb(access.env);
	const rows = await listAccountsForAdmin(db, actor);

	let seatLimit: number | null = null;
	let seatsUsed = rows.filter((r) => !r.disabled).length;

	if (actor.role !== "superadmin" && actor.businessId) {
		const [biz] = await db.select({ maxUsers: businesses.maxUsers }).from(businesses).where(eq(businesses.id, actor.businessId)).limit(1);
		if (biz) seatLimit = biz.maxUsers;
	}

	return NextResponse.json({
		accounts: rows.map((row) => (includeContacts ? accountListItemFromUser(row) : withoutAccountContacts(accountListItemFromUser(row)))),
		seats: { limit: seatLimit, used: seatsUsed },
	});
}

export async function POST(request: Request) {
	const access = await requireTeamAdmin(request);
	if (access.error) return access.error;
	if (!hasValidSessionMutationOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
	const parsed = createUserAccountSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
	}
	const actor = access.user!;
	if (!canManageUsers(actor)) {
		return NextResponse.json({ error: "You do not have permission to manage users" }, { status: 403 });
	}
	if (parsed.data.role === "admin" && !isPrimaryAdmin(actor)) {
		return NextResponse.json({ error: "Only the primary admin can create admin accounts" }, { status: 403 });
	}
	return createAccountResponse(access.env, actor, parsed.data);
}

export async function DELETE(request: Request) {
	const access = await requireTeamAdmin(request);
	if (access.error) return access.error;
	if (!hasValidSessionMutationOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
	const body = (await request.json().catch(() => null)) as { ids?: unknown; transferToId?: unknown } | null;
	const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string" && !!id) : [];
	const transferToId = typeof body?.transferToId === "string" ? body.transferToId : null;
	const result = await deleteAccounts(access.env, access.user!, { ids, transferToId });
	if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
	return NextResponse.json({ ok: true, deleted: result.deleted });
}
