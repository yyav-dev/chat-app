export interface Room {
  id: string;
  name: string;
  description?: string | null;
  type: 'channel' | 'group' | 'direct';
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  unreadCount?: number;
}
