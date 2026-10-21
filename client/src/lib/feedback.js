// Quick tags a guest can add to a rating (the server accepts exactly these keys).
export const FEEDBACK_TAG_LABEL = {
  tasty: 'Tasty food',
  quick: 'Quick service',
  friendly: 'Friendly staff',
  value: 'Good value',
  slow: 'Slow service',
  cold: 'Food was cold',
  wrong: 'Order was wrong'
};

// Happy guests see the praise tags; others see what went wrong (and can still say the food was tasty).
export const tagsForRating = (rating) => (rating >= 4 ? ['tasty', 'quick', 'friendly', 'value'] : ['slow', 'cold', 'wrong', 'tasty']);

export const RATING_LABEL = { 1: 'Poor', 2: 'Not great', 3: 'Okay', 4: 'Good', 5: 'Excellent' };

export const canRate = (order) => ['served', 'billed', 'complete'].includes(order?.status);
