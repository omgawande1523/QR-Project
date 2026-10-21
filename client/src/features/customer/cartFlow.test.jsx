import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import CustomerApp from './CustomerApp';
import CartScreen from './CartScreen';
import ItemDetailScreen from './ItemDetailScreen';
import { ToastProvider } from '../../components/ui';
import { api } from '../../lib/api';

// The customer app against a mocked API and socket: what the guest sees in the cart, and what is sent
// when they order. The server re-prices every order; the cart's numbers must match its maths.
vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn() }
}));
vi.mock('../../lib/socket', () => ({
  connectSocket: () => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() })
}));

const RID = 'r1';
const restaurant = { _id: RID, restaurantName: 'Olive Leaf Café', tables: [1, 2, 3], taxPercent: 5, serviceChargePercent: 10, acceptingOrders: true, categories: [] };
const curry = {
  _id: 'curry', name: 'Chicken Curry', price: 200, isVeg: false, available: true,
  variants: [{ _id: 'half', name: 'Half', price: 200 }, { _id: 'full', name: 'Full', price: 320 }],
  addOns: [{ _id: 'butter', name: 'Extra butter', price: 20 }]
};
const naan = { _id: 'naan', name: 'Butter Naan', price: 50, isVeg: true, available: true, variants: [], addOns: [] };
const lassi = { _id: 'lassi', name: 'Mango Lassi', price: 90, isVeg: true, available: false, variants: [], addOns: [] };

const line = (itemId, quantity, variantId, addOnIds = []) => ({ itemId, variantId, addOnIds, notes: '', quantity, key: [itemId, variantId || '', addOnIds.join('+'), ''].join('|') });

function Tracking() {
  return <p>Tracking order {useParams().orderId}</p>;
}

function renderCart({ table = 2, lines = [], path = 'cart' } = {}) {
  localStorage.setItem(`qr.cart.${RID}`, JSON.stringify(lines));
  if (table) sessionStorage.setItem(`qr.table.${RID}`, JSON.stringify(table));
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/menu/${RID}/${path}`]}>
        <Routes>
          <Route path="/menu/:restaurantId" element={<CustomerApp />}>
            <Route path="cart" element={<CartScreen />} />
            <Route path="item/:itemId" element={<ItemDetailScreen />} />
            <Route path="orders/:orderId" element={<Tracking />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

const billRow = (label) => within(screen.getByLabelText('Bill')).getByText(label).parentElement;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.mocked(api.get).mockReset().mockImplementation((url) => {
    if (url === `/api/users/${RID}/public`) return Promise.resolve({ data: restaurant });
    if (url === `/api/menu/${RID}`) return Promise.resolve({ data: [curry, naan, lassi] });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
  vi.mocked(api.post).mockReset();
});

describe('cart maths', () => {
  test('sizes replace the price, add-ons add to it; service charge then GST, in whole paise', async () => {
    // Full curry with butter: 320 + 20 = 340 x 2 = 680; naan 50 x 3 = 150; subtotal 830
    renderCart({ lines: [line('curry', 2, 'full', ['butter']), line('naan', 3)] });
    expect(await screen.findByText('Chicken Curry')).toBeInTheDocument();
    expect(screen.getByText('Full · Extra butter')).toBeInTheDocument();
    expect(billRow('Subtotal')).toHaveTextContent('₹830');
    expect(billRow('Service charge (10%)')).toHaveTextContent('₹83');
    expect(billRow('GST (5%)')).toHaveTextContent('₹45.65'); // 5% of 913
    expect(billRow('Total')).toHaveTextContent('₹958.65');
    expect(screen.getByRole('button', { name: /Place order · ₹958.65/ })).toBeEnabled();
  });

  test('changing a quantity updates the line and the bill', async () => {
    const user = userEvent.setup();
    renderCart({ lines: [line('naan', 1)] });
    const stepper = await screen.findByRole('group', { name: 'Butter Naan quantity' });
    await user.click(within(stepper).getByRole('button', { name: 'Increase' }));
    await user.click(within(stepper).getByRole('button', { name: 'Increase' }));
    expect(billRow('Subtotal')).toHaveTextContent('₹150');
    expect(billRow('Total')).toHaveTextContent('₹173.25'); // 150 + 15 + 8.25
  });

  test('a sold-out dish is flagged and left out of the bill', async () => {
    renderCart({ lines: [line('naan', 2), line('lassi', 1)] });
    expect(await screen.findByText('Mango Lassi')).toBeInTheDocument();
    expect(screen.getByText(/sold out|not available/i)).toBeInTheDocument();
    expect(billRow('Subtotal')).toHaveTextContent('₹100');
  });
});

describe('placing an order', () => {
  test('sends only ids, sizes, add-ons and quantities (never prices), then opens tracking', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({ data: { _id: 'o1', trackingToken: 't0k', status: 'pending', items: [], createdAt: new Date().toISOString() } });
    renderCart({ lines: [line('curry', 1, 'half', ['butter']), line('naan', 2), line('lassi', 1)] });
    await user.type(await screen.findByLabelText('Name'), 'Meera');
    await user.click(screen.getByRole('button', { name: /Place order/ }));

    expect(await screen.findByText('Tracking order o1')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
    const [url, body] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/api/orders');
    expect(body).toEqual({
      restaurantId: RID,
      tableNumber: 2,
      customerName: 'Meera',
      items: [
        { menuItem: 'curry', quantity: 1, variantId: 'half', addOnIds: ['butter'] },
        { menuItem: 'naan', quantity: 2 }
      ]
    });
    expect(JSON.stringify(body)).not.toMatch(/price|total|amount/i);
    // The cart is emptied and the order is remembered for tracking
    expect(JSON.parse(localStorage.getItem(`qr.cart.${RID}`))).toEqual([]);
    expect(JSON.parse(localStorage.getItem(`qr.orders.${RID}`))[0]).toMatchObject({ id: 'o1', token: 't0k' });
  });

  test('cannot order without choosing a table', async () => {
    renderCart({ table: null, lines: [line('naan', 1)] });
    expect(await screen.findByText('Choose your table to place the order')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Place order/ })).toBeDisabled();
  });

  test('a dish that sold out meanwhile shows the server message and reloads the menu', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { message: 'Butter Naan is sold out', code: 'ITEM_UNAVAILABLE' } } });
    renderCart({ lines: [line('naan', 1)] });
    await user.click(await screen.findByRole('button', { name: /Place order/ }));
    expect(await screen.findByText('Butter Naan is sold out')).toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.filter(([u]) => u === `/api/menu/${RID}`)).toHaveLength(2));
    expect(screen.queryByText(/Tracking order/)).not.toBeInTheDocument();
  });
});

describe('adding from the dish page', () => {
  test('the first size is preselected; the price follows size, add-ons and quantity; repeat adds merge', async () => {
    const user = userEvent.setup();
    const view = renderCart({ path: 'item/curry' });
    const add = await screen.findByRole('button', { name: /Add to cart/ });
    expect(add).toHaveTextContent('Add to cart · ₹200'); // Half, the first size

    await user.click(screen.getByRole('radio', { name: /Full/ }));
    await user.click(screen.getByRole('checkbox', { name: /Extra butter/ }));
    await user.click(within(screen.getByRole('group', { name: 'Quantity' })).getByRole('button', { name: 'Increase' }));
    expect(add).toHaveTextContent('Add to cart · ₹680'); // (320 + 20) x 2
    await user.click(add);
    const cartNow = () => JSON.parse(localStorage.getItem(`qr.cart.${RID}`));
    await waitFor(() => expect(cartNow()).toHaveLength(1));
    expect(cartNow()[0]).toMatchObject({ itemId: 'curry', variantId: 'full', addOnIds: ['butter'], quantity: 2 });

    // The same choice again adds to that line instead of a new one
    view.unmount();
    renderCart({ path: 'item/curry', lines: cartNow() });
    await user.click(await screen.findByRole('radio', { name: /Full/ }));
    await user.click(screen.getByRole('checkbox', { name: /Extra butter/ }));
    await user.click(screen.getByRole('button', { name: /Add to cart/ }));
    await waitFor(() => expect(cartNow()[0].quantity).toBe(3));
    expect(cartNow()).toHaveLength(1);
  });
});
