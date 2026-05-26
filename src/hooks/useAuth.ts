// Re-export useAuth from context for backwards compatibility
// All components that import from '@/hooks/useAuth' will use the shared context
export { useAuth } from '@/contexts/AuthContext';
