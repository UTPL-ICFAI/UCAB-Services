import React, { useState, useRef, useCallback } from "react";

/**
 * LocationSearch — Nominatim-powered address autocomplete
 * Props:
 *   placeholder  — input placeholder text
 *   dotColor     — "green" | "red"
 *   onSelect     — ({ lat, lng, address }) callback
 *   value        — controlled display value
 */
const LocationSearch = ({ placeholder, dotColor, onSelect, value }) => {
  const [query, setQuery]       = useState(value || "");
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [open, setOpen]         = useState(false);
  const debounceTimer           = useRef(null);

  const search = useCallback((q) => {
    if (q.length < 3) { setResults([]); setOpen(false); return; }
    setLoading(true);
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    )
      .then((r) => r.json())
      .then((data) => {
        setResults(data);
        setOpen(data.length > 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(v), 400);
  };

  const handleSelect = (item) => {
    const address = item.display_name.split(",").slice(0, 3).join(", ");
    setQuery(address);
    setOpen(false);
    setResults([]);
    onSelect({ lat: parseFloat(item.lat), lng: parseFloat(item.lon), address });
  };

  return (
    <div className="location-search-wrapper">
      <div className="location-row">
        <div className={`location-dot ${dotColor}`} />
        <input
          className="location-input"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          autoComplete="off"
        />
        {loading && <span className="search-spinner">⏳</span>}
      </div>

      {open && (
        <ul className="autocomplete-list">
          {results.map((item) => (
            <li
              key={item.place_id}
              className="autocomplete-item"
              onMouseDown={() => handleSelect(item)}
            >
              <span className="autocomplete-icon">📍</span>
              <div>
                <div className="autocomplete-main">
                  {item.display_name.split(",")[0]}
                </div>
                <div className="autocomplete-sub">
                  {item.display_name.split(",").slice(1, 3).join(",")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocationSearch;
