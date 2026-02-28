import type { Enums } from '@/integrations/supabase/types';

export type GarageServiceType = Enums<'garage_service_type'>;
export type GarageServiceStatus = Enums<'garage_service_status'>;
export type GarageCadenceType = Enums<'garage_cadence_type'>;

export interface GarageUserSettings {
  id: string;
  user_id: string;
  upcoming_miles_default: number;
  upcoming_days_default: number;
  created_at: string;
  updated_at: string;
}

export interface GarageVehicle {
  id: string;
  user_id: string;
  name: string;
  make: string | null;
  model: string | null;
  model_year: number | null;
  in_service_date: string | null;
  current_odometer_miles: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GarageService {
  id: string;
  user_id: string;
  vehicle_id: string;
  name: string;
  type: GarageServiceType;
  monitoring: boolean;
  cadence_type: GarageCadenceType;
  every_miles: number | null;
  every_months: number | null;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GarageServicing {
  id: string;
  user_id: string;
  vehicle_id: string;
  service_date: string;
  odometer_miles: number;
  shop_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GarageServicingService {
  id: string;
  user_id: string;
  vehicle_id: string;
  servicing_id: string;
  service_id: string;
  status: GarageServiceStatus;
  created_at: string;
}

export interface GarageServicingReceipt {
  id: string;
  user_id: string;
  vehicle_id: string;
  servicing_id: string;
  storage_object_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface GarageServicingWithRelations extends GarageServicing {
  outcomes: GarageServicingService[];
  receipts: GarageServicingReceipt[];
}

export type GarageDueBucket = 'past_due' | 'due_now' | 'upcoming' | 'not_due' | 'excluded_no_interval';

export interface GarageDueItem {
  service: GarageService;
  bucket: GarageDueBucket;
  lastPerformedDate: string | null;
  lastPerformedMileage: number | null;
  remainingMiles: number | null;
  remainingMonths: number | null;
  dueMileage: number | null;
  dueDate: string | null;
  daysUntilDue: number | null;
}
