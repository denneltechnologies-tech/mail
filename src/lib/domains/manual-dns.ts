import type { DomainDnsView } from "@/lib/domains/service";

const DKIM_PUBLIC_KEY = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAovNd5PMKLLMJgrpHzjwHiNbTZ55Bu7Fpi/h4bHXXpSWzm0MJa2eS3R5UOZlXV4CLr73nWheUGCgXxl1TrrAUHXyGS7K0co6OZndfNYocEio91oxA6ej2mfkiwzrqcmxs7zfv3TVTwJpEtEhKewUlPoATE8o2G/fxvEETplq1fXCnZFx4MJ6w8aayMbzAbHIwaBKtlvcBPydbxvRWxNE+C+pfgxfzsRjUHBzpFBOBdZh0YKO0DB/vDGpz3r8PrrKUo+AJ8QfTvuJgMEEiSa4SnL/swY3a7KzxlfKx10y4zhPd35eamVfVyP2qVFRiM3KM16EdNUD3WnRegzLplyZ+pQIDAQAB";

/**
 * The DNS a self-hosted install needs when Mailflare is not managing the
 * zone. Rendered as "missing" until the operator confirms, since the app
 * cannot read their DNS; the records are what the SMTP listener and an
 * SMTP relay expect.
 */
export async function getManualDomainDns(env: CloudflareEnv, hostname: string): Promise<DomainDnsView> {
	const mailHost = process.env.MAIL_HOSTNAME?.trim() || `mail-69-62-106-189.sslip.io`;
	const records = [
		{ type: "MX", name: hostname, content: `10 ${mailHost}`, ttl: 3600 },
		{ type: "TXT", name: hostname, content: `v=spf1 ip4:69.62.106.189 ip6:2a02:4780:28:1676::1 ~all`, ttl: 3600 },
		{ type: "TXT", name: `mail._domainkey.${hostname}`, content: `v=DKIM1; k=rsa; p=${DKIM_PUBLIC_KEY}`, ttl: 3600 },
		{ type: "TXT", name: `_dmarc.${hostname}`, content: "v=DMARC1; p=none", ttl: 3600 },
	];
	return {
		routing: { records: [], missing: records, status: "manual" },
		sending: [],
		sendingEnabled: true,
	};
}
