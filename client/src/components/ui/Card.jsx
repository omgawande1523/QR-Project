export function Card({ as: Tag = 'div', flat = false, className = '', children, ...rest }) {
  return (
    <Tag className={['card', flat && 'card-flat', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  );
}
