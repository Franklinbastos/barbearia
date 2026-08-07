export { getAvailability, type AvailabilitySlot } from './availability-service';
export { createAppointment, type CreateAppointmentInput } from './create-appointment';
export { createWalkInAppointment, type CreateWalkInInput } from './create-walk-in';
export { cancelAppointment, type CancelOrigin } from './cancel-appointment';
export { bookingWindowLimit, assertWithinBookingWindow } from './booking-window';
export {
  SlotTakenError,
  SlotUnavailableError,
  OutsideBookingWindowError,
  CancelNotAllowedError,
  NotFoundError,
} from './errors';
