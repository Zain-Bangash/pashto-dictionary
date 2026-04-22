import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Entries from './pages/Entries';
import EntryDetail from './pages/EntryDetail';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/entries" element={<Entries />} />
        <Route path="/entries/:id" element={<EntryDetail />} />
      </Routes>
    </BrowserRouter>
  );
}
