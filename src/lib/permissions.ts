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

export const routeToModule: Record<string, ModuleId> = {
  "/dashboard": "inventory",
  "/dashboard/inventory": "inventory",
  "/dashboard/assigned-assets": "assigned-assets",
  "/dashboard/warehouse": "warehouse",
  "/dashboard/provisioning": "provisioning",
  "/dashboard/finance": "finance",
  "/dashboard/logistics": "logistics",
  "/dashboard/reverse-pickup": "reverse-pickup",
  "/dashboard/warranty": "warranty",
  "/dashboard/product-master": "product-master",
  "/dashboard/vendor-master": "vendor-master",
  "/dashboard/admin": "admin",
  "/dashboard/admin/users": "admin",
};

export function canViewModule(permissions: unknown | null, role: string | null, moduleId: ModuleId): boolean {
  const perms = (permissions as Permissions) || getDefaultPermissions(role || undefined);
  return perms[moduleId]?.canView ?? false;
}
