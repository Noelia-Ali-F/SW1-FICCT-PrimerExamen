export type PolicyStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export interface BusinessPolicy {
  id: string;
  name: string;
  description: string;
  version: number;
  status: PolicyStatus;
  responsibleUserId: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}
