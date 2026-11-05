/**
 * The entity recorded against an inventory item is effectively signed off: it
 * drives the PWC paperwork for that asset, so letting anyone rewrite it later
 * would silently change history. Once a value is saved it is frozen, and only an
 * ADMIN may change or clear it.
 *
 * The rule is enforced in the server actions (the authoritative check); the UI
 * only mirrors it so nobody fills in a field that is never going to be saved.
 */
export function isEntityLocked(entity: string | null | undefined): boolean {
  return typeof entity === "string" && entity.trim().length > 0;
}

/** Whether `role` may write the entity field of an item that currently holds `currentEntity`. */
export function canEditEntity(
  role: string | null | undefined,
  currentEntity: string | null | undefined
): boolean {
  return role === "ADMIN" || !isEntityLocked(currentEntity);
}
