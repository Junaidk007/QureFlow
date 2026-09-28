import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import './MuiSelect.css';

export default function MuiSelect({
  label = 'Select',
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  disabled = false,
  fullWidth = true,
  helperText = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);
  const hasValue = Boolean(value);

  const handleSelect = (optValue) => {
    if (disabled) return;
    onChange(optValue);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`mui-form-control ${fullWidth ? 'mui-full-width' : ''} ${disabled ? 'mui-disabled' : ''} ${
        isOpen ? 'mui-focused' : ''
      }`}
    >
      <div
        className={`mui-outlined-input ${hasValue || isOpen ? 'has-value' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {/* Clean Material Floating Label */}
        <label className={`mui-input-label ${hasValue || isOpen ? 'shrink' : ''}`}>
          {label}
        </label>

        {/* Selected Display Value */}
        <div className="mui-select-rendered">
          {selectedOption ? (
            <span className="mui-select-text">{selectedOption.label}</span>
          ) : (
            <span className="mui-placeholder">{placeholder}</span>
          )}
        </div>

        {/* Dropdown Chevron */}
        <ChevronDown
          size={18}
          className={`mui-select-arrow ${isOpen ? 'open' : ''}`}
        />
      </div>

      {/* Helper text */}
      {helperText && <p className="mui-helper-text">{helperText}</p>}

      {/* Material UI Dropdown Menu */}
      {isOpen && (
        <div className="mui-dropdown-popover" role="listbox">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                className={`mui-menu-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(opt.value)}
                role="option"
                aria-selected={isSelected}
              >
                <div className="mui-menu-item-content">
                  <span className="mui-item-title">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="mui-item-sublabel">{opt.sublabel}</span>
                  )}
                </div>
                {isSelected && <Check size={16} className="mui-item-check" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
