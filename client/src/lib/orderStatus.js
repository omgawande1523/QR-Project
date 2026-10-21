// One place for order status names, labels and the customer timeline.
export const BOARD_COLUMNS = [
  { status: 'pending', label: 'New', next: 'process', action: 'Accept' },
  { status: 'process', label: 'Preparing', next: 'ready', action: 'Mark ready' },
  { status: 'ready', label: 'Ready', next: 'served', action: 'Mark served' },
  { status: 'served', label: 'Served', next: 'billed', action: 'Bill' },
  { status: 'billed', label: 'Billed', next: 'complete', action: 'Mark paid' }
];

export const STATUS_LABEL = {
  pending: 'New',
  process: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  billed: 'Billed',
  complete: 'Paid',
  cancelled: 'Cancelled'
};

export const STATUS_TONE = {
  pending: 'warning',
  process: 'info',
  ready: 'accent',
  served: 'success',
  billed: 'success',
  complete: 'success',
  cancelled: 'danger'
};

// Customer timeline: Received -> Preparing -> Ready -> Served (billed/paid count as served).
export const CUSTOMER_STEPS = [
  { key: 'pending', label: 'Received', hint: 'The kitchen has your order' },
  { key: 'process', label: 'Preparing', hint: 'Your food is being cooked' },
  { key: 'ready', label: 'Ready', hint: 'Coming to your table' },
  { key: 'served', label: 'Served', hint: 'Enjoy your meal!' }
];

const STEP_INDEX = { pending: 0, process: 1, ready: 2, served: 3, billed: 3, complete: 3 };

export const customerStepIndex = (status) => STEP_INDEX[status] ?? 0;
export const isActiveOrder = (status) => !['complete', 'cancelled'].includes(status);
