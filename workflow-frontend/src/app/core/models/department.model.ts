import { Status } from './status.model';

export interface Department {
  id: string;
  name: string;
  description?: string;
  status: Status;
  createdAt?: string;
  updatedAt?: string;
}

