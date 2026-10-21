import { toPaise, toRupees } from './pricing';
import { saveFile } from './platform';

// Restaurant service (SAC 996331, "services provided by restaurants") for the GST invoice.
export const RESTAURANT_SAC = '996331';

// GST state codes: the first two digits of a GSTIN give the place of supply for dine-in.
const GST_STATES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
  '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh'
};

export function placeOfSupply(gstin) {
  const code = String(gstin || '').slice(0, 2);
  return GST_STATES[code] ? `${code} - ${GST_STATES[code]}` : '';
}

// "Tax Invoice" needs a GSTIN; without one the restaurant issues a plain bill.
export const invoiceTitle = (profile) => (profile?.gstin ? 'Tax Invoice' : 'Bill');

export const PAYMENT_LABEL = { cash: 'Cash', upi: 'UPI', card: 'Card', online: 'Online' };

// Taxable value and GST split into CGST + SGST in whole paise, so the two halves always add up.
export function gstBreakdown(order) {
  const taxPaise = toPaise(order.taxAmount || 0);
  const cgstPaise = Math.floor(taxPaise / 2);
  return {
    taxable: toRupees(toPaise(order.subtotal ?? 0) + toPaise(order.serviceChargeAmount || 0)),
    halfRate: (order.taxPercent || 0) / 2,
    cgst: toRupees(cgstPaise),
    sgst: toRupees(taxPaise - cgstPaise)
  };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function belowThousand(n) {
  const rest = belowHundred(n % 100);
  return n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${rest ? ` ${rest}` : ''}` : rest;
}

// Indian numbering: 1,23,45,678 -> "One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight".
function integerInWords(n) {
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 1e7);
  if (crore) parts.push(`${integerInWords(crore)} Crore`);
  const lakh = Math.floor((n % 1e7) / 1e5);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  const thousand = Math.floor((n % 1e5) / 1e3);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  const rest = n % 1e3;
  if (rest) parts.push(belowThousand(rest));
  return parts.join(' ');
}

export function amountInWords(rupees) {
  const paise = toPaise(rupees);
  const whole = Math.floor(paise / 100);
  const fraction = paise % 100;
  return `Rupees ${integerInWords(whole)}${fraction ? ` and ${belowHundred(fraction)} Paise` : ''} Only`;
}

// upi://pay link for the bill's QR code; any UPI app opens it with the amount filled in.
export function upiPayLink({ upiId, payeeName, amount, note }) {
  const params = new URLSearchParams({ pa: upiId, pn: payeeName || '', am: toRupees(toPaise(amount)).toFixed(2), cu: 'INR' });
  if (note) params.set('tn', note);
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
}

export const shortOrderId = (id) => String(id).slice(-6).toUpperCase();

// jsPDF's built-in fonts cover Latin-1 only: "Rs." instead of the rupee sign, and other scripts are dropped.
const pdfMoney = (rupees) => `Rs. ${Number(rupees || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// eslint-disable-next-line no-control-regex
const latin = (text) => String(text ?? '').replace(/[^\x00-\xff]/g, '').replace(/\s+/g, ' ').trim();

/**
 * A4 GST invoice for one order. Includes a UPI QR code while the bill is unpaid and the restaurant
 * has a UPI ID. `qrDataUrl` is a PNG data URL (or null).
 */
export async function downloadInvoicePdf({ order, profile, qrDataUrl = null }) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 18;
  const right = 192;
  let y = 22;

  const text = (value, x, opts = {}) => pdf.text(latin(value), x, y, opts);
  const line = () => { pdf.setDrawColor(200); pdf.line(left, y, right, y); };
  const ensureRoom = (height) => {
    if (y + height > 280) { pdf.addPage(); y = 22; }
  };

  pdf.setFont('helvetica', 'bold').setFontSize(16);
  text(profile?.restaurantName || 'Restaurant', left);
  pdf.setFontSize(12);
  text(invoiceTitle(profile).toUpperCase(), right, { align: 'right' });
  pdf.setFont('helvetica', 'normal').setFontSize(9.5);
  y += 6;
  if (profile?.address) {
    const lines = pdf.splitTextToSize(latin(profile.address), 100);
    pdf.text(lines, left, y);
    y += lines.length * 4.5;
  }
  if (profile?.gstin) { text(`GSTIN: ${profile.gstin}`, left); y += 4.5; }

  // Invoice details, right column
  const details = [
    ['Invoice no.', order.invoiceNumber || '-'],
    ['Date', new Date(order.invoicedAt || order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
    ['Order', `#${shortOrderId(order._id)} · Table ${order.tableNumber}`],
    ...(profile?.gstin ? [['Place of supply', placeOfSupply(profile.gstin)]] : [])
  ];
  let dy = 28;
  details.forEach(([label, value]) => {
    pdf.setTextColor(110).text(label, 128, dy);
    pdf.setTextColor(0).text(latin(value), right, dy, { align: 'right' });
    dy += 4.5;
  });
  y = Math.max(y, dy) + 4;
  if (order.customerName) { text(`Billed to: ${order.customerName}`, left); y += 6; }

  // Items table
  const cols = { item: left, sac: 112, qty: 132, rate: 160, amount: right };
  line();
  y += 5;
  pdf.setFont('helvetica', 'bold');
  text('Item', cols.item);
  text('SAC', cols.sac);
  text('Qty', cols.qty, { align: 'right' });
  text('Rate', cols.rate, { align: 'right' });
  text('Amount', cols.amount, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  y += 2.5;
  line();
  y += 5.5;
  order.items.forEach((item) => {
    const options = [item.variant?.name, ...(item.addOns || []).map((a) => a.name)].filter(Boolean).join(', ');
    const name = pdf.splitTextToSize(latin(item.menuItemName) || 'Item', 88);
    const extra = options ? pdf.splitTextToSize(latin(options), 88) : [];
    ensureRoom((name.length + extra.length) * 4.5 + 2);
    pdf.text(name, cols.item, y);
    text(RESTAURANT_SAC, cols.sac);
    text(String(item.quantity), cols.qty, { align: 'right' });
    text(pdfMoney(item.price), cols.rate, { align: 'right' });
    text(pdfMoney(item.lineTotal ?? item.price * item.quantity), cols.amount, { align: 'right' });
    y += name.length * 4.5;
    if (extra.length) {
      pdf.setTextColor(110).text(extra, cols.item, y);
      pdf.setTextColor(0);
      y += extra.length * 4.5;
    }
    y += 1.5;
  });
  line();
  y += 6;

  // Totals
  const gst = gstBreakdown(order);
  const totals = [
    ['Subtotal', order.subtotal],
    ...(order.serviceChargeAmount > 0 ? [[`Service charge ${order.serviceChargePercent}%`, order.serviceChargeAmount]] : []),
    ...(order.taxAmount > 0 ? [['Taxable value', gst.taxable], [`CGST ${gst.halfRate}%`, gst.cgst], [`SGST ${gst.halfRate}%`, gst.sgst]] : [])
  ];
  ensureRoom(Math.max(totals.length * 5 + 30, 44));
  const totalsTop = y - 4;
  totals.forEach(([label, value]) => {
    text(label, 150, { align: 'right' });
    text(pdfMoney(value), right, { align: 'right' });
    y += 5;
  });
  pdf.setFont('helvetica', 'bold').setFontSize(12);
  y += 1;
  text('Total', 150, { align: 'right' });
  text(pdfMoney(order.totalAmount), right, { align: 'right' });
  pdf.setFont('helvetica', 'normal').setFontSize(9);
  y += 5;
  text(amountInWords(order.totalAmount), right, { align: 'right' });
  y += 9;

  // Payment: "PAID" line, or a UPI QR code beside the totals while unpaid
  pdf.setFontSize(10);
  if (!order.payment?.paidAt && qrDataUrl) {
    pdf.addImage(qrDataUrl, 'PNG', left, totalsTop, 34, 34, 'upi', 'FAST');
    pdf.text('Scan to pay with any UPI app', left + 38, totalsTop + 14);
    pdf.setTextColor(110).text(latin(`UPI ID: ${profile.upiId}`), left + 38, totalsTop + 19.5);
    pdf.setTextColor(0);
    y = Math.max(y, totalsTop + 40);
  }
  if (order.payment?.paidAt) {
    pdf.setFont('helvetica', 'bold');
    const ref = order.payment.reference ? ` (ref. ${order.payment.reference})` : '';
    text(`PAID by ${PAYMENT_LABEL[order.payment.method] || order.payment.method}${ref} on ${new Date(order.payment.paidAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}`, left);
    pdf.setFont('helvetica', 'normal');
    y += 8;
  }

  pdf.setFontSize(9).setTextColor(110);
  ensureRoom(14);
  y = Math.max(y, 262);
  if (!profile?.gstin && order.taxAmount > 0) { text('GSTIN not set: add it in Settings to issue a tax invoice.', left); y += 5; }
  text('This is a computer-generated invoice and needs no signature. Thank you, visit again!', left);

  // A download on the website; the share sheet in the app (WhatsApp, Gmail, Drive, print).
  await saveFile(pdf.output('blob'), `invoice-${(order.invoiceNumber || shortOrderId(order._id)).replace(/[^\w-]+/g, '-')}.pdf`);
}
