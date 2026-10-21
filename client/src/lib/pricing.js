// Mirrors server/src/services/pricing.js so the cart shows exactly what the server will charge.
// The server always recomputes; these numbers are for display only. Everything is in paise.
export const toPaise = (rupees) => Math.round(Number(rupees) * 100);
export const toRupees = (paise) => paise / 100;
const percentOf = (paise, percent) => Math.round((paise * percent) / 100);

// Unit price in paise for a menu item with the chosen variant and add-ons, or null if the choice is
// not valid any more (variant missing, add-on removed).
export function unitPricePaise(item, variantId, addOnIds = []) {
  if (!item) return null;
  let paise = toPaise(item.price);
  const variants = item.variants || [];
  if (variants.length > 0) {
    const variant = variants.find((v) => v._id === variantId);
    if (!variant) return null;
    paise = toPaise(variant.price);
  } else if (variantId) {
    return null;
  }
  for (const id of addOnIds) {
    const addOn = (item.addOns || []).find((a) => a._id === id);
    if (!addOn) return null;
    paise += toPaise(addOn.price);
  }
  return paise;
}

// Bill for cart lines [{ unitPaise, quantity }] using the restaurant's settings.
export function computeBill(lines, { taxPercent = 0, serviceChargePercent = 0 } = {}) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPaise * line.quantity, 0);
  const serviceCharge = percentOf(subtotal, serviceChargePercent);
  const tax = percentOf(subtotal + serviceCharge, taxPercent);
  return {
    subtotal: toRupees(subtotal),
    serviceCharge: toRupees(serviceCharge),
    tax: toRupees(tax),
    total: toRupees(subtotal + serviceCharge + tax),
    taxPercent,
    serviceChargePercent
  };
}
