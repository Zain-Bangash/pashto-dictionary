import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isModerator = user && (user.role === 'moderator' || user.role === 'admin');

  function handleLogout() {
    setDropdownOpen(false);
    logout();
    navigate('/');
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-charcoal border-b border-white/[0.06]">
      {/* Top accent bar */}
      <div
        className="h-[2px] w-full opacity-70"
        style={{ background: 'linear-gradient(90deg, transparent, #00f5b4, #e8c547, #00f5b4, transparent)' }}
      />

      <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 select-none">
          <span
            className="font-pashto text-gold text-xl leading-none"
            style={{ lineHeight: 1.7 }}
          >
            پښتو
          </span>
          <span className="font-display text-warm text-lg">Dictionary</span>
        </Link>

        {/* Centre nav */}
        <div className="flex items-center gap-1">
          <NavLink to="/entries">Browse</NavLink>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {!user ? (
            <>
              <Link
                to="/login"
                className="px-3.5 py-1.5 text-sm font-ui text-warm border border-white/[0.08] rounded-[10px] hover:border-gold/30 transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="px-3.5 py-1.5 text-sm font-ui font-semibold bg-mint text-charcoal rounded-[10px] hover:opacity-90 transition-opacity"
                style={{ boxShadow: '0 4px 20px rgba(0,245,180,0.3)' }}
              >
                Register
              </Link>
            </>
          ) : (
            <>
              <NavLink to="/submit">Submit</NavLink>

              {/* User dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-ui text-warm border border-white/[0.08] rounded-[10px] hover:border-gold/30 transition-colors"
                >
                  <span className="text-gold">●</span>
                  <span>{user.username}</span>
                  <span className="text-muted text-xs">▾</span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white/[0.06] backdrop-blur-[24px] border border-white/[0.08] rounded-[12px] overflow-hidden shadow-lg z-50">
                    <DropdownLink to="/my-submissions" onClick={() => setDropdownOpen(false)}>
                      My Submissions
                    </DropdownLink>
                    {isModerator && (
                      <DropdownLink to="/dashboard" onClick={() => setDropdownOpen(false)}>
                        Dashboard
                      </DropdownLink>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm font-ui text-red-400 hover:bg-white/[0.04] transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ to, children }) {
  return (
    <Link
      to={to}
      className="px-3 py-1.5 text-sm font-ui text-muted hover:text-warm rounded-[10px] hover:bg-white/[0.04] transition-colors"
    >
      {children}
    </Link>
  );
}

function DropdownLink({ to, onClick, children }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block px-4 py-2.5 text-sm font-ui text-warm hover:bg-white/[0.04] transition-colors"
    >
      {children}
    </Link>
  );
}
