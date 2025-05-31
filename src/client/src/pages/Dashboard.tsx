import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  TrendingUp, 
  Clock, 
  Globe, 
  MessageSquare,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { API } from '../services/api';
interface DashboardStats {
  totalSources: number;
  activeSources: number;
  totalArticles: number;
  articlesToday: number;
  articlesThisWeek: number;
}
interface Article {
  id: number;
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  sourceName: string;
  sourceType: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  keywords?: string;
}
/**
 * Dashboard component - the main overview page
 * Shows key metrics, recent articles, and system status
 */
export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [latestArticles, setLatestArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * Load dashboard data from the API
   * This function fetches both summary statistics and recent articles
   */
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch summary statistics and latest articles in parallel
      const [statsResponse, articlesResponse] = await Promise.all([
        API.getAnalyticsSummary(),
        API.getLatestArticles(10)
      ]);
      setStats(statsResponse.data);
      setLatestArticles(articlesResponse.data.latestArticles || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  // Load data when component mounts
  useEffect(() => {
    loadDashboardData();
  }, []);
  /**
   * Get sentiment color classes for visual indicators
   */
  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-100';
      case 'negative': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };
  /**
   * Get source type icon and styling
   */
  const getSourceTypeDisplay = (type: string) => {
    switch (type) {
      case 'twitter': return { icon: '🐦', label: 'Twitter', color: 'bg-blue-100 text-blue-800' };
      case 'facebook': return { icon: '📘', label: 'Facebook', color: 'bg-blue-100 text-blue-800' };
      default: return { icon: '🌐', label: 'Website', color: 'bg-gray-100 text-gray-800' };
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-6">
        <p className="text-red-800">{error}</p>
        <button 
          onClick={loadDashboardData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }
  return (
    <div className="px-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">News Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Monitor your news sources and stay up to date with the latest developments
        </p>
      </div>
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <Globe className="h-8 w-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Sources</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSources}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                <div className="h-3 w-3 bg-green-600 rounded-full"></div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Sources</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeSources}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Articles</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalArticles}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Today</p>
                <p className="text-2xl font-bold text-gray-900">{stats.articlesToday}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">This Week</p>
                <p className="text-2xl font-bold text-gray-900">{stats.articlesThisWeek}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Latest Articles Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Latest Articles</h2>
            <button 
              onClick={loadDashboardData}
              className="flex items-center text-primary-600 hover:text-primary-700 text-sm"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {latestArticles.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p>No articles found. Add some news sources to get started!</p>
            </div>
          ) : (
            latestArticles.map((article) => {
              const sourceDisplay = getSourceTypeDisplay(article.sourceType);
              return (
                <div key={article.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                      {/* Article title with external link */}
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
                          {article.title}
                        </h3>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 flex-shrink-0 text-gray-400 hover:text-gray-600"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      {/* Article summary */}
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                        {article.summary}
                      </p>
                      {/* Metadata row */}
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        {/* Source information */}
                        <span className={`inline-flex items-center px-2 py-1 rounded-full ${sourceDisplay.color}`}>
                          <span className="mr-1">{sourceDisplay.icon}</span>
                          {article.sourceName}
                        </span>
                        {/* Sentiment indicator */}
                        {article.sentiment && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getSentimentColor(article.sentiment)}`}>
                            {article.sentiment}
                          </span>
                        )}
                        {/* Publication time */}
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}
                        </span>
                      </div>
                      {/* Keywords */}
                      {article.keywords && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {article.keywords.split(',').slice(0, 3).map((keyword, index) => (
                            <span
                              key={index}
                              className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              {keyword.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};