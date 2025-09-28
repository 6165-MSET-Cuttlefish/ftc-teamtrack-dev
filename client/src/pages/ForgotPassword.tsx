import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Mail, ArrowLeft } from 'lucide-react';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    try {
      setMessage('');
      setError('');
      setLoading(true);
      await resetPassword(email);
      setMessage('Check your inbox for further instructions');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-team-dark py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md bg-team-dark border-team-blue-40">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-team-blue">
            Reset Password
          </CardTitle>
          <CardDescription className="text-center text-team-white-60">
            Enter your email address and we'll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-team-white">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-team-white-40" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-team-dark-20 border-team-blue-40 text-team-white placeholder-team-white-40"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-team-blue hover:bg-team-blue/90"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Reset Password'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center">
          <Link 
            to="/login" 
            className="flex items-center text-sm text-team-blue hover:underline"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign In
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ForgotPassword;
