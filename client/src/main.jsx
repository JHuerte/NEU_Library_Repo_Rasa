import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './styles.css';
import { AppProviders } from './context.jsx';
import Layout from './components/Layout.jsx';
import { RequireRole } from './components/common.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import Browse from './pages/Browse.jsx';
import ItemPage, { HandleRedirect } from './pages/Item.jsx';
import { Login, Register } from './pages/Auth.jsx';
import Submit from './pages/Submit.jsx';
import MySubmissions from './pages/MySubmissions.jsx';
import ReviewQueue from './pages/ReviewQueue.jsx';
import ReviewItem from './pages/ReviewItem.jsx';
import Reports from './pages/Reports.jsx';
import Admin from './pages/Admin.jsx';

function NotFound() {
  return <div className="empty">This page does not exist. Use the menu above to find what you need.</div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProviders>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="search" element={<Search />} />
            <Route path="browse" element={<Browse />} />
            <Route path="items/:id" element={<ItemPage />} />
            <Route path="handle/:prefix/:number" element={<HandleRedirect />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="submit" element={<RequireRole><Submit /></RequireRole>} />
            <Route path="submit/:id" element={<RequireRole><Submit /></RequireRole>} />
            <Route path="my-submissions" element={<RequireRole><MySubmissions /></RequireRole>} />
            <Route path="review" element={<RequireRole roles={['librarian', 'admin']}><ReviewQueue /></RequireRole>} />
            <Route path="review/:id" element={<RequireRole roles={['librarian', 'admin']}><ReviewItem /></RequireRole>} />
            <Route path="reports" element={<RequireRole roles={['admin']}><Reports /></RequireRole>} />
            <Route path="admin" element={<RequireRole roles={['librarian', 'admin']}><Admin /></RequireRole>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AppProviders>
    </BrowserRouter>
  </React.StrictMode>,
);
