import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface SearchBoxProps {
  readonly id: string;
  readonly className?: string;
}

export function SearchBox({ id, className }: SearchBoxProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeQuery = searchParams.get('q') ?? '';
  const [value, setValue] = useState(activeQuery);

  // Keep the field in step with the URL when the user lands on /search?q=…
  // directly or navigates back to an earlier query.
  useEffect(() => {
    setValue(activeQuery);
  }, [activeQuery]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed === '') {
      return;
    }
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form className={className ? `search-box ${className}` : 'search-box'} onSubmit={handleSubmit} role="search">
      <label className="visually-hidden" htmlFor={id}>
        コラムをタイトルで検索
      </label>
      <input
        id={id}
        className="search-box__input"
        type="search"
        name="q"
        value={value}
        placeholder="コラムを検索..."
        autoComplete="off"
        onChange={(event) => setValue(event.target.value)}
      />
      <button className="search-box__submit" type="submit">
        <span className="visually-hidden">検索する</span>
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="8.6" cy="8.6" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12.8 12.8 17.4 17.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  );
}
