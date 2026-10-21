import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// Environment variables needed for tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.DIRECT_URL = 'postgresql://test:test@localhost:5432/test';
process.env.PAFEX_API_COMPANY_ID = 'test-company';
process.env.PAFEX_CUSTOMER_CODE = 'test-customer';
process.env.PAFEX_SYNC_API_KEY = 'test-sync-key';
process.env.POD_API_KEY = 'test-pod-key';
process.env.TWO_FACTOR_ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long!!';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
