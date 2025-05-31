import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Radio, 
  FileText, 
  BarChart3, 
  Settings,
  Search,
  Bell
} from 'lucide-react';
interface LayoutProps {
  children: React.ReactNode;
}
/**
 * Layout component that provides the main navigation structure
 * This wraps all pages and provides consistent navigation experience
 */
export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  // Navigation items configuration
  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Sources', href: '/sources', icon: Radio },
    { name: 'Articles', href: '/articles', icon: FileText },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  ];
  /**
   * Check if the current route matches the navigation item
   * This helps highlight the active navigation state
   */
  const isActiveRoute = (href: string) => {
    return location.pathname === href;
  };
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar Navigation */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col flex-grow pt-5 bg-white border-r border-gray-200 overflow-y-auto">
          {/* Logo and Brand */}
          <div className="flex items-center flex-shrink-0 px-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div className="ml-3">
                <h1 className="text-lg font-semibold text-gray-900">Šponar News</h1>
                <p className="text-xs text-gray-500">Hot News Aggregator</p>
              </div>
            </div>
          </div>
          {/* Navigation Menu */}
          <div className="mt-8 flex-grow flex flex-col">
            <nav className="flex-1 px-2 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = isActiveRoute(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                      active
                        ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon
                      className={`mr-3 h-5 w-5 transition-colors ${
                        active ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            {/* Status indicator at bottom of sidebar */}
            <div className="flex-shrink-0 px-4 py-4 border-t border-gray-200">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="ml-2 text-xs text-gray-500">System Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top Header Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex justify-between items-center px-6 py-4">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold text-gray-900 capitalize">
                {location.pathname.replace('/', '') || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center space-x-4">
              {/* Search functionality - could be enhanced later */}
              <div className="hidden md:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search articles..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              {/* Notifications indicator */}
              <button className="p-2 text-gray-400 hover:text-gray-500 relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400"></span>
              </button>
              {/* Settings access */}
              <button className="p-2 text-gray-400 hover:text-gray-500">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};