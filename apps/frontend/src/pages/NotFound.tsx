import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';

export default function NotFound() {
  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold text-gray-900">Page not found</h1>
      <p className="text-sm text-gray-600">The page you are looking for does not exist.</p>
      <Link to="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">
        Go to Estudio
      </Link>
    </AuthLayout>
  );
}
