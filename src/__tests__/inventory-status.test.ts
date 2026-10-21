import { describe, it, expect } from 'vitest';
import {
  INVENTORY_STATUS_LABELS,
  INVENTORY_STATUS_STYLES,
  DEPLOYED_STATUSES,
  isDeployedStatus,
  deployedStatus,
} from '@/lib/inventory-status';

type InventoryStatusValue = keyof typeof INVENTORY_STATUS_LABELS;

describe('Inventory Status', () => {
  describe('INVENTORY_STATUS_LABELS', () => {
    it('has labels for all status values', () => {
      expect(INVENTORY_STATUS_LABELS.PROVISION_PENDING).toBe('Provision Pending – Asset in Warehouse');
      expect(INVENTORY_STATUS_LABELS.SHIPPED_TO_USER).toBe('Shipped to User');
      expect(INVENTORY_STATUS_LABELS.ASSET_REDEPLOYED).toBe('Asset Redeployed');
      expect(INVENTORY_STATUS_LABELS.ASSET_RETURN_TO_WAREHOUSE).toBe('Asset Return to Warehouse');
      expect(INVENTORY_STATUS_LABELS.QC_PENDING).toBe('QC Pending');
      expect(INVENTORY_STATUS_LABELS.DEFECTIVE).toBe('Defective');
      expect(INVENTORY_STATUS_LABELS.RETIRED).toBe('Retired');
    });
  });

  describe('INVENTORY_STATUS_STYLES', () => {
    it('has tailwind classes for each status', () => {
      for (const status of Object.keys(INVENTORY_STATUS_LABELS) as InventoryStatusValue[]) {
        expect(INVENTORY_STATUS_STYLES[status]).toBeDefined();
        expect(typeof INVENTORY_STATUS_STYLES[status]).toBe('string');
        expect(INVENTORY_STATUS_STYLES[status].length).toBeGreaterThan(0);
      }
    });
  });

  describe('DEPLOYED_STATUSES', () => {
    it('contains the two deployed statuses', () => {
      expect(DEPLOYED_STATUSES).toContain('SHIPPED_TO_USER');
      expect(DEPLOYED_STATUSES).toContain('ASSET_REDEPLOYED');
      expect(DEPLOYED_STATUSES).toHaveLength(2);
    });
  });

  describe('isDeployedStatus', () => {
    it('returns true for deployed statuses', () => {
      expect(isDeployedStatus('SHIPPED_TO_USER')).toBe(true);
      expect(isDeployedStatus('ASSET_REDEPLOYED')).toBe(true);
    });

    it('returns false for non-deployed statuses', () => {
      expect(isDeployedStatus('PROVISION_PENDING')).toBe(false);
      expect(isDeployedStatus('ASSET_RETURN_TO_WAREHOUSE')).toBe(false);
      expect(isDeployedStatus('QC_PENDING')).toBe(false);
      expect(isDeployedStatus('DEFECTIVE')).toBe(false);
      expect(isDeployedStatus('RETIRED')).toBe(false);
    });
  });

  describe('deployedStatus', () => {
    it('returns SHIPPED_TO_USER for PROVISION_PENDING (first deployment)', () => {
      expect(deployedStatus('PROVISION_PENDING')).toBe('SHIPPED_TO_USER');
    });

    it('returns ASSET_REDEPLOYED for other statuses (redeployment)', () => {
      expect(deployedStatus('ASSET_RETURN_TO_WAREHOUSE')).toBe('ASSET_REDEPLOYED');
      expect(deployedStatus('SHIPPED_TO_USER')).toBe('ASSET_REDEPLOYED');
      expect(deployedStatus('ASSET_REDEPLOYED')).toBe('ASSET_REDEPLOYED');
    });

    it('returns ASSET_REDEPLOYED for QC_PENDING, DEFECTIVE, RETIRED', () => {
      expect(deployedStatus('QC_PENDING')).toBe('ASSET_REDEPLOYED');
      expect(deployedStatus('DEFECTIVE')).toBe('ASSET_REDEPLOYED');
      expect(deployedStatus('RETIRED')).toBe('ASSET_REDEPLOYED');
    });
  });
});
