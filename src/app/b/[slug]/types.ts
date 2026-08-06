export type CatalogService = { id: string; name: string; durationMinutes: number; priceCents: number };
export type CatalogStaff = { id: string; name: string; photoUrl: string | null; serviceIds: string[] };
export type Catalog = {
  shop: { name: string; timeZone: string; maxAdvanceDays: number };
  services: CatalogService[];
  staff: CatalogStaff[];
};

export type AvailabilitySlot = { startAt: string; staffId: string; staffName: string };

export type Escolha = {
  serviceId?: string;
  serviceName?: string;
  staffId?: string;
  staffName?: string;
  startAt?: string;
};

export type Resultado = { appointmentId: string; manageUrl: string; startAt: string; staffName: string };
