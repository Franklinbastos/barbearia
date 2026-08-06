export { getAvailability, type AvailabilitySlot } from './availability-service';
export { createAppointment, type CreateAppointmentInput } from './create-appointment';
export { cancelAppointment } from './cancel-appointment';
export { SlotTakenError, SlotUnavailableError, NotFoundError } from './errors';
