import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { dnsAuthDescriptions, getDnsAuthItemClass } from "./utils";
import { ROW_GRID, StatusBadge, StatusRow } from "./status-row";
import CloudflareReceivingConfig from "./CloudflareReceivingConfig";
import ReceivingSetupSection from "./ReceivingSetupSection";
import SendingSetupSection from "./SendingSetupSection";
import TrackingHostSection from "./TrackingHostSection";
import type { DnsAuthRecord, DomainDnsDetailsProps } from "./types";

export default function DomainDnsDetails({
	domain,
	dns,
	onSetup,
	setupRecord,
	setupMessage,
	onSendingProviderChange,
	sendingProviderBusy,
	sendingProviderMessage,
	onReceivingProviderChange,
	receivingProviderBusy,
	receivingProviderMessage,
	onDnsChanged,
}: DomainDnsDetailsProps) {
	const { t } = useLanguage();
	const audit = dns.audit;
	const manual = domain.zoneId === "manual" && !domain.dnsSkipped;
	const subdomain = dns.sendingSubdomain;
	const sendingOk = subdomain ? dns.sendingEnabled : manual && domain.sendingEnabled;
	const sendingLabel = subdomain
		? t("domains.sendingFor", { name: subdomain.name, state: dns.sendingEnabled ? t("domains.enabled") : t("domains.disabled") })
		: manual
			? domain.sendingEnabled
				? t("domains.sendingConfigured")
				: t("domains.sendingNotConfigured")
			: t("domains.sendingNotSet");
	const routingOk = manual
		? audit?.mx.status === "ok"
		: dns.routing.missing.length === 0 && (dns.routing.records.length > 0 || domain.routingEnabled);
	const routingLabel = manual
		? audit?.mx.status === "ok"
			? "Inbound routing active (VPS Port 25)"
			: "MX record required to receive mail"
		: routingOk
			? t("domains.routingConfigured")
			: dns.routing.missing.length > 0
				? t("domains.recordsMissing", { count: dns.routing.missing.length })
				: t("domains.noRoutingRecords");

	const auditRow = (record: DnsAuthRecord) => {
		if (!audit) return null;
		const item = audit[record];
		const ok = item.status === "ok";
		return (
			<li key={record} className={`${ROW_GRID} ${getDnsAuthItemClass(item.status)}`}>
				<StatusBadge ok={ok} tone={item.status === "missing" ? "red" : "neutral"} />
				<span className="min-w-0">
					<span className="block font-medium text-neutral-900">{t("domains.recordLabel", { label: item.label })}</span>
					<span className="block text-xs text-neutral-500">{t(dnsAuthDescriptions[record])}</span>
				</span>
				{ok ? (
					<span className="min-w-0 break-all text-neutral-500">{item.found.length > 0 ? item.found.join(", ") : item.name}</span>
				) : manual ? (
					<Button
						variant="outline"
						size="sm"
						className="shrink-0 bg-white text-xs"
						onClick={() => onDnsChanged?.()}
					>
						Verify
					</Button>
				) : (
					<Button
						variant="outline"
						size="sm"
						className="shrink-0 bg-white"
						disabled={setupRecord === record}
						title={t("domains.createRecord", { label: item.label })}
						onClick={() => onSetup?.(record)}
					>
						{setupRecord === record ? t("domains.settingUp") : t("domains.setup")}
					</Button>
				)}
			</li>
		);
	};

	const cloudflareConfig = (
		<ul className="space-y-2">
			<StatusRow ok={!!sendingOk} title={t("domains.emailSending")} hint={t("domains.emailSendingHint")}>{sendingLabel}</StatusRow>
			{auditRow("dkim")}
		</ul>
	);

	const cloudflareReceiving = (
		<CloudflareReceivingConfig domainId={domain.id} routingOk={routingOk} routingLabel={routingLabel} manual={manual} onChanged={onDnsChanged} />
	);

	return (
		<div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
			{audit && (
				<section>
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-base font-semibold text-neutral-900">{t("domains.setupTitle")}</h2>
							<p className="mt-0.5 text-sm text-neutral-500">
								{t("domains.setupDescription")}
							</p>
						</div>
						{manual && (
							<Button size="sm" variant="outline" className="bg-white text-xs shrink-0" onClick={() => onDnsChanged?.()}>
								Re-check DNS
							</Button>
						)}
					</div>
					{manual && (
						<div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm">
							<div className="mb-2">
								<h3 className="font-semibold text-blue-950">Required DNS Records for {domain.hostname}</h3>
								<p className="text-xs text-neutral-600 mt-0.5">
									Add the following records at your DNS manager (e.g. Cloudflare DNS / Domain Registrar):
								</p>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-left text-xs">
									<thead>
										<tr className="border-b border-blue-200/80 text-neutral-600">
											<th className="py-1.5 font-semibold">Type</th>
											<th className="py-1.5 font-semibold">Host / Name</th>
											<th className="py-1.5 font-semibold">Value / Target</th>
											<th className="py-1.5 font-semibold">Priority</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-blue-200/50 font-mono text-xs">
										<tr>
											<td className="py-1.5 font-sans font-semibold text-neutral-800">MX</td>
											<td className="py-1.5">@</td>
											<td className="py-1.5 font-semibold text-blue-900 select-all">mail-69-62-106-189.sslip.io</td>
											<td className="py-1.5 font-sans">10</td>
										</tr>
										<tr>
											<td className="py-1.5 font-sans font-semibold text-neutral-800">TXT (SPF)</td>
											<td className="py-1.5">@</td>
											<td className="py-1.5 select-all text-neutral-800">v=spf1 ip4:69.62.106.189 ~all</td>
											<td className="py-1.5 font-sans">-</td>
										</tr>
										<tr>
											<td className="py-1.5 font-sans font-semibold text-neutral-800">TXT (DMARC)</td>
											<td className="py-1.5">_dmarc</td>
											<td className="py-1.5 select-all text-neutral-800">v=DMARC1; p=none</td>
											<td className="py-1.5 font-sans">-</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>
					)}
					<ul className="mt-3 space-y-2">
						{(["mx", "spf", "dmarc"] as DnsAuthRecord[]).map(auditRow)}
					</ul>
					{manual && (
						<p className="text-xs text-neutral-500">
							{t("domains.manualDnsNote")}
						</p>
					)}
					{setupMessage && <p role="alert" className="text-xs text-red-600">{setupMessage}</p>}
				</section>
			)}
			<ReceivingSetupSection
				domain={domain}
				onChange={onReceivingProviderChange}
				busy={receivingProviderBusy}
				message={receivingProviderMessage}
				cloudflareConfig={cloudflareReceiving}
				cloudflareOk={routingOk}
			/>
			<SendingSetupSection
				domain={domain}
				onChange={onSendingProviderChange}
				busy={sendingProviderBusy}
				message={sendingProviderMessage}
				cloudflareConfig={cloudflareConfig}
				cloudflareOk={!!sendingOk && audit?.dkim.status === "ok"}
			/>
			{domain.sendingProvider !== "none" && <TrackingHostSection domain={domain} />}
		</div>
	);
}
