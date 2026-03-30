import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SajuProvider } from '@/contexts/SajuContext';
import { TabBar } from '@/components/layout/TabBar';
import { HomePage } from '@/pages/HomePage';
import { InputPage } from '@/pages/InputPage';
import { LoadingPage } from '@/pages/LoadingPage';
import { ResultPage } from '@/pages/ResultPage';
import { DailyFortunePage } from '@/pages/DailyFortunePage';
import { CompatibilityPage } from '@/pages/CompatibilityPage';
import { StoragePage } from '@/pages/StoragePage';
import { ChargePage } from '@/pages/ChargePage';
import { MyPage } from '@/pages/MyPage';
import { SharePage } from '@/pages/SharePage';

export function App() {
  return (
    <BrowserRouter>
      <SajuProvider>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/input" element={<InputPage />} />
            <Route path="/loading" element={<LoadingPage />} />
            <Route path="/result/:id" element={<ResultPage />} />
            <Route path="/daily" element={<DailyFortunePage />} />
            <Route path="/compat" element={<CompatibilityPage />} />
            <Route path="/storage" element={<StoragePage />} />
            <Route path="/charge" element={<ChargePage />} />
            <Route path="/my" element={<MyPage />} />
            <Route path="/share/:id" element={<SharePage />} />
          </Routes>
          <TabBar />
        </div>
      </SajuProvider>
    </BrowserRouter>
  );
}
