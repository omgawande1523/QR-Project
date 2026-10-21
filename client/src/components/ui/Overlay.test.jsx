import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Overlay';

// The parent re-renders on every keystroke and passes a new onClose each time, like most callers do, and
// the first field has autoFocus like the dish editor.
function Editor({ onClosed }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Add dish</button>
      <Modal open={open} title="Add a dish" onClose={() => { setOpen(false); onClosed(); }}>
        <input aria-label="Name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        <input aria-label="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Modal>
    </>
  );
}

// Tab wrapping needs real layout (jsdom has none); e2e/keyboard.spec.js covers it in a browser.
describe('Modal focus', () => {
  test('typing in a later field keeps focus there, and Escape returns focus to the opener', async () => {
    const user = userEvent.setup();
    const onClosed = vi.fn();
    render(<Editor onClosed={onClosed} />);

    await user.click(screen.getByRole('button', { name: 'Add dish' }));
    expect(screen.getByLabelText('Name')).toHaveFocus();

    await user.click(screen.getByLabelText('Price'));
    await user.keyboard('120');
    expect(screen.getByLabelText('Price')).toHaveFocus();
    expect(screen.getByLabelText('Price')).toHaveValue('120');

    await user.keyboard('{Escape}');
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add dish' })).toHaveFocus();
  });
});
