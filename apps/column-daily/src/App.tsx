import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { NavBand } from './components/layout/NavBand';
import { ScrollToTop } from './components/layout/ScrollToTop';
import { SiteFooter } from './components/layout/SiteFooter';
import { SiteHeader } from './components/layout/SiteHeader';
import { ArticlePage } from './pages/ArticlePage';
import { HomePage } from './pages/HomePage';
import { CategoryPage, LatestPage, PopularPage, TagPage } from './pages/ListingPages';
import { SearchPage } from './pages/SearchPage';
import { SeriesPage } from './pages/SeriesPage';
import './components/layout/layout.css';
import './components/ui/ui.css';
import './app.css';

function AppRoutes() {
  const location = useLocation();

  return (
    <main id="main" className="site-main page-width">
      {/* Keyed on the location so each page re-runs the settle animation. */}
      <div className="route-fade" key={location.pathname + location.search}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/articles/:id" element={<ArticlePage />} />
          <Route path="/latest" element={<LatestPage />} />
          <Route path="/popular" element={<PopularPage />} />
          <Route path="/series" element={<SeriesPage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/tag/:tag" element={<TagPage />} />
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <a className="skip-link" href="#main">
        本文へスキップ
      </a>
      <SiteHeader />
      <NavBand />
      <AppRoutes />
      <SiteFooter />
    </HashRouter>
  );
}
