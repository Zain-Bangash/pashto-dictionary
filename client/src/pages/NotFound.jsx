import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-charcoal flex flex-col items-center justify-center px-4">
      <h1 className="font-display text-8xl font-bold text-gold mb-4">404</h1>
      <p className="text-warm text-xl mb-8">Page not found</p>
      <Link
        to="/"
        className="text-gold underline hover:opacity-80 transition-opacity"
      >
        Back to home
      </Link>
    </div>
  );
}
