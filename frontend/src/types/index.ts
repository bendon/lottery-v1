export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: "admin" | "presenter";
  user_type?: string;
  organization?: string;
  is_active: boolean;
  created_at: string;
}

export interface Lottery {
  id: string;
  name: string;
  description?: string;
  lottery_type: string;
  is_demo?: boolean;
  till_number?: string;
  paybill_number?: string;
  payment_types: string[];
  payout_amount?: number;
  payout_percentage?: number;
  settings?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface Promotion {
  id: string;
  user_id: string;
  lottery_id: string;
  name?: string;
  account_number?: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  transaction_number: string;
  payment_type: string;
  amount: number;
  customer_name?: string;
  customer_phone?: string;
  payment_date: string;
  product_type?: string;
  product_id?: string;
  till_number?: string;
}

export interface Draw {
  id: string;
  promotion_id: string;
  presenter_id?: string;
  transaction_id: string;
  winning_number: string;
  draw_type: string;
  drawn_at: string;
  notes?: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value?: string;
  value_type: string;
  description?: string;
  category?: string;
}

export interface AuthState {
  token: string | null;
  role: "admin" | "presenter" | null;
  user: Partial<User> | null;
}
