import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, articlesRes] = await Promise.all([
        axios.get('/api/v1/analytics/summary'),
        axios.get('/api/v1/articles/latest?limit=10')
      ]);
      setStats(statsRes.data.data);
      setArticles(articlesRes.data.data.latestArticles || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading dashboard...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">News Dashboard</h2>
      
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Sources</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.totalSources}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Active Sources</h3>
            <p className="text-3xl font-bold text-green-600">{stats.activeSources}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Articles</h3>
            <p className="text-3xl font-bold text-purple-600">{stats.totalArticles}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">This Week</h3>
            <p className="text-3xl font-bold text-orange-600">{stats.articlesThisWeek}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium">Latest Articles</h3>
        </div>
        <div className="divide-y">
          {articles.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No articles yet. Add some sources to start collecting news!
            </div>
          ) : (
            articles.map((article, index) => (
              <div key={index} className="px-6 py-4">
                <h4 className="font-medium text-gray-900 mb-2">{article.title}</h4>
                {article.summary && (
                  <p className="text-sm text-gray-600 mb-2">{article.summary}</p>
                )}
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>{article.sourceName}</span>
                  {article.sentiment && (
                    <span className={`px-2 py-1 rounded-full ${
                      article.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                      article.sentiment === 'negative' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {article.sentiment}
                    </span>
                  )}
                  <a href={article.url} target="_blank" rel="noopener noreferrer" 
                     className="text-blue-600 hover:text-blue-800">
                    Read Original
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;