// Things the Android back button should close before it navigates: open dialogs and sheets, the sidebar
// drawer. Each registers a close function while it is open; the newest one closes first.
// (On the website nothing presses "back" through here, so this has no effect there.)
const stack = [];

export function pushBack(close) {
  const entry = { close };
  stack.push(entry);
  return () => {
    const index = stack.indexOf(entry);
    if (index !== -1) stack.splice(index, 1);
  };
}

// Closes the newest open dialog or drawer; false if there was none.
export function popBack() {
  const entry = stack.pop();
  if (!entry) return false;
  entry.close();
  return true;
}
