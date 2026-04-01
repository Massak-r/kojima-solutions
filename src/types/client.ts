export interface Client {
  id: string;
  name: string;
  organization?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}
