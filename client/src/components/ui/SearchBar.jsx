import { Search, SlidersHorizontal } from 'lucide-react';
import { IconButton } from './Button';

export function SearchBar({ value, onChange, placeholder = 'Search', onFilter, filterActive = false, inputRef, label = 'Search' }) {
  return (
    <div className="search-bar" role="search">
      <Search size={20} aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="search"
      />
      {onFilter && (
        <IconButton label="Filters" variant="primary" onClick={onFilter} aria-pressed={filterActive}>
          <SlidersHorizontal size={20} />
        </IconButton>
      )}
    </div>
  );
}
