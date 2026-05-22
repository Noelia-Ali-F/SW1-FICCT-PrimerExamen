import { Status } from './status.model';

export interface User {
  id: string;
  fullName: string;
  email: string;
  roleId: string;
  departmentId: string;
  status: Status;
  createdAt?: string;
  updatedAt?: string;
}

