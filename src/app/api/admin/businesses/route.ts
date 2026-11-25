import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { assertSuperAdmin } from "@/lib/auth/admin";
import { createBusiness, listBusinesses } from "@/lib/businesses/service";
import { readJsonBody } from "@/lib/http/request";

export async function GET(request: Request) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		assertSuperAdmin(user);
	} catch {
		return NextResponse.json({ error: "Super administrator access required" }, { status: 403 });
	}

	try {
		const items = await listBusinesses(env);
		return NextResponse.json({ businesses: items });
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Failed to load businesses";
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}

export async function POST(request: Request) {
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

	if (!body?.name || typeof body.name !== "string" || !body.name.trim()) {
		return NextResponse.json({ error: "Business name is required" }, { status: 400 });
	}

	try {
		const result = await createBusiness(
			env,
			{
				name: body.name,
				slug: body.slug,
				maxUsers: typeof body.maxUsers === "number" ? body.maxUsers : 10,
				features: Array.isArray(body.features) ? body.features : undefined,
				domainName: body.domainName,
				adminEmail: body.adminEmail,
				adminName: body.adminName,
				adminPassword: body.adminPassword,
			},
			user.id,
		);
		return NextResponse.json({ business: result }, { status: 201 });
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Failed to create business";
		return NextResponse.json({ error: msg }, { status: 400 });
	}
}
