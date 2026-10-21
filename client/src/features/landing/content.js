// Marketing copy for the landing page. Edit freely: plan names, prices and limits are placeholders
// for the business to decide; only list features the product actually has.
import { QrCode, Zap, ConciergeBell, ReceiptIndianRupee, ToggleRight, Palette, ImagePlus, Smartphone } from 'lucide-react';

export const FEATURES = [
  { Icon: QrCode, title: 'A QR menu on every table', text: 'Guests scan, browse dishes with photos, pick sizes and add-ons, and order. No app to install.' },
  { Icon: Zap, title: 'Orders reach the kitchen instantly', text: 'A live board with sound alerts. Move orders from New to Served with one tap.' },
  { Icon: ConciergeBell, title: 'Waiter calls and bill requests', text: 'Guests call a waiter, ask for water or the bill. Requests pop up on your screen.' },
  { Icon: ReceiptIndianRupee, title: 'GST-ready, tamper-proof bills', text: 'Prices, GST and service charge are calculated on the server, so nobody can order for ₹0.' },
  { Icon: ToggleRight, title: 'Sold out in one tap', text: 'Mark dishes unavailable and every open menu updates immediately.' },
  { Icon: Palette, title: 'Branded table QR codes', text: 'Your colour and logo. Download one card or a print-ready A4 PDF of every table.' },
  { Icon: Smartphone, title: 'Live order tracking for guests', text: 'Guests watch their order go from Received to Served and can reorder in a tap.' },
  { Icon: ImagePlus, title: 'Beautiful menus in minutes', text: 'Upload photos straight from your phone; we resize and optimise them for you.' }
];

export const STEPS = [
  { title: 'Add your menu', text: 'Dishes, photos, prices, sizes and add-ons. Arrange categories the way your menu reads.' },
  { title: 'Print table QR codes', text: 'Download branded cards for every table and place them on the tables.' },
  { title: 'Take orders live', text: 'Guests order from their phones and orders arrive on your dashboard with a chime.' }
];

export const PLANS = [
  {
    name: 'Starter',
    price: '₹0',
    period: 'forever',
    blurb: 'For small cafés trying digital ordering.',
    features: ['Up to 5 tables', 'Unlimited dishes and orders', 'Live orders board', 'Branded QR codes'],
    cta: 'Start free'
  },
  {
    name: 'Growth',
    price: '₹799',
    period: 'per month',
    blurb: 'For busy restaurants.',
    features: ['Unlimited tables', 'Everything in Starter', 'Waiter calls and bill requests', 'GST receipts', 'Priority support'],
    cta: 'Start free trial',
    featured: true
  },
  {
    name: 'Business',
    price: '₹1,999',
    period: 'per month',
    blurb: 'For larger venues and chains.',
    features: ['Everything in Growth', 'Help migrating your menu', 'Onboarding call for staff', 'Dedicated account manager'],
    cta: 'Talk to us'
  }
];

export const FAQ = [
  { q: 'Do my guests need to download an app?', a: 'No. They scan the QR code on the table with their phone camera and the menu opens in the browser.' },
  { q: 'Which phones does it work on?', a: 'Any smartphone with a camera and a browser: Android or iPhone. The menu is light and loads quickly on mobile data.' },
  { q: 'How do guests pay?', a: 'Guests pay at the counter or to the waiter as usual. The dashboard shows each table\'s bill with GST and lets you print a receipt.' },
  { q: 'How is GST handled?', a: 'Set your GSTIN and GST rate once. Every order is priced on our server with GST (split into CGST and SGST on receipts) and an optional service charge.' },
  { q: 'Can I change prices or mark dishes sold out during service?', a: 'Yes. Changes appear on every guest\'s phone immediately, even on menus that are already open.' },
  { q: 'Is my data safe?', a: 'Each restaurant only sees its own orders and menu, passwords are hashed, and prices cannot be tampered with from a guest\'s phone.' }
];
