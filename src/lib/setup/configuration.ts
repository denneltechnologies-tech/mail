import { getDatabaseConfig } from "@/db/with-database";
import { hasCloudflareCredentials, isNodeRuntime } from "@/lib/runtime";
import type { SetupRequirementCheck } from "./types";

export function getSetupRequirementChecks(env: CloudflareEnv): SetupRequirementCheck[] {
	const hasApiToken = !!env.CF_TOKEN?.trim();
	const hasGlobalKey = !!env.CF_API_KEY?.trim() && !!env.CF_EMAIL?.trim();

	const database = getDatabaseConfig(env);
	if (isNodeRuntime(env)) {
		const mailer = env.EMAIL as unknown as { configured?: boolean };
		const mailerConfigured = mailer?.configured === true;
		const hasCf = hasCloudflareCredentials(env);
		return [
			{
				key: "Database",
				configured: !!env.DB,
				message: database.driver === "d1" ? "DATA_DIR is writable; the SQLite database is ready." : "DATABASE_URL is connected; migrations are applied on start.",
			},
			{
				key: mailerConfigured ? "Outbound mail" : "Outbound mail (optional)",
				configured: true,
				message: mailerConfigured
					? "Outbound mail relay is configured."
					: "Self-hosted VPS mode: outbound mail can use standard SMTP relay (SMTP_URL) or be configured later in Admin Settings. Inbound mail is received directly on this server.",
			},
			hasCf
				? {
					key: "Cloudflare API credentials (optional)",
					configured: true,
					message: "Domains are provisioned on Cloudflare automatically.",
				}
				: {
					key: "DNS & Domain Management",
					configured: true,
					message: "Self-hosted VPS mode: DNS records (MX, SPF, DKIM) are managed directly at your domain registrar or DNS provider.",
				},
		];
	}

	return [
		{
			key: "Cloudflare API credentials",
			configured: hasApiToken || hasGlobalKey,
			message: "Set CF_TOKEN, or set both CF_API_KEY and CF_EMAIL.",
		},
		{
			key: database.driver === "d1" ? "D1 database" : "Database",
			configured: !!env.DB,
			message: database.driver === "d1" ? "Deploy the Worker with the DB binding from wrangler.jsonc." : "Check DATABASE_URL (and DATABASE_DRIVER) for the external database.",
		},
	];
}
