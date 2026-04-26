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
        className="h-[2px] w-full"
        style={{ background: 'linear-gradient(90deg, transparent, #00f5b4 30%, #e8c547 60%, #00f5b4 80%, transparent)', opacity: 0.7 }}
      />

      <div className="w-full px-[max(16px,2vw)] h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 select-none shrink-0">
          <div
            className="rounded-lg border border-white/[0.1] bg-white/[0.04] flex items-center justify-center"
            style={{ width: 'clamp(28px,2.5vw,36px)', height: 'clamp(28px,2.5vw,36px)' }}
          >
            <span className="font-pashto text-mint" style={{ fontSize: 'clamp(13px,1.2vw,17px)', lineHeight: 1 }}>پ</span>
          </div>
          <div className="flex flex-col leading-none gap-0.5">
            <div className="flex items-baseline gap-1">
              <span className="font-ui text-warm font-semibold" style={{ fontSize: 'clamp(12px,1.2vw,16px)' }}>Pashto</span>
              <span className="font-display text-warm" style={{ fontSize: 'clamp(12px,1.2vw,16px)' }}>Dictionary</span>
            </div>
            <span className="font-pashto text-muted" style={{ fontSize: 'clamp(9px,0.8vw,11px)', lineHeight: 1.4 }}>
              د پښتو قاموس
            </span>
          </div>
        </Link>

        {/* Centre nav */}
        <div className="flex items-center gap-0.5">
          <NavLink to="/entries">Browse</NavLink>
          <NavLink to="/entries">Community</NavLink>
          <NavLink to="/entries">About</NavLink>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {!user ? (
            <>
              <Link
                to="/login"
                className="font-ui text-warm border border-white/[0.1] rounded-[10px] hover:border-white/20 transition-colors"
                style={{ fontSize: 'clamp(11px,1vw,13px)', padding: 'clamp(5px,0.5vh,8px) clamp(12px,1.2vw,18px)' }}
              >
                Login
              </Link>
              <Link
                to="/register"
                className="font-ui font-semibold bg-mint text-charcoal rounded-[10px] hover:opacity-90 transition-opacity"
                style={{ fontSize: 'clamp(11px,1vw,13px)', padding: 'clamp(5px,0.5vh,8px) clamp(12px,1.2vw,18px)', boxShadow: '0 4px 16px rgba(0,245,180,0.35)' }}
              >
                Register
              </Link>
            </>
          ) : (
            <>
              <NavLink to="/submit">Submit</NavLink>

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex items-center gap-1.5 font-ui text-warm border border-white/[0.1] rounded-[10px] hover:border-white/20 transition-colors"
                  style={{ fontSize: 'clamp(11px,1vw,13px)', padding: 'clamp(5px,0.5vh,8px) clamp(10px,1vw,14px)' }}
                >
                  <span className="w-4 h-4 rounded-full bg-mint flex items-center justify-center text-charcoal font-bold text-[8px]">
                    {user.username?.[0]?.toUpperCase()}
                  </span>
                  <span>{user.username}</span>
                  <span className="text-muted text-[10px]">▾</span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#111] backdrop-blur-[24px] border border-white/[0.08] rounded-[12px] overflow-hidden shadow-xl z-50">
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
      className="font-ui text-muted hover:text-warm rounded-[8px] hover:bg-white/[0.04] transition-colors"
      style={{ fontSize: 'clamp(11px,1vw,13px)', padding: 'clamp(4px,0.4vh,6px) clamp(10px,1vw,14px)' }}
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
