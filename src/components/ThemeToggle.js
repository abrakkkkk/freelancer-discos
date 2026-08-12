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
    >
      {theme === 'light' ? <FaMoon size={18} /> : <MdOutlineWbSunny size={18} />}
    </button>
  );
}
