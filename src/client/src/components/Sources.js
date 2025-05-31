import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Sources = () => {
  const [sources, setSources] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '', url: '', type: 'website', scanFrequency: 30, maxResults: 3
  });

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      const response = await axios.get('/api/v1/sources');
      setSources(response.data.data);
    } catch (error) {
      console.error('Error loading sources:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/v1/sources', formData);
      setFormData({ name: '', url: '', type: 'website', scanFrequency: 30, maxResults: 3 });
      setShowForm(false);
      loadSources();
    } catch (error) {
      alert('Error adding source: ' + (error.response?.data?.error || error.message));
    }
  };

  const deleteSource = async (id) => {
    if (window.confirm('Are you sure you want to delete this source?')) {
      try {
        await axios.delete(`/api/v1/sources/${id}`);
        loadSources();
      } catch (error) {
        alert('Error deleting source');
      }
    }
  };

  const testSource = async (id) => {
    try {
      const response = await axios.post(`/api/v1/sources/${id}/test`);
      alert(`Test successful! Found ${response.data.data.articlesFound} articles.`);
    } catch (error) {
      alert('Test failed: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">News Sources</h2>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add Source
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-medium mb-4">Add New Source</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="website">Website</option>
                  <option value="twitter">Twitter</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">URL</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({...formData, url: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="https://example.com or https://twitter.com/username"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Scan Frequency (minutes)</label>
                <input
                  type="number"
                  min="5"
                  value={formData.scanFrequency}
                  onChange={(e) => setFormData({...formData, scanFrequency: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Max Results</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.maxResults}
                  onChange={(e) => setFormData({...formData, maxResults: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Source
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium">Configured Sources ({sources.length})</h3>
        </div>
        {sources.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No sources configured. Add your first source to start collecting news!
          </div>
        ) : (
          <div className="divide-y">
            {sources.map(source => (
              <div key={source.id} className="px-6 py-4 flex justify-between items-center">
                <div>
                  <h4 className="font-medium">{source.name}</h4>
                  <p className="text-sm text-gray-600">{source.url}</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                    <span className={`px-2 py-1 rounded-full ${
                      source.type === 'twitter' ? 'bg-blue-100 text-blue-800' :
                      source.type === 'facebook' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {source.type}
                    </span>
                    <span>Every {source.scanFrequency} min</span>
                    <span>Max {source.maxResults} results</span>
                    <span className={`${source.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      {source.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => testSource(source.id)}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => deleteSource(source.id)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sources;