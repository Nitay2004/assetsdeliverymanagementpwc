export type ModuleId =
  | "inventory"
  | "assigned-assets"
  | "warehouse"
  | "provisioning"
  | "finance"
  | "logistics"
  | "reverse-pickup"
  | "warranty"
  | "product-master"
  | "vendor-master"
  | "admin";

export interface ModulePermission {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export type Permissions = Record<ModuleId, ModulePermission>;

export function getDefaultPermissions(role?: string): Permissions {
  const defaults: Permissions = {
    inventory:         { canView: false, canCreate: false, canEdit: false, canDelete: false },
    "assigned-assets": { canView: false, canCreate: false, canEdit: false, canDelete: false },
    warehouse:         { canView: false, canCreate: false, canEdit: false, canDelete: false },
    provisioning:      { canView: false, canCreate: false, canEdit: false, canDelete: false },
    finance:           { canView: false, canCreate: false, canEdit: false, canDelete: false },
    logistics:         { canView: false, canCreate: false, canEdit: false, canDelete: false },
    "reverse-pickup":  { canView: false, canCreate: false, canEdit: false, canDelete: false },
    warranty:          { canView: false, canCreate: false, canEdit: false, canDelete: false },
    "product-master":  { canView: false, canCreate: false, canEdit: false, canDelete: false },
    "vendor-master":   { canView: false, canCreate: false, canEdit: false, canDelete: false },
    admin:             { canView: false, canCreate: false, canEdit: false, canDelete: false },
  };

  if (role === "ADMIN") {
    for (const key of Object.keys(defaults) as ModuleId[]) {
      defaults[key] = { canView: true, canCreate: true, canEdit: true, canDelete: true };
    }
  }

  if (role === "WAREHOUSE") {
    defaults.warehouse = { canView: true, canCreate: true, canEdit: true, canDelete: false };
    defaults.inventory = { canView: true, canCreate: false, canEdit: true, canDelete: false };
  }

  if (role === "PROVISIONING") {
    defaults.provisioning = { canView: true, canCreate: false, canEdit: true, canDelete: false };
  }

  if (role === "FINANCE") {
    defaults.finance = { canView: true, canCreate: false, canEdit: true, canDelete: false };
  }

  if (role === "LOGISTICS") {
    defaults.logistics = { canView: true, canCreate: false, canEdit: true, canDelete: false };
    defaults["assigned-assets"] = { canView: true, canCreate: false, canEdit: false, canDelete: false };
  }

  if (role === "REVERSE_PICKUP") {
    defaults["reverse-pickup"] = { canView: true, canCreate: true, canEdit: true, canDelete: false };
  }

  if (role === "WARRANTY") {
    defaults.warranty = { canView: true, canCreate: false, canEdit: true, canDelete: false };
  }

  if (role === "PWC") {
    const viewOnlyModules: ModuleId[] = [
      "inventory",
      "assigned-assets",
      "warehouse",
      "provisioning",
      "finance",
      "logistics",
      "reverse-pickup",
      "warranty",
      "product-master",
      "vendor-master",
    ];
    for (const key of viewOnlyModules) {
      defaults[key] = { canView: true, canCreate: false, canEdit: false, canDelete: false };
    }
  }

  return defaults;
}

export const moduleLabels: Record<ModuleId, string> = {
  inventory: "Inventory",
  "assigned-assets": "Assigned Assets",
  warehouse: "Warehouse",
  provisioning: "Provisioning",
  finance: "Finance",
  logistics: "Logistics",
  "reverse-pickup": "Reverse Pickup",
  warranty: "Warranty",
  "product-master": "Product Master",
  "vendor-master": "Vendor Master",
  admin: "Admin",
};

const routePrefixToModule: [string, ModuleId][] = [
  ["/dashboard/admin", "admin"],
  ["/dashboard/vendor-master", "vendor-master"],
  ["/dashboard/product-master", "product-master"],
  ["/dashboard/assigned-assets", "assigned-assets"],
  ["/dashboard/reverse-pickup", "reverse-pickup"],
  ["/dashboard/provisioning", "provisioning"],
  ["/dashboard/inventory", "inventory"],
  ["/dashboard/warehouse", "warehouse"],
  ["/dashboard/finance", "finance"],
  ["/dashboard/logistics", "logistics"],
  ["/dashboard/warranty", "warranty"],
  ["/dashboard", "inventory"],
];

export function resolveModuleFromPath(pathname: string): ModuleId | null {
  for (const [prefix, moduleId] of routePrefixToModule) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return moduleId;
    }
  }
  return null;
}

export function canModuleAction(
  permissions: unknown | null,
  role: string | null,
  moduleId: ModuleId,
  action: keyof ModulePermission
): boolean {
  const perms = (permissions as Permissions) || getDefaultPermissions(role || undefined);
  return perms[moduleId]?.[action] ?? false;
}

export function canViewModule(permissions: unknown | null, role: string | null, moduleId: ModuleId): boolean {
  return canModuleAction(permissions, role, moduleId, "canView");
}

export function requirePermission(
  user: { permissions: unknown; role: string } | null,
  moduleId: ModuleId,
  action: keyof ModulePermission
): void {
  if (!user) throw new Error("Unauthorized");
  if (!canModuleAction(user.permissions, user.role, moduleId, action)) {
    throw new Error("Permission denied");
  }
}
