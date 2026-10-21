import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  labelForState,
  isDeliveredState,
  isInTransitState,
  latestEvent,
  latestDeliveredEvent,
  deliveredAt,
  pafexConfigured,
  PafexNotConfiguredError,
  type PafexTracking,
  type PafexEvent,
} from '@/lib/pafex';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('PAFEX Wrapper', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('labelForState', () => {
    it('maps known states to labels', () => {
      expect(labelForState('in_transit')).toBe('In Transit');
      expect(labelForState('delivered')).toBe('Delivered');
      expect(labelForState('picked_up')).toBe('Picked Up');
      expect(labelForState('out_for_delivery')).toBe('Out for Delivery');
      expect(labelForState('rto')).toBe('RTO');
      expect(labelForState('lost')).toBe('Lost');
      expect(labelForState('damaged')).toBe('Damaged');
    });

    it('humanizes unknown states', () => {
      expect(labelForState('custom_state')).toBe('Custom State');
      expect(labelForState('some-weird-format')).toBe('Some Weird Format');
    });

    it('handles null/undefined/empty', () => {
      expect(labelForState(null)).toBe('');
      expect(labelForState(undefined)).toBe('');
      expect(labelForState('')).toBe('');
    });

    it('is case-insensitive', () => {
      expect(labelForState('IN_TRANSIT')).toBe('In Transit');
      expect(labelForState('Delivered')).toBe('Delivered');
    });
  });

  describe('isDeliveredState', () => {
    it('returns true for delivered', () => {
      expect(isDeliveredState('delivered')).toBe(true);
      expect(isDeliveredState('Delivered')).toBe(true);
      expect(isDeliveredState('DELIVERED')).toBe(true);
    });

    it('returns false for other states', () => {
      expect(isDeliveredState('in_transit')).toBe(false);
      expect(isDeliveredState('picked_up')).toBe(false);
      expect(isDeliveredState(null)).toBe(false);
      expect(isDeliveredState(undefined)).toBe(false);
    });
  });

  describe('isInTransitState', () => {
    it('returns true for in_transit', () => {
      expect(isInTransitState('in_transit')).toBe(true);
      expect(isInTransitState('intransit')).toBe(true);
      expect(isInTransitState('IN_TRANSIT')).toBe(true);
    });

    it('returns false for other states', () => {
      expect(isInTransitState('delivered')).toBe(false);
      expect(isInTransitState('picked_up')).toBe(false);
      expect(isInTransitState(null)).toBe(false);
    });
  });

  describe('latestEvent', () => {
    const tracking: PafexTracking = {
      docket_events: [
        { id: '1', event_at: '2026-01-01 10:00:00', event_state: 'booked', event_description: 'Booked', docket_id: null, event_type: null, event_location: null, event_remark: null },
        { id: '2', event_at: '2026-01-02 10:00:00', event_state: 'in_transit', event_description: 'In Transit', docket_id: null, event_type: null, event_location: null, event_remark: null },
        { id: '3', event_at: '2026-01-03 10:00:00', event_state: 'delivered', event_description: 'Delivered', docket_id: null, event_type: null, event_location: null, event_remark: null },
      ],
      tracking_no: 'TEST123',
      reference_no: null,
      forwarding_no: null,
      chargeable_weight: null,
      expected_datetime: null,
      pod_image: null,
      pod_signature: null,
      docket_info: null,
    };

    it('returns latest event by time', () => {
      const result = latestEvent(tracking);
      expect(result?.event_state).toBe('delivered');
    });

    it('returns null for empty events', () => {
      expect(latestEvent({ ...tracking, docket_events: [] })).toBeNull();
    });

    it('falls back to first element for unparseable dates', () => {
      const badTracking = { ...tracking, docket_events: [
        { id: '1', event_at: null, event_state: 'booked', event_description: null, docket_id: null, event_type: null, event_location: null, event_remark: null },
        { id: '2', event_at: 'invalid', event_state: 'in_transit', event_description: null, docket_id: null, event_type: null, event_location: null, event_remark: null },
      ] };
      expect(latestEvent(badTracking)?.id).toBe('1');
    });
  });

  describe('latestDeliveredEvent', () => {
    const tracking: PafexTracking = {
      docket_events: [
        { id: '1', event_at: '2026-01-01 10:00:00', event_state: 'booked', event_description: null, docket_id: null, event_type: null, event_location: null, event_remark: null },
        { id: '2', event_at: '2026-01-03 10:00:00', event_state: 'delivered', event_description: null, docket_id: null, event_type: null, event_location: null, event_remark: null },
        { id: '3', event_at: '2026-01-04 10:00:00', event_state: 'in_transit', event_description: null, docket_id: null, event_type: null, event_location: null, event_remark: null },
      ],
      tracking_no: 'TEST123',
      reference_no: null,
      forwarding_no: null,
      chargeable_weight: null,
      expected_datetime: null,
      pod_image: null,
      pod_signature: null,
      docket_info: null,
    };

    it('returns delivered event if exists (not the newest in_transit)', () => {
      const result = latestDeliveredEvent(tracking);
      expect(result?.event_state).toBe('delivered');
      expect(result?.id).toBe('2');
    });

    it('returns null if no delivered event', () => {
      const noDelivered = { ...tracking, docket_events: [
        { id: '1', event_at: '2026-01-01 10:00:00', event_state: 'booked', event_description: null, docket_id: null, event_type: null, event_location: null, event_remark: null },
      ] };
      expect(latestDeliveredEvent(noDelivered)).toBeNull();
    });
  });

  describe('deliveredAt', () => {
    it('extracts delivery date from docket_info', () => {
      const tracking: PafexTracking = {
        docket_info: [['Delivery Date and Time', '2026-01-15 14:30:00']],
        docket_events: [
          { id: '1', event_at: '2026-01-15 14:30:00', event_state: 'delivered', event_description: null, docket_id: null, event_type: null, event_location: null, event_remark: null },
        ],
        tracking_no: 'TEST123',
        reference_no: null,
        forwarding_no: null,
        chargeable_weight: null,
        expected_datetime: null,
        pod_image: null,
        pod_signature: null,
      };
      const result = deliveredAt(tracking);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2026);
      expect(result?.getMonth()).toBe(0); // January = 0
      expect(result?.getDate()).toBe(15);
    });

    it('falls back to delivered event time', () => {
      const tracking: PafexTracking = {
        docket_info: null,
        docket_events: [
          { id: '1', event_at: '2026-01-20 10:00:00', event_state: 'delivered', event_description: null, docket_id: null, event_type: null, event_location: null, event_remark: null },
        ],
        tracking_no: 'TEST123',
        reference_no: null,
        forwarding_no: null,
        chargeable_weight: null,
        expected_datetime: null,
        pod_image: null,
        pod_signature: null,
      };
      const result = deliveredAt(tracking);
      expect(result?.getDate()).toBe(20);
    });

    it('returns null if no delivery info', () => {
      const tracking: PafexTracking = {
        docket_info: null,
        docket_events: null,
        tracking_no: 'TEST123',
        reference_no: null,
        forwarding_no: null,
        chargeable_weight: null,
        expected_datetime: null,
        pod_image: null,
        pod_signature: null,
      };
      expect(deliveredAt(tracking)).toBeNull();
    });
  });

  describe('pafexConfigured', () => {
    it('returns true when env vars are set', () => {
      process.env.PAFEX_API_COMPANY_ID = '123';
      process.env.PAFEX_CUSTOMER_CODE = '456';
      expect(pafexConfigured()).toBe(true);
    });

    it('returns false when env vars are missing', () => {
      const origCompany = process.env.PAFEX_API_COMPANY_ID;
      const origCustomer = process.env.PAFEX_CUSTOMER_CODE;
      delete process.env.PAFEX_API_COMPANY_ID;
      delete process.env.PAFEX_CUSTOMER_CODE;
      expect(pafexConfigured()).toBe(false);
      if (origCompany) process.env.PAFEX_API_COMPANY_ID = origCompany;
      if (origCustomer) process.env.PAFEX_CUSTOMER_CODE = origCustomer;
    });
  });
});
