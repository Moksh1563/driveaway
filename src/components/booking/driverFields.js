// Booking form constants shared by BookingPage and DriverStep

// Invalid fields get a danger border as well as the message underneath
export const FIELD_CLASS = 'field aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger';

// In on-screen order, so validation focuses the first problem a reader would meet
export const REQUIRED_DRIVER_FIELDS = ['customerName', 'customerPhone', 'licenseNumber'];
export const OPTIONAL_DRIVER_FIELDS = ['customerEmail', 'dateOfBirth', 'idProofType', 'idProofNumber', 'address', 'emergencyContact', 'emergencyPhone', 'specialRequirements'];
