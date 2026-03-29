export function isStaffReaderRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "auditor";
}

export function canMutateAdmin(role: string | null | undefined): boolean {
  return role === "admin";
}

export function homePathForRole(role: string | null | undefined): string {
  if (role === "admin" || role === "auditor") return "/admin/dashboard";
  if (role === "presenter") return "/dashboard";
  return "/login";
}

export function roleDisplayLabel(role: string | null | undefined): string {
  if (role === "auditor") return "Auditor";
  if (role === "admin") return "Admin";
  if (role === "presenter") return "Presenter";
  return "—";
}
