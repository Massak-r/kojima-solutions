export interface Client {
  id: string;
  name: string;
  organization?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  /** Per-client hourly rate (CHF). Falls back to company default when null/undefined. */
  hourlyRate?: number | null;
  createdAt: string;
}
