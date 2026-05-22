import { Status } from './status.model';

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: string[];
  status: Status;
  createdAt?: string;
  updatedAt?: string;
}

