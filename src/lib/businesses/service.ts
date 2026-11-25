import { and, count, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { businesses, domains, mailboxes, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { newId } from "@/lib/ids";
import { normalizeHostname } from "@/lib/domains/utils";

export type BusinessItem = {
	id: string;
	name: string;
	slug: string;
	maxUsers: number;
	features: string[];
	userCount: number;
	domains: Array<{ id: string; hostname: string; status: string }>;
	adminUsers: Array<{ id: string; email: string; name: string }>;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateBusinessInput = {
	name: string;
	slug?: string;
	maxUsers?: number;
	features?: string[];
	domainName?: string;
	adminEmail?: string;
	adminName?: string;
	adminPassword?: string;
};

export type UpdateBusinessInput = {
	name?: string;
	slug?: string;
	maxUsers?: number;
	features?: string[];
};

export function parseBusinessFeatures(featuresJson: string | null | undefined): string[] {
	if (!featuresJson) return ["branding", "shared_mailboxes", "forwarding", "drive", "calendar", "ai_assistant"];
	try {
		const parsed = JSON.parse(featuresJson);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return ["branding", "shared_mailboxes", "forwarding", "drive", "calendar", "ai_assistant"];
	}
}

export async function listBusinesses(env: CloudflareEnv): Promise<BusinessItem[]> {
	const db = getDb(env);
	const allBusinesses = await db.select().from(businesses).orderBy(desc(businesses.createdAt));
	if (allBusinesses.length === 0) return [];

	const bizIds = allBusinesses.map((b) => b.id);

	const [allUsers, allDomains] = await Promise.all([
		db
			.select({
				id: users.id,
				businessId: users.businessId,
				email: users.email,
				name: users.name,
				role: users.role,
				disabled: users.disabled,
			})
			.from(users)
			.where(inArray(users.businessId, bizIds)),
		db
			.select({
				id: domains.id,
				businessId: domains.businessId,
				hostname: domains.hostname,
				status: domains.status,
			})
			.from(domains)
			.where(inArray(domains.businessId, bizIds)),
	]);

	const usersByBiz = new Map<string, typeof allUsers>();
	for (const u of allUsers) {
		if (!u.businessId) continue;
		const list = usersByBiz.get(u.businessId) ?? [];
		list.push(u);
		usersByBiz.set(u.businessId, list);
	}

	const domainsByBiz = new Map<string, typeof allDomains>();
	for (const d of allDomains) {
		if (!d.businessId) continue;
		const list = domainsByBiz.get(d.businessId) ?? [];
		list.push(d);
		domainsByBiz.set(d.businessId, list);
	}

	return allBusinesses.map((biz) => {
		const bUsers = usersByBiz.get(biz.id) ?? [];
		const bDomains = domainsByBiz.get(biz.id) ?? [];
		const admins = bUsers.filter((u) => u.role === "admin" || u.role === "superadmin");

		return {
			id: biz.id,
			name: biz.name,
			slug: biz.slug,
			maxUsers: biz.maxUsers,
			features: parseBusinessFeatures(biz.features),
			userCount: bUsers.length,
			domains: bDomains.map((d) => ({ id: d.id, hostname: d.hostname, status: d.status })),
			adminUsers: admins.map((a) => ({ id: a.id, email: a.email, name: a.name })),
			createdAt: biz.createdAt,
			updatedAt: biz.updatedAt,
		};
	});
}

export async function createBusiness(env: CloudflareEnv, input: CreateBusinessInput, actorId: string): Promise<BusinessItem> {
	const db = getDb(env);
	const bizId = newId("biz");
	const slug = (input.slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || bizId).trim();
	const maxUsers = typeof input.maxUsers === "number" && input.maxUsers > 0 ? input.maxUsers : 10;
	const features = input.features ?? ["branding", "shared_mailboxes", "forwarding", "drive", "calendar", "ai_assistant"];
	const now = new Date();

	// Check slug uniqueness
	const [existingSlug] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, slug)).limit(1);
	if (existingSlug) {
		throw new Error(`A business with identifier "${slug}" already exists`);
	}

	await db.insert(businesses).values({
		id: bizId,
		name: input.name.trim(),
		slug,
		maxUsers,
		features: JSON.stringify(features),
		createdAt: now,
		updatedAt: now,
	});

	let domainId: string | null = null;
	let domainHostname: string | null = null;

	// If domain provided, create or associate domain
	if (input.domainName) {
		domainHostname = normalizeHostname(input.domainName);
		domainId = newId("dom");
		await db.insert(domains).values({
			id: domainId,
			businessId: bizId,
			userId: actorId,
			hostname: domainHostname,
			zoneId: "manual",
			status: "active",
			routingEnabled: true,
			sendingEnabled: true,
			dnsSkipped: true,
			createdAt: now,
		}).onConflictDoNothing();
	}

	let createdAdmin: { id: string; email: string; name: string } | null = null;

	// If admin credentials provided, create the initial business admin account
	if (input.adminEmail && input.adminPassword) {
		const adminEmail = input.adminEmail.toLowerCase().trim();
		const adminName = input.adminName?.trim() || adminEmail.split("@")[0];
		const adminUserId = newId("usr");

		await db.insert(users).values({
			id: adminUserId,
			businessId: bizId,
			email: adminEmail,
			name: adminName,
			passwordHash: hashPassword(input.adminPassword),
			role: "admin",
			isPrimaryAdmin: false,
			canManageUsers: true,
			canManageDomains: true,
			canManageMailboxes: true,
			calendarEnabled: features.includes("calendar"),
			driveEnabled: features.includes("drive"),
			remoteContentMode: "ask",
			createdByUserId: actorId,
			createdAt: now,
		});

		createdAdmin = { id: adminUserId, email: adminEmail, name: adminName };

		// If a domain was created or exists, set up a mailbox for the admin
		if (domainId && domainHostname) {
			const localPart = adminEmail.includes("@") ? adminEmail.split("@")[0] : adminName.toLowerCase().replace(/\s+/g, "");
			const mailboxId = newId("mbx");
			await db.insert(mailboxes).values({
				id: mailboxId,
				businessId: bizId,
				userId: adminUserId,
				domainId,
				localPart,
				displayName: adminName,
				useAllDomains: true,
				createdAt: now,
			}).onConflictDoNothing();
		}
	}

	return {
		id: bizId,
		name: input.name.trim(),
		slug,
		maxUsers,
		features,
		userCount: createdAdmin ? 1 : 0,
		domains: domainId && domainHostname ? [{ id: domainId, hostname: domainHostname, status: "active" }] : [],
		adminUsers: createdAdmin ? [createdAdmin] : [],
		createdAt: now,
		updatedAt: now,
	};
}

export async function updateBusiness(env: CloudflareEnv, id: string, input: UpdateBusinessInput): Promise<void> {
	const db = getDb(env);
	const updateData: Record<string, unknown> = {
		updatedAt: new Date(),
	};

	if (typeof input.name === "string" && input.name.trim()) {
		updateData.name = input.name.trim();
	}
	if (typeof input.slug === "string" && input.slug.trim()) {
		updateData.slug = input.slug.trim().toLowerCase();
	}
	if (typeof input.maxUsers === "number" && input.maxUsers > 0) {
		updateData.maxUsers = input.maxUsers;
	}
	if (Array.isArray(input.features)) {
		updateData.features = JSON.stringify(input.features);
	}

	await db.update(businesses).set(updateData).where(eq(businesses.id, id));
}

export async function deleteBusiness(env: CloudflareEnv, id: string): Promise<void> {
	const db = getDb(env);
	// Nullify or delete references
	await db.update(users).set({ businessId: null }).where(eq(users.businessId, id));
	await db.update(domains).set({ businessId: null }).where(eq(domains.businessId, id));
	await db.update(mailboxes).set({ businessId: null }).where(eq(mailboxes.businessId, id));
	await db.delete(businesses).where(eq(businesses.id, id));
}
