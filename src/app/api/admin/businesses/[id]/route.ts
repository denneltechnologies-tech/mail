import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { assertSuperAdmin } from "@/lib/auth/admin";
import { deleteBusiness, updateBusiness } from "@/lib/businesses/service";
import { readJsonBody } from "@/lib/http/request";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		assertSuperAdmin(user);
	} catch {
		return NextResponse.json({ error: "Super administrator access required" }, { status: 403 });
	}

	let body: any;
	try {
		body = await readJsonBody(request, 16 * 1024);
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	try {
		await updateBusiness(env, id, {
			name: body.name,
			slug: body.slug,
			maxUsers: typeof body.maxUsers === "number" ? body.maxUsers : undefined,
			features: Array.isArray(body.features) ? body.features : undefined,
		});
		return NextResponse.json({ ok: true });
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Failed to update business";
		return NextResponse.json({ error: msg }, { status: 400 });
	}
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		assertSuperAdmin(user);
	} catch {
		return NextResponse.json({ error: "Super administrator access required" }, { status: 403 });
	}

	try {
		await deleteBusiness(env, id);
		return NextResponse.json({ ok: true });
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Failed to delete business";
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}
