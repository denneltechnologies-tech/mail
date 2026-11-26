"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Building2, Check, Globe2, Pencil, Plus, Trash2, Users, Shield, Sparkles, Folder, CalendarDays, Palette, Mail } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth/client";
import { useCurrentUser } from "@/hooks/use-current-user";

type BusinessItem = {
	id: string;
	name: string;
	slug: string;
	maxUsers: number;
	features: string[];
	userCount: number;
	domains: Array<{ id: string; hostname: string; status: string }>;
	adminUsers: Array<{ id: string; email: string; name: string }>;
	createdAt: string;
	updatedAt: string;
};

const ALL_FEATURES = [
	{ id: "branding", name: "Custom Branding", description: "White-label logos, site name, and colors", icon: Palette },
	{ id: "shared_mailboxes", name: "Shared Mailboxes", description: "Team inboxes (e.g. support@, sales@)", icon: Mail },
	{ id: "forwarding", name: "Email Forwarding", description: "Automatic forwarding rules and routing", icon: Globe2 },
	{ id: "drive", name: "Cloud Drive", description: "File storage, document uploads & shares", icon: Folder },
	{ id: "calendar", name: "Calendar & Booking", description: "Event scheduling and booking links", icon: CalendarDays },
	{ id: "ai_assistant", name: "AI Mail Assistant", description: "Smart drafting, summarization & triage", icon: Sparkles },
];

export default function BusinessesPage() {
	const user = useCurrentUser();
	const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Create dialog state
	const [createOpen, setCreateOpen] = useState(false);
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [maxUsers, setMaxUsers] = useState(10);
	const [domainName, setDomainName] = useState("");
	const [adminName, setAdminName] = useState("");
	const [adminEmail, setAdminEmail] = useState("");
	const [adminPassword, setAdminPassword] = useState("");
	const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
		"branding",
		"shared_mailboxes",
		"forwarding",
		"drive",
		"calendar",
		"ai_assistant",
	]);

	// Edit dialog state
	const [editOpen, setEditOpen] = useState(false);
	const [editingBiz, setEditingBiz] = useState<BusinessItem | null>(null);
	const [editName, setEditName] = useState("");
	const [editSlug, setEditSlug] = useState("");
	const [editMaxUsers, setEditMaxUsers] = useState(10);
	const [editFeatures, setEditFeatures] = useState<string[]>([]);
	const [updating, setUpdating] = useState(false);

	// Delete state
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deletingBiz, setDeletingBiz] = useState<BusinessItem | null>(null);
	const [deleting, setDeleting] = useState(false);

	async function loadBusinesses() {
		try {
			setLoading(true);
			setError(null);
			const res = await authFetch("/api/admin/businesses");
			const data = (await res.json()) as { businesses?: BusinessItem[]; error?: string };
			if (!res.ok) throw new Error(data.error ?? "Failed to load businesses");
			setBusinesses(data.businesses ?? []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load businesses");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		loadBusinesses();
	}, []);

	// Auto-compute slug from name
	function handleNameChange(val: string) {
		setName(val);
		if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) {
			setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
		}
	}

	function toggleFeature(featureId: string, isEdit = false) {
		if (isEdit) {
			setEditFeatures((prev) =>
				prev.includes(featureId) ? prev.filter((f) => f !== featureId) : [...prev, featureId],
			);
		} else {
			setSelectedFeatures((prev) =>
				prev.includes(featureId) ? prev.filter((f) => f !== featureId) : [...prev, featureId],
			);
		}
	}

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) return;

		if (domainName.trim() && !domainName.trim().includes(".")) {
			setError(`"${domainName.trim()}" is not a valid domain name. Please include the domain extension (e.g. ${domainName.trim()}.com).`);
			return;
		}

		if (adminEmail.trim() && (!adminEmail.trim().includes("@") || !adminEmail.trim().includes("."))) {
			setError("Please enter a valid administrator email address.");
			return;
		}

		if (adminPassword && adminPassword.length < 8) {
			setError("Admin password must be at least 8 characters long.");
			return;
		}

		setCreating(true);
		setError(null);

		try {
			const res = await authFetch("/api/admin/businesses", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: name.trim(),
					slug: slug.trim() || undefined,
					maxUsers: Number(maxUsers) || 10,
					features: selectedFeatures,
					domainName: domainName.trim() || undefined,
					adminName: adminName.trim() || undefined,
					adminEmail: adminEmail.trim() || undefined,
					adminPassword: adminPassword || undefined,
				}),
			});

			const data = (await res.json()) as { business?: BusinessItem; error?: string };
			if (!res.ok) throw new Error(data.error ?? "Failed to create business");

			setCreateOpen(false);
			setName("");
			setSlug("");
			setMaxUsers(10);
			setDomainName("");
			setAdminName("");
			setAdminEmail("");
			setAdminPassword("");
			await loadBusinesses();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Creation failed");
		} finally {
			setCreating(false);
		}
	}

	function startEdit(biz: BusinessItem) {
		setError(null);
		setEditingBiz(biz);
		setEditName(biz.name);
		setEditSlug(biz.slug);
		setEditMaxUsers(biz.maxUsers);
		setEditFeatures(biz.features);
		setEditOpen(true);
	}

	async function handleUpdate(e: React.FormEvent) {
		e.preventDefault();
		if (!editingBiz) return;

		setUpdating(true);
		setError(null);

		try {
			const res = await authFetch(`/api/admin/businesses/${editingBiz.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: editName.trim(),
					slug: editSlug.trim(),
					maxUsers: Number(editMaxUsers) || 10,
					features: editFeatures,
				}),
			});

			const data = (await res.json()) as { ok?: boolean; error?: string };
			if (!res.ok) throw new Error(data.error ?? "Failed to update business");

			setEditOpen(false);
			await loadBusinesses();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Update failed");
		} finally {
			setUpdating(false);
		}
	}

	async function handleDelete() {
		if (!deletingBiz) return;

		setDeleting(true);
		setError(null);

		try {
			const res = await authFetch(`/api/admin/businesses/${deletingBiz.id}`, {
				method: "DELETE",
			});

			const data = (await res.json()) as { ok?: boolean; error?: string };
			if (!res.ok) throw new Error(data.error ?? "Failed to delete business");

			setDeleteOpen(false);
			setDeletingBiz(null);
			await loadBusinesses();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Deletion failed");
		} finally {
			setDeleting(false);
		}
	}

	// Calculate overall metrics
	const totalSeats = businesses.reduce((acc, b) => acc + b.maxUsers, 0);
	const totalUsers = businesses.reduce((acc, b) => acc + b.userCount, 0);
	const totalDomains = businesses.reduce((acc, b) => acc + b.domains.length, 0);

	return (
		<div className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto">
			{/* Top Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
							<Shield className="w-3.5 h-3.5" />
							Platform Super Admin
						</span>
					</div>
					<h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
						Businesses & Multi-Tenancy
					</h1>
					<p className="mt-1 text-sm text-neutral-500">
						Manage organizations, provision custom domains, assign feature entitlements, and set user seat limits.
					</p>
				</div>
				<Button
					onClick={() => {
						setError(null);
						setCreateOpen(true);
					}}
					className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm rounded-xl px-4 py-2 font-medium"
				>
					<Plus className="w-4 h-4" />
					Create Business
				</Button>
			</div>

			{error && (
				<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
					{error}
				</div>
			)}

			{/* Metric Cards */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card className="rounded-2xl border border-neutral-200/80 shadow-sm bg-white">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-neutral-500">Businesses</CardTitle>
						<Building2 className="w-5 h-5 text-neutral-400" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-neutral-900">{businesses.length}</div>
						<p className="text-xs text-neutral-500 mt-1">Active client organizations</p>
					</CardContent>
				</Card>

				<Card className="rounded-2xl border border-neutral-200/80 shadow-sm bg-white">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-neutral-500">Active Users</CardTitle>
						<Users className="w-5 h-5 text-neutral-400" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-neutral-900">{totalUsers}</div>
						<p className="text-xs text-neutral-500 mt-1">Users across all tenants</p>
					</CardContent>
				</Card>

				<Card className="rounded-2xl border border-neutral-200/80 shadow-sm bg-white">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-neutral-500">Seat Capacity</CardTitle>
						<Shield className="w-5 h-5 text-neutral-400" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-neutral-900">{totalSeats}</div>
						<p className="text-xs text-neutral-500 mt-1">Allocated user seats</p>
					</CardContent>
				</Card>

				<Card className="rounded-2xl border border-neutral-200/80 shadow-sm bg-white">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-neutral-500">Domains</CardTitle>
						<Globe2 className="w-5 h-5 text-neutral-400" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-neutral-900">{totalDomains}</div>
						<p className="text-xs text-neutral-500 mt-1">Assigned business domains</p>
					</CardContent>
				</Card>
			</div>

			{/* Businesses Table Card */}
			<Card className="rounded-3xl border border-neutral-200/80 shadow-sm bg-white overflow-hidden">
				<CardHeader className="border-b border-neutral-100 bg-neutral-50/50 p-6">
					<CardTitle className="text-lg font-semibold text-neutral-900">Registered Businesses</CardTitle>
					<CardDescription className="text-sm text-neutral-500">
						List of all client workspaces with their quotas, custom domains, and feature entitlements.
					</CardDescription>
				</CardHeader>
				<CardContent className="p-0">
					{loading ? (
						<div className="p-12 text-center text-sm text-neutral-500">Loading businesses...</div>
					) : businesses.length === 0 ? (
						<div className="p-12 text-center">
							<Building2 className="mx-auto h-12 w-12 text-neutral-300" />
							<h3 className="mt-3 text-base font-semibold text-neutral-900">No businesses yet</h3>
							<p className="mt-1 text-sm text-neutral-500">Get started by creating your first client business organization.</p>
							<Button
								onClick={() => setCreateOpen(true)}
								className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
							>
								<Plus className="w-4 h-4 mr-2" />
								Create Business
							</Button>
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-left text-sm">
								<thead className="bg-neutral-50/75 text-xs uppercase font-medium text-neutral-500 border-b border-neutral-100">
									<tr>
										<th className="px-6 py-4">Business & Slug</th>
										<th className="px-6 py-4">Assigned Domains</th>
										<th className="px-6 py-4">Seat Usage</th>
										<th className="px-6 py-4">Admin Account</th>
										<th className="px-6 py-4">Unlocked Features</th>
										<th className="px-6 py-4 text-right">Actions</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-neutral-100">
									{businesses.map((biz) => {
										const usagePercent = Math.min(100, Math.round((biz.userCount / (biz.maxUsers || 1)) * 100));
										const isAtLimit = biz.userCount >= biz.maxUsers;

										return (
											<tr key={biz.id} className="hover:bg-neutral-50/60 transition-colors">
												<td className="px-6 py-4">
													<div className="font-semibold text-neutral-900">{biz.name}</div>
													<div className="text-xs text-neutral-500 font-mono">slug: {biz.slug}</div>
												</td>
												<td className="px-6 py-4">
													{biz.domains.length === 0 ? (
														<span className="text-xs text-neutral-400 italic">No domain</span>
													) : (
														<div className="flex flex-wrap gap-1.5">
															{biz.domains.map((dom) => (
																<span
																	key={dom.id}
																	className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60"
																>
																	<Globe2 className="w-3 h-3" />
																	{dom.hostname}
																</span>
															))}
														</div>
													)}
												</td>
												<td className="px-6 py-4">
													<div className="flex items-center gap-2">
														<span className={`font-semibold ${isAtLimit ? "text-amber-600" : "text-neutral-900"}`}>
															{biz.userCount} / {biz.maxUsers}
														</span>
														<span className="text-xs text-neutral-400">seats</span>
													</div>
													<div className="w-28 bg-neutral-100 rounded-full h-1.5 mt-1 overflow-hidden">
														<div
															className={`h-full rounded-full ${
																isAtLimit ? "bg-amber-500" : "bg-blue-600"
															}`}
															style={{ width: `${usagePercent}%` }}
														/>
													</div>
												</td>
												<td className="px-6 py-4">
													{biz.adminUsers.length === 0 ? (
														<span className="text-xs text-neutral-400 italic">No admin assigned</span>
													) : (
														<div>
															<div className="font-medium text-neutral-900">{biz.adminUsers[0].name}</div>
															<div className="text-xs text-neutral-500">{biz.adminUsers[0].email}</div>
														</div>
													)}
												</td>
												<td className="px-6 py-4">
													<div className="flex flex-wrap gap-1 max-w-xs">
														{biz.features.map((f) => (
															<span
																key={f}
																className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 text-neutral-700"
															>
																{f.replace("_", " ")}
															</span>
														))}
													</div>
												</td>
												<td className="px-6 py-4 text-right">
													<div className="flex items-center justify-end gap-2">
														<Button
															variant="ghost"
															size="sm"
															onClick={() => startEdit(biz)}
															className="h-8 px-2.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg"
														>
															<Pencil className="w-3.5 h-3.5 mr-1" />
															Edit
														</Button>
														<Button
															variant="ghost"
															size="sm"
															onClick={() => {
																setDeletingBiz(biz);
																setDeleteOpen(true);
															}}
															className="h-8 px-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
														>
															<Trash2 className="w-3.5 h-3.5" />
														</Button>
													</div>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Create Business Modal */}
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-neutral-900">Create New Business</DialogTitle>
						<DialogDescription className="text-sm text-neutral-500">
							Set up a multi-tenant workspace with an isolated domain, seat limit, and administrator.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleCreate} className="space-y-6 mt-4">
						{error && (
							<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-2.5">
								<AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
								<div>{error}</div>
							</div>
						)}
						{/* Basic Info */}
						<div className="space-y-4">
							<h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 border-b pb-1">
								1. Business Profile & Quota
							</h4>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<Label htmlFor="biz-name">Business Name *</Label>
									<Input
										id="biz-name"
										placeholder="e.g. Acme Corporation"
										value={name}
										onChange={(e) => handleNameChange(e.target.value)}
										required
										className="rounded-xl"
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="biz-slug">Slug Identifier *</Label>
									<Input
										id="biz-slug"
										placeholder="e.g. acme"
										value={slug}
										onChange={(e) => setSlug(e.target.value)}
										required
										className="rounded-xl font-mono text-sm"
									/>
								</div>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="biz-seats">Max User Seats (Quota) *</Label>
								<Input
									id="biz-seats"
									type="number"
									min="1"
									max="10000"
									value={maxUsers}
									onChange={(e) => setMaxUsers(Number(e.target.value))}
									required
									className="rounded-xl max-w-xs"
								/>
								<p className="text-xs text-neutral-400">
									Maximum number of active email accounts allowed for this business.
								</p>
							</div>
						</div>

						{/* Domain */}
						<div className="space-y-4">
							<h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 border-b pb-1">
								2. Business Domain
							</h4>
							<div className="space-y-1.5">
								<Label htmlFor="biz-domain">Domain Name</Label>
								<Input
									id="biz-domain"
									placeholder="e.g. acme.com or mail.acme.com"
									value={domainName}
									onChange={(e) => setDomainName(e.target.value)}
									className="rounded-xl font-mono text-sm"
								/>
								<p className="text-xs text-neutral-400">
									This domain will be assigned directly to this business for mailboxes and routing.
								</p>
							</div>
						</div>

						{/* Initial Business Admin */}
						<div className="space-y-4">
							<h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 border-b pb-1">
								3. Initial Business Administrator
							</h4>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<Label htmlFor="admin-name">Admin Name</Label>
									<Input
										id="admin-name"
										placeholder="e.g. Alice Smith"
										value={adminName}
										onChange={(e) => setAdminName(e.target.value)}
										className="rounded-xl"
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="admin-email">Admin Email</Label>
									<Input
										id="admin-email"
										type="email"
										placeholder="e.g. admin@acme.com"
										value={adminEmail}
										onChange={(e) => setAdminEmail(e.target.value)}
										className="rounded-xl"
									/>
								</div>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="admin-pwd">Initial Password</Label>
								<Input
									id="admin-pwd"
									type="password"
									placeholder="Min 8 characters"
									value={adminPassword}
									onChange={(e) => setAdminPassword(e.target.value)}
									className="rounded-xl"
								/>
							</div>
						</div>

						{/* Feature Entitlements */}
						<div className="space-y-3">
							<h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 border-b pb-1">
								4. Provisioned Feature Entitlements
							</h4>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
								{ALL_FEATURES.map((feat) => {
									const isChecked = selectedFeatures.includes(feat.id);
									const Icon = feat.icon;
									return (
										<div
											key={feat.id}
											onClick={() => toggleFeature(feat.id, false)}
											className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
												isChecked
													? "border-blue-500 bg-blue-50/40 text-neutral-900"
													: "border-neutral-200 bg-neutral-50/40 text-neutral-500 hover:border-neutral-300"
											}`}
										>
											<div
												className={`w-5 h-5 mt-0.5 rounded-md flex items-center justify-center border transition-colors ${
													isChecked ? "bg-blue-600 border-blue-600 text-white" : "border-neutral-300 bg-white"
												}`}
											>
												{isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
											</div>
											<div>
												<div className="text-xs font-semibold flex items-center gap-1.5">
													<Icon className="w-3.5 h-3.5 text-blue-600" />
													{feat.name}
												</div>
												<div className="text-[11px] text-neutral-500 mt-0.5">{feat.description}</div>
											</div>
										</div>
									);
								})}
							</div>
						</div>

						<div className="flex items-center justify-end pt-4 border-t gap-2 sm:gap-0">
							<Button
								type="button"
								variant="outline"
								onClick={() => setCreateOpen(false)}
								className="rounded-xl mr-2"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={creating || !name.trim()}
								className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
							>
								{creating ? "Creating Business..." : "Create Business & Admin"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{/* Edit Business Modal */}
			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<DialogContent className="max-w-xl rounded-3xl p-6">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-neutral-900">Edit Business Quota & Features</DialogTitle>
						<DialogDescription className="text-sm text-neutral-500">
							Update organization seat limits and feature provisioning.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleUpdate} className="space-y-4 mt-4">
						{error && (
							<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-2.5">
								<AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
								<div>{error}</div>
							</div>
						)}
						<div className="space-y-1.5">
							<Label htmlFor="edit-name">Business Name</Label>
							<Input
								id="edit-name"
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								required
								className="rounded-xl"
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="edit-slug">Slug Identifier</Label>
							<Input
								id="edit-slug"
								value={editSlug}
								onChange={(e) => setEditSlug(e.target.value)}
								required
								className="rounded-xl font-mono text-sm"
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="edit-seats">Max User Seats (Quota)</Label>
							<Input
								id="edit-seats"
								type="number"
								min="1"
								value={editMaxUsers}
								onChange={(e) => setEditMaxUsers(Number(e.target.value))}
								required
								className="rounded-xl"
							/>
						</div>

						<div className="space-y-2 pt-2">
							<Label>Provisioned Features</Label>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
								{ALL_FEATURES.map((feat) => {
									const isChecked = editFeatures.includes(feat.id);
									return (
										<div
											key={feat.id}
											onClick={() => toggleFeature(feat.id, true)}
											className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs font-medium transition-all ${
												isChecked
													? "border-blue-500 bg-blue-50/50 text-blue-900"
													: "border-neutral-200 bg-neutral-50/50 text-neutral-600 hover:border-neutral-300"
											}`}
										>
											<div
												className={`w-4 h-4 rounded flex items-center justify-center border ${
													isChecked ? "bg-blue-600 border-blue-600 text-white" : "border-neutral-300 bg-white"
												}`}
											>
												{isChecked && <Check className="w-3 h-3 stroke-[3]" />}
											</div>
											<span>{feat.name}</span>
										</div>
									);
								})}
							</div>
						</div>

						<div className="flex items-center justify-end pt-4 border-t gap-2 sm:gap-0">
							<Button
								type="button"
								variant="outline"
								onClick={() => setEditOpen(false)}
								className="rounded-xl mr-2"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={updating || !editName.trim()}
								className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
							>
								{updating ? "Saving Changes..." : "Save Changes"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Modal */}
			<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<DialogContent className="max-w-md rounded-3xl p-6">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-red-600">Delete Business</DialogTitle>
						<DialogDescription className="text-sm text-neutral-500 mt-2">
							Are you sure you want to delete <span className="font-semibold text-neutral-900">{deletingBiz?.name}</span>?
							Users and domains associated with this business will be unlinked.
						</DialogDescription>
					</DialogHeader>

					<div className="flex items-center justify-end pt-4 gap-2 sm:gap-0">
						<Button
							type="button"
							variant="outline"
							onClick={() => setDeleteOpen(false)}
							className="rounded-xl mr-2"
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={handleDelete}
							disabled={deleting}
							className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
						>
							{deleting ? "Deleting..." : "Confirm Delete"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
