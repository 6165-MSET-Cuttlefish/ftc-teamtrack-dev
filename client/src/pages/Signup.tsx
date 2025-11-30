import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useTheme } from '@/contexts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';

const Signup = () => {
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signup, loginWithGoogle } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.displayName ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password should be at least 6 characters');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await signup(formData.email, formData.password, formData.displayName);
      navigate('/sessions');
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      navigate('/sessions');
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to sign up with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'} py-12 px-4 sm:px-6 lg:px-8`}
    >
      <Card
        className={`w-full max-w-md shadow-2xl border-2 transition-all duration-300 hover:shadow-3xl ${isDarkMode ? 'bg-gradient-to-br from-team-dark via-team-dark to-team-dark-20 border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
      >
        <CardHeader className="space-y-3 pb-6">
          <div className="flex items-center justify-center gap-3">
            <div className="h-8 w-1 bg-team-blue rounded-full"></div>
            <CardTitle className="text-3xl font-bold text-center text-team-blue">
              Create Account
            </CardTitle>
            <div className="h-8 w-1 bg-team-blue rounded-full"></div>
          </div>
          <CardDescription
            className={`text-center text-base ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            Sign up to get started with TeamTrack
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="displayName"
                className={isDarkMode ? 'text-team-white' : 'text-black'}
              >
                Full Name
              </Label>
              <div
                className={`relative rounded-lg ${isDarkMode ? 'bg-team-dark-20' : 'bg-gray-50'}`}
              >
                <User
                  className={`absolute left-4 top-3.5 h-5 w-5 transition-colors ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}
                />
                <Input
                  id="displayName"
                  name="displayName"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.displayName}
                  onChange={handleChange}
                  className={`h-12 pl-12 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-lg ${isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40 focus:border-team-blue' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-team-blue'}`}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="email"
                className={isDarkMode ? 'text-team-white' : 'text-black'}
              >
                Email
              </Label>
              <div
                className={`relative rounded-lg ${isDarkMode ? 'bg-team-dark-20' : 'bg-gray-50'}`}
              >
                <Mail
                  className={`absolute left-4 top-3.5 h-5 w-5 transition-colors ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}
                />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`h-12 pl-12 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-lg ${isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40 focus:border-team-blue' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-team-blue'}`}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className={isDarkMode ? 'text-team-white' : 'text-black'}
              >
                Password
              </Label>
              <div
                className={`relative rounded-lg ${isDarkMode ? 'bg-team-dark-20' : 'bg-gray-50'}`}
              >
                <Lock
                  className={`absolute left-4 top-3.5 h-5 w-5 transition-colors ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}
                />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`h-12 pl-12 pr-12 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-lg ${isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40 focus:border-team-blue' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-team-blue'}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-4 top-3.5 h-5 w-5 transition-all ${isDarkMode ? 'text-team-white-40 hover:text-team-blue hover:scale-110' : 'text-gray-400 hover:text-gray-600 hover:scale-110'}`}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className={isDarkMode ? 'text-team-white' : 'text-black'}
              >
                Confirm Password
              </Label>
              <div
                className={`relative rounded-lg ${isDarkMode ? 'bg-team-dark-20' : 'bg-gray-50'}`}
              >
                <Lock
                  className={`absolute left-4 top-3.5 h-5 w-5 transition-colors ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}
                />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`h-12 pl-12 pr-12 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-lg ${isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40 focus:border-team-blue' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-team-blue'}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={`absolute right-4 top-3.5 h-5 w-5 transition-all ${isDarkMode ? 'text-team-white-40 hover:text-team-blue hover:scale-110' : 'text-gray-400 hover:text-gray-600 hover:scale-110'}`}
                >
                  {showConfirmPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] bg-team-blue hover:bg-team-blue/90 text-white"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span
                className={`w-full border-t ${isDarkMode ? 'border-team-blue-40' : 'border-team-blue/60'}`}
              />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span
                className={`${isDarkMode ? 'bg-team-dark text-team-white-40' : 'bg-white text-team-blue-40'} px-2`}
              >
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className={`w-full ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20 text-team-white hover:bg-team-blue-10' : 'border-team-blue/60 bg-[#FEFEFE] text-black hover:bg-team-blue/10'}`}
            onClick={handleGoogleSignUp}
            disabled={loading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>
        </CardContent>

        <CardFooter className="flex justify-center">
          <div
            className={`text-sm text-center ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
          >
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-team-blue hover:underline font-medium"
            >
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Signup;
