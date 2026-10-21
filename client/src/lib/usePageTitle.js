import { useEffect } from 'react';
import { APP_NAME } from '../config';

// "Orders · QR Menu" in the browser tab and history; restores the previous title on leave.
export function usePageTitle(title) {
  useEffect(() => {
    if (!title) return undefined;
    const previous = document.title;
    document.title = `${title} · ${APP_NAME}`;
    return () => { document.title = previous; };
  }, [title]);
}
