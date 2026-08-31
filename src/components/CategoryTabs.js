import { PiVinylRecord, PiDisc, PiFilmStrip, PiCassetteTape } from "react-icons/pi";
import { CATEGORIES } from '@/constants/config';

const getIcon = (iconType) => {
  const style = { marginRight: '6px', verticalAlign: 'middle' };
  switch (iconType) {
    case 'vinyl': return <PiVinylRecord size={18} style={style} />;
    case 'film': return <PiFilmStrip size={18} style={style} />;
    case 'disc': return <PiDisc size={18} style={style} />;
    case 'cassette': return <PiCassetteTape size={18} style={style} />;
    default: return null;
  }
};

export default function CategoryTabs({ activeTab, onTabChange, additionalProps = {} }) {
  return (
    <div className="tabs" {...additionalProps}>
      {CATEGORIES.map(cat => (
        <button 
          key={cat.id}
          className={`tab-btn ${activeTab === cat.id ? 'active' : ''}`}
          onClick={() => onTabChange(cat.id)}
        >
          {getIcon(cat.iconType)} {cat.label}
        </button>
      ))}
    </div>
  );
}
