import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Layout, Container } from '@/components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Card,
  CardContent,
  CardFooter,
} from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  Chrome, 
  ArrowRight, 
  Shield,
  Sparkles
} from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout variant="centered" background="gradient">
      <Container size="sm">
        <div className="w-full max-w-md mx-auto space-y-8">
          {/* Logo and Header */}
          <div className="text-center space-y-6">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <div className="flex items-center gap-2.5">
                <svg
                  width="8"
                  height="20"
                  viewBox="0 0 8 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-2 h-5"
                >
                  <path
                    d="M3.9994 0.645596L7.60709 6.46935H0.464233L3.9994 0.645596Z"
                    fill="#537788"
                  />
                  <path
                    d="M4.00005 9.38123L0.392909 7.23372H7.53577L4.00005 9.38123Z"
                    fill="#537788"
                  />
                  <path
                    d="M0.321429 2.31992L3.28571 0.5L0 6.06897L0.321429 2.31992Z"
                    fill="#537788"
                  />
                  <path
                    d="M7.67857 2.31992L4.71429 0.5L8 6.06897L7.67857 2.31992Z"
                    fill="#537788"
                  />
                  <path
                    d="M0.392822 9.24855C0.392822 8.74891 0.92601 8.43006 1.36618 8.66649C1.58053 8.78162 1.71425 9.00524 1.71425 9.24855V18.3817C1.71425 18.6225 1.58325 18.8442 1.37235 18.9604C0.932001 19.203 0.392822 18.8844 0.392822 18.3817V9.24855Z"
                    fill="#537788"
                  />
                  <path
                    d="M2.3681 10.2849C2.37112 9.76044 2.94632 9.44078 3.39332 9.71519C3.59274 9.83762 3.71427 10.0548 3.71427 10.2888V17.1858C3.71427 17.4334 3.58216 17.6622 3.36771 17.786C2.9042 18.0535 2.32529 17.717 2.32837 17.1818L2.3681 10.2849Z"
                    fill="#537788"
                  />
                  <path
                    d="M7.53577 9.26287C7.53577 8.75993 6.9962 8.4414 6.55585 8.68437C6.34516 8.80063 6.21434 9.02223 6.21434 9.26287V18.4077C6.21434 18.6534 6.35068 18.8788 6.5683 18.9929C7.00823 19.2235 7.53577 18.9044 7.53577 18.4077V9.26287Z"
                    fill="#537788"
                  />
                  <path
                    d="M5.6319 10.2849C5.62888 9.76044 5.05368 9.44078 4.60668 9.71519C4.40726 9.83762 4.28573 10.0548 4.28573 10.2888V17.1858C4.28573 17.4334 4.41784 17.6622 4.63229 17.786C5.0958 18.0535 5.67471 17.717 5.67163 17.1818L5.6319 10.2849Z"
                    fill="#537788"
                  />
                </svg>
                <div>
                  <h1 className="text-2xl font-bold font-montserrat italic">TeamTrack</h1>
                  <p className="text-xs text-muted-foreground -mt-1">Performance Analytics</p>
                </div>
              </div>
            </Link>

            <div className="space-y-2">
              <Badge variant="secondary" className="mb-2">
                <Sparkles className="w-3 h-3 mr-1" />
                Welcome Back
              </Badge>
              <h2 className="text-2xl font-bold">Sign in to your account</h2>
              <p className="text-muted-foreground">
                Enter your credentials to access your dashboard
              </p>
            </div>
          </div>

          {/* Login Form */}
          <Card className="card-modern">
            <CardContent className="pt-6 space-y-6">
              {error && (
                <Alert variant="destructive" className="animate-fade-in">
                  <Shield className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <Link
                      to="/forgot-password"
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1 h-9 w-9 p-0 hover:bg-transparent"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 btn-primary-modern"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Signing in...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Sign in
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 btn-secondary-modern"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <Chrome className="mr-2 h-4 w-4" />
                Continue with Google
              </Button>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pb-6">
              <div className="text-sm text-center text-muted-foreground">
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className="text-primary hover:underline font-medium"
                >
                  Sign up for free
                </Link>
              </div>
              
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
                <span>•</span>
                <Link to="/terms" className="hover:text-foreground">Terms</Link>
                <span>•</span>
                <Link to="/help" className="hover:text-foreground">Help</Link>
              </div>
            </CardFooter>
          </Card>
        </div>
      </Container>
    </Layout>
  );
};

export default Login;
