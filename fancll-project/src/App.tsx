import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PredictionsProvider } from './data/store';
import TabLayout from './components/TabLayout';
import Login from './screens/Login';
import Fixtures from './screens/Fixtures';
import Predict from './screens/Predict';
import Leaderboard from './screens/Leaderboard';
import './styles.css';

export default function App() {
  return (
    <PredictionsProvider>
      <BrowserRouter>
        <div className="shell">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/app" element={<TabLayout />}>
              <Route index element={<Navigate to="fixtures" replace />} />
              <Route path="fixtures" element={<Fixtures />} />
              <Route path="leaderboard" element={<Leaderboard />} />
            </Route>
            <Route path="/predict/:fixtureId" element={<Predict />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </PredictionsProvider>
  );
}
