import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Sources } from './pages/Sources';
import { Articles } from './pages/Articles';
import { Analytics } from './pages/Analytics';
import './App.css';
/**
 * Main application component that sets up routing and layout
 * This component orchestrates the entire frontend experience
 */
function App() {
  return (
    <Router>
      <div className="App min-h-screen bg-gray-50">
        <Layout>
          <Routes>
            {/* Dashboard - main overview of all news activity */}
            <Route path="/dashboard" element={<Dashboard />} />
            {/* Sources management - add, edit, configure news sources */}
            <Route path="/sources" element={<Sources />} />
            {/* Articles view - browse and search all collected articles */}
            <Route path="/articles" element={<Articles />} />
            {/* Analytics - insights and reports on news collection */}
            <Route path="/analytics" element={<Analytics />} />
            {/* Default redirect to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
      </div>
    </Router>
  );
}
export default App;