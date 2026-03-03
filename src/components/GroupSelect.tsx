'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, FolderOpen } from 'lucide-react';

interface GroupSelectProps {
  value: string;
  onChange: (value: string) => void;
  existingGroups: string[];
  placeholder?: string;
}

export function GroupSelect({ value, onChange, existingGroups, placeholder = "Select or create a group" }: GroupSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [filteredGroups, setFilteredGroups] = useState<string[]>(existingGroups);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    // Filter groups based on input
    if (inputValue.trim()) {
      const filtered = existingGroups.filter(g =>
        g.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredGroups(filtered);
    } else {
      setFilteredGroups(existingGroups);
    }
  }, [inputValue, existingGroups]);

  useEffect(() => {
    // Close dropdown when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  const handleSelect = (group: string) => {
    setInputValue(group);
    onChange(group);
    setIsOpen(false);
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const isNewGroup = inputValue.trim() && !existingGroups.some(
    g => g.toLowerCase() === inputValue.toLowerCase()
  );

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full px-4 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (existingGroups.length > 0 || isNewGroup) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {isNewGroup && (
            <button
              type="button"
              onClick={() => handleSelect(inputValue.trim())}
              className="w-full px-4 py-2 text-left hover:bg-orange-50 flex items-center gap-2 text-orange-600 border-b border-gray-100"
            >
              <Plus className="w-4 h-4" />
              Create "{inputValue.trim()}"
            </button>
          )}
          {filteredGroups.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => handleSelect(group)}
              className={`w-full px-4 py-2 text-left hover:bg-orange-50 flex items-center gap-2 ${
                value === group ? 'bg-orange-50 text-orange-600' : 'text-gray-700'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              {group}
            </button>
          ))}
          {filteredGroups.length === 0 && !isNewGroup && (
            <div className="px-4 py-2 text-gray-500 text-sm">
              No groups found. Type to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
