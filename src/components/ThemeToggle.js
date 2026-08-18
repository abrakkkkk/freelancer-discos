'use client';

import { useTheme } from '@/components/ThemeProvider';
import { MdOutlineWbSunny } from "react-icons/md";
import { FaMoon } from "react-icons/fa6";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button 
      className="theme-toggle-btn"
      onClick={toggleTheme}
      title="Alternar Tema"
      style={{
        background: theme === 'light' ? '#e2e8f0' : '#27272a',
        color: theme === 'light' ? '#0f172a' : '#ffffff',
        borderColor: theme === 'light' ? '#cbd5e1' : '#3f3f46'
      }}
    >
      {theme === 'light' ? <FaMoon size={18} /> : <MdOutlineWbSunny size={18} />}
    </button>
  );
}
