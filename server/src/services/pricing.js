const AppError = require('../utils/AppError');

// All arithmetic is done in paise (integers) so totals never pick up floating-point drift.
const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const toRupees = (paise) => paise / 100;
const percentOf = (paise, percent) => Math.round((paise * percent) / 100);

const sameId = (a, b) => String(a) === String(b);

// Resolves one requested line against the restaurant's menu item. Throws AppError on anything
// the customer cannot order: unavailable items, unknown variants or add-ons.
function priceLine(menuItem, line) {
  if (!menuItem.available) {
    throw AppError.badRequest(`${menuItem.name} is sold out`, 'ITEM_UNAVAILABLE');
  }

  let unitPaise = toPaise(menuItem.price);
  let variant;
  const variants = menuItem.variants || [];
  if (variants.length > 0) {
    if (!line.variantId) throw AppError.badRequest(`Choose a size for ${menuItem.name}`, 'VARIANT_REQUIRED');
    const chosen = variants.find((v) => sameId(v._id, line.variantId));
    if (!chosen) throw AppError.badRequest(`That option is no longer available for ${menuItem.name}`, 'UNKNOWN_VARIANT');
    variant = { name: chosen.name, price: chosen.price };
    unitPaise = toPaise(chosen.price);
  } else if (line.variantId) {
    throw AppError.badRequest(`${menuItem.name} has no size options`, 'UNKNOWN_VARIANT');
  }

  const addOnIds = line.addOnIds || [];
  if (new Set(addOnIds.map(String)).size !== addOnIds.length) {
    throw AppError.badRequest('Each add-on can only be chosen once', 'DUPLICATE_ADD_ON');
  }
  const addOns = addOnIds.map((id) => {
    const addOn = (menuItem.addOns || []).find((a) => sameId(a._id, id));
    if (!addOn) throw AppError.badRequest(`That add-on is no longer available for ${menuItem.name}`, 'UNKNOWN_ADD_ON');
    unitPaise += toPaise(addOn.price);
    return { name: addOn.name, price: addOn.price };
  });

  const linePaise = unitPaise * line.quantity;
  return {
    linePaise,
    item: {
      menuItem: menuItem._id,
      menuItemName: menuItem.name,
      variant,
      addOns,
      price: toRupees(unitPaise),
      quantity: line.quantity,
      notes: line.notes || '',
      lineTotal: toRupees(linePaise)
    }
  };
}

/**
 * Prices an order from database values only; anything price-like sent by the client is ignored.
 * @param {object} restaurant  needs taxPercent and serviceChargePercent
 * @param {Map<string, object>} menuItemsById  the restaurant's menu items keyed by id
 * @param {Array<{menuItem, quantity, variantId?, addOnIds?, notes?}>} lines
 */
function priceOrder(restaurant, menuItemsById, lines) {
  let subtotalPaise = 0;
  const items = lines.map((line) => {
    const menuItem = menuItemsById.get(String(line.menuItem));
    if (!menuItem) {
      throw AppError.badRequest('One of the items is no longer on this menu', 'ITEM_NOT_FOUND');
    }
    const priced = priceLine(menuItem, line);
    subtotalPaise += priced.linePaise;
    return priced.item;
  });

  const taxPercent = restaurant.taxPercent || 0;
  const serviceChargePercent = restaurant.serviceChargePercent || 0;
  // Service charge is part of the taxable value, so GST is applied after it.
  const serviceChargePaise = percentOf(subtotalPaise, serviceChargePercent);
  const taxPaise = percentOf(subtotalPaise + serviceChargePaise, taxPercent);

  return {
    items,
    subtotal: toRupees(subtotalPaise),
    serviceChargePercent,
    serviceChargeAmount: toRupees(serviceChargePaise),
    taxPercent,
    taxAmount: toRupees(taxPaise),
    totalAmount: toRupees(subtotalPaise + serviceChargePaise + taxPaise)
  };
}

module.exports = { priceOrder, toPaise };
